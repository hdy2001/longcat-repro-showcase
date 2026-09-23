/* ============================================================
   吉卜力山谷 · Ghibli Valley
   程序化生成的 3D 交互世界 (three.js r128, 全部内联, 零外部资源)
   ============================================================ */
(function () {
'use strict';

/* ---------------- 工具 ---------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260923);
function hash2(ix, iz) { const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}
function fbm(x, z, oct) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, z * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}

/* ---------------- 调色板 & 世界常量 ---------------- */
const FOG_COLOR = new THREE.Color(0xeec39b);
const FOG_DENSITY = 0.0035;
const SUN_DIR = new THREE.Vector3(-0.72, 0.30, -0.52).normalize();
const SUN_COL = new THREE.Color(0xffb36b);
const DECK = { base: 15.0, camber: 1.5, half: 27, width: 13, bed: -8, water: -2.2 };
const WORLD_HALF = 360;

/* 河道: 沿 Z 蜿蜒 */
function riverCX(z) { return 34 * Math.sin(z * 0.012) + 13 * Math.sin(z * 0.0215 + 1.7); }
let ZB = 0, CXB = 0;
(function findZB() {
  let bd = 1e9;
  for (let z = -220; z <= 220; z += 0.5) { const d = Math.abs(riverCX(z)); if (d < bd) { bd = d; ZB = z; } }
  bd = 1e9;
  for (let z = ZB - 1; z <= ZB + 1; z += 0.02) { const d = Math.abs(riverCX(z)); if (d < bd) { bd = d; ZB = z; } }
  CXB = riverCX(ZB);
})();

/* 原始丘陵高度 */
function rawH(x, z) {
  let h = fbm(x * 0.008 + 3.1, z * 0.008 + 7.7, 4) * 20 + fbm(x * 0.0026 + 11.3, z * 0.0026 + 1.9, 3) * 30 - 8;
  const r = Math.sqrt(x * x + z * z);
  h *= 0.62 + 0.38 * smoothstep(40, 230, r);
  return h;
}

/* ---------------- 轨道 ---------------- */
const CTRL = [
  [-75, ZB], [75, ZB], [160, ZB - 1], [205, ZB - 95], [185, ZB - 210],
  [70, ZB - 265], [-60, ZB - 245], [-170, ZB - 170], [-215, ZB - 60], [-170, ZB + 0.5]
];
const curve = new THREE.CatmullRomCurve3(CTRL.map(p => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal');
const N_S = 1200;
const TX = new Float32Array(N_S), TY = new Float32Array(N_S), TZ = new Float32Array(N_S);
const TGX = new Float32Array(N_S), TGY = new Float32Array(N_S), TGZ = new Float32Array(N_S);
for (let i = 0; i < N_S; i++) { const p = curve.getPoint(i / N_S); TX[i] = p.x; TZ[i] = p.z; }
function deckTop(x) {
  const c = clamp(x, -DECK.half, DECK.half) / DECK.half;
  return DECK.base + DECK.camber * (1 - c * c);
}
(function buildTrackSamples() {
  const prof = new Float32Array(N_S);
  for (let i = 0; i < N_S; i++) {
    const ground = rawH(TX[i], TZ[i]) + 1.0;
    const adx = Math.abs(TX[i] - CXB), adz = Math.abs(TZ[i] - ZB);
    let y = ground;
    if (adx < 60 && adz < 22) {
      const a = smoothstep(28, 58, adx);           // 桥头引道
      y = lerp(deckTop(TX[i]) + 0.55, ground, a);
    }
    prof[i] = y;
  }
  for (let pass = 0; pass < 2; pass++) {           // 沿轨道平滑
    const src = prof.slice(), W = 14;
    for (let i = 0; i < N_S; i++) {
      let s = 0;
      for (let k = -W; k <= W; k++) s += src[(i + k + N_S) % N_S];
      prof[i] = s / (2 * W + 1);
    }
  }
  for (let i = 0; i < N_S; i++) TY[i] = prof[i];
  for (let i = 0; i < N_S; i++) {
    const i0 = (i - 1 + N_S) % N_S, i2 = (i + 1) % N_S;
    let tx = TX[i2] - TX[i0], ty = TY[i2] - TY[i0], tz = TZ[i2] - TZ[i0];
    const l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    TGX[i] = tx / l; TGY[i] = ty / l; TGZ[i] = tz / l;
  }
})();
let TRACK_L = 0;
for (let i = 0; i < N_S; i++) {
  const i2 = (i + 1) % N_S;
  TRACK_L += Math.sqrt((TX[i2] - TX[i]) ** 2 + (TY[i2] - TY[i]) ** 2 + (TZ[i2] - TZ[i]) ** 2);
}
const TRACK_DS = TRACK_L / N_S;
const CURV = new Float32Array(N_S);
for (let i = 0; i < N_S; i++) {
  const i0 = (i - 1 + N_S) % N_S, i2 = (i + 1) % N_S;
  const dot = clamp(TGX[i0] * TGX[i2] + TGY[i0] * TGY[i2] + TGZ[i0] * TGZ[i2], -1, 1);
  CURV[i] = Math.acos(dot) / (2 * TRACK_DS);
}
function trackAt(s, outP, outT) {
  s = ((s % TRACK_L) + TRACK_L) % TRACK_L;
  const f = s / TRACK_DS, i0 = Math.floor(f) % N_S, i1 = (i0 + 1) % N_S, t = f - Math.floor(f);
  outP.set(lerp(TX[i0], TX[i1], t), lerp(TY[i0], TY[i1], t), lerp(TZ[i0], TZ[i1], t));
  if (outT) outT.set(lerp(TGX[i0], TGX[i1], t), lerp(TGY[i0], TGY[i1], t), lerp(TGZ[i0], TGZ[i1], t)).normalize();
}

/* ---------------- 地形高度(唯一真值) ---------------- */
function nearestTrack(x, z) {
  let bd = Infinity, bi = 0;
  for (let i = 0; i < N_S; i += 4) {
    const dx = x - TX[i], dz = z - TZ[i], d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; bi = i; }
  }
  return { d: Math.sqrt(bd), y: TY[bi] };
}
function terrainHeight(x, z) {
  let h = rawH(x, z);
  const nt = nearestTrack(x, z);
  h = lerp(h, nt.y - 1.1, smoothstep(15, 5, nt.d));       // 轨道平整(路堤)
  const dR = Math.abs(x - riverCX(z));
  h = lerp(h, DECK.bed, smoothstep(22, 4, dR));            // 河道下切
  h += smoothstep(30, 18, dR) * 0.6;                        // 河岸微抬
  const cm = smoothstep(40, 16, Math.abs(z - ZB));          // 桥区走廊
  if (cm > 0) {
    const bankH = lerp(DECK.bed, DECK.base - 0.4, smoothstep(5, 32, Math.abs(x - CXB)));
    h = lerp(h, bankH, cm);
  }
  return h;
}
function groundAt(x, z, feet) {
  let h = terrainHeight(x, z);
  const dx = x - CXB, dz = z - ZB;
  if (Math.abs(dx) < 29 && Math.abs(dz) < 8) {
    const deck = deckTop(dx);
    if (deck > h || feet > deck - 1) h = Math.max(h, deck);
  }
  return h;
}

/* ---------------- 渲染器 / 场景 ---------------- */
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(FOG_COLOR);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), FOG_DENSITY);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
camera.rotation.order = 'YXZ';

const hemi = new THREE.HemisphereLight(0xa8b6d8, 0x6f7a4c, 0.78);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(SUN_COL.getHex(), 1.35);
sunLight.position.copy(SUN_DIR).multiplyScalar(300);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x8a7a6a, 0.18));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- 天空 / 太阳 / 星星 ---------------- */
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uSunDir: { value: SUN_DIR },
    uSunCol: { value: new THREE.Color(0xffc27d) },
    uFogColor: { value: FOG_COLOR }
  },
  vertexShader: `
    varying vec3 vDir;
    void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 uSunDir, uSunCol, uFogColor;
    varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 zen = vec3(0.40, 0.48, 0.70);
      vec3 mid = vec3(0.74, 0.64, 0.76);
      vec3 hor = vec3(0.96, 0.77, 0.56);
      vec3 col = mix(hor, mid, smoothstep(0.0, 0.17, h));
      col = mix(col, zen, smoothstep(0.12, 0.62, h));
      col = mix(col, uFogColor, smoothstep(0.0, -0.12, h));
      float s = max(dot(d, uSunDir), 0.0);
      col += uSunCol * (pow(s, 350.0) * 1.3 + pow(s, 24.0) * 0.38 + pow(s, 6.0) * 0.16);
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, depthTest: false
});
const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(900, 28, 14), skyMat);
skyMesh.renderOrder = -10;
skyMesh.frustumCulled = false;
scene.add(skyMesh);

function radialTex(size, stops) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const s of stops) g.addColorStop(s[0], s[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}
const sunTex = radialTex(256, [[0, 'rgba(255,242,214,1)'], [0.22, 'rgba(255,214,150,0.9)'], [0.55, 'rgba(255,180,110,0.35)'], [1, 'rgba(255,170,100,0)']]);
for (const [scale, op] of [[230, 0.85], [90, 1.0]]) {
  const sm = new THREE.SpriteMaterial({ map: sunTex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const sp = new THREE.Sprite(sm);
  sp.position.copy(SUN_DIR).multiplyScalar(840);
  sp.scale.setScalar(scale);
  scene.add(sp);
}
{ /* 星星 */
  const n = 220, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, e = Math.asin(rng() * 0.85 + 0.12), r = 870;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff4e0, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.5, fog: false, depthWrite: false })));
}

/* 体积光柱(伪 god rays) */
const rays = [];
{
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 128, 4, 32, 128, 120);
  g.addColorStop(0, 'rgba(255,220,160,0.55)');
  g.addColorStop(0.5, 'rgba(255,200,140,0.18)');
  g.addColorStop(1, 'rgba(255,190,130,0)');
  ctx.save(); ctx.scale(1, 1); ctx.translate(0, 0);
  ctx.fillStyle = g;
  ctx.save(); ctx.scale(0.5, 1); ctx.beginPath(); ctx.arc(64, 128, 120, 0, 7); ctx.fill(); ctx.restore();
  ctx.restore();
  const tex = new THREE.CanvasTexture(cv);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 150),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.05 + rng() * 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
    );
    const a = rng() * Math.PI * 2, r = 60 + rng() * 190;
    m.position.set(Math.cos(a) * r, 62 + rng() * 45, Math.sin(a) * r);
    m.renderOrder = 5;
    scene.add(m);
    rays.push({ mesh: m, phase: rng() * 6.28 });
  }
}

/* ---------------- 合并工具 ---------------- */
function paintVertColors(geom, baseHex, amt, scale) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const p = g.attributes.position, n = p.count;
  const c = new Float32Array(n * 3);
  const base = new THREE.Color(baseHex), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const v = 1 + (fbm(p.getX(i) * scale, p.getZ(i) * scale + p.getY(i) * scale * 0.7, 2) - 0.5) * 2 * amt;
    tmp.copy(base).multiplyScalar(v);
    c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function mergeGeoms(items) {
  let total = 0;
  const parts = [];
  for (const it of items) {
    const g = it.g.index ? it.g.toNonIndexed() : it.g;
    it.g2 = g; parts.push(g); total += g.attributes.position.count;
  }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  const nm = new THREE.Matrix3(), v = new THREE.Vector3(), c = new THREE.Color();
  for (const it of items) {
    const g = it.g2, p = g.attributes.position, n = g.attributes.normal;
    nm.getNormalMatrix(it.m);
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(it.m);
      pos[o * 3] = v.x; pos[o * 3 + 1] = v.y; pos[o * 3 + 2] = v.z;
      if (n) {
        v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(nm).normalize();
        nor[o * 3] = v.x; nor[o * 3 + 1] = v.y; nor[o * 3 + 2] = v.z;
      } else { nor[o * 3 + 1] = 1; }
      it.paint(v, c);
      col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
      o++;
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const lam = (color, opts) => new THREE.MeshPhongMaterial(Object.assign({ color, flatShading: true, shininess: 6, specular: 0x181410 }, opts || {}));
const lamVC = () => new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 6, specular: 0x181410 });

/* ---------------- 地形 ---------------- */
const C_GRASS1 = new THREE.Color(0x6aa047), C_GRASS2 = new THREE.Color(0xa9bd5e),
      C_DRY = new THREE.Color(0xb5b06a), C_SAND = new THREE.Color(0xc9b98a),
      C_ROCK = new THREE.Color(0x8a8578), C_BED = new THREE.Color(0x6b6250);
function terrainColor(x, z, h) {
  const c = C_GRASS1.clone().lerp(C_GRASS2, fbm(x * 0.02 + 50, z * 0.02 + 9, 3));
  c.lerp(C_GRASS1, fbm(x * 0.006 + 3, z * 0.006, 2) * 0.5);
  c.lerp(C_DRY, smoothstep(15, 32, h) * 0.55);
  const dR = Math.abs(x - riverCX(z));
  c.lerp(C_SAND, smoothstep(11, 5, dR) * 0.75);
  c.lerp(C_BED, smoothstep(-2.5, -6.5, h) * 0.8);
  c.multiplyScalar(0.92 + 0.16 * fbm(x * 0.015 + 9, z * 0.015 + 4, 2));
  return c;
}
{
  const SEG = 150;
  const tg = new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, terrainHeight(tp.getX(i), tp.getZ(i)));
  tg.computeVertexNormals();
  const nrm = tg.attributes.normal;
  const colors = new Float32Array(tp.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
    c.copy(terrainColor(x, z, y));
    const ny = nrm.getY(i);
    if (ny < 0.78) c.lerp(C_ROCK, smoothstep(0.78, 0.55, ny) * 0.8);   // 陡坡露岩
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(tg, lamVC()));
}

/* ---------------- 河流 ---------------- */
const WATER_UNIF = {
  uTime: { value: 0 },
  uSunDir: { value: SUN_DIR },
  uSunCol: { value: new THREE.Color(0xffc98a) },
  uDeep: { value: new THREE.Color(0x2f5d5a) },
  uShallow: { value: new THREE.Color(0x6f9f85) },
  uSky: { value: new THREE.Color(0xe8c9a8) },
  uCamPos: { value: new THREE.Vector3() },
  uAlpha: { value: 0.94 }
};
{
  const SEG = 110, W = 13;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= SEG; i++) {
    const z = -335 + (670 * i) / SEG;
    const cx = riverCX(z), v = (z + 335) / 670;
    pos.push(cx - W, DECK.water, z, cx + W, DECK.water, z);
    uv.push(0, v, 1, v);
    if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  var waterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, WATER_UNIF]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vWorld; varying float vFogDepth;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime, uAlpha;
      uniform vec3 uSunDir, uSunCol, uDeep, uShallow, uSky, uCamPos;
      varying vec2 vUv; varying vec3 vWorld; varying float vFogDepth;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main(){
        vec2 flow = vec2(0.0, uTime * 0.9);
        float n1 = vnoise(vWorld.xz * 0.55 + flow * 0.35);
        float n2 = vnoise(vWorld.xz * 1.4 - flow * 0.6 + 7.3);
        vec3 n = normalize(vec3((n1 - 0.5) * 0.55, 1.0, (n2 - 0.5) * 0.55));
        vec3 V = normalize(uCamPos - vWorld);
        vec3 R = reflect(-uSunDir, n);
        float rv = max(dot(R, V), 0.0);
        float spec = pow(rv, 90.0) * 1.5;
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        float bank = smoothstep(0.16, 0.45, abs(vUv.x - 0.5));
        vec3 col = mix(uShallow, uDeep, bank);
        col = mix(col, uSky, fres * 0.5);
        col += uSunCol * spec;
        float spark = step(0.986, hash(floor(vWorld.xz * 6.0) + floor(uTime * 8.0))) * rv;
        col += uSunCol * spark * 0.5;
        float foam = smoothstep(0.55, 0.95, vnoise(vWorld.xz * 2.0 + flow * 2.0)) * smoothstep(0.3, 0.5, abs(vUv.x - 0.5)) * 0.22;
        col += vec3(foam);
        float ef = smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
        gl_FragColor = vec4(col, uAlpha * ef);
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true
  });
  waterMat.uniforms.fogColor.value = FOG_COLOR;
  waterMat.uniforms.fogDensity.value = FOG_DENSITY;
  scene.add(new THREE.Mesh(g, waterMat));
}

/* ---------------- 石拱桥 ---------------- */
{
  const R = 13, HL = DECK.half, base = -10, db = DECK.base, cb = DECK.camber;
  const shape = new THREE.Shape();
  shape.moveTo(-HL, base);
  shape.lineTo(-R, base);
  shape.lineTo(-R, 0);
  shape.absarc(0, 0, R, Math.PI, 0, true);      // 拱腹
  shape.lineTo(R, base);
  shape.lineTo(HL, base);
  shape.lineTo(HL, db);
  shape.quadraticCurveTo(0, db + 2 * cb, -HL, db);   // 起拱桥面
  shape.closePath();
  const gMain = new THREE.ExtrudeGeometry(shape, { depth: DECK.width, bevelEnabled: false, curveSegments: 24 });
  gMain.translate(CXB, 0, ZB - DECK.width / 2);
  const main = new THREE.Mesh(paintVertColors(gMain, 0x8d8578, 0.13, 0.6),
    lamVC());
  scene.add(main);

  /* 拱肩石带(两侧) */
  const bs = new THREE.Shape();
  bs.absarc(0, 0, 14.6, Math.PI, 0, true);
  bs.absarc(0, 0, R, 0, Math.PI, false);
  bs.closePath();
  for (const side of [1, -1]) {
    const g = new THREE.ExtrudeGeometry(bs, { depth: 0.5, bevelEnabled: false, curveSegments: 24 });
    g.translate(CXB, 0, ZB + side * (DECK.width / 2 - (side > 0 ? 0.4 : 0.9)));
    scene.add(new THREE.Mesh(paintVertColors(g, 0x6f6a5f, 0.12, 0.9),
      lamVC()));
  }
  /* 护栏 */
  const ps = new THREE.Shape();
  ps.moveTo(-HL, db - 0.25);
  ps.quadraticCurveTo(0, db - 0.25 + 2 * cb, HL, db - 0.25);
  ps.lineTo(HL, db + 1.0);
  ps.quadraticCurveTo(0, db + 1.0 + 2 * cb, -HL, db + 1.0);
  ps.closePath();
  for (const side of [1, -1]) {
    const g = new THREE.ExtrudeGeometry(ps, { depth: 0.7, bevelEnabled: false, curveSegments: 24 });
    g.translate(CXB, 0, ZB + side * (DECK.width / 2 - 0.35));
    scene.add(new THREE.Mesh(paintVertColors(g, 0x7f7a6e, 0.1, 1.4),
      lamVC()));
  }
  /* 桥头柱 */
  const postItems = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const m = new THREE.Matrix4();
    m.setPosition(CXB + sx * (HL - 0.9), db + 0.8, ZB + sz * (DECK.width / 2 - 0.9));
    postItems.push({ g: new THREE.BoxGeometry(1.3, 1.7, 1.3), m, paint: (p, c) => c.setHex(0x66615a).multiplyScalar(0.9 + 0.2 * hash2(p.x * 2, p.z * 2)) });
  }
  scene.add(new THREE.Mesh(mergeGeoms(postItems), lamVC()));
}

/* ---------------- 铁轨 / 道砟 / 枕木 ---------------- */
{
  const pos = [], col = [], idx = [];
  let vc = 0;
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();
  const pushV = (x, y, z, r, g, b) => { pos.push(x, y, z); col.push(r, g, b); return vc++; };
  const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
  const onBridge = i => Math.abs(TX[i] - CXB) < 29 && Math.abs(TZ[i] - ZB) < 8;
  const cDirt = new THREE.Color(0x8a7355), cStone = new THREE.Color(0x7d766b),
        cBall = new THREE.Color(0x6f6a61), cRail = new THREE.Color(0x55504a), tmp = new THREE.Color();
  for (let i = 0; i < N_S; i++) {
    const i2 = (i + 1) % N_S;
    side.set(TGZ[i], 0, -TGX[i]).normalize();      // 轨道横向
    const ob = onBridge(i);
    /* 路堤(梯形截面) */
    {
      const y = TY[i], f = 0.9 + 0.2 * vnoise(TX[i] * 0.1, TZ[i] * 0.1);
      tmp.copy(ob ? cStone : cDirt).multiplyScalar(f);
      const a = pushV(TX[i] - side.x * 3.1, y - 2.2, TZ[i] - side.z * 3.1, tmp.r, tmp.g, tmp.b);
      const b = pushV(TX[i] - side.x * 2.0, y - 0.55, TZ[i] - side.z * 2.0, tmp.r, tmp.g, tmp.b);
      const c = pushV(TX[i] + side.x * 2.0, y - 0.55, TZ[i] + side.z * 2.0, tmp.r, tmp.g, tmp.b);
      const d = pushV(TX[i] + side.x * 3.1, y - 2.2, TZ[i] + side.z * 3.1, tmp.r, tmp.g, tmp.b);
      const f2 = 0.9 + 0.2 * vnoise(TX[i2] * 0.1, TZ[i2] * 0.1);
      tmp.copy(ob ? cStone : cDirt).multiplyScalar(f2);
      const a2 = pushV(TX[i2] - side.x * 3.1, TY[i2] - 2.2, TZ[i2] - side.z * 3.1, tmp.r, tmp.g, tmp.b);
      const b2 = pushV(TX[i2] - side.x * 2.0, TY[i2] - 0.55, TZ[i2] - side.z * 2.0, tmp.r, tmp.g, tmp.b);
      const c2 = pushV(TX[i2] + side.x * 2.0, TY[i2] - 0.55, TZ[i2] + side.z * 2.0, tmp.r, tmp.g, tmp.b);
      const d2 = pushV(TX[i2] + side.x * 3.1, TY[i2] - 2.2, TZ[i2] + side.z * 3.1, tmp.r, tmp.g, tmp.b);
      quad(b, c, c2, b, c2, b2);      // 顶面
      quad(a, b, b2, a, b2, a2);      // 左坡
      quad(c, d, d2, c, d2, c2);      // 右坡
    }
    /* 道砟层 */
    {
      tmp.copy(cBall).multiplyScalar(0.9 + 0.2 * vnoise(TX[i] * 0.3, TZ[i] * 0.3));
      const a = pushV(TX[i] - side.x * 1.5, TY[i] - 0.3, TZ[i] - side.z * 1.5, tmp.r, tmp.g, tmp.b);
      const b = pushV(TX[i] + side.x * 1.5, TY[i] - 0.3, TZ[i] + side.z * 1.5, tmp.r, tmp.g, tmp.b);
      tmp.copy(cBall).multiplyScalar(0.9 + 0.2 * vnoise(TX[i2] * 0.3, TZ[i2] * 0.3));
      const a2 = pushV(TX[i2] - side.x * 1.5, TY[i2] - 0.3, TZ[i2] - side.z * 1.5, tmp.r, tmp.g, tmp.b);
      const b2 = pushV(TX[i2] + side.x * 1.5, TY[i2] - 0.3, TZ[i2] + side.z * 1.5, tmp.r, tmp.g, tmp.b);
      quad(a, b, b2, a, b2, a2);
    }
    /* 钢轨(两根) */
    for (const r of [-0.75, 0.75]) {
      const y = TY[i], y2 = TY[i2];
      tmp.copy(cRail).multiplyScalar(0.9 + 0.2 * vnoise(TX[i] * 5, TZ[i] * 5));
      const bx = TX[i] + side.x * r, bz = TZ[i] + side.z * r;
      const a = pushV(bx - side.x * 0.045, y - 0.13, bz - side.z * 0.045, tmp.r, tmp.g, tmp.b);
      const b = pushV(bx + side.x * 0.045, y - 0.13, bz + side.z * 0.045, tmp.r, tmp.g, tmp.b);
      const c = pushV(bx + side.x * 0.045, y + 0.02, bz + side.z * 0.045, tmp.r, tmp.g, tmp.b);
      const d = pushV(bx - side.x * 0.045, y + 0.02, bz - side.z * 0.045, tmp.r, tmp.g, tmp.b);
      const bx2 = TX[i2] + side.x * r, bz2 = TZ[i2] + side.z * r;
      const a2 = pushV(bx2 - side.x * 0.045, y2 - 0.13, bz2 - side.z * 0.045, tmp.r, tmp.g, tmp.b);
      const b2 = pushV(bx2 + side.x * 0.045, y2 - 0.13, bz2 + side.z * 0.045, tmp.r, tmp.g, tmp.b);
      const c2 = pushV(bx2 + side.x * 0.045, y2 + 0.02, bz2 + side.z * 0.045, tmp.r, tmp.g, tmp.b);
      const d2 = pushV(bx2 - side.x * 0.045, y2 + 0.02, bz2 - side.z * 0.045, tmp.r, tmp.g, tmp.b);
      quad(d, c, c2, d, c2, d2);      // 轨顶
      quad(a, d, d2, a, d2, a2);      // 外侧
      quad(c, b, b2, c, b2, c2);      // 内侧
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, lamVC()));

  /* 枕木 */
  const nSl = Math.floor(N_S / 3);
  const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.1, 0.13, 0.55), lam(0x4a3b2c), nSl);
  const dummy = new THREE.Object3D();
  for (let k = 0; k < nSl; k++) {
    const i = k * 3;
    dummy.position.set(TX[i], TY[i] - 0.3, TZ[i]);
    dummy.lookAt(TX[i] + TGX[i], TY[i] - 0.3 + TGY[i], TZ[i] + TGZ[i]);
    dummy.updateMatrix();
    sl.setMatrixAt(k, dummy.matrix);
  }
  sl.instanceMatrix.needsUpdate = true;
  scene.add(sl);
}

/* ---------------- 蒸汽火车 ---------------- */
const units = [], wheels = [];
let smokeAcc = 0, cockAcc = 0, whistleT = 5;
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color();
function buildUnit() {
  const green = lam(0x2e4b3f), black = lam(0x24211c), brass = lam(0xb08d3f),
        cream = lam(0xe8dcc0), roofM = lam(0x3a3630), red = lam(0x8a3b2a);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc06a });
  const mk = (geo, mat, x, y, z, rx, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (rz) m.rotation.z = rz;
    return m;
  };
  const wheel = (r, x, y, z) => {
    const w = mk(new THREE.CylinderGeometry(r, r, 0.18, 12), red, x, y, z, 0, Math.PI / 2);
    wheels.push({ mesh: w, r });
    return w;
  };
  /* --- 车头 --- */
  const loco = new THREE.Group();
  loco.add(mk(new THREE.CylinderGeometry(1.05, 1.05, 4.4, 10), green, 0, 1.9, 0.9, Math.PI / 2));
  loco.add(mk(new THREE.CylinderGeometry(1.12, 1.12, 1.0, 10), black, 0, 1.9, 3.4, Math.PI / 2));
  loco.add(mk(new THREE.SphereGeometry(1.05, 10, 8), black, 0, 1.9, 3.95, Math.PI / 2));
  loco.add(mk(new THREE.CylinderGeometry(0.2, 0.32, 1.0, 8), black, 0, 3.2, 3.3));
  loco.add(mk(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 8), black, 0, 3.72, 3.3));
  loco.add(mk(new THREE.SphereGeometry(0.55, 8, 6), brass, 0, 2.9, 0.6));
  loco.add(mk(new THREE.SphereGeometry(0.42, 8, 6), brass, 0, 2.85, -0.9));
  loco.add(mk(new THREE.BoxGeometry(2.5, 2.6, 2.3), green, 0, 2.6, -2.2));
  loco.add(mk(new THREE.BoxGeometry(2.7, 0.18, 2.6), roofM, 0, 3.95, -2.2));
  loco.add(mk(new THREE.PlaneGeometry(0.55, 0.55), glow, 1.26, 2.9, -2.2, 0, Math.PI / 2));
  loco.add(mk(new THREE.PlaneGeometry(0.55, 0.55), glow, -1.26, 2.9, -2.2, 0, -Math.PI / 2));
  loco.add(mk(new THREE.BoxGeometry(2.3, 0.5, 6.4), black, 0, 0.9, -0.3));
  for (const sx of [-1, 1]) for (const z of [1.7, 0.3, -1.1]) wheel(0.62, sx * 1.02, 0.62, z);
  for (const sx of [-1, 1]) wheel(0.45, sx * 1.02, 0.45, 2.8);
  loco.add(mk(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), 0, 2.4, 4.15));
  const lamp = new THREE.PointLight(0xffb36b, 1.5, 30);
  lamp.position.set(0, 2.4, 4.6);
  loco.add(lamp);
  /* --- 煤水车 --- */
  const tender = new THREE.Group();
  tender.add(mk(new THREE.BoxGeometry(2.1, 0.4, 3.8), black, 0, 0.85, 0));
  tender.add(mk(new THREE.BoxGeometry(2.3, 1.7, 3.6), green, 0, 1.7, 0));
  const coal = mk(new THREE.SphereGeometry(0.95, 8, 6), lam(0x1c1a17), 0, 2.6, 0);
  coal.scale.y = 0.5;
  tender.add(coal);
  for (const sx of [-1, 1]) for (const z of [-0.9, 0.9]) wheel(0.42, sx * 0.95, 0.42, z);
  /* --- 车厢 --- */
  const carCols = [0x3a5f4a, 0x8a4a3a, 0x2f4a5f];
  const carUnits = [];
  for (let ci = 0; ci < 3; ci++) {
    const car = new THREE.Group();
    const body = carCols[ci];
    car.add(mk(new THREE.BoxGeometry(2.3, 2.1, 5.8), lam(body), 0, 2.05, 0));
    const rf = mk(new THREE.CylinderGeometry(1.3, 1.3, 5.8, 10), roofM, 0, 3.1, 0, Math.PI / 2);
    rf.scale.y = 0.5;
    car.add(rf);
    for (const sx of [-1, 1]) for (const wz of [-1.8, 0, 1.8])
      car.add(mk(new THREE.PlaneGeometry(0.75, 0.8), glow, sx * 1.16, 2.4, wz, 0, sx * Math.PI / 2));
    for (const bz of [-1.9, 1.9]) {
      car.add(mk(new THREE.BoxGeometry(1.7, 0.5, 1.3), black, 0, 0.55, bz));
      for (const sx of [-1, 1]) wheel(0.34, sx * 0.95, 0.34, bz);
    }
    carUnits.push(car);
  }
  return { loco, tender, carUnits };
}
{
  const { loco, tender, carUnits } = buildUnit();
  units.push({ g: loco, off: 0 }, { g: tender, off: -5.9 });
  carUnits.forEach((c, i) => units.push({ g: c, off: -10.9 - i * 7 }));
  for (const u of units) scene.add(u.g);
}

/* ---------------- 烟雾粒子池 ---------------- */
const smoke = new (class {
  constructor(max) {
    this.max = max; this.cur = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max); this.life = new Float32Array(max);
    this.size0 = new Float32Array(max); this.tint = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(this.tint, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize, aAlpha; attribute vec3 aTint;
        varying float vA; varying vec3 vC;
        void main(){
          vA = aAlpha; vC = aTint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (240.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA; varying vec3 vC;
        void main(){
          float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)) * vA;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vC, a);
        }`,
      transparent: true, depthWrite: false
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, size, r, g, b) {
    const i = this.cur; this.cur = (this.cur + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.size0[i] = size;
    this.tint[i * 3] = r; this.tint[i * 3 + 1] = g; this.tint[i * 3 + 2] = b;
    this.size[i] = size; this.alpha[i] = 0;
  }
  update(dt, wvx, wvz) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      const a = this.age[i] / this.life[i];
      if (a >= 1) { this.life[i] = 0; this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.vel[i * 3 + 1] += 0.5 * dt;
      this.vel[i * 3] += wvx * 0.18 * dt; this.vel[i * 3 + 2] += wvz * 0.18 * dt;
      const damp = 1 - 0.35 * dt;
      this.vel[i * 3] *= damp; this.vel[i * 3 + 1] *= damp; this.vel[i * 3 + 2] *= damp;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.size0[i] * (1 + a * 2.6);
      this.alpha[i] = 0.32 * (1 - a);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aTint.needsUpdate = true;
  }
})(400);

