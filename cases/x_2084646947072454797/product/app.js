/* ============================================================
   Blue Marble — procedurally generated planet
   Perlin-noise terrain, biome coloring, day/night, atmosphere
   Requires THREE (r128) global.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- seeded PRNG ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Perlin noise ---------------- */
  var GRAD3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerpN(a, b, t) { return a + t * (b - a); }

  function Perlin(seed) {
    var rand = mulberry32(seed);
    var p = new Uint8Array(256), i, j, tmp;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      j = (rand() * (i + 1)) | 0;
      tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    this.perm12 = new Uint8Array(512);
    for (i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.perm12[i] = this.perm[i] % 12;
    }
  }
  Perlin.prototype.n3 = function (x, y, z) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    var u = fade(x), v = fade(y), w = fade(z);
    var p = this.perm, p12 = this.perm12, g = GRAD3;
    var A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    var B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerpN(
      lerpN(
        lerpN(g[p12[AA]][0] * x + g[p12[AA]][1] * y + g[p12[AA]][2] * z,
              g[p12[BA]][0] * (x - 1) + g[p12[BA]][1] * y + g[p12[BA]][2] * z, u),
        lerpN(g[p12[AB]][0] * x + g[p12[AB]][1] * (y - 1) + g[p12[AB]][2] * z,
              g[p12[BB]][0] * (x - 1) + g[p12[BB]][1] * (y - 1) + g[p12[BB]][2] * z, u), v),
      lerpN(
        lerpN(g[p12[AA + 1]][0] * x + g[p12[AA + 1]][1] * y + g[p12[AA + 1]][2] * (z - 1),
              g[p12[BA + 1]][0] * (x - 1) + g[p12[BA + 1]][1] * y + g[p12[BA + 1]][2] * (z - 1), u),
        lerpN(g[p12[AB + 1]][0] * x + g[p12[AB + 1]][1] * (y - 1) + g[p12[AB + 1]][2] * (z - 1),
              g[p12[BB + 1]][0] * (x - 1) + g[p12[BB + 1]][1] * (y - 1) + g[p12[BB + 1]][2] * (z - 1), u), v),
      w);
  };
  Perlin.prototype.fbm = function (x, y, z, oct, pers, lac) {
    var a = 1, f = 1, s = 0, n = 0;
    for (var i = 0; i < oct; i++) {
      s += a * this.n3(x * f, y * f, z * f);
      n += a; a *= pers; f *= lac;
    }
    return s / n;
  };

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smoothstep(a, b, x) {
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  /* ---------------- config ---------------- */
  var R = 1.6;                 // planet radius
  var ELEV_AMP = 0.052;        // displacement amplitude (fraction of R handled in build)
  var DETAIL = 64;             // icosphere edge subdivisions (r128: segments per edge)

  var state = {
    seed: (Math.random() * 1e9) | 0,
    roughness: 0.55,
    seaLevel: 0.58,            // normalized 0..1
    rotSpeed: 0.35,            // 0..1
    mode: 0,                   // 0 day, 1 day-night, 2 temperature, 3 humidity
    cycle: true,
    atmosphere: true,
    specular: true
  };

  var perlin = null;
  var terrainDirty = true;

  function terrainHeight(x, y, z, rough) {
    var f = 1.5;
    var e = perlin.fbm(x * f + 11.3, y * f - 7.1, z * f + 3.7, 5, 0.40 + rough * 0.30, 2.03);
    // ridged mountains
    var m = 0, amp = 0.5, fr = f * 3.3;
    for (var i = 0; i < 4; i++) {
      var n = perlin.n3(x * fr - 5.2, y * fr + 9.4, z * fr - 1.7);
      m += amp * (1 - Math.abs(n));
      amp *= 0.5; fr *= 2.13;
    }
    m = Math.pow(Math.max(m, 0), 1.7) * (0.16 + rough * 0.55);
    return e * 0.9 + m * 0.85 - 0.14 * rough;
  }

  /* ---------------- renderer / scene ---------------- */
  var canvas = document.getElementById('scene');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    document.getElementById('nogl').style.display = 'flex';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x04060d, 1);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);

  /* camera orbit (custom, minimal) */
  var camTheta = 0.55, camPhi = 1.12, camDist = 5.6;
  (function () {
    var dragging = false, px = 0, py = 0;
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; px = e.clientX; py = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      camTheta -= (e.clientX - px) * 0.0052;
      camPhi -= (e.clientY - py) * 0.0052;
      camPhi = Math.max(0.12, Math.min(Math.PI - 0.12, camPhi));
      px = e.clientX; py = e.clientY;
    });
    window.addEventListener('pointerup', function () { dragging = false; });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      camDist *= 1 + Math.sign(e.deltaY) * 0.08;
      camDist = Math.max(2.9, Math.min(11, camDist));
    }, { passive: false });
  })();

  /* ---------------- starfield ---------------- */
  (function buildStars() {
    var N = 1800, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      var s = Math.sqrt(1 - u * u), r = 45 + Math.random() * 45;
      pos[i * 3] = s * Math.cos(th) * r;
      pos[i * 3 + 1] = u * r;
      pos[i * 3 + 2] = s * Math.sin(th) * r;
      var b = 0.35 + Math.random() * 0.65;
      var tint = Math.random();
      col[i * 3] = b * (tint < 0.25 ? 0.8 : 1.0);
      col[i * 3 + 1] = b * 0.95;
      col[i * 3 + 2] = b * (tint > 0.75 ? 1.0 : 0.9);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({
      size: 1.7, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0.9, depthWrite: false
    });
    scene.add(new THREE.Points(g, m));
  })();

  /* ---------------- sun (visual sprite) ---------------- */
  function makeGlowTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,250,230,1)');
    grd.addColorStop(0.25, 'rgba(255,236,190,0.85)');
    grd.addColorStop(0.6, 'rgba(255,210,130,0.22)');
    grd.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c);
    return t;
  }
  var sunTex = makeGlowTexture();
  var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  }));
  sunSprite.scale.set(7, 7, 1);
  scene.add(sunSprite);
  var sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35
  }));
  sunHalo.scale.set(18, 18, 1);
  scene.add(sunHalo);

  /* ---------------- planet shaders ---------------- */
  var planetVert = [
    'attribute float aElev;',
    'attribute float aTemp;',
    'attribute float aHum;',
    'attribute float aCity;',
    'attribute float aDetail;',
    'varying float vElev; varying float vTemp; varying float vHum;',
    'varying float vCity; varying float vDetail;',
    'varying vec3 vNormalW; varying vec3 vPosW;',
    'void main(){',
    '  vElev = aElev; vTemp = aTemp; vHum = aHum; vCity = aCity; vDetail = aDetail;',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vPosW = wp.xyz;',
    '  vNormalW = normalize(mat3(modelMatrix) * normal);',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var planetFrag = [
    'uniform float uSeaLevel;',
    'uniform int uMode;',           // 0 day, 1 day-night, 2 temperature, 3 humidity
    'uniform vec3 uSunDir;',
    'uniform float uSpec;',
    'varying float vElev; varying float vTemp; varying float vHum;',
    'varying float vCity; varying float vDetail;',
    'varying vec3 vNormalW; varying vec3 vPosW;',
    '',
    'vec3 ramp3(float t, vec3 a, vec3 b, vec3 c){',
    '  t = clamp(t, 0.0, 1.0);',
    '  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, t * 2.0 - 1.0);',
    '}',
    'vec3 ramp5(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4){',
    '  t = clamp(t, 0.0, 1.0);',
    '  if (t < 0.25) return mix(c0, c1, t / 0.25);',
    '  if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);',
    '  if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);',
    '  return mix(c3, c4, (t - 0.75) / 0.25);',
    '}',
    '// bright shallow cyan -> deep navy',
    'vec3 oceanColor(float depth, float detail){',
    '  float t = clamp(depth / 0.30, 0.0, 1.0);',
    '  vec3 c = ramp3(t,',
    '    vec3(0.20, 0.88, 0.80),',   // shallow: bright cyan-turquoise
    '    vec3(0.07, 0.53, 0.79),',   // mid blue
    '    vec3(0.025, 0.17, 0.50));', // deep: vivid navy
    '  c *= 0.94 + detail * 0.10;',
    '  return c;',
    '}',
    '// natural land biomes: forest / arid / grassland / snow / rock',
    'vec3 landColor(float temp, float hum, float elev, float detail){',
    '  vec3 snow   = vec3(0.93, 0.95, 0.98);',
    '  vec3 rock   = vec3(0.45, 0.39, 0.33);',
    '  vec3 forest = vec3(0.09, 0.34, 0.13);',
    '  vec3 jungle = vec3(0.05, 0.38, 0.17);',
    '  vec3 grass  = vec3(0.57, 0.56, 0.20);',
    '  vec3 desert = vec3(0.81, 0.65, 0.39);',
    '  vec3 arid   = vec3(0.55, 0.43, 0.28);',
    '  vec3 col = grass;',
    '  float forestW = smoothstep(0.42, 0.62, hum) * smoothstep(0.10, 0.26, temp);',
    '  float jungleW = smoothstep(0.66, 0.85, hum) * smoothstep(0.55, 0.78, temp);',
    '  col = mix(col, forest, forestW);',
    '  col = mix(col, jungle, jungleW * 0.85);',
    '  float aridW = smoothstep(0.50, 0.72, temp) * (1.0 - smoothstep(0.26, 0.50, hum));',
    '  vec3 aridCol = mix(arid, desert, smoothstep(0.55, 0.82, temp));',
    '  col = mix(col, aridCol, aridW);',
    '  float rockW = smoothstep(0.68, 0.85, elev);',
    '  col = mix(col, rock, rockW);',
    '  float snowLine = 0.30 + detail * 0.08;',
    '  float snowW = 1.0 - smoothstep(snowLine - 0.05, snowLine + 0.05, temp);',
    '  snowW = max(snowW, smoothstep(0.84, 0.95, elev));',
    '  col = mix(col, snow, snowW);',
    '  col *= 0.92 + detail * 0.16;',
    '  return col;',
    '}',
    'void main(){',
    '  vec3 N = normalize(vNormalW);',
    '  vec3 V = normalize(cameraPosition - vPosW);',
    '  vec3 L = normalize(uSunDir);',
    '  float ndl = dot(N, L);',
    '  float dayF = smoothstep(-0.10, 0.22, ndl);',
    '  float oceanM = 1.0 - step(uSeaLevel, vElev);',
    '  vec3 base = oceanColor(uSeaLevel - vElev, vDetail) * oceanM',
    '             + landColor(vTemp, vHum, vElev, vDetail) * (1.0 - oceanM);',
    '  vec3 col;',
    '  if (uMode == 2) {',
    '    // ---- temperature map ----',
    '    float t = vTemp * (oceanM > 0.5 ? 0.8 : 1.0);',
    '    col = ramp5(t,',
    '      vec3(0.03, 0.09, 0.55),',
    '      vec3(0.05, 0.55, 0.85),',
    '      vec3(0.15, 0.75, 0.35),',
    '      vec3(0.95, 0.85, 0.15),',
    '      vec3(0.90, 0.15, 0.08)) * 0.92 + vec3(0.05);',
    '    if (oceanM > 0.5) col = mix(col, vec3(0.05, 0.30, 0.65), 0.35);',
    '  } else if (uMode == 3) {',
    '    // ---- humidity map ----',
    '    col = ramp5(vHum,',
    '      vec3(0.78, 0.62, 0.38),',
    '      vec3(0.85, 0.72, 0.40),',
    '      vec3(0.55, 0.70, 0.30),',
    '      vec3(0.15, 0.55, 0.30),',
    '      vec3(0.05, 0.40, 0.60)) * 0.92 + vec3(0.05);',
    '    if (oceanM > 0.5) col = vec3(0.06, 0.35, 0.62);',
    '  } else if (uMode == 0) {',
    '    // ---- day: fully bright, gentle shading, subtle specular ----',
    '    float shade = 0.72 + 0.28 * max(ndl, 0.0);',
    '    col = base * shade * 1.10;',
    '    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '    col += vec3(0.22, 0.50, 1.0) * rim * 0.16;',
    '    if (oceanM > 0.5) {',
    '      vec3 H = normalize(L + V);',
    '      float spec = pow(max(dot(N, H), 0.0), 220.0);',
    '      col += vec3(1.0, 0.98, 0.92) * spec * uSpec;',
    '    }',
    '  } else {',
    '    // ---- day-night cycle ----',
    '    vec3 dayCol = base * (0.14 + 1.05 * max(ndl, 0.0));',
    '    vec3 nightCol = base * 0.05 + vec3(0.004, 0.008, 0.024);',
    '    float cityM = smoothstep(0.74, 0.84, vCity) * (1.0 - oceanM) * smoothstep(0.20, 0.45, vHum);',
    '    nightCol += vec3(1.0, 0.70, 0.35) * cityM * 0.42;',
    '    col = mix(nightCol, dayCol, dayF);',
    '    vec3 H = normalize(L + V);',
    '    float spec = pow(max(dot(N, H), 0.0), 140.0) * oceanM * dayF;',
    '    col += vec3(1.0, 0.98, 0.92) * spec * uSpec;',
    '    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '    col += vec3(0.22, 0.50, 1.0) * rim * (0.06 + 0.22 * dayF);',
    '  }',
    '  if (uMode == 2 || uMode == 3) col *= 0.85 + 0.15 * max(ndl, 0.0);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var planetUniforms = {
    uSeaLevel: { value: state.seaLevel },
    uMode: { value: state.mode },
    uSunDir: { value: new THREE.Vector3(1, 0.3, 0.4).normalize() },
    uSpec: { value: 0.32 }
  };

  var planetGroup = new THREE.Group();
  planetGroup.rotation.z = -0.41; // axial tilt ~23.5 deg
  scene.add(planetGroup);

  var planetMesh = null;
  var planetMat = new THREE.ShaderMaterial({
    vertexShader: planetVert,
    fragmentShader: planetFrag,
    uniforms: planetUniforms
  });
  planetGroup.add(planetMesh ? planetMesh : new THREE.Mesh(new THREE.BufferGeometry(), planetMat));
  planetMesh = planetGroup.children[0];

  /* ---------------- atmosphere ---------------- */
  var atmMat = new THREE.ShaderMaterial({
    vertexShader: [
      'varying vec3 vN; varying vec3 vW;',
      'void main(){',
      '  vN = normalize(mat3(modelMatrix) * normal);',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vW = wp.xyz;',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uColor; uniform vec3 uSunDir; uniform float uStrength;',
      'varying vec3 vN; varying vec3 vW;',
      'void main(){',
      '  vec3 n = normalize(vN);',
      '  vec3 V = normalize(cameraPosition - vW);',
      '  float d = dot(n, V);',
      // d is ~-0.55 at planet limb, ~0 at glow silhouette: keep peak at the
      // limb and fall off outward; clamp to 1.0 so it can never blow out
      '  float intensity = pow(clamp(0.62 - d, 0.0, 1.0), 3.2);',
      '  float sunF = 0.30 + 0.85 * smoothstep(-0.35, 0.55, dot(n, normalize(uSunDir)));',
      '  gl_FragColor = vec4(uColor * intensity * sunF * uStrength, 1.0);',
      '}'
    ].join('\n'),
    uniforms: {
      uColor: { value: new THREE.Color(0.35, 0.62, 1.0) },
      uSunDir: { value: new THREE.Vector3(1, 0.3, 0.4).normalize() },
      uStrength: { value: 0.85 }
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  var atmMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.22, 4), atmMat);
  planetGroup.add(atmMesh);

  /* ---------------- geometry helpers ---------------- */
  function weld(geometry) {
    var pos = geometry.attributes.position;
    var map = {};
    var newPos = [];
    var index = [];
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var k = Math.round(x * 1e4) + '_' + Math.round(y * 1e4) + '_' + Math.round(z * 1e4);
      var idx = map[k];
      if (idx === undefined) {
        idx = newPos.length / 3;
        map[k] = idx;
        newPos.push(x, y, z);
      }
      index.push(idx);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
    g.setIndex(index);
    return g;
  }

  /* ---------------- planet build ---------------- */
  var v = new THREE.Vector3();
  function buildPlanet() {
    perlin = new Perlin(state.seed);
    var geo = weld(new THREE.IcosahedronGeometry(R, DETAIL));
    var pos = geo.attributes.position;
    var count = pos.count;
    var raw = new Float32Array(count);
    var i;

    for (i = 0; i < count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      raw[i] = terrainHeight(v.x, v.y, v.z, state.roughness);
    }
    // percentile-normalize so the sea-level slider behaves predictably
    var sorted = Array.prototype.slice.call(raw).sort(function (a, b) { return a - b; });
    var lo = sorted[(count * 0.02) | 0];
    var hi = sorted[(count * 0.985) | 0];
    var range = Math.max(hi - lo, 1e-5);

    var elev = new Float32Array(count);
    var temp = new Float32Array(count);
    var hum = new Float32Array(count);
    var city = new Float32Array(count);
    var det = new Float32Array(count);

    for (i = 0; i < count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      var x = v.x, y = v.y, z = v.z;
      var e = (raw[i] - lo) / range;
      elev[i] = e;

      // temperature: hot equator -> cold poles, with noise + altitude cooling
      var t = 1 - Math.pow(Math.abs(y), 1.25);
      t += perlin.fbm(x * 2.3 - 31.7, y * 2.3 + 17.2, z * 2.3 - 8.9, 3, 0.5, 2.1) * 0.16;
      t -= Math.max(0, e - 0.75) * 0.35;
      temp[i] = clamp01(t);

      // humidity: independent noise channel, drier at altitude
      var h = perlin.fbm(x * 2.8 + 47.1, y * 2.8 - 23.6, z * 2.8 + 29.3, 4, 0.5, 2.0) * 0.5 + 0.5;
      h *= 1 - smoothstep(0.55, 0.95, e) * 0.55;
      hum[i] = clamp01(h);

      // city-light mask: high-frequency clusters
      var cn = perlin.fbm(x * 24.0 + 91.7, y * 24.0 - 53.2, z * 24.0 + 7.8, 3, 0.55, 2.2) * 0.5 + 0.5;
      city[i] = clamp01((cn - 0.38) * 3.2);

      // detail noise for color variation / ocean swirls
      det[i] = clamp01(perlin.fbm(x * 5.5 - 13.4, y * 5.5 + 41.9, z * 5.5 - 27.5, 4, 0.55, 2.2) * 0.5 + 0.5);

      // displace
      var r = R + (e - 0.5) * 2 * ELEV_AMP * R;
      pos.setXYZ(i, x * r, y * r, z * r);
    }

    geo.setAttribute('aElev', new THREE.BufferAttribute(elev, 1));
    geo.setAttribute('aTemp', new THREE.BufferAttribute(temp, 1));
    geo.setAttribute('aHum', new THREE.BufferAttribute(hum, 1));
    geo.setAttribute('aCity', new THREE.BufferAttribute(city, 1));
    geo.setAttribute('aDetail', new THREE.BufferAttribute(det, 1));
    geo.computeVertexNormals();

    planetMesh.geometry.dispose();
    planetMesh.geometry = geo;
  }

  /* ---------------- UI ---------------- */
  var $ = function (id) { return document.getElementById(id); };

  var MODES = [
    { name: 'Day', info: 'True-color daytime view — bright blue oceans (cyan shallows, navy depths) and natural land biomes.' },
    { name: 'Day-Night', info: 'Live day/night shading: terminator line, darkened night side with city lights, subtle ocean glint.' },
    { name: 'Temperature', info: 'Mean surface temperature — cold polar blues to hot equatorial reds.' },
    { name: 'Humidity', info: 'Surface humidity — arid tan/browns through grassy greens to saturated oceanic blues.' }
  ];

  var roughSlider = $('rough'), seaSlider = $('sea'), rotSlider = $('rot');
  var roughVal = $('roughVal'), seaVal = $('seaVal'), rotVal = $('rotVal');

  function syncLabels() {
    roughVal.textContent = Math.round(state.roughness * 100) + '%';
    seaVal.textContent = Math.round(state.seaLevel * 100) + '%';
    rotVal.textContent = Math.round(state.rotSpeed * 100) + '%';
  }

  var rebuildTimer = null;
  function scheduleRebuild() {
    terrainDirty = true;
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(function () { buildPlanet(); terrainDirty = false; }, 140);
  }

  $('regen').addEventListener('click', function () {
    state.seed = (Math.random() * 1e9) | 0;
    $('seed').textContent = '#' + state.seed;
    perlin = null;
    buildPlanet();
    terrainDirty = false;
  });

  roughSlider.addEventListener('input', function () {
    state.roughness = roughSlider.value / 100;
    syncLabels();
    scheduleRebuild();
  });
  seaSlider.addEventListener('input', function () {
    state.seaLevel = seaSlider.value / 100;
    planetUniforms.uSeaLevel.value = state.seaLevel;
    syncLabels();
  });
  rotSlider.addEventListener('input', function () {
    state.rotSpeed = rotSlider.value / 100;
    syncLabels();
  });

  // mode buttons
  var segButtons = document.querySelectorAll('#modes button');
  Array.prototype.forEach.call(segButtons, function (btn) {
    btn.addEventListener('click', function () {
      var m = parseInt(btn.getAttribute('data-mode'), 10);
      state.mode = m;
      planetUniforms.uMode.value = m;
      Array.prototype.forEach.call(segButtons, function (b) { b.classList.toggle('active', b === btn); });
      $('modeInfo').textContent = MODES[m].info;
      if (m === 2 || m === 3) {
        $('legend').className = 'show ' + (m === 2 ? 'temp' : 'hum');
        $('legMin').textContent = m === 2 ? 'Cold' : 'Dry';
        $('legMax').textContent = m === 2 ? 'Hot' : 'Wet';
      } else {
        $('legend').className = '';
      }
    });
  });

  // toggles
  $('cycle').addEventListener('change', function () { state.cycle = $('cycle').checked; });
  $('atmo').addEventListener('change', function () { state.atmosphere = $('atmo').checked; });
  $('spec').addEventListener('change', function () { state.specular = $('spec').checked; });

  window.addEventListener('resize', onResize);
  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ---------------- animation ---------------- */
  var sunAngle = -0.45;
  var clock = new THREE.Clock();
  var spin = 0;

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);

    // planet spin
    spin += state.rotSpeed * 0.85 * dt;
    planetMesh.rotation.y = spin;

    // sun / day-night cycle
    if (state.cycle) sunAngle += 0.22 * dt;
    var sd = planetUniforms.uSunDir.value;
    sd.set(Math.cos(sunAngle), 0.30, Math.sin(sunAngle)).normalize();
    atmMat.uniforms.uSunDir.value.copy(sd);
    sunSprite.position.copy(sd).multiplyScalar(30);
    sunHalo.position.copy(sd).multiplyScalar(30);

    // toggles
    atmMesh.visible = state.atmosphere;
    planetUniforms.uSpec.value = state.specular ? 0.32 : 0.0;

    // camera
    camera.position.set(
      camDist * Math.sin(camPhi) * Math.sin(camTheta),
      camDist * Math.cos(camPhi),
      camDist * Math.sin(camPhi) * Math.cos(camTheta));
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  /* ---------------- init ---------------- */
  onResize();
  syncLabels();
  $('seed').textContent = '#' + state.seed;
  buildPlanet();
  animate();
})();
