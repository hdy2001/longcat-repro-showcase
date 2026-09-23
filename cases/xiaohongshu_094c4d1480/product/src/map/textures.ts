// ===== 程序化纹理（Canvas 生成，无需外部素材） =====
import * as THREE from 'three';
import type { MatType } from './mapData';

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

// 确定性伪随机
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseOver(ctx: CanvasRenderingContext2D, size: number, rand: () => number, alpha: number, light: boolean, scale = 1) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 2 * alpha * scale;
    d[i] = Math.max(0, Math.min(255, d[i] + n * 255));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 255 * (light ? 1 : 0.9)));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 255 * (light ? 0.85 : 0.7)));
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function sandTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const rand = mulberry32(101);
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#d9b878');
  g.addColorStop(0.5, '#cfae6b');
  g.addColorStop(1, '#d5b471');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // 大块色斑
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${180 + rand() * 40 | 0}, ${150 + rand() * 30 | 0}, ${95 + rand() * 30 | 0}, ${0.05 + rand() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(rand() * S, rand() * S, 30 + rand() * 90, 20 + rand() * 60, rand() * 3, 0, 7);
    ctx.fill();
  }
  noiseOver(ctx, S, rand, 0.16, true);
  // 沙粒
  for (let i = 0; i < 9000; i++) {
    const v = rand();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,240,200,0.25)' : 'rgba(120,95,55,0.22)';
    ctx.fillRect(rand() * S, rand() * S, 1.5, 1.5);
  }
  // 零星枯草
  ctx.strokeStyle = 'rgba(140,125,70,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const x = rand() * S, y = rand() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 7, y - 3 - rand() * 6);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function stoneTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const rand = mulberry32(202);
  ctx.fillStyle = '#b8935a';
  ctx.fillRect(0, 0, S, S);
  // 石块砌缝（砂岩砖）
  const rows = 6;
  const rh = S / rows;
  for (let r = 0; r <= rows; r++) {
    ctx.strokeStyle = 'rgba(70,52,28,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, r * rh);
    ctx.lineTo(S, r * rh);
    ctx.stroke();
    const off = (r % 2) * 0.5;
    for (let i = 0; i < 3; i++) {
      const x = ((i + off) / 3) * S;
      ctx.beginPath();
      ctx.moveTo(x, r * rh);
      ctx.lineTo(x, (r + 1) * rh);
      ctx.stroke();
    }
  }
  // 每块砖底色微差
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < 3; i++) {
      const l = 0.88 + rand() * 0.24;
      ctx.fillStyle = `rgba(${170 * l | 0}, ${138 * l | 0}, ${82 * l | 0}, 0.5)`;
      const off = (r % 2) * 0.5;
      const x0 = ((i + off) / 3) * S;
      const x1 = ((i + off + 1) / 3) * S;
      ctx.fillRect(x0 + 2, r * rh + 2, x1 - x0 - 4, rh - 4);
    }
  }
  noiseOver(ctx, S, rand, 0.13, true);
  // 顶部受光、底部阴影渐变
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, 'rgba(255,240,200,0.14)');
  g.addColorStop(1, 'rgba(60,45,20,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function woodTexture(): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  const rand = mulberry32(303);
  ctx.fillStyle = '#9a6f3e';
  ctx.fillRect(0, 0, S, S);
  // 木板
  for (let p = 0; p < 4; p++) {
    const y0 = p * 64;
    ctx.fillStyle = `rgba(${140 + rand() * 40 | 0}, ${100 + rand() * 28 | 0}, ${55 + rand() * 18 | 0}, 1)`;
    ctx.fillRect(0, y0 + 2, S, 60);
    ctx.strokeStyle = 'rgba(60,40,18,0.8)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-2, y0 + 1, S + 4, 62);
    // 木纹
    ctx.strokeStyle = 'rgba(90,60,28,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      const y = y0 + 6 + rand() * 52;
      ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 32) ctx.lineTo(x, y + (rand() - 0.5) * 6);
      ctx.stroke();
    }
    // 钉
    ctx.fillStyle = 'rgba(50,45,40,0.9)';
    ctx.beginPath(); ctx.arc(16, y0 + 32, 2.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(S - 16, y0 + 32, 2.5, 0, 7); ctx.fill();
  }
  noiseOver(ctx, S, rand, 0.1, true);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sandbagTexture(): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  const rand = mulberry32(404);
  ctx.fillStyle = '#a8935e';
  ctx.fillRect(0, 0, S, S);
  // 袋子圆块
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < 5; i++) {
      const off = (r % 2) * 18;
      const x = i * 52 + off + 8, y = r * (S / rows) + S / rows / 2;
      const g = ctx.createRadialGradient(x - 6, y - 8, 4, x, y, 34);
      g.addColorStop(0, '#c2ad72');
      g.addColorStop(1, '#7d6a3e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, 34, 24, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,50,25,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  noiseOver(ctx, S, rand, 0.12, true);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rockTexture(): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  const rand = mulberry32(505);
  ctx.fillStyle = '#b3905c';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${150 + rand() * 60 | 0}, ${120 + rand() * 40 | 0}, ${80 + rand() * 30 | 0}, ${0.25 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(rand() * S, rand() * S, 8 + rand() * 30, 6 + rand() * 20, rand() * 3, 0, 7);
    ctx.fill();
  }
  noiseOver(ctx, S, rand, 0.18, true);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function darkStoneTexture(): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  const rand = mulberry32(606);
  ctx.fillStyle = '#6e5c42';
  ctx.fillRect(0, 0, S, S);
  noiseOver(ctx, S, rand, 0.16, false);
  // 横向浇筑纹
  ctx.strokeStyle = 'rgba(30,24,16,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 44 + 20);
    ctx.lineTo(S, i * 44 + 20);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 材质缓存 ----------
const cache = new Map<MatType, THREE.MeshStandardMaterial>();

export function getMaterial(mat: MatType): THREE.MeshStandardMaterial {
  const hit = cache.get(mat);
  if (hit) return hit;
  let tex: THREE.CanvasTexture;
  let roughness = 0.95;
  switch (mat) {
    case 'stone': tex = stoneTexture(); break;
    case 'wood': tex = woodTexture(); break;
    case 'sandbag': tex = sandbagTexture(); break;
    case 'rock': tex = rockTexture(); roughness = 1.0; break;
    case 'darkstone': tex = darkStoneTexture(); break;
    case 'metal': {
      const m = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.55, metalness: 0.65 });
      cache.set(mat, m);
      return m;
    }
  }
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness, metalness: 0.0 });
  cache.set(mat, m);
  return m;
}

let _groundTex: THREE.CanvasTexture | null = null;
export function groundTexture(): THREE.CanvasTexture {
  if (_groundTex) return _groundTex;
  _groundTex = sandTexture();
  _groundTex.repeat.set(26, 22);
  return _groundTex;
}

// ---------- 包点字母贴图 ----------
export function siteMarkerTexture(label: string): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255, 200, 80, 0.95)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 100, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '900 130px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 200, 80, 0.95)';
  ctx.fillText(label, S / 2, S / 2 + 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
