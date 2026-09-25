// ============================================================
// materials.js — 全部程序化 Canvas 纹理与夜景材质（无任何外部素材）
// ============================================================
import * as THREE from 'three';

function canvasTex(size, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = opts.w || size; c.height = opts.h || size;
  const ctx = c.getContext('2d');
  draw(ctx, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function noise(ctx, w, h, alpha, n = 2600) {
  for (let i = 0; i < n; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? `rgba(255,240,220,${alpha * Math.random()})` : `rgba(0,0,0,${alpha * Math.random()})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

// ---- 琉璃瓦（屋顶）----
export function makeRoofTileTexture() {
  return canvasTex(512, (ctx, w, h) => {
    ctx.fillStyle = '#41301e'; ctx.fillRect(0, 0, w, h);
    const tw = 21; // 筒瓦列宽
    for (let x = 0; x < w; x += tw) {
      const g = ctx.createLinearGradient(x, 0, x + tw, 0);
      g.addColorStop(0, '#322515'); g.addColorStop(0.28, '#7a5830');
      g.addColorStop(0.5, '#9a7440'); g.addColorStop(0.72, '#7a5830'); g.addColorStop(1, '#2e2114');
      ctx.fillStyle = g; ctx.fillRect(x, 0, tw, h);
      ctx.fillStyle = 'rgba(255,220,160,0.10)'; ctx.fillRect(x + tw * 0.42, 0, 2, h);
    }
    // 横向瓦垄分层线
    for (let y = 0; y < h; y += 34) {
      ctx.fillStyle = 'rgba(12,8,4,0.55)'; ctx.fillRect(0, y, w, 3);
      ctx.fillStyle = 'rgba(255,215,150,0.08)'; ctx.fillRect(0, y + 3, w, 2);
    }
    noise(ctx, w, h, 0.10, 5200);
  });
}

// ---- 红墙 ----
export function makeWallTexture() {
  return canvasTex(256, (ctx, w, h) => {
    ctx.fillStyle = '#7c241f'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,190,140,0.07)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 0.16, 4200);
  });
}

// ---- 槅扇门窗（暖光透出的棂格）----
export function makeLatticeTexture() {
  const t = canvasTex(0, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffdf9e'); g.addColorStop(0.5, '#f7b264'); g.addColorStop(1, '#d98a3e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 窗棂网格（步步锦意匠）
    ctx.strokeStyle = '#33200f'; ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    for (let x = 26; x < w - 10; x += 24) { ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, h * 0.55); ctx.stroke(); }
    for (let x = 14; x < w - 10; x += 24) { ctx.beginPath(); ctx.moveTo(x, h * 0.55); ctx.lineTo(x, h - 8); ctx.stroke(); }
    for (let y = 26; y < h * 0.5; y += 24) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(w - 8, y); ctx.stroke(); }
    for (let y = h * 0.5 + 20; y < h - 10; y += 24) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(w - 8, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(120,60,20,0.35)'; ctx.fillRect(0, h * 0.5 - 3, w, 6);
  }, { w: 128, h: 256 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---- 汉白玉台基 ----
export function makeStoneTexture() {
  return canvasTex(256, (ctx, w, h) => {
    ctx.fillStyle = '#a9a294'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,250,235,0.10)'); g.addColorStop(1, 'rgba(40,40,55,0.18)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 0.12, 3600);
    ctx.strokeStyle = 'rgba(60,60,70,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.lineTo(Math.random() * w, Math.random() * h); ctx.stroke();
    }
  });
}

// ---- 御路石雕 ----
export function makeCarvedTexture() {
  return canvasTex(256, (ctx, w, h) => {
    ctx.fillStyle = '#b0a897'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(70,66,58,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const x = 20 + Math.random() * (w - 40), y = 20 + Math.random() * (h - 40);
      ctx.arc(x, y, 8 + Math.random() * 16, Math.random() * 6, Math.random() * 3 + 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(70,66,58,0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    noise(ctx, w, h, 0.08, 2200);
  });
}

// ---- 地面金砖墁地 ----
export function makeGroundTexture() {
  return canvasTex(512, (ctx, w, h) => {
    ctx.fillStyle = '#272d3a'; ctx.fillRect(0, 0, w, h);
    const s = 128;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const l = 16 + Math.random() * 10;
      ctx.fillStyle = `rgb(${l + 10},${l + 13},${l + 19})`;
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      ctx.fillStyle = 'rgba(255,230,190,0.045)';
      ctx.fillRect(x + 2, y + 2, s - 4, 14);
    }
    noise(ctx, w, h, 0.14, 9000);
  });
}

// ---- 广场（主路）墁地（稍亮、磨损）----
export function makePlazaTexture() {
  return canvasTex(512, (ctx, w, h) => {
    ctx.fillStyle = '#313845'; ctx.fillRect(0, 0, w, h);
    const s = 128;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const l = 20 + Math.random() * 11;
      ctx.fillStyle = `rgb(${l + 8},${l + 11},${l + 16})`;
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    }
    // 车辙磨痕
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(255,225,180,${0.03 + Math.random() * 0.04})`;
      ctx.lineWidth = 3 + Math.random() * 5;
      ctx.beginPath(); ctx.moveTo(0, Math.random() * h); ctx.lineTo(w, Math.random() * h); ctx.stroke();
    }
    noise(ctx, w, h, 0.12, 8000);
  });
}

