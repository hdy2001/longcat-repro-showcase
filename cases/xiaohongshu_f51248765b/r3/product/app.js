/* ============================================================
   应县木塔（佛宫寺释迦塔）· 构件级数字拆解
   three.js r128 · 单文件离线版
   ============================================================ */
(function () {
'use strict';

/* ---------------- 基础工具 ---------------- */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function M4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(
    V3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    V3(sx, sy, sz));
}
const clamp01 = x => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const FACE = ['东', '东北', '北', '西北', '西', '西南', '南', '东南'];
const CN = ['一', '二', '三', '四', '五', '六'];
const A8 = Math.PI / 8;

/* ---------------- 程序化贴图 ---------------- */
function canvasTex(size, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  fn(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function woodCanvas(base, dark, light) {
  return (ctx, s) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? dark : light;
      ctx.globalAlpha = 0.05 + Math.random() * 0.12;
      ctx.fillRect(Math.random() * s, 0, 1 + Math.random() * 3.2, s);
    }
    ctx.globalAlpha = 0.16; ctx.fillStyle = dark;
    for (let i = 0; i < 12; i++)
      ctx.fillRect(Math.random() * s, Math.random() * s * 0.5, 1.2, s * (0.3 + Math.random() * 0.6));
    ctx.globalAlpha = 1;
  };
}
const texWood  = canvasTex(512, woodCanvas('#7a5230', '#5a3a20', '#96683e'));
const texWoodD = canvasTex(512, woodCanvas('#5e4026', '#42291a', '#7a5533'));
const texWall  = canvasTex(512, woodCanvas('#8a6a42', '#6b4c2c', '#a8845a'));
const texStone = canvasTex(512, (ctx, s) => {
  ctx.fillStyle = '#7d766a'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#6d675c' : '#8b8478';
    ctx.globalAlpha = 0.25; ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  ctx.globalAlpha = 0.3; ctx.strokeStyle = '#57524a';
  for (let y = 0; y < s; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
});
const texTile = canvasTex(512, (ctx, s) => {
  ctx.fillStyle = '#33373d'; ctx.fillRect(0, 0, s, s);
  const tw = s / 8;
  for (let i = 0; i < 8; i++) {
    const g = ctx.createLinearGradient(i * tw, 0, (i + 1) * tw, 0);
    g.addColorStop(0, '#272b30'); g.addColorStop(0.45, '#43484f'); g.addColorStop(1, '#23262b');
    ctx.fillStyle = g; ctx.fillRect(i * tw + 1, 0, tw - 2, s);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < s; y += 42) ctx.fillRect(0, y, s, 3);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#3d4248' : '#2b2e33';
    ctx.globalAlpha = 0.3; ctx.fillRect(Math.random() * s, Math.random() * s, 3, 2);
  }
  ctx.globalAlpha = 1;
});
const texDoor = canvasTex(512, (ctx, s) => {
  ctx.fillStyle = '#5d3f24'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#4a3018'; ctx.fillRect(0, (i + 0.5) * s / 6, s, 3);
    ctx.fillStyle = 'rgba(255,220,160,0.06)'; ctx.fillRect(0, (i + 0.5) * s / 6 - 3, s, 3);
  }
  ctx.strokeStyle = '#caa14e'; ctx.lineWidth = 8; ctx.strokeRect(18, 18, s - 36, s - 36);
  ctx.fillStyle = '#d8b25e';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
    ctx.beginPath(); ctx.arc(60 + c * 96, 70 + r * 92, 13, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0d288'; ctx.beginPath(); ctx.arc(56 + c * 96, 66 + r * 92, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8b25e';
  }
  for (const x of [s * 0.3, s * 0.7]) {
    ctx.strokeStyle = '#caa14e'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(x, s * 0.78, 26, 0, 7); ctx.stroke();
  }
});
const texLattice = canvasTex(512, (ctx, s) => {
  ctx.fillStyle = '#151009'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#7d5c36';
  ctx.fillRect(0, 0, s, 26); ctx.fillRect(0, s - 26, s, 26); ctx.fillRect(0, 0, 26, s); ctx.fillRect(s - 26, 0, 26, s);
  for (let x = 40; x < s - 30; x += 42) ctx.fillRect(x, 20, 12, s - 40);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 40; x < s - 30; x += 42) ctx.fillRect(x + 12, 20, 4, s - 40);
});
const texGlow = canvasTex(512, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,170,90,0.5)'); g.addColorStop(0.35, 'rgba(200,110,50,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});

/* ---------------- 材质 ---------------- */
function std(map, color, rough, metal) {
  return new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: metal === undefined ? 0.05 : metal });
}
const MAT = {
  column: std(texWood, 0x8a5a38, 0.62),
  wood:   std(texWood, 0x9a6b42, 0.72),
  woodD:  std(texWoodD, 0x7a5636, 0.78),
  wall:   std(texWall, 0xa8845c, 0.8),
  stone:  std(texStone, 0x9a9284, 0.92, 0),
  tile:   new THREE.MeshStandardMaterial({ map: texTile, color: 0xb8bcc4, roughness: 0.55, metalness: 0.12, side: THREE.DoubleSide }),
  iron:   new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.38, metalness: 0.85 }),
  gold:   new THREE.MeshStandardMaterial({ color: 0xd8b25e, roughness: 0.3, metalness: 0.9 }),
};
const mirrorMats = {};
function mirrorMatFor(mat) {
  const k = mat.uuid;
  if (!mirrorMats[k]) {
    const m = mat.clone();
    m.transparent = true; m.opacity = 0.15; m.depthWrite = false;
    m.side = THREE.DoubleSide; m.emissive = new THREE.Color(0x000000);
    mirrorMats[k] = m;
  }
  return mirrorMats[k];
}

