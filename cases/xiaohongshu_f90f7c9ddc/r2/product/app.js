/* ============================================================
   小西天 · 大雄宝殿内部悬塑 —— 程序化三维复原
   Three.js r160（内联）。几何体按材质分桶合并，小佛像走 InstancedMesh。
   ============================================================ */

// ---------- 基础 ----------
const HALL = { W: 16.8, D: 13.2, H: 7.4 };           // 殿堂内空尺寸
const LAYERS = 6, LH = 1.06, Y0 = 0.92, UW = 1.06;   // 悬塑层数 / 层高 / 层底 / 单元宽
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const loadText = document.getElementById('loadText');
const loadBar = document.querySelector('#loadBar i');
async function phase(txt, pct) { loadText.textContent = txt; loadBar.style.width = pct + '%'; await frame(); }

function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- 渲染器 / 场景 / 相机 ----------
let renderer;
try {
  renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('err').style.display = 'flex';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(0x0e0a08);
scene.fog = new FogExp2(0x0e0a08, 0.011);

const camera = new PerspectiveCamera(58, innerWidth / innerHeight, 0.06, 80);
camera.position.set(0, 3.0, 3.5);

// 相机安全区：殿堂中央，任何情况下不会穿出墙壁 / 穿模
const SAFE = { min: new Vector3(-5.3, 0.5, -3.6), max: new Vector3(5.3, 5.4, 3.6) };

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 1.2;
controls.maxDistance = 5.0;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = 1.62;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;
controls.zoomSpeed = 0.8;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- 贴图（Canvas 程序化绘制） ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const dragonTex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#1d5c40'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 20, 8); }
  g.strokeStyle = '#0f3d2b'; g.lineWidth = 20; g.beginPath();
  for (let x = 0; x <= 320; x += 8) { const y = 64 + Math.sin(x * 0.045) * 24; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke();
  g.strokeStyle = '#d4af37'; g.lineWidth = 13; g.beginPath();
  for (let x = 0; x <= 320; x += 8) { const y = 64 + Math.sin(x * 0.045) * 24; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke();
  g.fillStyle = '#d4af37';
  for (let x = 12; x < 310; x += 26) {
    const y = 64 + Math.sin(x * 0.045) * 24;
    g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 7, y - 30); g.lineTo(x + 14, y - 14); g.fill();
  }
  g.beginPath(); g.arc(348, 60, 20, 0, 7); g.fill();
  g.fillStyle = '#0f3d2b'; g.beginPath(); g.arc(342, 56, 4, 0, 7); g.fill();
  g.strokeStyle = '#d4af37'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(360, 52); g.quadraticCurveTo(380, 40, 386, 26); g.stroke();
  g.beginPath(); g.moveTo(356, 74); g.quadraticCurveTo(372, 82, 384, 80); g.stroke();
  g.strokeStyle = '#d4af37'; g.lineWidth = 4;
  for (const [cx, cy, r] of [[420, 40, 14], [455, 80, 18], [405, 95, 11], [470, 30, 10]]) {
    g.beginPath();
    for (let a = 0; a < 16; a += 0.5) { const rr = r * a / 16; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; a === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }
});
dragonTex.wrapS = RepeatWrapping;

const roofTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#2a6b4a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(10,40,26,.55)'; g.lineWidth = 2;
  for (let x = 0; x <= w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  g.strokeStyle = 'rgba(190,230,200,.28)';
  for (let y = 6; y <= h; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});
roofTex.wrapS = roofTex.wrapT = RepeatWrapping;

const fasciaTex = canvasTex(128, 64, (g, w, h) => {
  g.fillStyle = '#7e1f1a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d4af37'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  for (let x = 10; x < w; x += 20) { g.beginPath(); g.arc(x, h / 2, 4, 0, 7); g.fill(); }
});
fasciaTex.wrapS = RepeatWrapping;

const panelTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#6e1512'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d4af37'; g.lineWidth = 4; g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = '#1d5c40'; g.fillRect(22, 22, w - 44, h - 44);
  g.strokeStyle = '#d4af37'; g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
  g.fillStyle = '#d4af37';
  for (const [x, y] of [[15, 15], [w - 15, 15], [15, h - 15], [w - 15, h - 15]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
});

const plasterTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#2c1f18'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 420; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(18,10,6,${Math.random() * 0.25})` : `rgba(70,50,34,${Math.random() * 0.22})`;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 6, 0, 7); g.fill();
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * w; const gr = g.createLinearGradient(x, 0, x + 14, 0);
    gr.addColorStop(0, 'rgba(20,12,8,0)'); gr.addColorStop(.5, 'rgba(20,12,8,.28)'); gr.addColorStop(1, 'rgba(20,12,8,0)');
    g.fillStyle = gr; g.fillRect(x, 0, 14, h);
  }
});
plasterTex.wrapS = plasterTex.wrapT = RepeatWrapping;

const floorTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#262019'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '90,80,60'},${Math.random() * .12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = '#17120c'; g.lineWidth = 5;
  g.strokeRect(0, 0, w / 2, h / 2); g.strokeRect(w / 2, 0, w / 2, h / 2);
  g.strokeRect(0, h / 2, w / 2, h / 2); g.strokeRect(w / 2, h / 2, w / 2, h / 2);
});
floorTex.wrapS = floorTex.wrapT = RepeatWrapping;

const roundelTex = canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#1d5c40'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill();
  g.strokeStyle = '#d4af37'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  g.strokeStyle = '#c03a28'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 96, 0, 7); g.stroke();
  g.strokeStyle = '#d4af37'; g.lineWidth = 11; g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a < 21; a += 0.4) { const r = 8 + a * 1.15; const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r; a === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke();
  g.fillStyle = '#c03a28';
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6; g.beginPath(); g.arc(128 + Math.cos(a) * 55, 128 + Math.sin(a) * 55, 9, 0, 7); g.fill(); }
});

const haloTex = canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {
    const a0 = i / 22 * Math.PI * 2, a1 = (i + 1) / 22 * Math.PI * 2;
    g.fillStyle = i % 2 ? '#c03a28' : '#d4af37';
    g.beginPath(); g.moveTo(128, 128);
    g.quadraticCurveTo(128 + Math.cos(a0 + 0.06) * 128, 128 + Math.sin(a0 + 0.06) * 128, 128 + Math.cos((a0 + a1) / 2) * 92, 128 + Math.sin((a0 + a1) / 2) * 92);
    g.quadraticCurveTo(128 + Math.cos(a1 - 0.06) * 128, 128 + Math.sin(a1 - 0.06) * 128, 128, 128);
    g.fill();
  }
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 66);
  gr.addColorStop(0, 'rgba(232,200,106,.95)'); gr.addColorStop(1, 'rgba(232,200,106,.18)');
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 66, 0, 7); g.fill();
  g.strokeStyle = '#d4af37'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 62, 0, 7); g.stroke();
});

const plaqueTex = canvasTex(512, 160, (g, w, h) => {
  g.fillStyle = '#101d33'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d4af37'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  g.lineWidth = 2; g.strokeRect(16, 16, w - 32, h - 32);
  g.fillStyle = '#e8c86a'; g.font = 'bold 92px "KaiTi","STKaiti","Kaiti SC","Noto Serif SC",serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 4;
  g.fillText('大雄寶殿', w / 2, h / 2 + 4);
});

function coupletTex(chars) {
  return canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#123527'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d4af37'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#e8c86a'; g.font = 'bold 84px "KaiTi","STKaiti","Kaiti SC","Noto Serif SC",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    [...chars].forEach((ch, i) => g.fillText(ch, w / 2, 76 + i * 118));
  });
}
const coupletR = coupletTex('西天佛國'), coupletL = coupletTex('乾坤淨土');

const doorTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#5e1310'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d4af37'; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#d4af37';
  for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) {
    g.beginPath(); g.arc(20 + c * 29, 24 + r * 33, 7, 0, 7); g.fill();
    g.fillStyle = '#8a6d2a'; g.beginPath(); g.arc(20 + c * 29 + 2, 24 + r * 33 + 2, 3, 0, 7); g.fill();
    g.fillStyle = '#d4af37';
  }
});