/* ---------------- 树 ---------------- */
{
  const items = [];
  const placed = [];
  const greens = [0x4e7d3a, 0x5c8f42, 0x6fa04b, 0x7fae4e, 0x8fae54];
  let tries = 0;
  while (placed.length < 95 && tries < 1500) {
    tries++;
    const a = rng() * Math.PI * 2, r = 25 + Math.sqrt(rng()) * 255;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x - riverCX(z)) < 24) continue;
    if (nearestTrack(x, z).d < 13) continue;
    if (Math.abs(x - CXB) < 46 && Math.abs(z - ZB) < 28) continue;
    if (Math.hypot(x - 60, z - 140) < 15 || Math.hypot(x + 95, z + 120) < 13) continue;
    const h = terrainHeight(x, z);
    if (h < DECK.water + 1) continue;
    if (Math.abs(terrainHeight(x + 2, z) - terrainHeight(x - 2, z)) > 5.5) continue;
    let ok = true;
    for (const p of placed) { if ((p.x - x) ** 2 + (p.z - z) ** 2 < 20) { ok = false; break; } }
    if (!ok) continue;
    placed.push({ x, z });
    const s = 0.8 + rng() * 0.9;
    if (rng() < 0.62) {   /* 圆冠树 */
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - 0.5) * 0.1, rng() * Math.PI * 2, (rng() - 0.5) * 0.14));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.3, z), q, new THREE.Vector3(s, s * 1.1, s));
      items.push({ g: new THREE.CylinderGeometry(0.28 * s, 0.5 * s, 3.4 * s, 5), m, paint: (p, c) => c.setHex(0x6b4a33).multiplyScalar(0.8 + 0.4 * hash2(p.x * 3.1, p.z * 1.7)) });
      const nb = 4 + Math.floor(rng() * 3);
      for (let i = 0; i < nb; i++) {
        const br = (1.1 + rng() * 1.3) * s;
        const bm = new THREE.Matrix4().makeScale(br, br * (0.8 + rng() * 0.3), br);
        bm.setPosition(x + (rng() - 0.5) * 3.4 * s, h + (2.6 + rng() * 1.6) * s, z + (rng() - 0.5) * 3.4 * s);
        const hex = greens[Math.floor(rng() * greens.length)];
        items.push({ g: new THREE.IcosahedronGeometry(1, 1), m: bm, paint: (p, c) => { const f = 0.72 + 0.28 * clamp((p.y - h) / (4.5 * s), 0, 1); c.setHex(hex).multiplyScalar(f * (0.9 + 0.2 * hash2(p.x * 2.3, p.z * 1.9))); } });
      }
    } else {              /* 松树 */
      const m0 = new THREE.Matrix4().makeScale(s, s, s);
      m0.setPosition(x, h - 0.2, z);
      items.push({ g: new THREE.CylinderGeometry(0.22 * s, 0.4 * s, 2.2 * s, 5), m: m0, paint: (p, c) => c.setHex(0x6b4a33).multiplyScalar(0.8 + 0.4 * hash2(p.x * 3.1, p.z * 1.7)) });
      const pineG = [0x2f5d33, 0x3a6b3a, 0x467a42];
      for (let i = 0; i < 3; i++) {
        const cw = (3.2 - i * 0.8) * s, ch = 2.6 * s;
        const m = new THREE.Matrix4().makeScale(cw, ch, cw);
        m.setPosition(x, h + (1.6 + i * 1.5) * s, z);
        const hex = pineG[i];
        items.push({ g: new THREE.ConeGeometry(1, 1, 7), m, paint: (p, c) => { const f = 0.75 + 0.25 * clamp((p.y - h) / (6 * s), 0, 1); c.setHex(hex).multiplyScalar(f * (0.88 + 0.24 * hash2(p.x * 1.7, p.z * 2.3))); } });
      }
    }
  }
  scene.add(new THREE.Mesh(mergeGeoms(items), lamVC()));
}