/* ---------------- 几何 ---------------- */
const unitBox = new THREE.BoxGeometry(1, 1, 1);
function boxPart(w, h, d, x, y, z, ry, su, sv) {
  let g = unitBox;
  if (su) { g = unitBox.clone(); uvScale2(g, su, sv); }
  return { g, m: M4(x, y, z, 0, ry, 0, w, h, d) };
}
function uvScale2(g, sx, sy) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
}
function douGeo(w, h, d, x, y, z, tT, tB) { // 梯形斗
  const wb = w / 2 * (tB || 0.86), db = d / 2 * (tB || 0.86);
  const wt = w / 2 * (tT || 1.14), dt = d / 2 * (tT || 1.14);
  const p = [-wb,0,-db, wb,0,-db, wb,0,db, -wb,0,db,  -wt,h,-dt, wt,h,-dt, wt,h,dt, -wt,h,dt];
  const idx = [];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; idx.push(i, j, 4 + j, i, 4 + j, 4 + i); }
  idx.push(3,2,1, 3,1,0, 4,5,6, 4,6,7);
  const uv = [];
  for (let i = 0; i < 12; i++) uv.push((i % 4 === 1 || i % 4 === 2) ? 1 : 0, i > 3 ? 1 : 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  g.applyMatrix4(M4(x, y, z));
  return { g, m: M4() };
}
function prismGeo(profs, x, y, z) { // 变截面棱柱（昂/拱），profiles: [{z,yt,yb,w}]
  const pos = [], uv = [], idx = [];
  const n = profs.length;
  profs.forEach(p => {
    const w = p.w / 2;
    pos.push(-w, p.yt, p.z, w, p.yt, p.z, -w, p.yb, p.z, w, p.yb, p.z);
    uv.push(0, 1, 1, 1, 0, 0, 1, 0);
  });
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4, b = (i + 1) * 4;
    idx.push(a, b, b + 1, a, b + 1, a + 1, a + 2, a + 3, b + 3, a + 2, b + 3, b + 2,
             a, a + 2, b + 2, a, b + 2, b, a + 1, b + 1, b + 3, a + 1, b + 3, a + 3);
  }
  idx.push(0, 1, 2, 0, 2, 3);
  const e = (n - 1) * 4;
  idx.push(e, e + 2, e + 3, e, e + 3, e + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  g.applyMatrix4(M4(x, y, z));
  return { g, m: M4() };
}
const ROTX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
function tubeGeo(p1, p2, r, seg) {
  const dir = V3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg || 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.normalize()));
  g.translate((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
  return { g, m: M4() };
}
function discGeo(p, dir, r, h) { // 瓦当
  const g = new THREE.CylinderGeometry(r, r, h, 10);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize()));
  g.translate(p.x, p.y, p.z);
  return { g, m: M4() };
}
function mergeParts(parts) {
  const pos = [], norm = [], uv = [], idx = [];
  let off = 0;
  const v = new THREE.Vector3();
  for (const p of parts) {
    const g = p.g, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(p.m);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(p.m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); norm.push(v.x, v.y, v.z);
      uv.push(ua.getX(i), ua.getY(i));
    }
    const ia = g.index.array;
    for (let i = 0; i < ia.length; i++) idx.push(ia[i] + off);
    off += pa.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/* ---------------- 场景 ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070503, 150, 460);

const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 1200);
const CAM_END = V3(46, 25, 46), TGT_END = V3(0, 24, 0), CAM_START = V3(108, 64, 108);
camera.position.copy(CAM_START);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.copy(TGT_END);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.minDistance = 12; controls.maxDistance = 260;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotate = true; controls.autoRotateSpeed = 0.55;

const key = new THREE.DirectionalLight(0xffa24e, 1.8);
key.position.set(42, 62, 30);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -42;
key.shadow.camera.right = key.shadow.camera.top = 42;
key.shadow.camera.near = 20; key.shadow.camera.far = 190;
key.shadow.bias = -0.0006;
key.target.position.set(0, 22, 0);
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0x51648c, 0.4); fill.position.set(-46, 24, -34); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffd9a6, 0.75); rim.position.set(-18, 50, -52); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x33261a, 0x090604, 0.75));

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(340, 48),
  new THREE.MeshStandardMaterial({ color: 0x141009, roughness: 0.42, metalness: 0.6 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);
const glowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshBasicMaterial({ map: texGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
glowPlane.rotation.x = -Math.PI / 2; glowPlane.position.y = 0.06;
scene.add(glowPlane);

const dustGeo = new THREE.BufferGeometry();
{
  const n = 260, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 14 + Math.random() * 70, a = Math.random() * Math.PI * 2;
    arr[i * 3] = Math.cos(a) * r; arr[i * 3 + 1] = 2 + Math.random() * 58; arr[i * 3 + 2] = Math.sin(a) * r;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
}
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xffc27d, size: 0.32, transparent: true, opacity: 0.45,
  blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(dust);

/* ---------------- 构件体系 ---------------- */
const tower = new THREE.Group();
scene.add(tower);
const comps = [];
function addComponent(id, name, desc, expP, expS, bobble) {
  const g = new THREE.Group();
  g.userData = {
    isComponent: true, id, name, desc,
    expP: expP || null, expS: expS || null,
    bobble: bobble !== false, phase: Math.random() * 6.28,
    hidden: false, mats: [], mirrors: []
  };
  tower.add(g); comps.push(g);
  return g;
}
function addMesh(comp, geo, mat) {
  const m = new THREE.Mesh(geo, mat.clone());
  m.castShadow = true; m.receiveShadow = true;
  comp.add(m); comp.userData.mats.push(m.material);
  // 地面镜像 twin
  const tm = new THREE.Mesh(geo, mirrorMatFor(mat));
  tm.raycast = () => {}; tm.castShadow = false; tm.receiveShadow = false;
  comp.add(tm); comp.userData.mirrors.push(tm);
  return m;
}
const faceLen = R => 2 * R * Math.tan(A8) + 0.001;
const faceNormal = k => V3(Math.cos(k * Math.PI / 4), 0, Math.sin(k * Math.PI / 4));

/* ---- 台基 ---- */
{
  const c = addComponent('TB-01', '台基（含踏跺）', '双层青石台基，承托全塔荷载，四面设踏跺登台。');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(17.8, 18.6, 1.3, 8), MAT.stone.clone());
  base.position.y = 0.65; base.rotation.y = Math.PI / 8;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(16.4, 17.8, 0.9, 8), MAT.stone.clone());
  top.position.y = 1.75; top.rotation.y = Math.PI / 8;
  [base, top].forEach(m => {
    m.castShadow = m.receiveShadow = true;
    c.add(m); c.userData.mats.push(m.material);
    const tm = new THREE.Mesh(m.geometry, mirrorMatFor(m.material));
    tm.raycast = () => {}; c.add(tm); c.userData.mirrors.push(tm);
  });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    const st = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 3.2), MAT.stone.clone());
    st.position.set(Math.cos(a) * 17.4, 0.35, Math.sin(a) * 17.4);
    st.rotation.y = -a + Math.PI / 2;
    st.castShadow = st.receiveShadow = true;
    c.add(st); c.userData.mats.push(st.material);
    const tm = new THREE.Mesh(st.geometry, mirrorMatFor(st.material));
    tm.raycast = () => {}; c.add(tm); c.userData.mirrors.push(tm);
  }
}