// ---- 匾额（蓝底金字）----
export function makePlaqueTexture(text) {
  return canvasTex(0, (ctx, w, h) => {
    ctx.fillStyle = '#0e2a55'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(120,180,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#ffd964';
    ctx.font = `600 ${Math.floor(h * 0.52)}px "Kaiti SC","KaiTi","STKaiti",serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,215,120,0.6)'; ctx.shadowBlur = 8;
    ctx.fillText(text, w / 2, h / 2 + 2);
  }, { w: 256, h: 128 });
}

// ---- 树（深夜剪影）----
export function makeBarkTexture() {
  return canvasTex(128, (ctx, w, h) => {
    ctx.fillStyle = '#241a12'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(${40 + Math.random() * 30},${28 + Math.random() * 18},${18 + Math.random() * 12},0.8)`;
      ctx.lineWidth = 1 + Math.random() * 3;
      const x = Math.random() * w;
      ctx.beginPath(); ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 8, h * 0.3, x - 8, h * 0.6, x + 4, h); ctx.stroke();
    }
  });
}

// ---- 月光光晕 / 灯光光晕 sprite ----
export function makeGlowTexture(inner = 'rgba(255,240,210,1)', outer = 'rgba(255,200,120,0)') {
  return canvasTex(0, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace('1)', '0.55)')); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { w: 128, h: 128 });
}

export function makeRedGlowTexture() {
  return canvasTex(0, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,120,70,1)'); g.addColorStop(0.3, 'rgba(255,80,45,0.55)'); g.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { w: 128, h: 128 });
}