function robeTex(base, fold, trim, patch) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = fold; g.lineWidth = 4; g.globalAlpha = 0.55;
    for (let i = 0; i <= 11; i++) {
      g.beginPath();
      for (let y = 0; y <= h; y += 8) { const x = i * 11.6 + Math.sin(y * 0.05 + i) * 3; y === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
    if (patch) {
      g.strokeStyle = '#d8b25c'; g.lineWidth = 2.5;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
        g.fillStyle = 'rgba(142,47,36,.88)'; g.fillRect(w / 2 + 4 + c * 16, 30 + r * 34, 14, 32);
        g.strokeRect(w / 2 + 4 + c * 16, 30 + r * 34, 14, 32);
      }
    }
    g.fillStyle = trim; g.fillRect(0, h - 26, w, 10); g.fillRect(0, 0, w, 6);
  });
}
const buddhaRobeTex = robeTex('#b3894a', '#7a5426', '#e0bc6a', true);
const sashTex = robeTex('#8e2f24', '#5e1a12', '#e0bc6a', false);
function monkRobeTex(base, fold) { return robeTex(base, fold, '#d8b25c', false); }
const monkRobes = [
  monkRobeTex('#7fa3b8', '#4a6a7c'),
  monkRobeTex('#d9a0a8', '#a86a74'),
  monkRobeTex('#a8c0a0', '#6e8a66'),
  monkRobeTex('#9a9a8f', '#6a6a60'),
  monkRobeTex('#c8a86a', '#8a6e3c'),
];

// 小佛面部（头部球体贴图，u=0.5 为正面，几何已预旋转使面朝 +z）
const smallFaceTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#e8c86a'); gr.addColorStop(1, '#b8923e');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#241d18';
  g.beginPath(); g.arc(64, 30, 34, Math.PI, 0); g.fill();
  for (let r = 0; r < 3; r++) for (let i = 0; i < 9 - r * 2; i++) {
    g.beginPath(); g.arc(30 + i * 8.5 + r * 4, 12 + r * 8, 1.8, 0, 7); g.fill();
  }
  g.strokeStyle = '#8a6d2a'; g.lineWidth = 2;
  g.beginPath(); g.arc(64, 46, 3, 0, 7); g.stroke();
  g.strokeStyle = '#3a2415'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(42, 52); g.quadraticCurveTo(50, 47, 58, 51); g.stroke();
  g.beginPath(); g.moveTo(70, 51); g.quadraticCurveTo(78, 47, 86, 52); g.stroke();
  g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(44, 62); g.quadraticCurveTo(51, 67, 58, 62); g.stroke();
  g.beginPath(); g.moveTo(70, 62); g.quadraticCurveTo(77, 67, 84, 62); g.stroke();
  g.strokeStyle = 'rgba(90,60,30,.6)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(64, 64); g.lineTo(63, 70); g.stroke();
  g.strokeStyle = '#a03a2a'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(58, 74); g.quadraticCurveTo(64, 77, 70, 74); g.stroke();
});

const monkFaceTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#c9a37b'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(120,85,50,.35)'; g.beginPath(); g.arc(64, 34, 36, Math.PI, 0); g.fill();
  g.strokeStyle = '#4a3020'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(42, 54); g.quadraticCurveTo(50, 49, 58, 53); g.stroke();
  g.beginPath(); g.moveTo(70, 53); g.quadraticCurveTo(78, 49, 86, 54); g.stroke();
  g.strokeStyle = '#3a2415'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(44, 63); g.quadraticCurveTo(51, 68, 58, 63); g.stroke();
  g.beginPath(); g.moveTo(70, 63); g.quadraticCurveTo(77, 68, 84, 63); g.stroke();
  g.strokeStyle = 'rgba(90,60,30,.6)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(64, 65); g.lineTo(63, 71); g.stroke();
  g.strokeStyle = '#a03a2a'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(58, 75); g.quadraticCurveTo(64, 78, 70, 75); g.stroke();
});

const guardianFaceTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#b08a5e'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#3a2415'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(40, 50); g.lineTo(58, 56); g.stroke();
  g.beginPath(); g.moveTo(88, 50); g.lineTo(70, 56); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(44, 63); g.quadraticCurveTo(51, 67, 58, 63); g.stroke();
  g.beginPath(); g.moveTo(70, 63); g.quadraticCurveTo(77, 67, 84, 63); g.stroke();
  g.strokeStyle = 'rgba(80,50,25,.7)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(64, 65); g.lineTo(63, 72); g.stroke();
  g.strokeStyle = '#7a2a1a'; g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(56, 77); g.quadraticCurveTo(64, 81, 72, 77); g.stroke();
});

// ---------- 材质 ----------
const std = (o) => new MeshStandardMaterial(o);
const MATS = {
  green: std({ color: 0x2e7d5b, roughness: 0.75, metalness: 0.05 }),
  greenDark: std({ color: 0x1d5c40, roughness: 0.8 }),
  red: std({ color: 0x9e2b25, roughness: 0.78 }),
  redDark: std({ color: 0x6e1512, roughness: 0.85 }),
  gold: std({ color: 0xd4af37, roughness: 0.32, metalness: 0.85 }),
  goldDeep: std({ color: 0xb08a2e, roughness: 0.42, metalness: 0.8 }),
  pink: std({ color: 0xe8a0b4, roughness: 0.8 }),
  pinkLight: std({ color: 0xf2c4cd, roughness: 0.85 }),
  white: std({ color: 0xf5ead8, roughness: 0.9 }),
  dark: std({ color: 0x140d09, roughness: 1 }),
  wood: std({ color: 0x4a3226, roughness: 0.9 }),
  flesh: std({ color: 0xc9a37b, roughness: 0.55 }),
  hair: std({ color: 0x241d18, roughness: 0.6 }),
  roofTile: std({ map: roofTex, roughness: 0.7 }),
  plaster: std({ map: plasterTex, roughness: 1 }),
  fascia: std({ map: fasciaTex, roughness: 0.85 }),
  panelRed: std({ map: panelTex, roughness: 0.85 }),
  dragon: std({ map: dragonTex.clone(), roughness: 0.7 }),
  floor: std({ map: floorTex, roughness: 0.6, metalness: 0.08 }),
  ceiling: std({ color: 0x241812, roughness: 1 }),
  halo: std({ map: haloTex, transparent: true, side: DoubleSide, roughness: 0.6, metalness: 0.25, depthWrite: false }),
  roundel: std({ map: roundelTex, transparent: true, side: DoubleSide, roughness: 0.7, depthWrite: false }),
  robeBuddha: std({ map: buddhaRobeTex, roughness: 0.72 }),
  sash: std({ map: sashTex, roughness: 0.7 }),
  door: std({ map: doorTex, roughness: 0.7 }),
  plaque: std({ map: plaqueTex, roughness: 0.7 }),
  coupletR: std({ map: coupletR, roughness: 0.75 }),
  coupletL: std({ map: coupletL, roughness: 0.75 }),
  monkFace: std({ map: monkFaceTex, roughness: 0.55 }),
  guardianFace: std({ map: guardianFaceTex, roughness: 0.6 }),
  monkRobes: monkRobes.map(t => std({ map: t, roughness: 0.8 })),
  goldHead: std({ map: smallFaceTex, roughness: 0.38, metalness: 0.7 }),
  eyesDark: std({ color: 0x2a1a10, roughness: 0.5 }),
  lipsRed: std({ color: 0xa03a28, roughness: 0.5 }),
  vc: std({ vertexColors: true, roughness: 0.8 }),
};
MATS.dragon.map.repeat.set(4, 1);

// ---------- 几何分桶合并系统 ----------
const BUCK = {};
function put(key, geo, m) { (BUCK[key] || (BUCK[key] = [])).push(geo.clone().applyMatrix4(m)); }
function mat4(px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new Matrix4();
  m.compose(new Vector3(px, py, pz), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(sx, sy, sz));
  return m;
}