/* ---- 柱网（内外两槽） ---- */
function buildColumnGrid(Rout, Rin, yBot, h, rO, rI, id, name, desc) {
  const c = addComponent(id, name, desc, null, V3(1.27, 1, 1.27));
  const parts = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + A8;
    parts.push(tubeGeo(V3(Math.cos(a) * Rout, yBot, Math.sin(a) * Rout), V3(Math.cos(a) * Rout, yBot + h, Math.sin(a) * Rout), rO, 8));
    parts.push(tubeGeo(V3(Math.cos(a) * Rin, yBot, Math.sin(a) * Rin), V3(Math.cos(a) * Rin, yBot + h, Math.sin(a) * Rin), rI, 8));
  }
  addMesh(c, mergeParts(parts), MAT.column);
}

/* ---- 阑额 / 梁枋 ---- */
function buildArchitrave(Rout, Rin, yTop, id, name, desc, pupai) {
  const c = addComponent(id, name, desc, null, V3(1.19, 1, 1.19));
  const parts = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    const n = faceNormal(k), n2 = faceNormal((k + 1) % 8);
    const L = faceLen(Rout) + 0.5;
    parts.push(boxPart(L, 0.4, 0.24, n.x * Rout, yTop - 0.2, n.z * Rout, Math.PI / 2 - a + A8));
    if (pupai) parts.push(boxPart(L + 0.3, 0.18, 0.3, n.x * (Rout + 0.02), yTop + 0.08, n.z * (Rout + 0.02), Math.PI / 2 - a + A8));
    const Li = faceLen(Rin) + 0.4;
    parts.push(boxPart(Li, 0.32, 0.2, n2.x * Rin, yTop - 0.7, n2.z * Rin, Math.PI / 2 - a - A8));
    const p1 = V3(n2.x * Rin, yTop - 0.7, n2.z * Rin), p2 = V3(n.x * Rout, yTop - 0.7, n.z * Rout);
    const mid = V3().addVectors(p1, p2).multiplyScalar(0.5);
    const len = V3().subVectors(p2, p1).length();
    parts.push(boxPart(0.26, 0.34, len, mid.x, mid.y, mid.z, Math.atan2(n.x - n2.x, n.z - n2.z)));
  }
  addMesh(c, mergeParts(parts), MAT.wood);
}

/* ---- 墙体 / 门窗 ---- */
function buildWalls(st, yBot, yTop) {
  const { Rout, name, cn } = st;
  const h = yTop - yBot, th = 0.32, Rin = Rout - th / 2 - 0.02;
  for (let k = 0; k < 8; k++) {
    const n = faceNormal(k), L = faceLen(Rin) - 0.1;
    const cc = addComponent(`W${cn}-${FACE[k]}`, `${name}·${FACE[k]}墙体`, `${name}${FACE[k]}面墙体，版筑木骨，与檐柱相交，围护塔身。`, V3(n.x * 3.6, 0.4, n.z * 3.6));
    addMesh(cc, mergeParts([boxPart(L, h, th, n.x * Rin, yBot + h / 2, n.z * Rin, Math.PI / 2 - k * Math.PI / 4, L / 1.4, h / 1.4)]), MAT.wall);
  }
  const isG = st.ground;
  const dH = isG ? 5.6 : 3.3, dW = isG ? 2.7 : 2.1;
  for (const k of [0, 2, 4, 6]) {
    const n = faceNormal(k);
    const cc = addComponent(`SM${cn}-${FACE[k]}`, `${name}·${FACE[k]}隔扇门`, '板门铜钉、铺首衔环，出入之所。', V3(n.x * 5.4, 0.9, n.z * 5.4));
    const y0 = yBot + (isG ? 0.15 : (h - dH) / 2 + 0.15);
    addMesh(cc, mergeParts([boxPart(dW, dH, 0.1, n.x * (Rin - 0.14), y0 + dH / 2, n.z * (Rin - 0.14), Math.PI / 2 - k * Math.PI / 4)]),
      std(texDoor, 0xa88a68, 0.7));
  }
  for (const k of [1, 3, 5, 7]) {
    const n = faceNormal(k);
    const cc = addComponent(`SC${cn}-${FACE[k]}`, `${name}·${FACE[k]}直棂窗`, '直棂窗，竖向棂条，采光通风。', V3(n.x * 5.4, 0.9, n.z * 5.4));
    const wW = 2.5, wH = Math.min(2.6, h - 3.2), cy = yBot + h * 0.6;
    addMesh(cc, mergeParts([boxPart(wW, wH, 0.09, n.x * (Rin - 0.14), cy, n.z * (Rin - 0.14), Math.PI / 2 - k * Math.PI / 4)]),
      std(texLattice, 0x9a7a50, 0.8));
  }
}