// ---- 云 ----
export function makeCloudTexture() {
  return canvasTex(0, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = w * 0.5 + (Math.random() - 0.5) * w * 0.6;
      const y = h * 0.5 + (Math.random() - 0.5) * h * 0.22;
      const r = 30 + Math.random() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(150,170,215,${0.10 + Math.random() * 0.10})`);
      g.addColorStop(1, 'rgba(150,170,215,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }, { w: 512, h: 192 });
}

// ============================================================
// 材质库（夜景基调）
// ============================================================
export function makeMaterials() {
  const roofTex = makeRoofTileTexture();
  const wallTex = makeWallTexture();
  const latticeTex = makeLatticeTexture();
  const stoneTex = makeStoneTexture();
  const groundTex = makeGroundTexture();
  const plazaTex = makePlazaTexture();

  const M = {};
  // 琉璃瓦屋顶：夜间被暖光映成金色
  M.roof = new THREE.MeshStandardMaterial({
    map: roofTex, roughness: 0.5, metalness: 0.25,
    emissive: 0xa86828, emissiveMap: roofTex, emissiveIntensity: 0.55,
  });
  M.ridge = new THREE.MeshStandardMaterial({ color: 0x4a3a1e, roughness: 0.6, metalness: 0.35, emissive: 0x4a3410, emissiveIntensity: 0.15 });
  M.ridgeEnd = new THREE.MeshStandardMaterial({ color: 0x3a2e16, roughness: 0.55, metalness: 0.4, emissive: 0x5a4012, emissiveIntensity: 0.3 });
  M.wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, metalness: 0.02 });
  M.wallDark = new THREE.MeshStandardMaterial({ color: 0x4e1713, roughness: 0.92 });
  M.plinth = new THREE.MeshStandardMaterial({ color: 0x5d584e, roughness: 0.85 });
  M.column = new THREE.MeshStandardMaterial({ color: 0x8c2b20, roughness: 0.62, metalness: 0.05, emissive: 0x521208, emissiveIntensity: 0.35 });
  M.dougong = new THREE.MeshStandardMaterial({ color: 0x54281c, roughness: 0.8, emissive: 0x3a1408, emissiveIntensity: 0.3 });
  M.eaveBoard = new THREE.MeshStandardMaterial({ color: 0x38180f, roughness: 0.9, side: THREE.DoubleSide });
  // 透光槂扇门窗 —— 夜晚满堂暖光的关键
  M.lattice = new THREE.MeshStandardMaterial({
    map: latticeTex, emissiveMap: latticeTex, emissive: 0xffb765, emissiveIntensity: 1.5,
    color: 0x402818, roughness: 0.8, side: THREE.DoubleSide,
  });
  M.latticeDim = new THREE.MeshStandardMaterial({
    map: latticeTex, emissiveMap: latticeTex, emissive: 0xd98a3e, emissiveIntensity: 0.85,
    color: 0x301c10, roughness: 0.85, side: THREE.DoubleSide,
  });
  M.stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.82, metalness: 0.04, color: 0xbdb6a6 });
  M.stoneDark = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.88, color: 0x767064 });
  M.carved = new THREE.MeshStandardMaterial({ map: makeCarvedTexture(), roughness: 0.85, color: 0xb5ad9c });
  M.ground = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.62, metalness: 0.12 });
  M.plaza = new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.55, metalness: 0.14 });
  M.water = new THREE.MeshStandardMaterial({ color: 0x18293f, roughness: 0.28, metalness: 0.55, emissive: 0x0a1626, emissiveIntensity: 0.6 });
  M.bark = new THREE.MeshStandardMaterial({ map: makeBarkTexture(), roughness: 0.95 });
  M.foliage = new THREE.MeshStandardMaterial({ color: 0x14231c, roughness: 0.95 });
  M.foliageLit = new THREE.MeshStandardMaterial({ color: 0x1a2c20, roughness: 0.95, emissive: 0x0c1a10, emissiveIntensity: 0.4 });
  M.archDark = new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 1 }); // 门洞
  M.finial = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.85, emissive: 0xa87818, emissiveIntensity: 0.9 });
  M.lanternRed = new THREE.MeshBasicMaterial({ color: 0xff5a30 });
  M.lanternWarm = new THREE.MeshBasicMaterial({ color: 0xffc36a });
  M.bulbWarm = new THREE.MeshBasicMaterial({ color: 0xffb75e });
  M.bulbCool = new THREE.MeshBasicMaterial({ color: 0xcfe0ff });
  M.rock = new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.95 });
  M.plaque = (text) => new THREE.MeshStandardMaterial({ map: makePlaqueTexture(text), roughness: 0.5, metalness: 0.15, emissive: 0x1a3a6a, emissiveIntensity: 0.25 });
  M.moon = new THREE.MeshBasicMaterial({ color: 0xf5eeda, fog: false });
  M.merlon = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xa03528, roughness: 0.9 });
  M.bridgeArch = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xa89f8e, roughness: 0.8 });
  return M;
}