// 常用模板几何
const colGeo = new CylinderGeometry(0.045, 0.052, 1, 8);
const bandGeo = new TorusGeometry(0.055, 0.013, 6, 12); bandGeo.rotateX(Math.PI / 2);
const blockGeo = new BoxGeometry(0.07, 0.06, 0.06);
const roofCone = new ConeGeometry(1, 1, 4); roofCone.rotateY(Math.PI / 4);
const ridgeGeo = new BoxGeometry(0.3, 0.055, 0.07);
const bellGeo = new ConeGeometry(0.02, 0.05, 6); bellGeo.rotateX(Math.PI);
const coneOrn = new ConeGeometry(0.026, 0.08, 6);
const beadGeo = new SphereGeometry(0.04, 8, 6);
const petalGeo = new SphereGeometry(0.05, 6, 5); petalGeo.scale(1, 1.75, 0.45);
const petalBig = new SphereGeometry(0.1, 8, 6); petalBig.scale(1, 1.9, 0.5);
const cylR06 = new CylinderGeometry(0.06, 0.07, 0.05, 8);
const torusR055 = new TorusGeometry(0.055, 0.013, 6, 10); torusR055.rotateX(Math.PI / 2);

// 小佛（莲台 / 身 / 头），InstancedMesh
const pedGeo = mergeGeometries([cylR06, torusR055.clone().translate(0, 0.045, 0)]);
const bodyGeo = new LatheGeometry([
  new Vector2(0.001, 0), new Vector2(0.075, 0), new Vector2(0.088, 0.02), new Vector2(0.105, 0.06),
  new Vector2(0.115, 0.10), new Vector2(0.10, 0.145), new Vector2(0.062, 0.17), new Vector2(0.036, 0.19),
  new Vector2(0.032, 0.21)
], 10);
const headGeo = new SphereGeometry(0.055, 12, 10); headGeo.rotateY(-Math.PI / 2);

// 实例登记
const inst = { ped: [], body: [], head: [], ceilPed: [], ceilBody: [], ceilHead: [] };
function regBuddha(arr, x, y, z, yaw, s) { arr.push({ p: new Vector3(x, y, z), y: yaw, s }); }

// ---------- 祥云 / 卷草 ----------
class SwirlCurve extends Curve {
  constructor(cx, cy, cz, R, turns, h, phase) { super(); Object.assign(this, { cx, cy, cz, R, turns, h, phase }); }
  getPoint(t, target = new Vector3()) {
    const a = this.phase + t * this.turns * Math.PI * 2;
    const r = this.R * (1 - 0.72 * t);
    return target.set(this.cx + Math.cos(a) * r, this.cy + t * this.h, this.cz + Math.sin(a) * r);
  }
}
function putSwirl(key, cx, cy, cz, R, turns, h, phase) {
  const geo = new TubeGeometry(new SwirlCurve(cx, cy, cz, R, turns, h, phase), 42, 0.034, 6, false);
  put(key, geo, mat4(0, 0, 0));
}
class StreamerCurve extends Curve {
  constructor(u, y0, y1, d, seed) { super(); Object.assign(this, { u, y0, y1, d, seed }); }
  getPoint(t, target = new Vector3()) {
    return target.set(
      this.u + Math.sin(t * 7 + this.seed) * 0.10,
      this.y0 + (this.y1 - this.y0) * t,
      this.d + Math.cos(t * 5 + this.seed) * 0.09
    );
  }
}
function putStreamer(u, y0, y1, d, seed) {
  const geo = new TubeGeometry(new StreamerCurve(u, y0, y1, d, seed), 60, 0.048, 6, false);
  const pos = geo.attributes.position, n = pos.count, colors = new Float32Array(n * 3);
  const cA = new Color(0xe8a0b4), cB = new Color(0xf5ead8), cC = new Color(0xd4af37), tmp = new Color();
  const bands = Math.max(3, Math.round((y1 - y0) / 0.65));
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i), t = (y - y0) / (y1 - y0);
    const b = Math.floor(t * bands) % 4;
    tmp.copy(b === 3 ? cC : (b % 2 ? cB : cA));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  put('vc', geo, mat4(0, 0, 0));
}