/* ---- 斗拱铺作 ---- */
function dougongParts(type) {
  const P = [];
  const rotY = ry => new THREE.Matrix4().makeRotationY(ry);
  if (type === 'bj') { // 补间铺作：十字拱
    P.push(douGeo(0.52, 0.3, 0.52, 0, 0.06, 0));
    P.push(boxPart(0.58, 0.06, 0.58, 0, 0.03, 0, 0));
    for (const ry of [0, Math.PI / 2]) {
      const len = ry === 0 ? 1.15 : 1.0;
      const arm = prismGeo([{ z: -len / 2, yt: 0.36, yb: 0.64, w: 0.26 }, { z: len / 2, yt: 0.36, yb: 0.64, w: 0.26 }]);
      arm.m = arm.m.clone().premultiply(rotY(ry)); P.push(arm);
      for (const s of [-1, 1]) {
        const d = douGeo(0.2, 0.14, 0.2, 0, 0, 0);
        d.m = M4(Math.sin(ry) * s * (len / 2 - 0.05), 0.64, Math.cos(ry) * s * (len / 2 - 0.05));
        P.push(d);
      }
    }
    const top = prismGeo([{ z: -0.6, yt: 0.8, yb: 1.06, w: 0.26 }, { z: 0.6, yt: 0.8, yb: 1.06, w: 0.26 }]);
    top.m = top.m.clone().premultiply(rotY(Math.PI / 2)); P.push(top);
    for (const s of [-1, 1]) P.push(douGeo(0.2, 0.14, 0.2, s * 0.56, 1.06, 0));
    P.push(boxPart(1.24, 0.09, 0.16, 0, 1.24, 0, 0));
    return P;
  }
  const core = () => {
    const p = [];
    p.push(boxPart(0.74, 0.08, 0.74, 0, 0.04, 0, 0));                       // 皿板
    p.push(douGeo(0.66, 0.34, 0.66, 0, 0.1, 0));                         // 栌斗
    p.push(prismGeo([                                                     // 杪（华拱）
      { z: -0.86, yt: 0.44, yb: 0.92, w: 0.34 },
      { z: 0.05, yt: 0.42, yb: 0.94, w: 0.36 },
      { z: 1.04, yt: 0.46, yb: 0.9, w: 0.3 }]));
    p.push(douGeo(0.3, 0.2, 0.3, 0, 0.92, 0.98));                       // 交互斗
    p.push(prismGeo([                                                     // 下昂（琴面昂嘴）
      { z: -1.04, yt: 0.64, yb: 1.08, w: 0.32 },
      { z: 0.35, yt: 0.4, yb: 0.84, w: 0.32 },
      { z: 1.05, yt: 0.16, yb: 0.6, w: 0.3 },
      { z: 1.54, yt: -0.14, yb: 0.36, w: 0.19 }]));
    p.push(boxPart(0.3, 0.24, 0.32, 0, 0.18, 1.12, 0));                  // 华头子
    p.push(prismGeo([                                                     // 耍头（批竹式）
      { z: -0.9, yt: 1.0, yb: 1.34, w: 0.3 },
      { z: 0.55, yt: 0.82, yb: 1.16, w: 0.3 },
      { z: 1.44, yt: 0.68, yb: 1.0, w: 0.22 }]));
    const gz = prismGeo([{ z: -0.66, yt: 1.12, yb: 1.4, w: 0.24 }, { z: 0.66, yt: 1.12, yb: 1.4, w: 0.24 }]); // 瓜子拱
    gz.m = gz.m.clone().premultiply(rotY(Math.PI / 2)); p.push(gz);
    for (const s of [-1, 1]) p.push(douGeo(0.19, 0.15, 0.19, s * 0.6, 1.4, 0));
    const mg = prismGeo([{ z: -0.9, yt: 1.56, yb: 1.82, w: 0.24 }, { z: 0.9, yt: 1.56, yb: 1.82, w: 0.24 }]); // 慢拱
    mg.m = mg.m.clone().premultiply(rotY(Math.PI / 2)); p.push(mg);
    for (const s of [-1, 1]) p.push(douGeo(0.19, 0.15, 0.19, s * 0.86, 1.82, 0));
    const lg = prismGeo([{ z: -0.52, yt: 1.98, yb: 2.2, w: 0.22 }, { z: 0.52, yt: 1.98, yb: 2.2, w: 0.22 }]); // 令拱
    lg.m = lg.m.clone().premultiply(rotY(Math.PI / 2)); p.push(lg);
    for (const s of [-1, 1]) p.push(douGeo(0.18, 0.13, 0.18, s * 0.47, 2.2, 0));
    p.push(boxPart(1.1, 0.1, 0.18, 0, 2.32, 0, 0));                        // 替木
    const ni = prismGeo([{ z: -0.56, yt: 1.1, yb: 1.36, w: 0.22 }, { z: 0.02, yt: 1.1, yb: 1.36, w: 0.22 }]); // 内跳横拱
    ni.m = ni.m.clone().premultiply(rotY(Math.PI / 2)); p.push(ni);
    for (const s of [-1, 1]) p.push(douGeo(0.17, 0.13, 0.17, s * 0.4, 1.36, 0));
    return p;
  };
  P.push(...core());
  if (type === 'zj') { // 转角：侧面一套 + 由昂宝瓶
    core().slice(2).forEach(sp => P.push({ g: sp.g, m: sp.m.clone().premultiply(rotY(Math.PI / 2)) }));
    P.push(prismGeo([                                                     // 由昂
      { z: 0.3, yt: 1.1, yb: 2.5, w: 0.22 },
      { z: 0.86, yt: 1.5, yb: 2.75, w: 0.22 }]));
    P.push(douGeo(0.24, 0.14, 0.24, 0, 2.75, 0.86));                     // 平盘斗
    P.push(boxPart(0.2, 0.34, 0.2, 0, 2.95, 0.86, 0));                    // 宝瓶
  }
  return P;
}
const DG_DESC = {
  dt: '立于柱头栌斗之上，双杪单昂五铺作，杪、昂、斗层叠出跳，承撩檐枋与檐椽，是檐部主要悬挑构件。',
  bj: '坐于阑额之上，补柱间之空，十字出跳，承托檐枋，使檐部荷载均匀传递。',
  zj: '位于转角柱头，鸳鸯交首，两面华拱、下昂并出，角昂、由昂斜挑，承托转角檐角与上翘。'
};
function faceOf(theta) { return ((Math.round(theta / (Math.PI / 4)) % 8) + 8) % 8; }
function buildDougongRing(Rout, yBase, cn, prefix) {
  let nDt = 0, nBj = 0;
  for (let k = 0; k < 8; k++) {
    for (const off of [-A8, A8]) { // 柱头铺作 ×16
      const th = k * Math.PI / 4 + off, f = faceOf(th);
      const cc = addComponent(`D${prefix}-DT-${String(++nDt).padStart(2, '0')}`,
        `${cn}柱头铺作·${FACE[f]}面`, DG_DESC.dt, V3(Math.cos(th) * 2.5, 1.3, Math.sin(th) * 2.5));
      cc.position.set(Math.cos(th) * Rout, yBase, Math.sin(th) * Rout);
      cc.rotation.y = Math.PI / 2 - th;
      addMesh(cc, mergeParts(dougongParts('dt')), MAT.wood);
    }
    for (const off of [-A8 / 2, A8 / 2]) { // 补间铺作 ×16
      const th = k * Math.PI / 4 + off, f = faceOf(th);
      const cc = addComponent(`D${prefix}-BJ-${String(++nBj).padStart(2, '0')}`,
        `${cn}补间铺作·${FACE[f]}面`, DG_DESC.bj, V3(Math.cos(th) * 2.5, 1.3, Math.sin(th) * 2.5));
      cc.position.set(Math.cos(th) * (Rout + 0.1), yBase, Math.sin(th) * (Rout + 0.1));
      cc.rotation.y = Math.PI / 2 - th;
      addMesh(cc, mergeParts(dougongParts('bj')), MAT.woodD);
    }
    { // 转角铺作 ×8
      const th = k * Math.PI / 4 + A8 * 3, f = faceOf(th);
      const cc = addComponent(`D${prefix}-ZJ-${String(k + 1).padStart(2, '0')}`,
        `${cn}转角铺作·${FACE[f]}${FACE[(f + 1) % 8]}角`, DG_DESC.zj, V3(Math.cos(th) * 2.5, 1.3, Math.sin(th) * 2.5));
      cc.position.set(Math.cos(th) * Rout, yBase, Math.sin(th) * Rout);
      cc.rotation.y = Math.PI / 2 - th;
      addMesh(cc, mergeParts(dougongParts('zj')), MAT.wood);
    }
  }
}
function buildFuDougong(Rout, yBase, cn) { // 副阶：柱头×16 补间×8
  let n = 0;
  for (let k = 0; k < 16; k++) {
    const th = k * Math.PI / 8, f = faceOf(th);
    const cc = addComponent(`FD-DT-${String(++n).padStart(2, '0')}`,
      `${cn}柱头铺作·${FACE[f]}${k % 2 ? '间' : ''}`, DG_DESC.dt, V3(Math.cos(th) * 2.5, 1.3, Math.sin(th) * 2.5));
    cc.position.set(Math.cos(th) * Rout, yBase, Math.sin(th) * Rout);
    cc.rotation.y = Math.PI / 2 - th;
    addMesh(cc, mergeParts(dougongParts('dt')), MAT.wood);
  }
  n = 0;
  for (let k = 0; k < 8; k++) {
    const th = k * Math.PI / 4, f = faceOf(th);
    const cc = addComponent(`FD-BJ-${String(++n).padStart(2, '0')}`,
      `${cn}补间铺作·${FACE[f]}面`, DG_DESC.bj, V3(Math.cos(th) * 2.5, 1.3, Math.sin(th) * 2.5));
    cc.position.set(Math.cos(th) * (Rout + 0.1), yBase, Math.sin(th) * (Rout + 0.1));
    cc.rotation.y = Math.PI / 2 - th;
    addMesh(cc, mergeParts(dougongParts('bj')), MAT.woodD);
  }
}

