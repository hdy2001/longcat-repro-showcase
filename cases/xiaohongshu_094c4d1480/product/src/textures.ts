// 程序化 Canvas 纹理：沙地 / 石墙 / 木箱 / 沙袋 / 迷彩 / 天空
import * as THREE from 'three';
import { CAMO_DATA_URI } from './camo';

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noise(g: CanvasRenderingContext2D, s: number, n: number, alpha: number, dark = true): void {
  for (let i = 0; i < n; i++) {
    const v = Math.random();
    g.fillStyle = dark && v < 0.5
      ? `rgba(60,40,20,${alpha * Math.random()})`
      : `rgba(255,240,210,${alpha * Math.random()})`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

export function makeSandTexture(): THREE.Texture {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#c8a870';
    g.fillRect(0, 0, s, s);
    // 大块色斑
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(${150 + Math.random() * 60 | 0},${115 + Math.random() * 45 | 0},${60 + Math.random() * 30 | 0},0.25)`;
      g.beginPath();
      g.ellipse(Math.random() * s, Math.random() * s, 20 + Math.random() * 50, 15 + Math.random() * 35, Math.random() * 3, 0, 7);
      g.fill();
    }
    noise(g, s, 2600, 0.16);
    noise(g, s, 800, 0.1, false);
  });
}

export function makeWallTexture(): THREE.Texture {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#b39468';
    g.fillRect(0, 0, s, s);
    // 石缝水平线
    g.strokeStyle = 'rgba(70,50,30,0.55)';
    g.lineWidth = 2;
    for (let y = 0; y <= s; y += 32) {
      g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(s, y + 0.5); g.stroke();
    }
    // 竖缝错位
    g.lineWidth = 1.5;
    for (let row = 0; row < s / 32; row++) {
      const off = (row % 2) * 42;
      for (let x = off; x <= s; x += 84) {
        g.beginPath(); g.moveTo(x + 0.5, row * 32); g.lineTo(x + 0.5, row * 32 + 32); g.stroke();
      }
    }
    // 顶部日晒褪色渐变
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, 'rgba(255,235,200,0.28)');
    grad.addColorStop(0.35, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(60,40,20,0.22)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    noise(g, s, 1500, 0.14);
  });
}

export function makeCrateTexture(): THREE.Texture {
  return canvasTex(128, (g, s) => {
    g.fillStyle = '#9a7443';
    g.fillRect(0, 0, s, s);
    // 木板
    for (let i = 0; i < 4; i++) {
      g.fillStyle = `rgba(${120 + Math.random() * 50 | 0},${85 + Math.random() * 35 | 0},${45 + Math.random() * 20 | 0},0.5)`;
      g.fillRect(0, i * 32 + 1, s, 30);
    }
    g.strokeStyle = 'rgba(50,32,15,0.8)';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(s, i * 32); g.stroke(); }
    // 边框 + 交叉撑
    g.lineWidth = 7;
    g.strokeRect(4, 4, s - 8, s - 8);
    g.beginPath(); g.moveTo(6, 6); g.lineTo(s - 6, s - 6); g.moveTo(s - 6, 6); g.lineTo(6, s - 6); g.stroke();
    noise(g, s, 700, 0.2);
  });
}

export function makeSandbagTexture(): THREE.Texture {
  return canvasTex(128, (g, s) => {
    g.fillStyle = '#b8a06a';
    g.fillRect(0, 0, s, s);
    // 袋块
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = c * 44 + (r % 2) * 20, y = r * 44;
        g.fillStyle = `rgba(${165 + Math.random() * 30 | 0},${140 + Math.random() * 25 | 0},${85 + Math.random() * 20 | 0},0.9)`;
        g.beginPath();
        g.roundRect(x + 2, y + 2, 42, 40, 12);
        g.fill();
      }
    }
    noise(g, s, 900, 0.18);
  });
}

export function makeCamoTexture(): THREE.Texture {
  const t = new THREE.Texture();
  const img = new Image();
  img.onload = () => { t.needsUpdate = true; };
  img.src = CAMO_DATA_URI;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 竖直渐变天空
export function makeSkyTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1e63c8');
  grad.addColorStop(0.45, '#4a90e0');
  grad.addColorStop(0.75, '#9cc8ee');
  grad.addColorStop(1, '#e8d9b0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 标签精灵（头顶名字 / A、B 区标记）
export function makeTextSprite(text: string, color: string, size = 44, bg?: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const pad = 16;
  const m = c.getContext('2d')!;
  m.font = `bold ${size}px "Arial Black", Arial, sans-serif`;
  const w = Math.ceil(m.measureText(text).width) + pad * 2;
  c.width = w; c.height = size + pad * 2;
  const g = c.getContext('2d')!;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.font = `bold ${size}px "Arial Black", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(text, c.width / 2, c.height / 2);
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  sp.scale.set(c.width / 90, c.height / 90, 1);
  return sp;
}