/* ---------------- 风场材质工厂 ---------------- */
const swayMats = [];
function makeSwayMaterial(amp) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uWind: { value: 3.5 }, uGust: { value: 0 },
      uWindDir: { value: new THREE.Vector2(1, 0) }, uAmp: { value: amp }
    }]),
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec3 aColor; attribute float aPhase; attribute float aH;
      uniform float uTime, uWind, uGust, uAmp; uniform vec2 uWindDir;
      varying vec3 vColor; varying float vFogDepth;
      void main(){
        float yn = clamp(position.y / max(aH, 0.001), 0.0, 1.0);
        float y2 = yn * yn;
        float sway = sin(uTime * 2.1 + aPhase + position.x * 0.16 + position.z * 0.12) * 0.62
                   + sin(uTime * 0.8 + aPhase * 1.7 + position.z * 0.05) * 0.38;
        float amp = (0.16 + uGust * 0.075) * (0.3 + uWind * 0.22) * uAmp;
        vec3 p = position;
        p.x += uWindDir.x * sway * amp * y2;
        p.z += uWindDir.y * sway * amp * y2;
        p.y -= sway * sway * amp * y2 * 0.22;
        vColor = aColor;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      varying vec3 vColor; varying float vFogDepth;
      uniform vec3 uWarm;
      void main(){
        gl_FragColor = vec4(vColor * uWarm, 1.0);
        #include <fog_fragment>
      }`,
    side: THREE.DoubleSide, fog: true
  });
  m.uniforms.uWarm = { value: new THREE.Color(1.06, 0.97, 0.86) };
  m.uniforms.fogColor.value = FOG_COLOR;
  m.uniforms.fogDensity.value = FOG_DENSITY;
  swayMats.push(m);
  return m;
}

/* ---------------- 草地 ---------------- */
function scatterPos(rad1, rad2) {
  const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
  const rad = r < 0.72 ? rad1 * Math.sqrt(rng()) : rad1 + ((r - 0.72) / 0.28) * (rad2 - rad1);
  return [Math.cos(a) * rad, Math.sin(a) * rad];
}
function okGrassPos(x, z) {
  if (Math.abs(x - riverCX(z)) < 17) return false;
  if (nearestTrack(x, z).d < 7) return false;
  if (Math.abs(x - CXB) < 42 && Math.abs(z - ZB) < 26) return false;
  if (Math.hypot(x - 60, z - 140) < 9 || Math.hypot(x + 95, z + 120) < 8) return false;
  const h = terrainHeight(x, z);
  if (h < DECK.water + 0.6) return false;
  if (Math.abs(terrainHeight(x + 1.5, z) - terrainHeight(x - 1.5, z)) > 4.5) return false;
  return true;
}
{
  const MAX = 22000;
  const pos = [], col = [], ph = [], hh = [];
  const base = new THREE.PlaneGeometry(0.09, 1, 1, 2);
  base.translate(0, 0.5, 0);
  const bg = base.toNonIndexed(), bp = bg.attributes.position;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  const cRoot = new THREE.Color(), cTip = new THREE.Color(), tmp = new THREE.Color();
  let placed = 0, tries = 0;
  while (placed < MAX && tries < MAX * 4) {
    tries++;
    const [x, z] = scatterPos(150, 280);
    if (!okGrassPos(x, z)) continue;
    const h = terrainHeight(x, z);
    const sh = 0.45 + rng() * 0.75, sw = 0.7 + rng() * 0.7;
    e.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.25);
    q.setFromEuler(e);
    m4.compose(v.set(x, h - 0.05, z), q, new THREE.Vector3(sw, sh, sw));
    const tint = 0.85 + rng() * 0.35;
    cRoot.setHex(0x3f7a35).multiplyScalar(tint);
    cTip.setHex(0xa8c854).multiplyScalar(tint);
    for (let i = 0; i < bp.count; i++) {
      v.set(bp.getX(i), bp.getY(i), bp.getZ(i)).applyMatrix4(m4);
      pos.push(v.x, v.y, v.z);
      tmp.copy(cRoot).lerp(cTip, bp.getY(i) * bp.getY(i));
      col.push(tmp.r, tmp.g, tmp.b);
      ph.push(rng() * 6.2832); hh.push(sh);
    }
    placed++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
  scene.add(new THREE.Mesh(g, makeSwayMaterial(1.0)));

  /* 野花 */
  const MAXF = 1300;
  const fPos = [], fCol = [], fPh = [], fHh = [];
  const fBase = new THREE.PlaneGeometry(0.16, 0.5, 1, 1);
  fBase.translate(0, 0.25, 0);
  const fb = fBase.toNonIndexed(), fbp = fb.attributes.position;
  const fCols = [0xfff3f0, 0xffd94d, 0xff9ec7, 0xc9a0ff, 0xff8a5c];
  placed = 0; tries = 0;
  while (placed < MAXF && tries < MAXF * 4) {
    tries++;
    const [x, z] = scatterPos(20, 190);
    if (!okGrassPos(x, z)) continue;
    const h = terrainHeight(x, z);
    const sh = 0.3 + rng() * 0.35;
    e.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.2);
    q.setFromEuler(e);
    m4.compose(v.set(x, h - 0.03, z), q, new THREE.Vector3(1, sh * 2, 1));
    const cc = new THREE.Color(fCols[Math.floor(rng() * fCols.length)]);
    for (let i = 0; i < fbp.count; i++) {
      v.set(fbp.getX(i), fbp.getY(i), fbp.getZ(i)).applyMatrix4(m4);
      fPos.push(v.x, v.y, v.z);
      tmp.copy(cc).multiplyScalar(0.55 + 0.45 * fbp.getY(i) * 2);
      fCol.push(tmp.r, tmp.g, tmp.b);
      fPh.push(rng() * 6.2832); fHh.push(sh * 2);
    }
    placed++;
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  fg.setAttribute('aColor', new THREE.Float32BufferAttribute(fCol, 3));
  fg.setAttribute('aPhase', new THREE.Float32BufferAttribute(fPh, 1));
  fg.setAttribute('aH', new THREE.Float32BufferAttribute(fHh, 1));
  scene.add(new THREE.Mesh(fg, makeSwayMaterial(0.45)));
}

/* ---------------- 远山 ---------------- */
{
  const items = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng() * 0.4, r = 430 + rng() * 120;
    const h = 70 + rng() * 90, w = 130 + rng() * 110;
    const m = new THREE.Matrix4().makeRotationY(rng() * Math.PI).scale(new THREE.Vector3(w, h, w));
    m.setPosition(Math.cos(a) * r, -14, Math.sin(a) * r);
    items.push({ g: new THREE.ConeGeometry(1, 1, 7), m, paint: (p, c) => c.setHex(0x8b84a0).multiplyScalar(0.85 + 0.3 * hash2(p.x * 0.05, p.z * 0.05)) });
  }
  scene.add(new THREE.Mesh(mergeGeoms(items), lamVC()));
}

/* ---------------- 云 ---------------- */
const clouds = [];
{
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x2a2018 });
  for (let ci = 0; ci < 9; ci++) {
    const items = [];
    const nb = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < nb; i++) {
      const br = 6 + rng() * 9;
      const m = new THREE.Matrix4().makeScale(br * (0.9 + rng() * 0.7), br * (0.55 + rng() * 0.3), br * (0.9 + rng() * 0.7));
      m.setPosition((rng() - 0.5) * 36, (rng() - 0.5) * 7, (rng() - 0.5) * 20);
      items.push({ g: new THREE.IcosahedronGeometry(1, 1), m, paint: (p, c) => { const f = 0.8 + 0.2 * clamp(p.y / 8 + 0.5, 0, 1); c.setHex(0xf6e3cc).multiplyScalar(f); } });
    }
    const mesh = new THREE.Mesh(mergeGeoms(items), mat);
    const a = rng() * Math.PI * 2, r = 170 + rng() * 300;
    mesh.position.set(Math.cos(a) * r, 95 + rng() * 70, Math.sin(a) * r);
    mesh.scale.setScalar(1.1 + rng() * 1.3);
    scene.add(mesh);
    clouds.push({ mesh, speed: 0.8 + rng() * 1.1 });
  }
}

/* ---------------- 风车 / 小屋 / 鸟 ---------------- */
const windmill = { blades: null };
{
  const wm = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.6, 13, 7), lam(0xe6d7b8));
  tower.position.y = 6.5;
  wm.add(tower);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.6, 7), lam(0x9c4f35));
  roof.position.y = 13.8;
  wm.add(roof);
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.4, 0.1), lam(0xf0e6cc));
    b.position.y = 2.7;
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI) / 2;
    holder.add(b);
    blades.add(holder);
  }
  blades.position.set(0, 12.6, 2.2);
  wm.add(blades);
  windmill.blades = blades;
  wm.position.set(-95, terrainHeight(-95, -120) - 0.2, -120);
  wm.rotation.y = 0.6;
  scene.add(wm);
}
const houseSmokePos = new THREE.Vector3();
{
  const hs = new THREE.Group();
  const hw = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.2, 4.4), lam(0xecdcba));
  hw.position.set(0, 1.6, 0);
  hs.add(hw);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.4, 4), lam(0x9c4f35));
  roof.position.y = 4.4; roof.rotation.y = Math.PI / 4;
  hs.add(roof);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), lam(0x8a7a68));
  chim.position.set(1.6, 4.2, 0.8);
  hs.add(chim);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.15), lam(0x5a4632));
  door.position.set(0, 1.0, 2.26);
  hs.add(door);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc06a });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glow); w1.position.set(-1.5, 1.8, 2.26); hs.add(w1);
  const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glow); w2.position.set(2.71, 1.8, 0); w2.rotation.y = Math.PI / 2; hs.add(w2);
  const l = new THREE.PointLight(0xffb060, 0.9, 16);
  l.position.set(0, 2.4, 2.8); hs.add(l);
  hs.position.set(60, terrainHeight(60, 140), 140);
  hs.rotation.y = -0.5;
  scene.add(hs);
  _v.set(1.6, 5.2, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.5).add(hs.position);
  houseSmokePos.copy(_v);
}
const birds = [];
{
  const bc = new THREE.Vector3(-60, 0, -140);
  bc.y = terrainHeight(-60, -140) + 24;
  const mat = new THREE.MeshBasicMaterial({ color: 0x4a4034, side: THREE.DoubleSide });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.15, 0, -0.3, 1.15, 0, 0.3], 3));
  wingGeo.computeVertexNormals();
  for (let i = 0; i < 6; i++) {
    const pivot = new THREE.Group();
    const wl = new THREE.Mesh(wingGeo, mat);
    const wr = new THREE.Mesh(wingGeo, mat);
    wr.scale.x = -1;
    pivot.add(wl); pivot.add(wr);
    scene.add(pivot);
    birds.push({ pivot, wl, wr, r: 34 + i * 4, ph: i * 1.1, sp: 0.12 + i * 0.008, cx: bc.x, cz: bc.z, cy: bc.y });
  }
}

/* ---------------- 玩家控制 ---------------- */
const qs = new URLSearchParams(location.search);
const testMode = qs.has('test');
let started = testMode, locked = false;
let fly = qs.has('fly');
const player = { pos: new THREE.Vector3(-58, 0, ZB + 64), vy: 0, grounded: true };
player.pos.y = groundAt(player.pos.x, player.pos.z, -1e9) + 1.7;
let yaw = -0.699, pitch = -0.04;
const keys = {};
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
crosshair.style.display = 'block';
if (testMode) overlay.classList.add('hidden');
overlay.addEventListener('click', () => {
  if (!started) canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { started = true; overlay.classList.add('hidden'); }
  else if (started && !testMode) overlay.classList.remove('hidden');
});
document.addEventListener('mousemove', e => {
  if (!locked) return;
  yaw -= e.movementX * 0.0022;
  pitch = clamp(pitch - e.movementY * 0.0022, -1.5, 1.5);
});
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyF' && started) {
    fly = !fly;
    document.getElementById('modePanel').textContent = fly ? '✈ 飞行模式' : '🚶 步行模式';
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
function updatePlayer(dt) {
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  const f = new THREE.Vector3(fwd.x, 0, fwd.z);
  if (f.lengthSq() < 1e-6) f.set(0, 0, -1); else f.normalize();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
  const mv = new THREE.Vector3();
  if (keys.KeyW) mv.add(f);
  if (keys.KeyS) mv.sub(f);
  if (keys.KeyD) mv.add(r);
  if (keys.KeyA) mv.sub(r);
  if (mv.lengthSq() > 0) mv.normalize();
  const boost = keys.ShiftLeft || keys.ShiftRight;
  const p = player.pos;
  if (fly) {
    const sp = boost ? 45 : 20;
    const v = new THREE.Vector3().copy(mv).multiplyScalar(sp);
    if (keys.Space) v.y += sp;
    if (keys.KeyC || keys.ControlLeft) v.y -= sp;
    p.addScaledVector(v, dt);
    p.y = clamp(p.y, 1.5, 260);
  } else {
    const sp = boost ? 11 : 6.5;
    p.x += mv.x * sp * dt;
    p.z += mv.z * sp * dt;
    p.x = clamp(p.x, -345, 345);
    p.z = clamp(p.z, -345, 345);
    /* 桥侧碰撞 */
    const dx = p.x - CXB, dz = p.z - ZB;
    if (Math.abs(dx) < 30 && Math.abs(dz) < 9) {
      const deck = deckTop(clamp(dx, -DECK.half, DECK.half));
      if (p.y - 1.7 < deck - 0.6 && Math.abs(dz) > 6.4) p.z = ZB + (dz > 0 ? 1 : -1) * 6.4;
    }
    const g = groundAt(p.x, p.z, p.y - 1.7) + 1.7;
    if (keys.Space && player.grounded) { player.vy = 5.2; player.grounded = false; }
    if (player.grounded) {
      p.y = lerp(p.y, g, 1 - Math.exp(-14 * dt));
    } else {
      player.vy -= 13 * dt;
      p.y += player.vy * dt;
      if (p.y <= g) { p.y = g; player.vy = 0; player.grounded = true; }
    }
    if (p.y < DECK.water + 1.0) p.y = DECK.water + 1.0;   // 涉水
  }
  camera.position.copy(p);
}

/* ---------------- 风 ---------------- */
const wind = { dir: 2.2, speed: 3.6, gust: 0, peak: 0 };
const windVec = new THREE.Vector2(1, 0);
function updateWind(t, dt) {
  wind.dir = 2.2 + Math.sin(t * 0.05) * 0.5 + (vnoise(t * 0.03, 8) - 0.5) * 1.2;
  wind.speed = 3.2 + Math.sin(t * 0.07) * 1.2;
  const g = Math.max(0, vnoise(t * 0.22, 1.7) - 0.45) * 2.2;
  wind.gust = g * g * 8;
  wind.peak = Math.max(wind.gust * 0.95, wind.peak * (1 - dt * 0.05));
  wind.speed += wind.gust;
  windVec.set(Math.sin(wind.dir), Math.cos(wind.dir));
}

/* ---------------- 火车运行 ---------------- */
let trainS = 75, trainSpeed = 8;
function updateTrain(dt, t) {
  trackAt(trainS, _p, _t);
  const i0 = Math.floor((((trainS % TRACK_L) + TRACK_L) % TRACK_L) / TRACK_DS) % N_S;
  const target = clamp(14 - CURV[i0] * 300, 4.5, 15);
  trainSpeed += clamp(target - trainSpeed, -3 * dt, 2.2 * dt);
  trainS += trainSpeed * dt;
  for (const u of units) {
    trackAt(trainS + u.off, _p, _t);
    u.g.position.set(_p.x, _p.y + 0.02, _p.z);
    u.g.lookAt(_p.x + _t.x, _p.y + 0.02 + _t.y, _p.z + _t.z);
  }
  for (const w of wheels) w.mesh.rotation.x += (trainSpeed * dt) / w.r;
  /* 烟囱烟 */
  smokeAcc += (2 + trainSpeed * 0.9) * dt;
  while (smokeAcc > 1) {
    smokeAcc -= 1;
    _v.set(0, 3.78, 3.3).applyQuaternion(units[0].g.quaternion).add(units[0].g.position);
    smoke.emit(_v.x, _v.y, _v.z,
      windVec.x * 0.5 + (rng() - 0.5) * 0.4, 2.3 + rng() * 0.8 + trainSpeed * 0.04, windVec.y * 0.5 + (rng() - 0.5) * 0.4,
      2.4 + rng() * 1.2, 0.5 + rng() * 0.3, 0.8 + rng() * 0.12, 0.76 + rng() * 0.1, 0.7 + rng() * 0.08);
  }
  /* 汽缸白汽 */
  if (trainSpeed > 3) {
    cockAcc += dt;
    if (cockAcc > 0.4) {
      cockAcc = 0;
      for (const sx of [-1, 1]) {
        _v.set(sx * 0.9, 0.7, 2.6).applyQuaternion(units[0].g.quaternion).add(units[0].g.position);
        smoke.emit(_v.x, _v.y, _v.z, windVec.x * 0.7 + sx * 0.8, 0.8, windVec.y * 0.7, 0.8, 0.28, 0.92, 0.9, 0.86);
      }
    }
  }
  /* 汽笛 */
  whistleT -= dt;
  if (whistleT <= 0) {
    whistleT = 6 + rng() * 6;
    _v.set(0, 3.78, 3.3).applyQuaternion(units[0].g.quaternion).add(units[0].g.position);
    for (let i = 0; i < 14; i++)
      smoke.emit(_v.x, _v.y, _v.z, windVec.x * 0.6 + (rng() - 0.5) * 0.8, 4 + rng() * 2, windVec.y * 0.6 + (rng() - 0.5) * 0.8, 1.6, 0.35, 0.94, 0.92, 0.88);
  }
}

/* ---------------- HUD ---------------- */
const el = id => document.getElementById(id);
let hudT = 0;
function updateHUD(dt) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.15;
  el('windVal').textContent = wind.speed.toFixed(1);
  el('gustVal').textContent = wind.gust.toFixed(1);
  el('gustPeak').textContent = wind.peak.toFixed(1);
  el('gustBar').style.width = (wind.gust / 10 * 100) + '%';
  const vx = Math.sin(wind.dir), vz = Math.cos(wind.dir);
  const deg = (Math.atan2(vx, -vz) * 180 / Math.PI + 360) % 360;
  el('windArrow').style.transform = `rotate(${-90 + deg}deg)`;
  el('windDir').textContent = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(deg / 45) % 8] + '风';
  el('trainSpeed').textContent = (trainSpeed * 3.6).toFixed(0);
  el('trainState').textContent = trainSpeed < 0.5 ? '停靠中' : '行驶中';
}

/* ---------------- 主循环 ---------------- */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  updateWind(t, dt);
  updatePlayer(dt);
  updateTrain(dt, t);
  smoke.update(dt, windVec.x * wind.speed, windVec.y * wind.speed);
  /* 小屋炊烟 */
  if (rng() < dt * 1.6)
    smoke.emit(houseSmokePos.x, houseSmokePos.y, houseSmokePos.z, windVec.x * 0.4, 0.9 + rng() * 0.3, windVec.y * 0.4, 3, 0.5, 0.62, 0.58, 0.55);
  for (const m of swayMats) {
    m.uniforms.uTime.value = t;
    m.uniforms.uWind.value = wind.speed;
    m.uniforms.uGust.value = wind.gust;
    m.uniforms.uWindDir.value.copy(windVec);
  }
  waterMat.uniforms.uTime.value = t;
  waterMat.uniforms.uCamPos.value.copy(camera.position);
  for (const c of clouds) {
    c.mesh.position.x += windVec.x * c.speed * dt;
    c.mesh.position.z += windVec.y * c.speed * dt;
    if (c.mesh.position.x > 560) c.mesh.position.x = -560;
    if (c.mesh.position.x < -560) c.mesh.position.x = 560;
    if (c.mesh.position.z > 560) c.mesh.position.z = -560;
    if (c.mesh.position.z < -560) c.mesh.position.z = 560;
  }
  windmill.blades.rotation.z += dt * 0.55;
  for (const b of birds) {
    const th = t * b.sp + b.ph;
    b.pivot.position.set(b.cx + Math.cos(th) * b.r, b.cy + Math.sin(t * 0.6 + b.ph) * 2.5, b.cz + Math.sin(th) * b.r);
    b.pivot.rotation.y = -th;
    const flap = Math.sin(t * 8.5 + b.ph * 1.7) * 0.55;
    b.wl.rotation.z = 0.25 + flap;
    b.wr.rotation.z = -(0.25 + flap);
  }
  for (const r of rays) {
    r.mesh.lookAt(camera.position);
    r.mesh.material.opacity = 0.04 + 0.035 * (0.5 + 0.5 * Math.sin(t * 0.3 + r.phase));
  }
  updateHUD(dt);
  renderer.render(scene, camera);
}
animate();
})();