/* ---- 屋檐 ---- */
function eavePoint(e, u, v) {
  const edge = Math.pow(Math.abs(2 * u - 1), 5);
  return {
    R: e.Rin + (e.Rout - e.Rin) * v + e.cornerOut * edge * sstep(0.5, 1, v),
    y: e.yTop + (e.yEdge - e.yTop) * Math.pow(v, 1.55) + e.lift * edge * sstep(0.4, 1, v)
  };
}
function apexPoint(e, apex, u, v) {
  const edge = Math.pow(Math.abs(2 * u - 1), 5);
  return {
    R: e.Rout + (apex.R - e.Rout) * Math.pow(v, 0.92) + e.cornerOut * edge * (1 - v),
    y: e.yEdge + (apex.y - e.yEdge) * Math.pow(v, 1.35) + e.lift * edge * (1 - sstep(0, 0.45, v))
  };
}
function roofSurfaceGeo(e, segU, segV, apex) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segV; i++) for (let j = 0; j <= segU; j++) {
    const u = j / segU, v = i / segV;
    const p = apex ? apexPoint(e, apex, u, v) : eavePoint(e, u, v);
    const a = (u - 0.5) * 2 * A8;
    pos.push(p.R * Math.cos(a), p.y, p.R * Math.sin(a));
    uv.push(u * 4, (apex ? 1 - v : v) * 2.2);
  }
  for (let i = 0; i < segV; i++) for (let j = 0; j < segU; j++) {
    const a = i * (segU + 1) + j, b = a + 1, c = a + segU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function buildEave(e, yTop, cn, apex) { // 返回 8 个檐段组件
  const pt = (u, v, k) => {
    const p = apex ? apexPoint(e, apex, u, v) : eavePoint(e, u, v);
    const a = (u - 0.5) * 2 * A8;
    return { x: p.R * Math.cos(a), y: p.y, z: p.R * Math.sin(a) };
  };
  for (let k = 0; k < 8; k++) {
    const n = faceNormal(k);
    const isTop = !!apex;
    const cc = addComponent(`Y${isTop ? 'D' : cn}-${FACE[k]}`,
      `${isTop ? '六重檐（攒尖顶）' : cn + '重檐'}·${FACE[k]}段`,
      isTop ? '攒尖顶段，八脊汇聚宝顶，角梁起翘如飞翼。' : '檐椽飞子承瓦，角梁起翘，曲面反宇，排水深远。',
      V3(n.x * (isTop ? 3.8 : 4.6), isTop ? 3.6 : 3.0, n.z * (isTop ? 3.8 : 4.6)));
    const surf = addMesh(cc, roofSurfaceGeo(e, 26, 12, apex), MAT.tile);
    const woodParts = [], trimParts = [];
    if (!apex) {
      for (let i = 0; i < 14; i++) { // 檐椽
        const u = (i + 0.5) / 14;
        const p0 = pt(u, 0.14, k), p1 = pt(u, 1.05, k);
        woodParts.push(tubeGeo(V3(p0.x, p0.y, p0.z), V3(p1.x, p1.y, p1.z), 0.075, 5));
        const q0 = pt(u, 0.88, k), q1 = pt(u, 1.03, k); // 飞子
        woodParts.push(tubeGeo(V3(q0.x, q0.y + 0.09, q0.z), V3(q1.x, q1.y + 0.09, q1.z), 0.05, 5));
      }
      for (const v of [[0.15, 0.7], [0.7, 1.0]]) { // 角梁
        const p0 = pt(0, v[0], k), p1 = pt(0, v[1], k);
        woodParts.push(tubeGeo(V3(p0.x, p0.y, p0.z), V3(p1.x, p1.y, p1.z), 0.12, 5));
      }
      for (let i = 0; i < 16; i++) { // 瓦当
        const u = (i + 0.5) / 16, p = pt(u, 1.0, k);
        const phi = (u - 0.5) * 2 * A8;
        trimParts.push(discGeo(V3(p.x, p.y - 0.04, p.z), V3(Math.cos(phi), 0.25, Math.sin(phi)), 0.16, 0.09));
      }
      trimParts.push(tubeGeo(pt(0.02, 1.0, k), pt(0.98, 1.0, k), 0.06, 5)); // 连檐
      const fl = pt(0.5, 0.04, k), Rf = Math.hypot(fl.x, fl.z);
      woodParts.push(boxPart(faceLen(Rf) + 0.2, 0.22, 0.3, fl.x, yTop + 0.16, fl.z, Math.PI / 2 - Math.atan2(fl.z, fl.x))); // 撩檐枋
    } else { // 攒尖垂脊
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(pt(0, i / 8, k));
      const curve = new THREE.CatmullRomCurve3(pts.map(p => V3(p.x, p.y + 0.05, p.z)));
      const g = new THREE.TubeGeometry(curve, 14, 0.15, 6, false);
      woodParts.push({ g, m: M4() });
      for (let i = 0; i < 16; i++) {
        const u = (i + 0.5) / 16, p = pt(u, 1.0, k);
        const phi = (u - 0.5) * 2 * A8;
        trimParts.push(discGeo(V3(p.x, p.y - 0.04, p.z), V3(Math.cos(phi), 0.25, Math.sin(phi)), 0.16, 0.09));
      }
    }
    addMesh(cc, mergeParts(woodParts), apex ? MAT.tile : MAT.woodD);
    addMesh(cc, mergeParts(trimParts), MAT.tile);
  }
}

/* ---- 平坐（平台 + 栏杆） ---- */
function buildBalcony(Rout, yBase, cn) {
  const c = addComponent(`P${cn}`, `${cn.replace('M', '第') + '层'}平坐·栏杆`, '凭栏远眺之处，望柱、寻杖、盆唇、地栿次第分明。', null, V3(1.15, 1, 1.15));
  const parts = [];
  for (let k = 0; k < 8; k++) { // 平台
    const n = faceNormal(k), a = k * Math.PI / 4;
    parts.push(boxPart(faceLen(Rout) + 0.6, 0.8, 1.8, n.x * (Rout - 0.7), yBase + 0.4, n.z * (Rout - 0.7), Math.PI / 2 - a + A8));
  }
  for (let k = 0; k < 16; k++) { // 望柱
    const th = k * Math.PI / 8, R = Rout + 0.08;
    parts.push(boxPart(0.13, 1.05, 0.13, Math.cos(th) * R, yBase + 1.3, Math.sin(th) * R, 0));
  }
  for (let k = 0; k < 8; k++) { // 寻杖 / 盆唇 / 地栿
    const n = faceNormal(k), a = k * Math.PI / 4, L = faceLen(Rout + 0.16) + 0.1;
    const ry = Math.PI / 2 - a + A8;
    parts.push(boxPart(L, 0.09, 0.1, n.x * (Rout + 0.08), yBase + 1.95, n.z * (Rout + 0.08), ry));
    parts.push(boxPart(L, 0.06, 0.08, n.x * (Rout + 0.08), yBase + 1.5, n.z * (Rout + 0.08), ry));
    parts.push(boxPart(L, 0.12, 0.14, n.x * (Rout + 0.08), yBase + 0.86, n.z * (Rout + 0.08), ry));
  }
  addMesh(c, mergeParts(parts), MAT.wood);
}

/* ---- 暗层（斜撑） ---- */
function buildDark(Rout, Rin, yBot, h, cn) {
  const c = addComponent(`A${cn}`, `${cn.replace('M', '第') + '层'}暗层·斜撑`, '暗层斜撑，结构之筋骨，隐于平坐之间，固塔身之抗侧力。', null, V3(1.22, 1, 1.22));
  const parts = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + A8, ai = k * Math.PI / 4;
    parts.push(tubeGeo(V3(Math.cos(a) * Rout, yBot, Math.sin(a) * Rout), V3(Math.cos(a) * Rout, yBot + h, Math.sin(a) * Rout), 0.24, 6));
    parts.push(tubeGeo(V3(Math.cos(ai) * Rin, yBot, Math.sin(ai) * Rin), V3(Math.cos(ai) * Rin, yBot + h, Math.sin(ai) * Rin), 0.22, 6));
    const n = faceNormal(k), a2 = k * Math.PI / 4;
    const p1 = V3(Math.cos(a) * (Rout - 0.12), yBot + 0.2, Math.sin(a) * (Rout - 0.12));
    const p2 = V3(Math.cos(a + Math.PI / 4) * (Rout - 0.12), yBot + h - 0.2, Math.sin(a + Math.PI / 4) * (Rout - 0.12));
    const mid = V3().addVectors(p1, p2).multiplyScalar(0.5);
    const len = V3().subVectors(p2, p1).length();
    parts.push(boxPart(0.16, 0.16, len, mid.x, mid.y, mid.z, Math.atan2(Math.cos(a) - Math.cos(a + Math.PI / 4), Math.sin(a + Math.PI / 4) - Math.sin(a))));
    const p3 = V3(Math.cos(a) * (Rout - 0.12), yBot + h - 0.2, Math.sin(a) * (Rout - 0.12));
    const p4 = V3(Math.cos(a + Math.PI / 4) * (Rout - 0.12), yBot + 0.2, Math.sin(a + Math.PI / 4) * (Rout - 0.12));
    const mid2 = V3().addVectors(p3, p4).multiplyScalar(0.5);
    const len2 = V3().subVectors(p4, p3).length();
    parts.push(boxPart(0.16, 0.16, len2, mid2.x, mid2.y, mid2.z, Math.atan2(Math.cos(a) - Math.cos(a + Math.PI / 4), Math.sin(a + Math.PI / 4) - Math.sin(a))));
  }
  addMesh(c, mergeParts(parts), MAT.woodD);
}

