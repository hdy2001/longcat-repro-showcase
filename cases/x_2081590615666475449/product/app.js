/* ============================================================
   GHIBLI MEADOW — DUSK
   A Ghibli-style 3D interactive world.
   - 260k GPU-instanced grass blades with spatial wind field
   - Multi-arch stone viaduct over a river gorge
   - Low-poly trees, steam train with particles
   - Low sun, long shadows, volumetric-style mist, watercolor grade
   - WASD+mouse / fly mode / cinematic mode / HUD
   Fully procedural — zero external resources.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- seeded RNG + noise ---------------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20260923);

  function hash2(ix, iz) {
    let h = (ix * 374761393 + iz * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  }
  function vnoise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz);
    const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }
  function fbm(x, z, oct) {
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) {
      v += vnoise(x * f, z * f) * amp;
      tot += amp; amp *= 0.5; f *= 2.03;
    }
    return v / tot; // ~[-1,1]
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, t) {
    t = clamp((t - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* ---------------- world layout constants ---------------- */
  const RIVER_PTS = [
    [-420, -520], [-200, -445], [-70, -470], [-10, -395], [28, -300],
    [4, -190], [-4, -90], [10, -30], [26, 60], [95, 150], [120, 260],
    [60, 360], [-40, 440], [-110, 520]
  ];
  const BRIDGE_S = 0.5;          // river param where the viaduct crosses
  const GORGE_HALF = 15;         // full carve half-width
  const GORGE_FADE = 34;         // carve fade distance
  const GORGE_DEEP = 13;         // extra depth at bridge
  const WATER_Y = -3.4;
  const GRASS_COUNT = 500000;

  /* ---------------- river curve ---------------- */
  const riverCurve = new THREE.CatmullRomCurve3(
    RIVER_PTS.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'catmullrom', 0.5);
  const RIVER_SAMPLES = 240;
  const riverPts = riverCurve.getSpacedPoints(RIVER_SAMPLES); // Vector3[], y=0

  // coarse height grid for fast placement queries (bilinear lookup)
  const HG_RES = 400, HG_MIN = -240, HG_CELL = 480 / HG_RES;
  const hGrid = new Float32Array(HG_RES * HG_RES);
  for (let iz = 0; iz < HG_RES; iz++) {
    for (let ix = 0; ix < HG_RES; ix++) {
      hGrid[iz * HG_RES + ix] = terrainH(HG_MIN + (ix + 0.5) * HG_CELL, HG_MIN + (iz + 0.5) * HG_CELL);
    }
  }
  function heightAt(x, z) {
    const fx = (x - HG_MIN) / HG_CELL - 0.5, fz = (z - HG_MIN) / HG_CELL - 0.5;
    if (fx < 0 || fz < 0 || fx >= HG_RES - 1 || fz >= HG_RES - 1) return terrainH(x, z);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const a = hGrid[iz * HG_RES + ix], b = hGrid[iz * HG_RES + ix + 1];
    const c = hGrid[(iz + 1) * HG_RES + ix], d = hGrid[(iz + 1) * HG_RES + ix + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  // distance from (x,z) to river polyline + param s in [0,1]
  function riverInfo(x, z) {
    let best = 1e12, bi = 0;
    for (let i = 0; i <= RIVER_SAMPLES; i++) {
      const p = riverPts[i];
      const dx = x - p.x, dz = z - p.z;
      const d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    return { d: Math.sqrt(best), s: bi / RIVER_SAMPLES };
  }

  /* ---------------- terrain height field ---------------- */
  function terrainH(x, z) {
    let h = 12 * fbm(x * 0.0042 + 13.7, z * 0.0042 + 91.2, 4)
          + 5.0 * fbm(x * 0.0130 + 7.3, z * 0.0130 + 3.1, 3)
          + 1.6 * fbm(x * 0.0470 + 1.7, z * 0.0470 + 5.9, 2);
    // distant rim mountains
    const dc = Math.hypot(x, z);
    const rim = smoothstep(330, 540, dc);
    h += rim * (70 + 55 * fbm(x * 0.006 + 31.1, z * 0.006 + 77.7, 3));
    // river gorge carve
    const ri = riverInfo(x, z);
    const g = Math.pow(Math.max(0, Math.cos((ri.s - BRIDGE_S) * Math.PI * 2 / 0.22)), 2);
    const carve = smoothstep(GORGE_FADE, GORGE_HALF * 0.55, ri.d);
    const depth = 2.6 + GORGE_DEEP * g;
    h -= depth * carve;
    // flattened riverbed
    const bed = -4.6 - GORGE_DEEP * g * 0.8;
    const bedMix = smoothstep(GORGE_HALF * 0.9, GORGE_HALF * 0.3, ri.d);
    h = lerp(h, Math.min(h, bed), bedMix);
    // slightly raised banks near the gorge
    h += 3.5 * g * smoothstep(GORGE_FADE * 1.6, GORGE_FADE * 0.8, ri.d) * (1 - carve);
    return h;
  }

  /* ---------------- bridge ---------------- */
  const bridgeCenter = riverCurve.getPointAt(BRIDGE_S);
  const bridgeTan = riverCurve.getTangentAt(BRIDGE_S);
  const bankH = Math.min(
    terrainH(bridgeCenter.x - 52, bridgeCenter.z),
    terrainH(bridgeCenter.x + 52, bridgeCenter.z));
  const DECK_TOP = bankH - 1.6;
  const BR_ROT = Math.atan2(-bridgeTan.x, -bridgeTan.z); // local +x maps to bridge axis (perp to river)
  const BR_NARCH = 4, BR_ARCH_W = 12, BR_PIER_W = 8.6, BR_W = 7.2;
  const BR_LEN = BR_NARCH * BR_ARCH_W + (BR_NARCH + 1) * BR_PIER_W; // 92.4
  const BR_BOTTOM = DECK_TOP - 34;
  const BR_ARCH_SPRING = BR_BOTTOM + 18;   // arch springing line (local y)

  /* ---------------- track spline ---------------- */
  // distance to bridge axis segment (in world xz)
  function distToBridge(x, z) {
    // bridge axis: through bridgeCenter, direction perpendicular to river tangent
    const dx = -bridgeTan.z, dz = bridgeTan.x; // perpendicular unit-ish
    const px = x - bridgeCenter.x, pz = z - bridgeCenter.z;
    const along = px * dx + pz * dz;
    const halfL = BR_LEN / 2 + 14;
    const ac = clamp(along, -halfL, halfL);
    const cx = bridgeCenter.x + dx * ac, cz = bridgeCenter.z + dz * ac;
    return Math.hypot(x - cx, z - cz);
  }
  function trackGroundY(x, z) {
    if (distToBridge(x, z) < 26) return DECK_TOP + 0.82;
    return terrainH(x, z) + 0.18;
  }
  const TRACK_CTRL = [
    [-300, -86], [-210, -78], [-130, -62], [-72, -44], [-44, -33],
    [-16, -30.5], [16, -30.5], [46, -30], [76, -32], [150, -22],
    [240, 0], [315, 70], [340, 165], [285, 255], [170, 295],
    [35, 305], [-75, 275], [-175, 215], [-255, 130], [-305, 35]
  ];
  const trackCtrlV3 = TRACK_CTRL.map(p => new THREE.Vector3(p[0], trackGroundY(p[0], p[1]), p[1]));
  const trackCurve = new THREE.CatmullRomCurve3(trackCtrlV3, true, 'catmullrom', 0.5);
  const TRACK_LEN = trackCurve.getLength();

  /* ---------------- renderer / scene ---------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const FOG_COLOR = new THREE.Color(0xf3c49b);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0026);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2600);

  /* ---------------- sun & lights ---------------- */
  const SUN_DIR = new THREE.Vector3(-0.80, 0.155, -0.42).normalize();
  const sun = new THREE.DirectionalLight(0xffb469, 2.7);
  sun.position.copy(SUN_DIR).multiplyScalar(700);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -340; sun.shadow.camera.right = 340;
  sun.shadow.camera.top = 340; sun.shadow.camera.bottom = -340;
  sun.shadow.camera.near = 200; sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.00045;
  sun.shadow.normalBias = 2.2;
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0x8a90cc, 0x503c30, 0.55));
  const fill = new THREE.DirectionalLight(0x9aa4d8, 0.3);
  fill.position.set(300, 200, 500);
  scene.add(fill);

  /* ---------------- sky dome ---------------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSunDir: { value: SUN_DIR },
      uZenith: { value: new THREE.Color(0x6d84b4) },
      uHorizon: { value: new THREE.Color(0xffd9a6) },
      uGround: { value: FOG_COLOR }
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uSunDir, uZenith, uHorizon, uGround;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.12, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(max(h,0.0), 0.5));
        if(d.y < 0.0) col = mix(uHorizon, uGround, clamp(-d.y*6.0,0.0,1.0));
        float s = max(dot(d, uSunDir), 0.0);
        col += vec3(1.0,0.75,0.45)*pow(s, 600.0)*2.2;   // disc
        col += vec3(1.0,0.62,0.30)*pow(s, 18.0)*0.38;   // inner glow
        col += vec3(1.0,0.85,0.62)*pow(s, 3.0)*0.10;    // haze
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat));

  // sun sprite glow
  function makeGlowTexture(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(255,246,225,1)', 'rgba(255,190,120,0.55)'),
    transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  sunSprite.position.copy(SUN_DIR).multiplyScalar(1350);
  sunSprite.scale.setScalar(420);
  scene.add(sunSprite);

  /* ---------------- terrain mesh ---------------- */
  const TER_SIZE = 1100, TER_SEG = 256;
  const terGeo = new THREE.PlaneGeometry(TER_SIZE, TER_SIZE, TER_SEG, TER_SEG);
  terGeo.rotateX(-Math.PI / 2);
  {
    const pos = terGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass1 = new THREE.Color(0x5f9c4c), cGrass2 = new THREE.Color(0x3e7c46);
    const cDry = new THREE.Color(0x93ac54), cRock = new THREE.Color(0x8a7a66);
    const cSand = new THREE.Color(0xbfae7e), cDeep = new THREE.Color(0x4c7a52);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainH(x, z);
      pos.setY(i, h);
      const n1 = fbm(x * 0.02 + 5, z * 0.02 + 11, 3) * 0.5 + 0.5;
      const n2 = fbm(x * 0.09 + 40, z * 0.09 + 3, 2) * 0.5 + 0.5;
      tmp.copy(cGrass1).lerp(cGrass2, n1).lerp(cDry, smoothstep(0.62, 0.9, n2) * 0.55);
      // slope → rock
      const s1 = terrainH(x + 2.5, z) - h, s2 = terrainH(x, z + 2.5) - h;
      const slope = Math.hypot(s1, s2) / 2.5;
      tmp.lerp(cRock, smoothstep(0.75, 1.25, slope) * 0.9);
      // river banks sand
      const ri = riverInfo(x, z);
      tmp.lerp(cSand, smoothstep(17, 9, ri.d) * 0.8);
      if (h < WATER_Y - 0.5) tmp.lerp(cDeep, 0.5);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    terGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terGeo.computeVertexNormals();
  }
  const terrain = new THREE.Mesh(terGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0
  }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  /* ---------------- grass (GPU instanced, wind shader) ---------------- */
  const grassUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uWindDir: { value: new THREE.Vector2(1, 0.25) },
      uWindSpeed: { value: 4 },
      uGust: { value: 0 },
      uGustFront: { value: -300 }
    }
  ]);
  const grassMat = new THREE.ShaderMaterial({
    uniforms: grassUniforms, side: THREE.DoubleSide, fog: true,
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      attribute vec3 iPos;
      attribute vec4 iData;   // x: height, y: width, z: phase, w: tint
      uniform float uTime, uWindSpeed, uGust, uGustFront;
      uniform vec2 uWindDir;
      varying vec3 vColor;
      varying float vY;
      void main(){
        float h = iData.x, w = iData.y, ph = iData.z;
        // spatially varying wind direction (curles around the meadow)
        float dirVar = sin(iPos.x*0.011 + iPos.z*0.016 + uTime*0.21)
                      + 0.5*sin(iPos.x*0.023 - iPos.z*0.019 - uTime*0.13);
        vec2 wdir = normalize(uWindDir + 0.6*vec2(-uWindDir.y, uWindDir.x)*dirVar);
        // traveling gust wavefront sweeping across the field
        float front = exp(-pow((iPos.x - uGustFront)/30.0, 2.0));
        float amp = (0.10 + uWindSpeed*0.045) * (1.0 + uGust*0.7 + front*1.4);
        float t = uTime*(1.5 + uWindSpeed*0.12);
        float sway  = sin(t + ph + iPos.x*0.35 + iPos.z*0.27);
        float sway2 = sin(t*0.43 + ph*3.1 + iPos.z*0.11);
        vec2 bend = wdir * (sway*amp + 0.4*amp*sway2);
        float bn = clamp(position.y, 0.0, 1.0);
        float bendAmt = bn*bn;
        vec3 p = position;
        p.xz += bend * bendAmt * 1.25;
        p.y  -= dot(bend,bend)*bendAmt*0.45;
        vec3 world = iPos + vec3(p.x*w, p.y*h, p.z*w);
        // color: base → tip gradient, per-blade tint
        vec3 base = mix(vec3(0.10,0.24,0.07), vec3(0.16,0.33,0.10), iData.w);
        vec3 tip  = mix(vec3(0.55,0.72,0.28), vec3(0.72,0.82,0.38), iData.w);
        vColor = mix(base, tip, bn*bn);
        vY = bn;
        vec4 mvPosition = modelViewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      varying vec3 vColor;
      varying float vY;
      void main(){
        // cheap painterly shading: warmer toward sunlit tips
        vec3 col = vColor * vec3(1.10, 1.0, 0.80) * (0.82 + 0.30*vY);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`
  });

  function buildGrass() {
    // candidate points, rejected near river/track/steep slopes
    const cand = [];
    const R = 235;
    const target = GRASS_COUNT;
    let attempts = 0;
    while (cand.length < target && attempts < target * 14) {
      attempts++;
      const x = (rng() * 2 - 1) * R;
      const z = (rng() * 2 - 1) * R;
      // density feather with distance from center
      const dc = Math.hypot(x, z);
      const keep = 1 - smoothstep(150, 235, dc) * 0.72;
      if (rng() > keep) continue;
      const ri = riverInfo(x, z);
      if (ri.d < 15) continue;
      if (distToBridge(x, z) < 5.5) continue;
      const h = heightAt(x, z);
      if (h < WATER_Y + 0.25) continue;
      // slope check
      const sx = heightAt(x + 1.2, z) - heightAt(x - 1.2, z);
      const sz = heightAt(x, z + 1.2) - heightAt(x, z - 1.2);
      if (Math.hypot(sx, sz) / 2.4 > 0.95) continue;
      // keep off the track corridor (approx: distance to track curve coarse samples)
      cand.push([x, h, z]);
    }
    const n = cand.length;
    const g = new THREE.InstancedBufferGeometry();
    // blade: 4 levels (7 verts), unit height/width
    const verts = new Float32Array([
      -0.5, 0.0, 0,   0.5, 0.0, 0,
      -0.36, 0.42, 0,  0.36, 0.42, 0,
      -0.20, 0.75, 0,  0.20, 0.75, 0,
      0, 1.0, 0
    ]);
    const idx = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.instanceCount = n;
    const iPos = new Float32Array(n * 3), iData = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const c = cand[i];
      iPos[i * 3] = c[0]; iPos[i * 3 + 1] = c[1]; iPos[i * 3 + 2] = c[2];
      const th = 0.55 + rng() * 0.75;
      iData[i * 4] = th;                          // height
      iData[i * 4 + 1] = 0.055 + rng() * 0.075;   // width
      iData[i * 4 + 2] = rng() * Math.PI * 2;      // phase
      iData[i * 4 + 3] = rng();                   // tint
    }
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    g.setAttribute('iData', new THREE.InstancedBufferAttribute(iData, 4));
    const mesh = new THREE.Mesh(g, grassMat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    console.log('grass blades:', n);
  }
  buildGrass();

  /* ---------------- river water ---------------- */
  const waterUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR },
      uDeep: { value: new THREE.Color(0x2e6f68) },
      uShallow: { value: new THREE.Color(0x7fb3a0) },
      uSky: { value: new THREE.Color(0xffd9a6) }
    }
  ]);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms, transparent: true, fog: true,
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSunDir, uDeep, uShallow, uSky;
      varying vec3 vWorld;
      void main(){
        // flowing ripple bands
        float f1 = sin(vWorld.z*0.55 + vWorld.x*0.22 - uTime*1.6);
        float f2 = sin(vWorld.z*1.35 - vWorld.x*0.6 + uTime*2.3);
        float f3 = sin((vWorld.x+vWorld.z)*0.42 + uTime*0.9);
        float rip = f1*0.5 + f2*0.3 + f3*0.2;
        vec3 col = mix(uDeep, uShallow, 0.5 + 0.35*rip);
        // warm sky reflection toward sun side
        float sunSide = clamp(dot(normalize(vWorld), uSunDir)*0.5+0.5, 0.0, 1.0);
        col = mix(col, uSky, 0.18 + 0.30*sunSide*sunSide*smoothstep(0.3,0.9,rip*0.5+0.5));
        // sparkle
        float sp = pow(max(rip,0.0), 6.0)*0.35;
        col += vec3(1.0,0.85,0.6)*sp;
        gl_FragColor = vec4(col, 0.92);
        #include <fog_fragment>
      }`
  });
  {
    const W = 260, halfW = 11;
    const wp = riverCurve.getSpacedPoints(W);
    const pos = new Float32Array((W + 1) * 2 * 3);
    const uv = new Float32Array((W + 1) * 2 * 2);
    for (let i = 0; i <= W; i++) {
      const p = wp[i];
      const p2 = wp[Math.min(i + 1, W)];
      let tx = p2.x - p.x, tz = p2.z - p.z;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const nx = -tz, nz = tx;
      pos.set([p.x + nx * halfW, WATER_Y, p.z + nz * halfW], i * 6);
      pos.set([p.x - nx * halfW, WATER_Y, p.z - nz * halfW], i * 6 + 3);
      uv.set([i / W * 40, 0], i * 4);
      uv.set([i / W * 40, 1], i * 4 + 2);
    }
    const idx = [];
    for (let i = 0; i < W; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    const river = new THREE.Mesh(g, waterMat);
    river.renderOrder = 2;
    scene.add(river);
  }

  /* ---------------- stone viaduct ---------------- */
  function brickTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#8d8178'; g.fillRect(0, 0, 128, 128);
    const r = mulberry32(7);
    const bh = 8, bw = 16;
    for (let row = 0; row < 16; row++) {
      const off = (row % 2) * bw / 2;
      for (let col = -1; col < 9; col++) {
        const v = 0.82 + r() * 0.36;
        g.fillStyle = `rgb(${(141 * v) | 0},${(126 * v) | 0},${(113 * v) | 0})`;
        g.fillRect(col * bw + off + 1, row * bh + 1, bw - 2, bh - 2);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.09, 0.35);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  {
    const shape = new THREE.Shape();
    shape.moveTo(-BR_LEN / 2, BR_BOTTOM);
    shape.lineTo(BR_LEN / 2, BR_BOTTOM);
    shape.lineTo(BR_LEN / 2, 0.1);
    shape.lineTo(-BR_LEN / 2, 0.1);
    shape.closePath();
    const archBottom = BR_BOTTOM + 9;
    for (let i = 0; i < BR_NARCH; i++) {
      const xc = -BR_LEN / 2 + BR_PIER_W + BR_ARCH_W / 2 + i * (BR_ARCH_W + BR_PIER_W);
      const hole = new THREE.Path();
      hole.moveTo(xc - BR_ARCH_W / 2, archBottom - 1);
      hole.lineTo(xc - BR_ARCH_W / 2, BR_ARCH_SPRING);
      hole.absarc(xc, BR_ARCH_SPRING, BR_ARCH_W / 2, Math.PI, 0, true);
      hole.lineTo(xc + BR_ARCH_W / 2, archBottom - 1);
      hole.closePath();
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: BR_W, bevelEnabled: false });
    g.translate(0, 0, -BR_W / 2);
    const stoneMat = new THREE.MeshStandardMaterial({
      map: brickTexture(), color: 0xbfae9c, roughness: 0.95, metalness: 0
    });
    const bridge = new THREE.Mesh(g, stoneMat);
    bridge.position.set(bridgeCenter.x, DECK_TOP - 0.1, bridgeCenter.z);
    bridge.rotation.y = BR_ROT;
    bridge.castShadow = true; bridge.receiveShadow = true;
    scene.add(bridge);

    // deck slab + parapets
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x9a8c7c, roughness: 1 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(BR_LEN + 4, 0.9, BR_W + 0.6), deckMat);
    deck.position.set(bridgeCenter.x, DECK_TOP + 0.35, bridgeCenter.z);
    deck.rotation.y = BR_ROT;
    deck.castShadow = true; deck.receiveShadow = true;
    scene.add(deck);
    const parMat = new THREE.MeshStandardMaterial({ color: 0x8d8178, roughness: 1 });
    [-1, 1].forEach(s => {
      const par = new THREE.Mesh(new THREE.BoxGeometry(BR_LEN + 4, 0.85, 0.5), parMat);
      const dx = Math.sin(BR_ROT) * s * (BR_W / 2 - 0.15);
      const dz = Math.cos(BR_ROT) * s * (BR_W / 2 - 0.15);
      par.position.set(bridgeCenter.x + dx, DECK_TOP + 1.2, bridgeCenter.z + dz);
      par.rotation.y = BR_ROT;
      par.castShadow = true;
      scene.add(par);
    });
  }

  /* ---------------- track (ballast, sleepers, rails) ---------------- */
  {
    const N = 900;
    const pts = trackCurve.getSpacedPoints(N);
    // ballast ribbon
    const pos = new Float32Array((N + 1) * 2 * 3);
    const col = new Float32Array((N + 1) * 2 * 3);
    const cBall = new THREE.Color(0x6e6258), cBall2 = new THREE.Color(0x7d7065);
    for (let i = 0; i <= N; i++) {
      const p = pts[i];
      const tan = trackCurve.getTangentAt(i / N);
      let nx = -tan.z, nz = tan.x;
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const w = 1.9;
      pos.set([p.x + nx * w, p.y + 0.02, p.z + nz * w], i * 6);
      pos.set([p.x - nx * w, p.y + 0.02, p.z - nz * w], i * 6 + 3);
      const v = (fbm(i * 0.15, 3.3, 2) * 0.5 + 0.5);
      const cc = cBall.clone().lerp(cBall2, v);
      col.set([cc.r, cc.g, cc.b], i * 6);
      col.set([cc.r, cc.g, cc.b], i * 6 + 3);
    }
    const idx = [];
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    bg.setIndex(idx);
    bg.computeVertexNormals();
    const ballast = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    ballast.receiveShadow = true;
    scene.add(ballast);

    // sleepers (instanced)
    const slGeo = new THREE.BoxGeometry(2.0, 0.12, 0.3);
    const slMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
    const spacing = 0.85;
    const count = Math.floor(TRACK_LEN / spacing);
    const sleepers = new THREE.InstancedMesh(slGeo, slMat, count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const sc = new THREE.Vector3(1, 1, 1);
    let si = 0;
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const p = trackCurve.getPointAt(u);
      const tan = trackCurve.getTangentAt(u);
      q.setFromAxisAngle(up, Math.atan2(tan.x, tan.z) + Math.PI / 2);
      m4.compose(new THREE.Vector3(p.x, p.y + 0.10, p.z), q, sc);
      sleepers.setMatrixAt(si++, m4);
    }
    sleepers.receiveShadow = true; sleepers.castShadow = false;
    scene.add(sleepers);

    // rails (thin steel strips: side + top faces)
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x8f9096, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide
    });
    [-0.75, 0.75].forEach(off => {
      const rp2 = new Float32Array((N + 1) * 4 * 3);
      for (let i = 0; i <= N; i++) {
        const p = pts[i];
        const tan = trackCurve.getTangentAt(i / N);
        let nx = -tan.z, nz = tan.x;
        const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
        const cx = p.x + nx * off, cz = p.z + nz * off, y = p.y + 0.26;
        rp2.set([cx - nx * 0.045, y, cz - nz * 0.045], i * 12);
        rp2.set([cx + nx * 0.045, y, cz + nz * 0.045], i * 12 + 3);
        rp2.set([cx - nx * 0.045, y + 0.10, cz - nz * 0.045], i * 12 + 6);
        rp2.set([cx + nx * 0.045, y + 0.10, cz + nz * 0.045], i * 12 + 9);
      }
      const ri2 = [];
      for (let i = 0; i < N; i++) {
        const a = i * 4;
        ri2.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // side face
        ri2.push(a + 2, a + 3, a + 6, a + 3, a + 7, a + 6); // top face
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(rp2, 3));
      rg.setIndex(ri2);
      rg.computeVertexNormals();
      const rail = new THREE.Mesh(rg, railMat);
      scene.add(rail);
    });
  }

  /* ---------------- trees ---------------- */
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4630, roughness: 1, flatShading: true });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  {
    const trunks = [], canopies = [], pines = [];
    const R = 300;
    let attempts = 0;
    const want = 340;
    while (trunks.length < want && attempts < want * 60) {
      attempts++;
      const x = (rng() * 2 - 1) * R, z = (rng() * 2 - 1) * R;
      if (riverInfo(x, z).d < 22) continue;
      if (distToBridge(x, z) < 10) continue;
      // keep off track: coarse distance check vs track samples
      let ok = true;
      for (let i = 0; i < 40; i++) {
        const p = trackCurve.getPointAt(i / 40);
        const dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz < 42) { ok = false; break; }
      }
      if (!ok) continue;
      const h = terrainH(x, z);
      if (h < WATER_Y + 0.4) continue;
      const sx = terrainH(x + 1.5, z) - terrainH(x - 1.5, z);
      const sz = terrainH(x, z + 1.5) - terrainH(x, z - 1.5);
      if (Math.hypot(sx, sz) / 3 > 0.8) continue;
      // grove clustering
      if (fbm(x * 0.008 + 90, z * 0.008 + 17, 2) * 0.5 + 0.5 < 0.32 && rng() > 0.2) continue;
      trunks.push([x, h, z]);
      const isPine = rng() < 0.16;
      if (isPine) pines.push([x, h, z]); else canopies.push([x, h, z]);
    }

    function fillInstanced(list, geo, mat, builder) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
      const col = new THREE.Color();
      list.forEach((t, i) => {
        const s = 0.75 + rng() * 0.8;
        e.set(0, rng() * Math.PI * 2, 0);
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(t[0], t[1] - 0.15, t[2]), q, builder.scale(s));
        im.setMatrixAt(i, m4);
        im.setColorAt(i, builder.color(col, rng));
      });
      im.castShadow = true; im.receiveShadow = true;
      scene.add(im);
      return im;
    }
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.30, 4.2, 5);
    trunkGeo.translate(0, 2.1, 0);
    fillInstanced(trunks, trunkGeo, trunkMat, {
      scale: s => new THREE.Vector3(s, s * (0.85 + rng() * 0.4), s),
      color: c => c.setHSL(0.07 + rng() * 0.03, 0.32, 0.26 + rng() * 0.08)
    });
    const canopyGeo = new THREE.IcosahedronGeometry(2.6, 1);
    fillInstanced(canopies, canopyGeo, canopyMat, {
      scale: s => new THREE.Vector3(s * (0.9 + rng() * 0.5), s * (0.75 + rng() * 0.35), s * (0.9 + rng() * 0.5)),
      color: (c, r) => c.setHSL(0.26 + r * 0.06, 0.42 + r * 0.2, 0.30 + r * 0.14)
    });
    // second canopy blob for fullness
    const canopy2 = new THREE.IcosahedronGeometry(1.7, 1);
    canopy2.translate(0.9, 1.3, 0.3);
    fillInstanced(canopies.slice(0, canopies.length * 2 | 0), canopy2, canopyMat, {
      scale: s => new THREE.Vector3(s, s, s),
      color: (c, r) => c.setHSL(0.27 + r * 0.05, 0.45, 0.34 + r * 0.14)
    });
    const pineGeo = new THREE.ConeGeometry(1.9, 6.5, 7);
    pineGeo.translate(0, 4.6, 0);
    fillInstanced(pines, pineGeo, pineMat, {
      scale: s => new THREE.Vector3(s, s * (0.9 + rng() * 0.5), s),
      color: (c, r) => c.setHSL(0.33 + r * 0.04, 0.42, 0.24 + r * 0.1)
    });
  }

  /* ---------------- small village ---------------- */
  {
    const houses = [];
    const base = [170, -190];
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2, d = 12 + rng() * 55;
      const x = base[0] + Math.cos(a) * d * 1.6, z = base[1] + Math.sin(a) * d;
      if (riverInfo(x, z).d < 26) continue;
      const y = terrainH(x, z);
      const g = new THREE.Group();
      const w = 4 + rng() * 2, hDep = 3 + rng() * 1.4, hh = 2.6 + rng() * 0.8;
      const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.09, 0.25, 0.62 + rng() * 0.15), roughness: 1 });
      const roofMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.05 + rng() * 0.03, 0.5, 0.3 + rng() * 0.08), roughness: 1, flatShading: true });
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, hh, hDep), wallMat);
      walls.position.y = hh / 2;
      g.add(walls);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, hDep) / 2 * 1.25, 1.8, 4), roofMat);
      roof.position.y = hh + 0.9; roof.rotation.y = Math.PI / 4;
      g.add(roof);
      // warm windows
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffc06a });
      [-1, 1].forEach(s => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), winMat);
        win.position.set(s * w * 0.25, hh * 0.55, hDep / 2 + 0.02);
        g.add(win);
      });
      g.position.set(x, y - 0.1, z);
      g.rotation.y = rng() * Math.PI * 2;
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(g);
      houses.push(g);
    }
  }

  /* ---------------- steam train ---------------- */
  const train = new THREE.Group();
  const TRAIN_N = 4;
  const trainUnits = [];
  {
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x27332b, roughness: 0.6, metalness: 0.25, flatShading: true });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb08434, roughness: 0.35, metalness: 0.7 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0x7c3226, roughness: 0.7, flatShading: true });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 0.8, flatShading: true });
    const roofMatT = new THREE.MeshStandardMaterial({ color: 0x5e4030, roughness: 0.9, flatShading: true });
    const winMatT = new THREE.MeshBasicMaterial({ color: 0xffc06a });

    // locomotive
    const loco = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 1.9), darkMat);
    frame.position.y = 0.75; loco.add(frame);
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.0, 10), darkMat);
    boiler.rotation.z = Math.PI / 2; boiler.position.set(0.5, 1.55, 0); loco.add(boiler);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.1, 2.0), redMat);
    cab.position.set(-1.45, 1.85, 0); loco.add(cab);
    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 2.2), roofMatT);
    cabRoof.position.set(-1.45, 3.0, 0); loco.add(cabRoof);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.0, 8), darkMat);
    chimney.position.set(1.7, 2.75, 0); loco.add(chimney);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), brassMat);
    dome.position.set(0.5, 2.35, 0); loco.add(dome);
    const cow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 4), redMat);
    cow.rotation.z = -Math.PI / 2; cow.rotation.y = Math.PI / 4;
    cow.position.set(2.6, 0.7, 0); cow.scale.set(1, 1, 0.7); loco.add(cow);
    const winL = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.6), winMatT);
    winL.position.set(-1.45, 2.1, 1.01); loco.add(winL);
    const winR = winL.clone(); winR.position.z = -1.01; loco.add(winR);
    for (let i = 0; i < 3; i++) [-1, 1].forEach(s => {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - i * 0.07, 0.5 - i * 0.07, 0.15, 10), darkMat);
      wh.rotation.x = Math.PI / 2;
      wh.position.set(-1.3 + i * 1.35, 0.5, s * 0.95);
      loco.add(wh);
    });
    loco.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    trainUnits.push(loco);

    // passenger cars
    for (let c = 0; c < TRAIN_N - 1; c++) {
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.9, 1.7, 1.9), creamMat);
      body.position.y = 1.35; car.add(body);
      const roofC = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 4.1, 8, 1, false, 0, Math.PI), roofMatT);
      roofC.rotation.z = Math.PI / 2; // half-pipe shell over the top
      roofC.position.y = 2.2; roofC.scale.set(1, 1, 0.95); car.add(roofC);
      for (let wI = 0; wI < 4; wI++) [-1, 1].forEach(s => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.65), winMatT);
        win.position.set(-1.35 + wI * 0.9, 1.55, s * 0.96);
        car.add(win);
      });
      for (let i = 0; i < 2; i++) [-1, 1].forEach(s => {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.15, 10), darkMat);
        wh.rotation.x = Math.PI / 2;
        wh.position.set(-1.1 + i * 2.2, 0.42, s * 0.9);
        car.add(wh);
      });
      car.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
      trainUnits.push(car);
    }
    trainUnits.forEach(u => scene.add(u));
  }
  let trainT = 0.13;
  const TRAIN_SPEED = 13.5;
  const CAR_GAP = 5.6;
  function updateTrain(dt) {
    trainT = (trainT + (TRAIN_SPEED * dt) / TRACK_LEN) % 1;
    const up = new THREE.Vector3(0, 1, 0);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qFix = new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2); // model +X front → -Z (travel dir)
    const origin = new THREE.Vector3(0, 0, 0);
    trainUnits.forEach((u, i) => {
      let uu = trainT - i * (CAR_GAP / TRACK_LEN);
      uu = ((uu % 1) + 1) % 1;
      const p = trackCurve.getPointAt(uu);
      const tan = trackCurve.getTangentAt(uu);
      u.position.set(p.x, p.y + 0.26, p.z);
      m4.lookAt(origin, tan, up); // lookAt frame: +Z = -tan (i.e. -Z faces travel dir)
      q.setFromRotationMatrix(m4);
      u.quaternion.copy(q).multiply(qFix); // model +X front → travel dir
    });
  }

  /* ---------------- steam particles (GPU) ---------------- */
  const steamUniforms = {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector3(2, 0, 0.5) },
    uEmitter: { value: new THREE.Vector3() },
    uTex: { value: makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.4)') }
  };
  const STEAM_N = 420;
  let steamPoints;
  {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(STEAM_N * 4);
    for (let i = 0; i < STEAM_N * 4; i++) seeds[i] = rng();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STEAM_N * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const m = new THREE.ShaderMaterial({
      uniforms: steamUniforms, transparent: true, depthWrite: false,
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform vec3 uWind, uEmitter;
        varying float vAlpha;
        varying float vAge;
        void main(){
          float life = 2.6 + aSeed.x * 2.4;
          float age = mod(uTime * (0.7 + aSeed.y * 0.5) + aSeed.z * 37.0, life);
          float an = age / life;
          vec3 vel = vec3((aSeed.y - 0.5) * 1.4, 2.6 + aSeed.z * 2.2, (aSeed.w - 0.5) * 1.4);
          vec3 p = uEmitter + vel * age;
          p += uWind * age * (0.35 + an);
          p.x += sin(age * 2.1 + aSeed.z * 20.0) * 0.5 * an;
          p.z += cos(age * 1.7 + aSeed.x * 20.0) * 0.5 * an;
          p.y += sin(age * 3.0 + aSeed.x * 9.0) * 0.35 * an;
          vAlpha = smoothstep(0.0, 0.18, an) * (1.0 - smoothstep(0.45, 1.0, an)) * 0.5;
          vAge = an;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (3.0 + an * 26.0) * (140.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        varying float vAlpha;
        varying float vAge;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          vec3 col = mix(vec3(1.0), vec3(0.82,0.78,0.74), vAge);
          gl_FragColor = vec4(col, t.a * vAlpha);
        }`
    });
    steamPoints = new THREE.Points(g, m);
    steamPoints.frustumCulled = false;
    steamPoints.renderOrder = 5;
    scene.add(steamPoints);
  }

  /* ---------------- fireflies ---------------- */
  {
    const N = 150;
    const g = new THREE.BufferGeometry();
    const base = new Float32Array(N * 3), seeds = new Float32Array(N * 2);
    const r2 = mulberry32(42);
    for (let i = 0; i < N; i++) {
      const x = (r2() * 2 - 1) * 200, z = (r2() * 2 - 1) * 200;
      base.set([x, terrainH(x, z) + 1 + r2() * 2.5, z], i * 3);
      seeds.set([r2() * 10, r2() * 6 + 1], i * 2);
    }
    g.setAttribute('position', new THREE.BufferAttribute(base, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTex: { value: makeGlowTexture('rgba(255,230,160,1)', 'rgba(255,190,90,0.4)') } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec2 aSeed;
        uniform float uTime;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime*0.31 + aSeed.x)*3.0;
          p.y += sin(uTime*0.53 + aSeed.y*3.0)*1.2;
          p.z += cos(uTime*0.27 + aSeed.x*2.0)*3.0;
          vA = 0.5 + 0.5*sin(uTime*aSeed.y + aSeed.x*7.0);
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = (2.0 + 2.5*vA) * (60.0 / -mv.z);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        varying float vA;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vec3(1.0,0.85,0.55), t.a * vA * 0.8);
        }`
    });
    const ff = new THREE.Points(g, m);
    ff.frustumCulled = false;
    ff.onBeforeRender = () => { m.uniforms.uTime.value = perf.time; };
    scene.add(ff);
  }

  /* ---------------- mist billboards + clouds ---------------- */
  const mistTex = makeGlowTexture('rgba(255,240,220,0.85)', 'rgba(255,225,195,0.4)');
  const mistSprites = [];
  {
    const r3 = mulberry32(7);
    for (let i = 0; i < 22; i++) {
      // cluster along the river valley and low meadows
      const s = r3();
      const rp = riverCurve.getPointAt(s);
      const x = rp.x + (r3() * 2 - 1) * 90, z = rp.z + (r3() * 2 - 1) * 70;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: mistTex, transparent: true, depthWrite: false,
        opacity: 0.05 + r3() * 0.075, color: 0xffe6cc
      }));
      const sc = 70 + r3() * 110;
      sp.scale.set(sc, sc * 0.45, 1);
      sp.position.set(x, terrainH(x, z) + 7 + r3() * 10, z);
      sp.userData.baseX = x;
      sp.renderOrder = 4;
      scene.add(sp);
      mistSprites.push(sp);
    }
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: mistTex, transparent: true, depthWrite: false, opacity: 0.10 + r3() * 0.06, color: 0xfff2e2
      }));
      const sc = 200 + r3() * 180;
      sp.scale.set(sc, sc * 0.38, 1);
      sp.position.set((r3() * 2 - 1) * 700, 130 + r3() * 90, (r3() * 2 - 1) * 700);
      sp.userData.baseX = sp.position.x;
      scene.add(sp);
      mistSprites.push(sp);
    }
  }

  /* ---------------- controls ---------------- */
  const player = {
    pos: new THREE.Vector3(-72, 0, -66),
    yaw: Math.atan2(-(bridgeCenter.x - -72), -(bridgeCenter.z - -66)),
    pitch: -0.04,
    fly: true,
    locked: false,
    cinematic: false
  };
  player.pos.y = terrainH(player.pos.x, player.pos.z) + 2.2;

  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyF' && !player.cinematic) {
      player.fly = !player.fly;
      flashHint(player.fly ? 'FLY MODE' : 'WALK MODE');
    }
    if (e.code === 'KeyC') {
      player.cinematic = !player.cinematic;
      if (player.cinematic) {
        document.exitPointerLock && document.exitPointerLock();
        camPath.u = 0;
        flashHint('CINEMATIC — press C to exit');
      } else {
        flashHint('FREE CAMERA');
      }
    }
    if (e.code === 'KeyH') hintEl.style.opacity = hintEl.style.opacity === '0' ? '1' : '0';
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  renderer.domElement.addEventListener('click', () => {
    if (!player.cinematic && !player.locked) {
      renderer.domElement.requestPointerLock &&
        renderer.domElement.requestPointerLock();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    player.locked = document.pointerLockElement === renderer.domElement;
  });
  document.addEventListener('mousemove', e => {
    if (!player.locked || player.cinematic) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch = clamp(player.pitch - e.movementY * 0.0022, -1.45, 1.45);
  });

  // cinematic spline
  const camPath = (function () {
    const posPts = [
      [-72, 5.5, -78], [-26, 3.0, -58], [28, 9, -52], [78, 30, -66],
      [130, 46, -150], [-40, 22, -190], [-150, 14, -120], [-120, 9, 30]
    ].map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const lookPts = [
      [10, DECK_TOP + 2, -30], [10, DECK_TOP + 3, -30], [10, DECK_TOP, -30], [10, 8, -30],
      [60, 6, -100], [0, 6, -20], [10, DECK_TOP + 2, -30], [10, DECK_TOP + 1, -30]
    ].map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const posC = new THREE.CatmullRomCurve3(posPts, true, 'catmullrom', 0.5);
    const lookC = new THREE.CatmullRomCurve3(lookPts, true, 'catmullrom', 0.5);
    return { posC, lookC, u: 0, T: 75 };
  })();

  function updateCamera(dt) {
    if (player.cinematic) {
      camPath.u = (camPath.u + dt / camPath.T) % 1;
      const p = camPath.posC.getPointAt(camPath.u);
      const l = camPath.lookC.getPointAt(camPath.u);
      const gh = heightAt(p.x, p.z);
      if (p.y < gh + 1.8) p.y = gh + 1.8;
      camera.position.copy(p);
      camera.lookAt(l);
      return;
    }
    const speed = (keys.ShiftLeft || keys.ShiftRight) ? 30 : 11;
    const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const move = new THREE.Vector3();
    if (keys.KeyW) move.add(f);
    if (keys.KeyS) move.sub(f);
    if (keys.KeyD) move.add(r);
    if (keys.KeyA) move.sub(r);
    if (move.lengthSq() > 0) move.normalize();
    player.pos.addScaledVector(move, speed * dt);
    if (player.fly) {
      if (keys.Space) player.pos.y += speed * 0.8 * dt;
      if (keys.ControlLeft || keys.ControlRight) player.pos.y -= speed * 0.8 * dt;
      // gentle collision with terrain
      const gh = terrainH(player.pos.x, player.pos.z);
      if (player.pos.y < gh + 1.6) player.pos.y = gh + 1.6;
      if (player.pos.y > 260) player.pos.y = 260;
    } else {
      const gh = terrainH(player.pos.x, player.pos.z);
      const target = gh + 1.7;
      player.pos.y = lerp(player.pos.y, target, 1 - Math.pow(0.0001, dt));
    }
    // clamp to world
    player.pos.x = clamp(player.pos.x, -520, 520);
    player.pos.z = clamp(player.pos.z, -520, 520);
    camera.position.copy(player.pos);
    const dir = new THREE.Vector3(
      -Math.sin(player.yaw) * Math.cos(player.pitch),
      Math.sin(player.pitch),
      -Math.cos(player.yaw) * Math.cos(player.pitch));
    camera.lookAt(player.pos.clone().add(dir));
  }

  /* ---------------- wind system ---------------- */
  const wind = {
    angle: 0.55, gust: 0, gustTarget: 0, gustTimer: 0, nextGust: 5,
    front: -320
  };
  function updateWind(dt, t) {
    wind.nextGust -= dt;
    if (wind.nextGust <= 0) {
      wind.gustTarget = 3.5 + Math.random() * 5.5;
      wind.gustTimer = 0;
      wind.nextGust = 7 + Math.random() * 11;
    }
    wind.gustTimer += dt;
    const ramp = smoothstep(0, 1.4, wind.gustTimer);
    const decay = 1 - smoothstep(2.2, 6.5, wind.gustTimer);
    wind.gust = wind.gustTarget * ramp * decay;
    wind.angle = 0.55 + 0.22 * Math.sin(t * 0.06) + 0.1 * Math.sin(t * 0.017 + 2);
    const speed = 3.1 + 0.9 * Math.sin(t * 0.11) + 0.5 * Math.sin(t * 0.043 + 1) + wind.gust * 0.55;
    wind.speed = Math.max(0.4, speed);
    wind.front = -330 + ((t * 34) % 680);
    const wd = new THREE.Vector2(Math.cos(wind.angle), Math.sin(wind.angle));
    grassUniforms.uWindDir.value.copy(wd);
    grassUniforms.uWindSpeed.value = wind.speed;
    grassUniforms.uGust.value = wind.gust;
    grassUniforms.uGustFront.value = wind.front;
    steamUniforms.uWind.value.set(wd.x * wind.speed * 0.5, 0, wd.y * wind.speed * 0.5);
    mistSprites.forEach(sp => {
      sp.position.x += wd.x * wind.speed * dt * 0.35;
      if (sp.position.x > 420) sp.position.x = -420;
    });
  }

  /* ---------------- HUD ---------------- */
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div class="hud-tl">
      <div class="title">GHIBLI&nbsp;MEADOW&nbsp;·&nbsp;夕暮</div>
      <div id="hud-wind">WIND -- m/s</div>
      <div id="hud-gust">GUST -- m/s</div>
    </div>
    <div class="hud-br">
      <div id="hud-train">TRAIN -- km/h</div>
      <div id="hud-fps">-- FPS</div>
    </div>
    <div id="hud-hint">WASD move · SHIFT sprint · SPACE/CTRL up/down · F fly/walk · C cinematic · H hide</div>
    <div id="hud-flash"></div>
    <div id="crosshair"></div>`;
  document.body.appendChild(hud);
  const hintEl = document.getElementById('hud-hint');
  const flashEl = document.getElementById('hud-flash');
  let flashTO = null;
  function flashHint(text) {
    flashEl.textContent = text;
    flashEl.style.opacity = '1';
    clearTimeout(flashTO);
    flashTO = setTimeout(() => { flashEl.style.opacity = '0'; }, 1600);
  }
  setTimeout(() => { hintEl.style.opacity = '0.25'; }, 14000);

  const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  let fpsEMA = 60, hudTimer = 0;
  function updateHUD(dt) {
    fpsEMA = lerp(fpsEMA, 1 / Math.max(dt, 1e-4), 0.06);
    hudTimer -= dt;
    if (hudTimer > 0) return;
    hudTimer = 0.15;
    const dir = DIRS[((Math.round(wind.angle / (Math.PI / 4)) % 8) + 8) % 8];
    document.getElementById('hud-wind').textContent =
      `WIND ${wind.speed.toFixed(1)} m/s ${dir}`;
    document.getElementById('hud-gust').textContent =
      `GUST ${(wind.gust + 1.2).toFixed(1)} m/s`;
    document.getElementById('hud-train').textContent =
      `TRAIN ${(TRAIN_SPEED * 3.6).toFixed(0)} km/h`;
    document.getElementById('hud-fps').textContent =
      `${fpsEMA.toFixed(0)} FPS`;
  }

  /* ---------------- main loop ---------------- */
  const perf = { time: 0 };
  const clock = new THREE.Clock();
  const chimWorld = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    perf.time += dt;
    const t = perf.time;

    grassUniforms.uTime.value = t;
    waterUniforms.uTime.value = t;
    steamUniforms.uTime.value = t;

    updateWind(dt, t);
    updateTrain(dt);

    // steam emitter = chimney world position
    const loco = trainUnits[0];
    chimWorld.set(1.7, 3.3, 0).applyMatrix4(loco.matrixWorld);
    steamUniforms.uEmitter.value.copy(chimWorld);

    updateCamera(dt);
    updateHUD(dt);

    // mist pulse
    for (let i = 0; i < 22; i++) {
      const sp = mistSprites[i];
      sp.material.opacity = 0.05 + 0.045 * (0.5 + 0.5 * Math.sin(t * 0.24 + i * 1.7));
    }

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