// ---------- 悬塑单元（一层一开间：平座、佛龛、廊柱、檐顶、莲瓣、垂花） ----------
function wallUnit(u0, L, yaw, at, rng, doorZone) {
  const y0 = Y0 + L * LH, w = UW;
  const depth = 0.46 - L * 0.03;
  const cx = u0 + w / 2;
  if (doorZone && cx > 6.2 && cx < 10.6 && L < 3) return;

  // M：墙体局部坐标 → 世界（面朝房间）
  const M = (u, d, y, o = {}) => {
    const p = at(u, d, y);
    return mat4(p.x, p.y, p.z, o.rx || 0, yaw + (o.ry || 0), o.rz || 0, o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  };
  // WM：先偏航再绕局部 X 倾斜（用于莲瓣）
  const WM = (u, d, y, spin, tilt) => {
    const p = at(u, d, y);
    const q = new Quaternion().setFromEuler(new Euler(tilt, yaw + spin, 0, 'YXZ'));
    return new Matrix4().compose(p, q, new Vector3(1, 1, 1));
  };

  // 平座 + 朱红缘板
  put('wood', new BoxGeometry(w - 0.05, 0.09, depth), M(cx, depth / 2 - 0.02, y0 - 0.02));
  put('fascia', new BoxGeometry(w - 0.05, 0.1, 0.03), M(cx, depth - 0.005, y0 - 0.02));

  // 佛龛：深色背板 + 拱形龛框 + 龛楣
  const aW = w - 0.22, aR = (w - 0.26) / 2, aY = y0 + 0.34;
  put('dark', new BoxGeometry(aW, 0.74, 0.04), M(cx, 0.03, y0 + 0.40));
  put('green', new BoxGeometry(w - 0.24, 0.1, 0.09), M(cx, 0.05, y0 + 0.84));
  put('gold', new TorusGeometry(aR + 0.02, 0.038, 6, 14, Math.PI), M(cx, 0.05, aY));
  put('gold', new BoxGeometry(0.06, 0.3, 0.1), M(cx - aR - 0.02, 0.05, aY - 0.13));
  put('gold', new BoxGeometry(0.06, 0.3, 0.1), M(cx + aR + 0.02, 0.05, aY - 0.13));

  // 廊柱与金箍
  for (const sx of [-1, 1]) {
    put('green', colGeo, M(cx + sx * (w / 2 - 0.07), 0.12, y0 + LH * 0.32, { sy: LH * 0.64 }));
    put('gold', bandGeo, M(cx + sx * (w / 2 - 0.07), 0.12, y0 + 0.05));
    put('gold', bandGeo, M(cx + sx * (w / 2 - 0.07), 0.12, y0 + LH * 0.64));
  }
  // 阑额 + 金线
  put('green', new BoxGeometry(w - 0.08, 0.1, 0.12), M(cx, 0.1, y0 + LH - 0.12));
  put('gold', new BoxGeometry(w - 0.06, 0.025, 0.13), M(cx, 0.1, y0 + LH - 0.065));

  // 斗拱一排
  for (let k = -2; k <= 2; k++) put(k % 2 ? 'red' : 'green', blockGeo, M(cx + k * 0.17, 0.12, y0 + LH - 0.02));

  // 檐顶：绿瓦 + 戗脊 + 脊头 + 四角风铃
  put('roofTile', roofCone, M(cx, 0.16, y0 + LH + 0.08, { ry: rng() * 0.4, sx: w * 0.86, sy: 0.2, sz: 0.5 }));
  put('gold', ridgeGeo, M(cx, 0.16, y0 + LH + 0.17, { sx: w * 0.55, sy: 1.4, sz: 1 }));
  put('gold', coneOrn, M(cx - w * 0.26, 0.16, y0 + LH + 0.19, { rz: 0.5, sy: 1.4 }));
  put('gold', coneOrn, M(cx + w * 0.26, 0.16, y0 + LH + 0.19, { rz: -0.5, sy: 1.4 }));
  for (const [bx, bd] of [[-w * 0.4, 0.40], [w * 0.4, 0.40], [-w * 0.4, 0.10], [w * 0.4, 0.10]])
    put('gold', bellGeo, M(cx + bx, bd, y0 + LH - 0.02));

  // 垂花
  put('gold', coneOrn, M(cx - w * 0.2, depth + 0.02, y0 - 0.09));
  put('gold', coneOrn, M(cx + w * 0.2, depth + 0.02, y0 - 0.09));
  put('pinkLight', beadGeo, M(cx, depth + 0.02, y0 - 0.075, { sy: 0.7 }));

  // 莲瓣裙边
  for (let k = 0; k < 6; k++)
    put(k % 3 === 2 ? 'gold' : 'pink', petalGeo, WM(u0 + 0.1 + k * (w - 0.2) / 5, depth + 0.01, y0 - 0.02, rng() * 0.6, -0.5));

  // 龛内小佛
  const nB = L === 0 ? 1 : L === 1 ? 2 : 3;
  const sB = L === 0 ? 1.15 : 1.0;
  for (let k = 0; k < nB; k++) {
    const off = nB === 1 ? 0 : (k - (nB - 1) / 2) * 0.22;
    regBuddha(inst.ped, cx + off, y0 + 0.13, 0.10, yaw, sB);
    regBuddha(inst.body, cx + off, y0 + 0.18, 0.10, yaw, sB);
    regBuddha(inst.head, cx + off, y0 + 0.27, 0.10, yaw, sB);
  }
  // 平座前沿小佛
  for (let k = 0; k < 3; k++) {
    const off = (k - 1) * 0.3;
    regBuddha(inst.ped, cx + off, y0 + 0.0, depth - 0.10, yaw, 0.55);
    regBuddha(inst.body, cx + off, y0 + 0.045, depth - 0.10, yaw, 0.55);
    regBuddha(inst.head, cx + off, y0 + 0.12, depth - 0.10, yaw, 0.55);
  }
}

// ---------- 宝塔 / 楼阁 ----------
function pagoda(u, d, yBase, stories, w0, rng, ry = 0, hBase = 0.19) {
  let y = yBase, w = w0;
  for (let s = 0; s < stories; s++) {
    const h = hBase + rng() * 0.06;
    put(s % 2 ? 'green' : 'red', new BoxGeometry(w, h, w * 0.7), mat4(u, y + h / 2, d, 0, ry));
    put('roofTile', roofCone, mat4(u, y + h + 0.045, d, 0, ry + rng() * 0.2, w * 1.3, 0.085, w * 0.95));
    put('gold', ridgeGeo, mat4(u, y + h + 0.085, d, 0, ry, w * 1.25, 1.2, 1));
    y += h + 0.09; w *= 0.82;
  }
  put('gold', coneOrn, mat4(u, y + 0.05, d, 0, ry));
  put('gold', beadGeo, mat4(u, y + 0.15, d, 0, ry, 1.5, 1.5, 1.5));
}
function pavilion(uC, d, yBase, LHh, rng, yaw) {
  put('panelRed', new BoxGeometry(2.05, 0.12, 0.5), mat4(uC, yBase + 0.06, d));
  for (const k of [-0.85, -0.3, 0.3, 0.85]) {
    put('green', colGeo, mat4(uC + k, d + 0.08, yBase + 0.12 + LHh * 0.33, { sy: LHh * 0.66 }));
    put('gold', bandGeo, mat4(uC + k, d + 0.08, yBase + 0.12 + LHh * 0.66));
  }
  for (const k of [-0.5, 0.5]) {
    put('dark', new BoxGeometry(0.62, LHh * 0.55, 0.05), mat4(uC + k, d + 0.02, yBase + LHh * 0.32));
    put('gold', new TorusGeometry(0.28, 0.03, 6, 12, Math.PI), mat4(uC + k, d + 0.05, yBase + LHh * 0.28));
    regBuddha(inst.ped, uC + k, yBase + 0.14, d + 0.08, yaw, 1.3);
    regBuddha(inst.body, uC + k, yBase + 0.22, d + 0.08, yaw, 1.3);
    regBuddha(inst.head, uC + k, yBase + 0.34, d + 0.08, yaw, 1.3);
  }
  put('green', new BoxGeometry(1.9, 0.09, 0.14), mat4(uC, d + 0.08, yBase + LHh - 0.1));
  put('roofTile', roofCone, mat4(uC, d + 0.1, yBase + LHh + 0.1, { sx: 1.06, sy: 0.22, sz: 0.55 }));
  put('gold', ridgeGeo, mat4(uC, d + 0.1, yBase + LHh + 0.2, { sx: 0.9, sy: 1.4 }));
  for (const k of [-0.8, 0.8]) put('gold', bellGeo, mat4(uC + k, d + 0.32, yBase + LHh - 0.02));
}

// ---------- 墙体生成 ----------
function buildWall(len, origin, dir, n, seed, doorZone = false) {
  const rng = mulberry(seed);
  const yaw = Math.atan2(n.x, n.z);
  const at = (u, d, y) => origin.clone().addScaledVector(dir, u).addScaledVector(n, d).setY(y);
  const nu = Math.floor(len / UW);
  const off = (len - nu * UW) / 2;

  for (let L = 0; L < LAYERS; L++)
    for (let i = 0; i < nu; i++)
      wallUnit(off + i * UW + 0.02, L, yaw, at, rng, doorZone);

  // 柱间宝塔（错落层叠如“悬塑群山”）
  for (let j = 0; j <= nu; j += 4) {
    const u = off + j * UW;
    if (doorZone && u > 5.9 && u < 10.6) continue;
    const stories = 3 + Math.floor(rng() * 3) + (j % 8 === 0 ? 1 : 0);
    pagoda(u, 0.28, Y0 + LH * (1 + (j % 2)) - 0.1, stories, 0.3, rng, rng() * 0.8);
  }
  // 双开间楼阁
  for (let j = 2; j <= nu - 1; j += 8) {
    const u = off + j * UW;
    if (doorZone && u > 5.9 && u < 10.6) continue;
    pavilion(u, 0.2, Y0 + LH * (2 + (j % 3)) - 0.15, LH, rng, yaw);
  }
  // 层间祥云
  for (let L = 0; L < LAYERS - 1; L++)
    for (let i = 0; i < nu; i += 2) {
      const u = off + i * UW + UW * (0.3 + rng() * 0.4);
      const yC = Y0 + L * LH + LH - 0.05;
      const key = ['pink', 'white', 'gold', 'greenDark'][Math.floor(rng() * 4)];
      const p0 = at(u, 0.3, yC);
      putSwirl(key, p0.x, yC, p0.z, 0.2 + rng() * 0.14, 1.5 + rng(), 0.3 + rng() * 0.25, rng() * 6.28);
      if (rng() < 0.4) {
        const p1 = at(u + 0.3, 0.26, yC);
        putSwirl(key, p1.x, yC - 0.1, p1.z, 0.14 + rng() * 0.1, -(1 + rng()), 0.2, rng() * 6.28);
      }
    }
  // 攀援升龙（粉白相间云气）
  for (let j = 3; j <= nu - 2; j += 6) {
    const u = off + j * UW;
    if (doorZone && u > 5.9 && u < 10.6) continue;
    putStreamer(u, Y0 - 0.1, Y0 + 5 * LH + 0.1, 0.3, rng() * 6.28);
  }
}

// ---------- 大坐佛 ----------
function limb(a, b, r1, r2, mat, parent) {
  const d = b.clone().sub(a), len = d.length();
  const m = new Mesh(new CylinderGeometry(r2, r1, len, 8), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}
function sphOnFace(head, r, thetaDeg, phiDeg, geo, mat) {
  const th = thetaDeg * Math.PI / 180, ph = phiDeg * Math.PI / 180;
  const m = new Mesh(geo, mat);
  m.position.set(r * Math.sin(th) * Math.sin(ph), r * Math.cos(th), r * Math.sin(th) * Math.cos(ph));
  m.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)));
  m.castShadow = true;
  head.add(m);
  return m;
}
function buildBuddha(scale = 1) {
  const g = new Group();
  const base = new Mesh(new CylinderGeometry(1.0, 1.12, 0.42, 8), MATS.panelRed);
  base.position.y = 0.21; g.add(base);
  const trim = new Mesh(new TorusGeometry(1.03, 0.03, 6, 8), MATS.gold);
  trim.rotation.x = Math.PI / 2; trim.position.y = 0.42; g.add(trim);
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    const p = new Mesh(petalBig, MATS.pink);
    p.position.set(Math.cos(a) * 0.86, 0.52, Math.sin(a) * 0.86);
    p.rotation.order = 'YXZ';
    p.rotation.y = Math.PI / 2 - a;
    p.rotation.x = 0.35;
    g.add(p);
  }
  const seat = new Mesh(new CylinderGeometry(0.9, 0.95, 0.16, 16), MATS.red);
  seat.position.y = 0.5; g.add(seat);
  const seatTrim = new Mesh(new TorusGeometry(0.88, 0.025, 6, 20), MATS.gold);
  seatTrim.rotation.x = Math.PI / 2; seatTrim.position.y = 0.58; g.add(seatTrim);
  // 裙裾与躯干（衣纹贴图）
  const skirt = new Mesh(new LatheGeometry([
    new Vector2(0.02, 0.56), new Vector2(0.98, 0.58), new Vector2(1.0, 0.66),
    new Vector2(0.9, 0.8), new Vector2(0.66, 0.95), new Vector2(0.52, 1.06), new Vector2(0.46, 1.1)
  ], 20), MATS.robeBuddha);
  g.add(skirt);
  const torso = new Mesh(new LatheGeometry([
    new Vector2(0.44, 1.02), new Vector2(0.5, 1.16), new Vector2(0.56, 1.36),
    new Vector2(0.585, 1.5), new Vector2(0.55, 1.6), new Vector2(0.3, 1.69), new Vector2(0.175, 1.72)
  ], 20), MATS.robeBuddha);
  g.add(torso);
  for (const s of [-1, 1]) {
    const knee = new Mesh(new SphereGeometry(1, 12, 10), MATS.robeBuddha);
    knee.scale.set(0.36, 0.24, 0.42); knee.position.set(s * 0.45, 0.72, 0.3); g.add(knee);
  }
  // 披帛
  const sashGeo = new TorusGeometry(0.52, 0.07, 8, 24, Math.PI * 0.85);
  sashGeo.rotateZ(Math.PI * 0.075);
  const sash = new Mesh(sashGeo, MATS.sash);
  sash.position.set(0.02, 1.5, 0.2); sash.rotation.set(-0.55, 0.35, 0); g.add(sash);
  // 手臂 + 禅定印
  limb(new Vector3(-0.55, 1.48, 0.05), new Vector3(-0.06, 1.1, 0.52), 0.075, 0.055, MATS.robeBuddha, g);
  limb(new Vector3(0.55, 1.48, 0.05), new Vector3(0.06, 1.1, 0.55), 0.075, 0.055, MATS.robeBuddha, g);
  const h1 = new Mesh(new SphereGeometry(1, 10, 8), MATS.flesh);
  h1.scale.set(0.1, 0.045, 0.06); h1.position.set(-0.03, 1.06, 0.56); g.add(h1);
  const h2 = h1.clone(); h2.position.set(0.03, 1.08, 0.58); g.add(h2);
  // 颈 + 头
  const neck = new Mesh(new CylinderGeometry(0.125, 0.14, 0.2, 10), MATS.flesh);
  neck.position.set(0, 1.78, 0.01); g.add(neck);
  const head = new Mesh(new SphereGeometry(0.3, 24, 18), MATS.flesh);
  head.position.set(0, 2.12, 0); g.add(head);
  const hair = new Mesh(new SphereGeometry(0.318, 24, 18), MATS.hair);
  hair.scale.set(1, 0.95, 0.92); hair.position.set(0, 2.16, -0.05); g.add(hair);
  const ush = new Mesh(new SphereGeometry(0.1, 12, 10), MATS.hair);
  ush.position.set(0, 2.44, -0.02); g.add(ush);
  const jewel = new Mesh(new SphereGeometry(0.035, 8, 6), MATS.gold);
  jewel.position.set(0, 2.56, -0.02); g.add(jewel);
  for (const s of [-1, 1]) {
    const ear = new Mesh(new SphereGeometry(1, 8, 8), MATS.flesh);
    ear.scale.set(0.05, 0.14, 0.04); ear.position.set(s * 0.3, 2.12, 0); g.add(ear);
    const curl = new Mesh(new TorusGeometry(0.028, 0.008, 5, 10), MATS.eyesDark);
    curl.position.set(s * 0.3, 2.1, 0.03); curl.rotation.y = Math.PI / 2; g.add(curl);
  }
  // 面部五官
  const eyeGeo = new TorusGeometry(0.068, 0.012, 6, 14, Math.PI); eyeGeo.rotateZ(Math.PI);
  sphOnFace(head, 0.295, 96, 18, eyeGeo, MATS.eyesDark);
  sphOnFace(head, 0.295, 96, -18, eyeGeo.clone(), MATS.eyesDark);
  const browGeo = new TorusGeometry(0.082, 0.013, 6, 14, Math.PI * 0.75); browGeo.rotateZ(Math.PI * 0.125);
  sphOnFace(head, 0.298, 85, 21, browGeo, MATS.eyesDark);
  sphOnFace(head, 0.298, 85, -21, browGeo.clone(), MATS.eyesDark);
  const nose = new Mesh(new BoxGeometry(0.05, 0.11, 0.05), MATS.flesh);
  sphOnFace(head, 0.285, 99, 0, nose.geometry, MATS.flesh); head.add(nose);
  const tip = new Mesh(new SphereGeometry(0.024, 8, 6), MATS.flesh);
  sphOnFace(head, 0.3, 104, 0, tip.geometry, MATS.flesh); head.add(tip);
  const lips = new Mesh(new SphereGeometry(1, 10, 8), MATS.lipsRed);
  lips.scale.set(0.1, 0.028, 0.035); sphOnFace(head, 0.29, 113, 0, lips.geometry, MATS.lipsRed); head.add(lips);
  const urna = new Mesh(new SphereGeometry(0.018, 8, 6), MATS.gold);
  sphOnFace(head, 0.299, 88, 0, urna.geometry, MATS.gold); head.add(urna);
  // 头光
  const halo = new Mesh(new CircleGeometry(0.82, 32), MATS.halo);
  halo.position.set(0, 2.2, -0.55); g.add(halo);
  const haloRing = new Mesh(new TorusGeometry(0.82, 0.028, 6, 32), MATS.gold);
  haloRing.position.copy(halo.position); g.add(haloRing);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.scale.setScalar(scale);
  return g;
}