/* ---- 斗拱大样（展示用） ---- */
let bigSample;
{
  bigSample = addComponent('DG-DY', '斗拱大样 · 柱头铺作（双杪单昂）', '等比放大的柱头铺作大样：栌斗承杪，杪上交互斗，下昂斜挑，耍头批竹，瓜子、慢、令三拱层叠，替木承枋。', null, null, false);
  bigSample.position.set(27, 11.5, 15);
  bigSample.scale.setScalar(2.9);
  const parts = dougongParts('dt');
  parts.forEach((p, i) => {
    const m = new THREE.Mesh(p.g, MAT.wood.clone());
    m.userData.partY = i * 0.26;
    m.userData.partBase = 0;
    bigSample.add(m); bigSample.userData.mats.push(m.material);
    const tm = new THREE.Mesh(p.g, mirrorMatFor(MAT.wood));
    tm.raycast = () => {}; tm.userData.isBigSamplePart = true;
    bigSample.add(tm); bigSample.userData.mirrors.push(tm);
  });
}

/* ---- 塔刹 ---- */
function buildSpire(apexY, cornerR, cornerY) {
  const c = addComponent('TS-01', '塔刹（相轮宝珠）', '铁刹耸立，八条风链系于攒尖垂脊之首，相轮五重，宝珠收顶。', V3(0, 7, 0));
  const parts = [];
  parts.push(tubeGeo(V3(0, apexY - 0.5, 0), V3(0, apexY + 9.2, 0), 0.09, 6)); // 刹杆
  parts.push(discGeo(V3(0, apexY + 1.0, 0), V3(0, 1, 0), 0.55, 0.55));       // 覆钵
  for (let i = 0; i < 5; i++) {                                              // 相轮
    const r = 0.85 - i * 0.09, y = apexY + 2.1 + i * 0.62;
    const g = new THREE.TorusGeometry(r, 0.06, 6, 22); g.applyMatrix4(M4(0, y, 0, Math.PI / 2));
    parts.push({ g, m: M4() });
  }
  parts.push(discGeo(V3(0, apexY + 9.6, 0), V3(0, 1, 0), 0.2, 0.35));       // 宝珠
  addMesh(c, mergeParts(parts), MAT.iron);
  const chains = [];
  for (let k = 0; k < 8; k++) {
    const th = k * Math.PI / 4 - A8;
    chains.push(tubeGeo(V3(0, apexY + 3.4, 0), V3(Math.cos(th) * cornerR, cornerY, Math.sin(th) * cornerR), 0.028, 4));
  }
  addMesh(c, mergeParts(chains), MAT.iron);
}

