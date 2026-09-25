// ============================================================
// 程序化材质 —— 全部用 Canvas 手绘生成，不下载任何外部素材
// ============================================================
import * as THREE from 'three';
import { PAL } from './config.js';

function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

// --- 辉光贴图（光晕精灵共用） ---
export function glowTexture() {
  return canvasTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0, 'rgba(255,225,160,1)');
    g.addColorStop(0.25, 'rgba(255,196,110,0.85)');
    g.addColorStop(0.6, 'rgba(255,160,70,0.25)');
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
}

// --- 窗棂透光贴图：暖光 + 深色棂条（视觉证据：窗格透出暖黄灯光） ---
export function latticeTexture() {
  return canvasTex(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#ffdf9e'); g.addColorStop(0.5, '#f7b95e'); g.addColorStop(1, '#c06a1e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#33170a'; ctx.lineWidth = 10;
    const n = 4, m = 3;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i*s/n, 0); ctx.lineTo(i*s/n, s); ctx.stroke(); }
    for (let j = 0; j <= m; j++) { ctx.beginPath(); ctx.moveTo(0, j*s/m); ctx.lineTo(s, j*s/m); ctx.stroke(); }
    ctx.lineWidth = 6;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const x = i*s/n, y = j*s/m, w = s/n, h = s/m;
      ctx.beginPath(); ctx.moveTo(x+w*0.15, y+h*0.85); ctx.lineTo(x+w*0.5, y+h*0.15); ctx.lineTo(x+w*0.85, y+h*0.85); ctx.stroke();
    }
    ctx.strokeStyle = '#200f05'; ctx.lineWidth = 16; ctx.strokeRect(0, 0, s, s);
  });
}

// --- 广场石板贴图 ---
export function pavingTexture() {
  return canvasTex(512, (ctx, s) => {
    ctx.fillStyle = '#5d5654'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(30,26,24,0.9)'; ctx.lineWidth = 3;
    const step = s / 8;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i*step, 0); ctx.lineTo(i*step, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*step); ctx.lineTo(s, i*step); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let k = 0; k < 400; k++) ctx.fillRect(Math.random()*s, Math.random()*s, 2, 2);
  }, [24, 24]);
}

// --- 月亮贴图 ---
export function moonTexture() {
  return canvasTex(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s/2, s/2, s*0.1, s/2, s/2, s*0.5);
    g.addColorStop(0, 'rgba(255,252,240,1)');
    g.addColorStop(0.55, 'rgba(240,238,225,0.98)');
    g.addColorStop(0.72, 'rgba(210,208,195,0.55)');
    g.addColorStop(0.8, 'rgba(180,185,200,0.15)');
    g.addColorStop(1, 'rgba(160,170,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s/2, s/2, s/2, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(190,188,175,0.5)';
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.arc(s*0.35 + Math.random()*s*0.3, s*0.35 + Math.random()*s*0.3, 4 + Math.random()*10, 0, 7);
      ctx.fill();
    }
  });
}

// --- 桥体栏板贴图（极简：白色大理石+暖光带） ---
export function marbleTexture() {
  return canvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#b5ad9c'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(255,214,150,0.35)'; ctx.fillRect(0, 0, s, s*0.18);
    ctx.strokeStyle = 'rgba(60,55,45,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, s*0.5); ctx.lineTo(s, s*0.5); ctx.stroke();
  });
}

// 共享材质（全部自建）
export function buildMaterials() {
  const lattice = latticeTexture();
  const M = {
    // 屋顶：夜色里的琉璃瓦（偏暗、有微光）
    roof: new THREE.MeshStandardMaterial({ color: 0x5a4c30, roughness: 0.5, metalness: 0.35, emissive: 0x241704, emissiveIntensity: 0.7, side: THREE.DoubleSide }),
    roofAlt: new THREE.MeshStandardMaterial({ color: 0x463a24, roughness: 0.55, metalness: 0.3, emissive: 0x1a1004, emissiveIntensity: 0.7, side: THREE.DoubleSide }),
    // 墙体：暗红（带暖色自发光，夜色里可读）
    wall: new THREE.MeshStandardMaterial({ color: 0x94402c, roughness: 0.8, metalness: 0.02, emissive: 0x381208, emissiveIntensity: 0.85 }),
    wallDark: new THREE.MeshStandardMaterial({ color: 0x6e2c1e, roughness: 0.85, emissive: 0x280d05, emissiveIntensity: 0.8 }),
    column: new THREE.MeshStandardMaterial({ color: PAL.columnRed, roughness: 0.7 }),
    marble: new THREE.MeshStandardMaterial({ color: PAL.marble, roughness: 0.5, metalness: 0.08 }),
    marbleDark: new THREE.MeshStandardMaterial({ color: PAL.marbleD, roughness: 0.7 }),
    // 地面
    ground: new THREE.MeshStandardMaterial({ color: 0x323a4c, roughness: 0.95 }),
    plaza: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, map: pavingTexture() }),
    water: new THREE.MeshStandardMaterial({ color: 0x12203a, roughness: 0.08, metalness: 0.7 }),
    // 金色轮廓灯带（自发光，交给 Bloom 泛光）
    goldGlow: new THREE.MeshBasicMaterial({ color: PAL.goldHot }),
    goldGlowDim: new THREE.MeshBasicMaterial({ color: PAL.gold }),
    // 斗拱层：暖光照亮的金褐色
    dougong: new THREE.MeshStandardMaterial({ color: 0xc99e63, roughness: 0.6, metalness: 0.25, emissive: 0x6b4a1e, emissiveIntensity: 0.55 }),
    // 窗棂透光
    windowGlow: new THREE.MeshBasicMaterial({ map: lattice }),
    // 门洞黑暗
    dark: new THREE.MeshBasicMaterial({ color: 0x05030a }),
    // 树
    tree: new THREE.MeshStandardMaterial({ color: PAL.treeDark, roughness: 1 }),
    treeSnow: new THREE.MeshStandardMaterial({ color: 0x2c3a4a, roughness: 1 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }),
    // 火树灯球
    fireball: new THREE.MeshBasicMaterial({ color: 0xffd98a }),
    lanternRed: new THREE.MeshStandardMaterial({ color: 0xa03024, roughness: 0.5, emissive: 0xff5a2a, emissiveIntensity: 0.9 }),
    lanternGlow: new THREE.MeshBasicMaterial({ color: 0xffb45e }),
  };
  return M;
}