// ---------- 弟子 / 罗汉立像 ----------
function discipleMesh(robeIdx, variant, matFace) {
  const g = new Group();
  const robe = MATS.monkRobes[robeIdx % MATS.monkRobes.length];
  const base = new Mesh(new CylinderGeometry(0.2, 0.23, 0.1, 10), MATS.pink);
  base.position.y = 0.05; g.add(base);
  const bt = new Mesh(new TorusGeometry(0.2, 0.02, 6, 12), MATS.gold);
  bt.rotation.x = Math.PI / 2; bt.position.y = 0.1; g.add(bt);
  const body = new Mesh(new LatheGeometry([
    new Vector2(0.001, 0.1), new Vector2(0.17, 0.12), new Vector2(0.185, 0.35),
    new Vector2(0.16, 0.7), new Vector2(0.175, 0.95), new Vector2(0.22, 1.25),
    new Vector2(0.235, 1.38), new Vector2(0.19, 1.48), new Vector2(0.07, 1.52)
  ], 12), robe);
  g.add(body);
  const sash = new Mesh(new TorusGeometry(0.175, 0.022, 6, 14), MATS.red);
  sash.rotation.x = Math.PI / 2; sash.position.y = 0.95; g.add(sash);
  if (variant === 1) {
    limb(new Vector3(-0.2, 1.36, 0.02), new Vector3(-0.045, 1.06, 0.2), 0.05, 0.04, robe, g);
    limb(new Vector3(0.2, 1.36, 0.02), new Vector3(0.045, 1.06, 0.2), 0.05, 0.04, robe, g);
  } else if (variant === 2) {
    limb(new Vector3(-0.2, 1.36, 0.02), new Vector3(-0.08, 1.02, 0.18), 0.05, 0.04, robe, g);
    limb(new Vector3(0.2, 1.36, 0.02), new Vector3(0.05, 1.02, 0.2), 0.05, 0.04, robe, g);
    const sc = new Mesh(new CylinderGeometry(0.028, 0.028, 0.46, 8), MATS.gold);
    sc.position.set(0, 1.06, 0.24); sc.rotation.z = 0.25; g.add(sc);
  } else if (variant === 3) {
    limb(new Vector3(-0.2, 1.36, 0.02), new Vector3(-0.1, 1.0, 0.16), 0.05, 0.04, robe, g);
    limb(new Vector3(0.2, 1.36, 0.02), new Vector3(0.18, 0.9, 0.12), 0.05, 0.04, robe, g);
    const st = new Mesh(new CylinderGeometry(0.018, 0.022, 1.7, 6), MATS.wood);
    st.position.set(0.2, 0.85, 0.12); st.rotation.z = 0.06; g.add(st);
  } else {
    limb(new Vector3(-0.2, 1.36, 0.02), new Vector3(-0.07, 0.98, 0.18), 0.05, 0.04, robe, g);
    limb(new Vector3(0.2, 1.36, 0.02), new Vector3(0.07, 0.98, 0.18), 0.05, 0.04, robe, g);
    const bowl = new Mesh(new LatheGeometry([
      new Vector2(0.001, 0), new Vector2(0.09, 0.01), new Vector2(0.11, 0.05), new Vector2(0.1, 0.07)
    ], 10), MATS.gold);
    bowl.position.set(0, 1.0, 0.2); g.add(bowl);
  }
  for (const s of [-1, 1]) {
    const hand = new Mesh(new SphereGeometry(0.045, 8, 6), MATS.flesh);
    hand.position.set(s * 0.05, variant === 1 ? 1.06 : 1.0, 0.22); g.add(hand);
  }
  const head = new Mesh(new SphereGeometry(0.115, 16, 12), matFace);
  head.position.y = 1.63; g.add(head);
  for (const s of [-1, 1]) {
    const ear = new Mesh(new SphereGeometry(1, 6, 6), MATS.flesh);
    ear.scale.set(0.25, 0.4, 0.3); ear.position.set(s * 0.11, 1.63, 0); g.add(ear);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- 力士 ----------
function guardianMesh() {
  const g = new Group();
  const base = new Mesh(new CylinderGeometry(0.26, 0.3, 0.14, 10), MATS.redDark);
  base.position.y = 0.07; g.add(base);
  const skirt = new Mesh(new LatheGeometry([
    new Vector2(0.001, 0.14), new Vector2(0.24, 0.16), new Vector2(0.22, 0.4),
    new Vector2(0.2, 0.62), new Vector2(0.21, 0.8), new Vector2(0.24, 0.9)
  ], 12), MATS.sash);
  g.add(skirt);
  const torso = new Mesh(new CylinderGeometry(0.17, 0.2, 0.62, 10), MATS.flesh);
  torso.position.y = 1.2; g.add(torso);
  const belt = new Mesh(new TorusGeometry(0.21, 0.03, 6, 12), MATS.gold);
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.92; g.add(belt);
  limb(new Vector3(-0.24, 1.44, 0), new Vector3(-0.4, 0.85, 0.1), 0.06, 0.045, MATS.flesh, g);
  limb(new Vector3(0.24, 1.44, 0), new Vector3(0.36, 1.95, 0.05), 0.06, 0.045, MATS.flesh, g);
  const vajra = new Group();
  const v1 = new Mesh(new CylinderGeometry(0.018, 0.018, 0.18, 6), MATS.gold);
  const v2 = new Mesh(new ConeGeometry(0.028, 0.06, 6), MATS.gold); v2.position.y = 0.12;
  const v3 = v2.clone(); v3.rotation.x = Math.PI; v3.position.y = -0.12;
  vajra.add(v1, v2, v3); vajra.position.set(0.38, 2.06, 0.05); g.add(vajra);
  const head = new Mesh(new SphereGeometry(0.14, 16, 12), MATS.guardianFace);
  head.position.y = 1.72; g.add(head);
  const hair = new Mesh(new SphereGeometry(0.145, 12, 10), MATS.hair);
  hair.scale.set(1, 0.8, 1); hair.position.set(0, 1.78, -0.02); g.add(hair);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- 组装 ----------
function addMesh(geo, mat, shadow = true) {
  const m = new Mesh(geo, mat);
  m.castShadow = shadow; m.receiveShadow = true;
  scene.add(m);
  return m;
}
let dust = null;
const flicker = [];

async function init() {
  await phase('砌墙铺地…', 8);
  const floor = new PlaneGeometry(HALL.W, HALL.D); floor.rotateX(-Math.PI / 2);
  MATS.floor.map.repeat.set(8, 6);
  addMesh(floor, MATS.floor);
  const wallDefs = [
    { o: new Vector3(-8.4, 0, -6.6), d: new Vector3(1, 0, 0), n: new Vector3(0, 0, 1), len: HALL.W, rot: 0 },
    { o: new Vector3(-8.4, 0, 6.6), d: new Vector3(1, 0, 0), n: new Vector3(0, 0, -1), len: HALL.W, rot: Math.PI },
    { o: new Vector3(8.4, 0, -6.6), d: new Vector3(0, 0, 1), n: new Vector3(-1, 0, 0), len: HALL.D, rot: -Math.PI / 2 },
    { o: new Vector3(-8.4, 0, -6.6), d: new Vector3(0, 0, 1), n: new Vector3(1, 0, 0), len: HALL.D, rot: Math.PI / 2 },
  ];
  for (const wdef of wallDefs) {
    MATS.plaster.map.repeat.set(5, 2.5);
    const pg = new PlaneGeometry(wdef.len, HALL.H);
    const pm = new Mesh(pg, MATS.plaster);
    pm.position.copy(wdef.o).setY(HALL.H / 2);
    pm.rotation.y = wdef.rot;
    pm.receiveShadow = true;
    scene.add(pm);
    put('panelRed', new BoxGeometry(wdef.len, 0.3, 0.06),
      mat4(wdef.o.x + wdef.d.x * wdef.len / 2, 0.15, wdef.o.z + wdef.d.z * wdef.len / 2, 0, wdef.rot));
  }

  await phase('塑制四壁悬塑（六层佛龛·楼阁·廊柱）…', 22);
  buildWall(HALL.W, wallDefs[0].o, wallDefs[0].d, wallDefs[0].n, 11);
  await frame();
  buildWall(HALL.D, wallDefs[2].o, wallDefs[2].d, wallDefs[2].n, 23);
  await frame();
  buildWall(HALL.D, wallDefs[3].o, wallDefs[3].d, wallDefs[3].n, 37);
  await frame();
  buildWall(HALL.W, wallDefs[1].o, wallDefs[1].d, wallDefs[1].n, 51, true);
  await frame();

  await phase('起宝塔、布祥云…', 40);
  const rngC = mulberry(99);
  for (const [cx, cz] of [[-7.9, -6.0], [7.9, -6.0], [-7.9, 6.0], [7.9, 6.0]]) {
    pagoda(cx, cz + (cz < 0 ? 0.35 : -0.35), 0.0, 9, 0.42, rngC, cx > 0 ? 0.4 : Math.PI - 0.4, 0.5);
    const zoff = cz < 0 ? 0.3 : -0.3;
    putSwirl('pink', cx + (cx < 0 ? 0.5 : -0.5), 1.2, cz + zoff, 0.4, 2.2, 3.5, rngC() * 6);
    putSwirl('white', cx + (cx < 0 ? -0.3 : 0.3), 3.4, cz + zoff * 0.8, 0.34, -1.8, 3.0, rngC() * 6);
    putSwirl('gold', cx, 5.6, cz + zoff, 0.3, 1.6, 2.6, rngC() * 6);
  }

  await phase('架梁布顶（梁架·椽子·藻井）…', 52);
  for (const bx of [-6.3, -2.1, 2.1, 6.3]) {
    MATS.dragon.map.repeat.set(5, 1);
    addMesh(new BoxGeometry(0.36, 0.44, HALL.D + 0.3), MATS.dragon).position.set(bx, 7.32, 0);
    for (let z = -6; z <= 6; z += 1.5) put(z % 3 ? 'green' : 'red', blockGeo, mat4(bx, 7.05, z));
    put('gold', coneOrn, mat4(bx, 7.0, 0, { sy: 1.6 }));
  }
  for (const [tz, ty, s] of [[0, 7.1, 1], [-3.35, 7.14, 0.7], [3.35, 7.14, 0.7]]) {
    MATS.dragon.map.repeat.set(6, 1);
    addMesh(new BoxGeometry(HALL.W + 0.2, 0.24 * s, 0.26 * s), MATS.dragon).position.set(0, ty, tz);
  }
  for (const wdef of wallDefs) {
    MATS.dragon.map.repeat.set(4, 1);
    const am = addMesh(new BoxGeometry(wdef.len + 0.1, 0.28, 0.24), MATS.dragon, false);
    am.position.copy(wdef.o).addScaledVector(wdef.d, wdef.len / 2).setY(6.98);
    am.rotation.y = wdef.rot;
  }
  for (let x = -8.2; x <= 8.3; x += 0.34)
    put('wood', new BoxGeometry(0.09, 0.13, HALL.D + 0.2), mat4(x, 7.86, 0));
  const ceil = new PlaneGeometry(HALL.W + 0.3, HALL.D + 0.3); ceil.rotateX(Math.PI / 2);
  addMesh(ceil, MATS.ceiling, false).position.set(0, 8.12, 0);
  MATS.dragon.map.repeat.set(3, 1);
  addMesh(new BoxGeometry(0.3, 0.3, HALL.D + 0.4), MATS.wood).position.set(0, 8.32, 0);
  for (let x = -2.1; x <= 2.15; x += 0.7) {
    const rg = new CircleGeometry(0.5, 24); rg.rotateX(Math.PI / 2);
    addMesh(rg, MATS.roundel, false).position.set(x, 7.76, 0);
  }
  for (const bx of [-2.1, 2.1]) for (const lz of [-3, 0, 3]) {
    put('gold', new CylinderGeometry(0.05, 0.05, 0.16, 8), mat4(bx, 6.72, lz));
    put('gold', coneOrn, mat4(bx, 6.6, lz));
    put('gold', new CylinderGeometry(0.008, 0.008, 0.3, 4), mat4(bx, 6.95, lz));
  }
  for (const bx of [-6.3, -2.1, 2.1, 6.3]) for (const lz of [-4.5, -1.5, 1.5, 4.5])
    putSwirl(lz % 3 ? 'pink' : 'white', bx + (lz > 0 ? 0.3 : -0.3), 7.0, lz, 0.26, 1.6, 0.5, lz);

  await phase('立柱、装门（南门·力士·楹联）…', 62);
  for (const [cx, cz] of [[-8.2, -6.4], [8.2, -6.4], [-8.2, 6.4], [8.2, 6.4]]) {
    MATS.dragon.map.repeat.set(2, 3);
    addMesh(new CylinderGeometry(0.22, 0.24, HALL.H, 12), MATS.dragon).position.set(cx, HALL.H / 2, cz);
    addMesh(new CylinderGeometry(0.3, 0.34, 0.35, 12), MATS.redDark).position.set(cx, 0.17, cz);
    addMesh(new BoxGeometry(0.56, 0.14, 0.56), MATS.gold).position.set(cx, HALL.H - 0.1, cz);
  }
  // 南门
  const sAt = (u, d, y) => new Vector3(-8.4 + u, y, 6.6 - d);
  put('dark', new BoxGeometry(2.3, 3.3, 0.12), mat4(sAt(8.4, 0.02, 1.6).x, 1.6, sAt(8.4, 0.02, 1.6).z));
  for (const s of [-1, 1]) {
    put('red', new CylinderGeometry(0.14, 0.15, 3.5, 10), mat4(sAt(8.4 + s * 1.25, 0.1, 1.75).x, 1.75, sAt(8.4 + s * 1.25, 0.1, 1.75).z));
    put('gold', bandGeo, mat4(sAt(8.4 + s * 1.25, 0.1, 3.4).x, 3.4, sAt(8.4 + s * 1.25, 0.1, 3.4).z));
  }
  MATS.dragon.map.repeat.set(2, 1);
  addMesh(new BoxGeometry(3.1, 0.32, 0.2), MATS.dragon).position.copy(sAt(8.4, 0.1, 3.42));
  addMesh(new BoxGeometry(1.8, 0.85, 0.1), MATS.plaque).position.copy(sAt(8.4, 0.24, 3.66));
  for (const s of [-1, 1]) {
    addMesh(new BoxGeometry(1.04, 3.1, 0.07), MATS.door).position.copy(sAt(8.4 + s * 0.55, 0.1, 1.62));
    addMesh(new TorusGeometry(0.05, 0.012, 6, 12), MATS.gold).position.copy(sAt(8.4 + s * 0.18, 0.16, 1.7));
  }
  for (const [u, mat] of [[6.55, 'coupletR'], [10.25, 'coupletL']]) {
    const cq = addMesh(new BoxGeometry(0.46, 2.7, 0.06), MATS[mat]);
    cq.position.copy(sAt(u, 0.05, 1.85));
    cq.rotation.y = Math.PI;
  }
  for (const u of [6.3, 10.5]) {
    const gd = guardianMesh();
    gd.position.set(-8.4 + u, 0, 6.6 - 0.85);
    gd.rotation.y = Math.PI;
    scene.add(gd);
  }

  await phase('筑佛坛、塑三世佛…', 72);
  addMesh(new BoxGeometry(9.4, 0.8, 2.4), MATS.panelRed).position.set(0, 0.4, -5.15);
  for (const [w, h, d, x, y, z] of [
    [9.5, 0.08, 2.5, 0, 0.82, -5.15], [9.5, 0.08, 0.14, 0, 0.06, -3.9],
    [2.4, 0.24, 0.5, 0, 0.12, -3.72], [2.4, 0.26, 0.4, 0, 0.36, -3.6]
  ]) addMesh(new BoxGeometry(w, h, d), MATS.gold).position.set(x, y, z);
  const trimF = addMesh(new BoxGeometry(9.4, 0.1, 0.05), MATS.gold, false);
  trimF.position.set(0, 0.45, -3.93);
  const buddhaDefs = [
    { x: 0, z: -5.0, s: 1.0, ry: 0 },
    { x: -3.1, z: -4.85, s: 0.85, ry: 0.14 },
    { x: 3.1, z: -4.85, s: 0.85, ry: -0.14 },
  ];
  for (const bd of buddhaDefs) {
    const b = buildBuddha(bd.s);
    b.position.set(bd.x, 0.8, bd.z);
    b.rotation.y = bd.ry;
    scene.add(b);
  }
  const attDefs = [[-1.6, -4.5], [1.6, -4.5], [-4.35, -4.35], [4.35, -4.35]];
  attDefs.forEach(([x, z], i) => {
    const d = discipleMesh(i % 5, 1, MATS.monkFace);
    d.position.set(x, 0.8, z);
    d.scale.setScalar(0.8);
    scene.add(d);
  });
  for (const [x, z] of [[-2.2, -4.3], [0, -4.15], [2.2, -4.3]]) {
    const censer = new Mesh(new LatheGeometry([
      new Vector2(0.001, 0), new Vector2(0.12, 0.02), new Vector2(0.09, 0.12),
      new Vector2(0.13, 0.2), new Vector2(0.1, 0.26), new Vector2(0.05, 0.3)
    ], 10), MATS.gold);
    censer.position.set(x, 0.8, z);
    censer.castShadow = true;
    scene.add(censer);
  }
  for (const s of [-1, 1]) {
    const vase = new Mesh(new LatheGeometry([
      new Vector2(0.001, 0), new Vector2(0.09, 0.02), new Vector2(0.05, 0.15),
      new Vector2(0.07, 0.3), new Vector2(0.09, 0.34), new Vector2(0.07, 0.36)
    ], 10), MATS.red);
    vase.position.set(s * 3.6, 0.8, -4.5);
    vase.castShadow = true;
    scene.add(vase);
  }

  await phase('列弟子罗汉（东西两壁）…', 80);
  const robeCycle = [0, 1, 2, 3, 4, 0, 2];
  for (const side of [2, 3]) {
    const wdef = wallDefs[side];
    const rngF = mulberry(side * 7 + 3);
    for (let k = 0; k < 7; k++) {
      const u = 1.0 + k * 1.55;
      const pos = wdef.o.clone().addScaledVector(wdef.d, u).addScaledVector(wdef.n, 0.42);
      const d = discipleMesh(robeCycle[k], k % 4, MATS.monkFace);
      d.position.copy(pos);
      d.scale.setScalar(0.95 + rngF() * 0.15);
      d.rotation.y = Math.atan2(wdef.n.x, wdef.n.z) + (rngF() - 0.5) * 0.25;
      scene.add(d);
    }
  }

  await phase('悬小佛万尊·合顶…', 88);
  let ci = 0;
  for (let x = -7.5; x <= 7.55; x += 0.9) for (const z of [-2.2, 0, 2.2]) {
    const yaw = (ci++ % 2) ? 0 : Math.PI;
    regBuddha(inst.ceilPed, x, 7.52, z, yaw, 0.62);
    regBuddha(inst.ceilBody, x, 7.56, z, yaw, 0.62);
    regBuddha(inst.ceilHead, x, 7.63, z, yaw, 0.62);
  }

  await phase('点灯扫尘…', 94);
  let totalVerts = 0;
  for (const key of Object.keys(BUCK)) {
    const arr = BUCK[key];
    if (!arr.length) continue;
    const merged = mergeGeometries(arr, false);
    if (!merged) { console.warn('合并失败:', key); continue; }
    totalVerts += merged.attributes.position.count;
    const mesh = new Mesh(merged, MATS[key] || MATS.green);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    arr.length = 0;
  }
  function makeInst(arr, geo, mat) {
    if (!arr.length) return;
    const im = new InstancedMesh(geo, mat, arr.length);
    const m = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3();
    arr.forEach((it, i) => {
      q.setFromEuler(e.set(0, it.y, 0));
      m.compose(it.p, q, v.set(it.s, it.s, it.s));
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true;
    im.frustumCulled = false;
    scene.add(im);
  }
  makeInst(inst.ped, pedGeo, MATS.pink);
  makeInst(inst.body, bodyGeo, MATS.gold);
  makeInst(inst.head, headGeo, MATS.goldHead);
  makeInst(inst.ceilPed, pedGeo, MATS.pink);
  makeInst(inst.ceilBody, bodyGeo, MATS.gold);
  makeInst(inst.ceilHead, headGeo, MATS.goldHead);

  // 灯光
  scene.add(new HemisphereLight(0xffe8cc, 0x2a1c12, 0.55));
  const dir = new DirectionalLight(0xffe0b8, 2.0);
  dir.position.set(5, 8, 9);
  dir.target.position.set(0, 1, -2);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -10; dir.shadow.camera.right = 10;
  dir.shadow.camera.top = 10; dir.shadow.camera.bottom = -10;
  dir.shadow.camera.far = 30;
  dir.shadow.camera.updateProjectionMatrix();
  dir.shadow.bias = -0.0004;
  dir.shadow.normalBias = 0.03;
  scene.add(dir, dir.target);
  const spot = new SpotLight(0xffc890, 160, 22, 0.55, 0.7, 1.6);
  spot.position.set(0, 2.6, 8.2);
  spot.target.position.set(0, 1.2, 0);
  scene.add(spot, spot.target);
  const candle1 = new PointLight(0xff9a40, 24, 11, 2); candle1.position.set(-2.4, 1.7, -4.4);
  const candle2 = new PointLight(0xff9a40, 24, 11, 2); candle2.position.set(2.4, 1.7, -4.4);
  const candle3 = new PointLight(0xff9a40, 18, 9, 2); candle3.position.set(0, 1.7, -4.0);
  flicker.push({ l: candle1, b: 24, f: 9.3 }, { l: candle2, b: 24, f: 8.1, p: 2 }, { l: candle3, b: 18, f: 10.7, p: 4 });
  const skyL = new PointLight(0xfff0dd, 36, 18, 2); skyL.position.set(0, 6.4, 0);
  const fill = new PointLight(0xffe0c0, 8, 13, 2); fill.position.set(0, 3, 5);
  scene.add(candle1, candle2, candle3, skyL, fill);

  // 浮尘
  const dustN = 260, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 13;
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 6;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 9;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(dustPos, 3));
  dust = new Points(dustGeo, new PointsMaterial({
    color: 0xffe0b0, size: 0.03, transparent: true, opacity: 0.32,
    depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // 统计
  const totalBuddhas = inst.ped.length + inst.ceilPed.length;
  document.getElementById('stats').innerHTML =
    `悬塑小佛 <b>${totalBuddhas.toLocaleString()}</b> 尊 · 悬塑 <b>${LAYERS}</b> 层<br>大坐佛 <b>3</b> 尊 · 弟子罗汉 <b>16</b> 尊 · 守门力士 <b>2</b> 尊<br>场景顶点 ≈ <b>${(totalVerts / 1000).toFixed(0)}k</b>`;

  document.getElementById('loading').classList.add('hide');
  const btnSpin = document.getElementById('btnSpin');
  btnSpin.classList.add('on');
  btnSpin.onclick = () => {
    controls.autoRotate = !controls.autoRotate;
    btnSpin.classList.toggle('on', controls.autoRotate);
  };
  document.getElementById('btnReset').onclick = resetView;
  renderer.domElement.addEventListener('dblclick', resetView);
  controls.addEventListener('start', () => {
    if (controls.autoRotate) { controls.autoRotate = false; btnSpin.classList.remove('on'); }
  });
  window.__demo = {
    setCam(x, y, z, tx = 0, ty = 2.5, tz = 0) {
      camera.position.set(x, y, z);
      controls.target.set(tx, ty, tz);
      controls.autoRotate = false;
      controls.update();
    },
    count: totalBuddhas
  };
  loadText.textContent = '完成';
}

function resetView() {
  camera.position.set(0, 3.0, 3.5);
  controls.target.set(0, 2.5, 0);
  controls.update();
}

// ---------- 主循环 ----------
const clock = new Clock();
function tick() {
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime();
  controls.update();
  // 相机硬限制：任何情况下不越出中央安全区
  camera.position.clamp(SAFE.min, SAFE.max);
  for (const f of flicker) f.l.intensity = f.b + Math.sin(t * f.f + (f.p || 0)) * f.b * 0.1 + Math.sin(t * f.f * 2.6) * f.b * 0.06;
  if (dust) { dust.rotation.y = t * 0.012; dust.position.y = Math.sin(t * 0.2) * 0.12; }
  renderer.render(scene, camera);
}

init().then(() => tick()).catch(err => {
  console.error(err);
  loadText.textContent = '构建失败：' + err.message;
});