/* ================= 建塔 ================= */
const ST = [
  { key: 'M1', cn: '一', name: '明层一', Rout: 11.6, Rin: 6.0, base: 2.2, h: 9.2, ground: true },
  { key: 'M2', cn: '二', name: '明层二', Rout: 10.3, Rin: 6.0, base: 14.4, h: 5.0 },
  { key: 'M3', cn: '三', name: '明层三', Rout: 9.1, Rin: 6.0, base: 22.4, h: 5.0 },
  { key: 'M4', cn: '四', name: '明层四', Rout: 8.0, Rin: 6.0, base: 30.4, h: 5.0 },
  { key: 'M5', cn: '五', name: '明层五', Rout: 7.0, Rin: 5.6, base: 38.4, h: 5.0 },
];
const EAVE = [
  { Rin: 14.35, Rout: 17.6, drop: 1.7, lift: 1.9, cornerOut: 1.0 },  // 副阶檐
  { Rin: 11.95, Rout: 16.3, drop: 1.5, lift: 1.7, cornerOut: 0.9 },  // 二檐
  { Rin: 10.65, Rout: 14.6, drop: 1.45, lift: 1.6, cornerOut: 0.85 },// 三檐
  { Rin: 9.45, Rout: 13.0, drop: 1.4, lift: 1.5, cornerOut: 0.8 },   // 四檐
  { Rin: 8.35, Rout: 11.5, drop: 1.35, lift: 1.4, cornerOut: 0.75 }, // 五檐
  { Rin: 7.35, Rout: 10.1, drop: 1.3, lift: 1.3, cornerOut: 0.7 },   // 六檐(攒尖)
];
const BR_H = 2.2, DARK_H = 3.0, BALC_PLAT = 0.8, BALC_RAIL = 1.05;

// 副阶
buildColumnGrid(14.0, -1, 2.2, 3.8, 0.3, 0.3, 'FZ-01', '副阶·檐柱', '外廊环柱十六根，围合副阶回廊，承托副阶屋檐。');
buildArchitrave(14.0, 12.2, 6.0, 'FL-01', '副阶·阑额', '联系副阶檐柱柱头，上承斗拱。', false);
buildFuDougong(14.0, 6.4, '副阶');
buildEave(Object.assign(EAVE[0], { yTop: 8.2, yEdge: 8.2 - EAVE[0].drop }), 8.2, '一');

// 明层
for (const st of ST) {
  const wallTop = st.base + st.h;
  buildColumnGrid(st.Rout, st.Rin, st.base, st.h, 0.3, 0.26, `Z${st.cn}-01`, `${st.name}·柱网`, '内外两槽柱网，外槽二十八柱（含副阶），内槽八柱，贯通全塔。');
  buildWalls(st, st.base, wallTop);
  buildArchitrave(st.Rout, st.Rin, wallTop, `L${st.cn}-01`, `${st.name}·阑额梁枋`, '阑额、普拍方联系柱头，内槽梁架承托平坐。', !st.ground);
  const dgY = wallTop;
  const eaveIdx = st.ground ? 1 : st.key === 'M2' ? 2 : st.key === 'M3' ? 3 : st.key === 'M4' ? 4 : 5;
  const eTop = dgY + BR_H;
  buildDougongRing(st.Rout, dgY, CN[eaveIdx - 1], CN[eaveIdx - 1]);
  buildEave(Object.assign(EAVE[eaveIdx], { yTop: eTop, yEdge: eTop - EAVE[eaveIdx].drop }), eTop, CN[eaveIdx]);
  if (!st.ground) {
    const balcY = wallTop;
    buildBalcony(st.Rout, balcY, st.key);
    buildDark(st.Rout, st.Rin, wallTop, DARK_H, st.key);
  }
}
// 攒尖顶（六重檐）
{
  const st5 = ST[4], eTop5 = st5.base + st5.h + BR_H;
  buildDougongRing(st5.Rout, st5.base + st5.h, '六', '六');
  const apex = { R: 1.7, y: eTop5 + 5.6 };
  buildEave(Object.assign(EAVE[5], { yTop: eTop5, yEdge: eTop5 - EAVE[5].drop }), eTop5, '六', apex);
  buildSpire(apex.y, EAVE[5].Rout + EAVE[5].cornerOut + 0.4, eTop5 - EAVE[5].drop + EAVE[5].lift);
}

// 记录基准变换
comps.forEach(c => {
  c.userData.basePos = c.position.clone();
  c.userData.baseScale = c.scale.clone();
});

/* ---------------- 交互 ---------------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selected = null, hovered = null;
let explodeT = 1, explodeTarget = 1; // 默认爆炸拆解状态

function compFromObject(o) {
  while (o) { if (o.userData && o.userData.isComponent) return o; o = o.parent; }
  return null;
}
function pickAt(cx, cy) {
  pointer.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(tower.children, true);
  for (const h of hits) {
    const c = compFromObject(h.object);
    if (c && !c.userData.hidden) return c;
  }
  return null;
}
function setEmissive(comp, hex, intensity) {
  if (!comp) return;
  for (const m of comp.userData.mats) { m.emissive.setHex(hex); m.emissiveIntensity = intensity; }
}
function select(comp) {
  if (selected) setEmissive(selected, 0x000000, 0);
  selected = comp;
  if (comp) {
    setEmissive(comp, 0xff2417, 0.55);
    document.getElementById('iid').textContent = comp.userData.id;
    document.getElementById('iname').textContent = comp.userData.name;
    document.getElementById('idesc').textContent = comp.userData.desc;
    document.getElementById('iid').style.color = '#ff5040';
  } else {
    document.getElementById('iid').textContent = '— —';
    document.getElementById('iname').textContent = '点击塔身任意构件';
    document.getElementById('idesc').textContent = '拖拽旋转 · 滚轮缩放 · 右键平移 · 点击选中 · 双击隔离';
    document.getElementById('iid').style.color = '#d8b25e';
  }
  document.getElementById('bIso').disabled = !comp;
  document.getElementById('bHide').disabled = !comp;
}
function hideComp(comp, v) { comp.userData.hidden = v; comp.visible = !v; }
function showAll() { comps.forEach(c => hideComp(c, false)); }
function isolate(comp) { comps.forEach(c => hideComp(c, c !== comp)); }

let downX = 0, downY = 0;
const dom = renderer.domElement;
dom.addEventListener('pointerdown', e => { downX = e.clientX; downY = e.clientY; introDone = true; controls.autoRotate = false; });
dom.addEventListener('pointerup', e => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
  select(pickAt(e.clientX, e.clientY));
});
dom.addEventListener('pointermove', e => {
  const c = pickAt(e.clientX, e.clientY);
  if (c === hovered) return;
  if (hovered && hovered !== selected) setEmissive(hovered, 0x000000, 0);
  hovered = c;
  if (hovered && hovered !== selected) setEmissive(hovered, 0x8a4a1a, 0.5);
  dom.style.cursor = hovered ? 'pointer' : 'grab';
});
dom.addEventListener('dblclick', e => { const c = pickAt(e.clientX, e.clientY); if (c) isolate(c); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') select(null); });

const bExplode = document.getElementById('bExplode');
function setExplodeTarget(t) {
  explodeTarget = t;
  bExplode.textContent = t > 0.5 ? '聚合复原' : '拆解视图';
  bExplode.classList.toggle('on', t > 0.5);
}
bExplode.onclick = () => setExplodeTarget(explodeTarget > 0.5 ? 0 : 1);
document.getElementById('bAll').onclick = () => { showAll(); };
document.getElementById('bIso').onclick = () => { if (selected) isolate(selected); };
document.getElementById('bHide').onclick = () => { if (selected) hideComp(selected, true); select(null); };
document.getElementById('bReset').onclick = () => {
  introT = 0; introDone = false; controls.autoRotate = true;
};
setExplodeTarget(1);

/* ---------------- 动画 ---------------- */
const clock = new THREE.Clock();
let introT = 0, introDone = false;
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // 入场相机
  if (!introDone) {
    introT += dt / 2.6;
    if (introT >= 1) { introT = 1; introDone = true; }
    const e = easeOut(introT);
    camera.position.lerpVectors(CAM_START, CAM_END, e);
    controls.target.lerpVectors(V3(0, 18, 0), TGT_END, e);
  }
  controls.update();

  // 爆炸插值
  explodeT += (explodeTarget - explodeT) * Math.min(1, dt * 3.2);
  if (Math.abs(explodeTarget - explodeT) < 0.001) explodeT = explodeTarget;
  for (const c of comps) {
    const u = c.userData;
    let px = 0, py = 0, pz = 0, sxz = 1;
    if (u.expP) { px = u.expP.x * explodeT; py = u.expP.y * explodeT; pz = u.expP.z * explodeT; }
    if (u.expS) { sxz = 1 + (u.expS.x - 1) * explodeT; }
    if (u.bobble && u.expP) py += Math.sin(time * 0.7 + u.phase) * 0.1 * explodeT;
    c.position.set(u.basePos.x + px, u.basePos.y + py, u.basePos.z + pz);
    c.scale.set(u.baseScale.x * sxz, u.baseScale.y, u.baseScale.z * sxz);
    for (const tm of u.mirrors) tm.position.y = -2 * c.position.y;
  }
  // 大样旋转 + 分层
  bigSample.rotation.y += dt * 0.12;
  bigSample.children.forEach(ch => {
    if (ch.userData.partY !== undefined) ch.position.y = ch.userData.partY * explodeT;
  });

  dust.rotation.y += dt * 0.008;
  dust.position.y = Math.sin(time * 0.18) * 1.2;

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

})();
