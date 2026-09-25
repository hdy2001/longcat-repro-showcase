// ============================================================
// 程序化纹理 —— 全部用 Canvas 生成, 无任何外部资源
// ============================================================
import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

/** 确定性伪随机 */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTexture(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------
// 沙地
// ------------------------------------------------------------
export function sandTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(512, 512);
  const rnd = mulberry(777);
  g.fillStyle = '#d3ac72';
  g.fillRect(0, 0, 512, 512);
  // 大块色斑
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 20 + rnd() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() > 0.5 ? '214,186,138' : '196,164,112';
    grad.addColorStop(0, `rgba(${tone},0.35)`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 噪点
  for (let i = 0; i < 9000; i++) {
    const v = 150 + rnd() * 105;
    g.fillStyle = `rgba(${v},${v * 0.82 | 0},${v * 0.55 | 0},${0.12 + rnd() * 0.25})`;
    g.fillRect(rnd() * 512, rnd() * 512, 1.5, 1.5);
  }
  // 风纹
  g.strokeStyle = 'rgba(160,128,84,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    const y0 = rnd() * 512;
    g.moveTo(0, y0);
    g.bezierCurveTo(170, y0 + rnd() * 30 - 15, 340, y0 + rnd() * 30 - 15, 512, y0 + rnd() * 24 - 12);
    g.stroke();
  }
  return toTexture(c, 24);
}

// ------------------------------------------------------------
// 黄褐色石墙 (砖石 + 风化)
// ------------------------------------------------------------
export function stoneWallTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(512, 256);
  const rnd = mulberry(4242);
  g.fillStyle = '#c49a62';
  g.fillRect(0, 0, 512, 256);
  // 砖缝
  const bh = 32, bw = 86;
  for (let row = 0; row < 256 / bh; row++) {
    const y = row * bh;
    g.fillStyle = `rgba(90,64,36,${0.25 + rnd() * 0.15})`;
    g.fillRect(0, y, 512, 3);
    const off = (row % 2) * bw / 2;
    for (let x = off; x < 512; x += bw) g.fillRect(x, y, 3, bh);
  }
  // 砖面明暗
  for (let i = 0; i < 512 / 86 * 256 / 32; i++) {
    const x = rnd() * 512, y = rnd() * 256;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,230,180,0.10)' : 'rgba(80,54,26,0.12)';
    g.fillRect(x, y, bw - 4, bh - 5);
  }
  // 风化斑驳
  for (let i = 0; i < 380; i++) {
    const x = rnd() * 512, y = rnd() * 256, r = 2 + rnd() * 9;
    g.fillStyle = `rgba(120,88,50,${0.05 + rnd() * 0.12})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // 底部沙尘堆积渐变
  const grad = g.createLinearGradient(0, 256, 0, 190);
  grad.addColorStop(0, 'rgba(150,118,70,0.55)');
  grad.addColorStop(1, 'rgba(150,118,70,0)');
  g.fillStyle = grad;
  g.fillRect(0, 190, 512, 66);
  return toTexture(c, 1);
}

// ------------------------------------------------------------
// 木箱
// ------------------------------------------------------------
export function crateTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(256, 256);
  const rnd = mulberry(99);
  g.fillStyle = '#a06f3a';
  g.fillRect(0, 0, 256, 256);
  // 木板
  for (let i = 0; i < 4; i++) {
    const y = i * 64;
    g.fillStyle = `rgba(60,38,16,0.5)`;
    g.fillRect(0, y, 256, 4);
    g.fillStyle = `rgba(${140 + rnd() * 40 | 0},${95 + rnd() * 25 | 0},${45 + rnd() * 15 | 0},0.55)`;
    g.fillRect(0, y + 4, 256, 60);
    // 木纹
    g.strokeStyle = 'rgba(70,45,20,0.35)';
    for (let j = 0; j < 7; j++) {
      g.beginPath();
      const yy = y + 8 + rnd() * 48;
      g.moveTo(0, yy);
      g.bezierCurveTo(80, yy + rnd() * 8 - 4, 170, yy + rnd() * 8 - 4, 256, yy);
      g.stroke();
    }
  }
  // 边框
  g.strokeStyle = 'rgba(52,32,12,0.85)';
  g.lineWidth = 14;
  g.strokeRect(7, 7, 242, 242);
  g.strokeStyle = 'rgba(255,220,160,0.18)';
  g.lineWidth = 3;
  g.strokeRect(16, 16, 224, 224);
  // 钉子
  g.fillStyle = 'rgba(40,26,10,0.9)';
  for (const [x, y] of [[22, 22], [234, 22], [22, 234], [234, 234]]) {
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
  }
  //  stencil 标记
  g.fillStyle = 'rgba(235,220,190,0.5)';
  g.font = 'bold 30px monospace';
  g.textAlign = 'center';
  g.fillText('7.62', 128, 118);
  g.font = 'bold 15px monospace';
  g.fillText('AMMO', 128, 140);
  return toTexture(c, 1);
}

// ------------------------------------------------------------
// 沙袋
// ------------------------------------------------------------
export function sandbagTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(256, 128);
  const rnd = mulberry(31337);
  g.fillStyle = '#b39b6b';
  g.fillRect(0, 0, 256, 128);
  // 横向袋纹 (两层)
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const x = i * 64 + (row % 2) * 32 - 16;
      const y = row * 64;
      g.fillStyle = `rgba(${140 + rnd() * 40 | 0},${120 + rnd() * 30 | 0},${75 + rnd() * 20 | 0},0.9)`;
      g.beginPath();
      g.roundRect(x + 3, y + 6, 58, 52, 14);
      g.fill();
      g.strokeStyle = 'rgba(70,58,32,0.55)';
      g.lineWidth = 2.5;
      g.stroke();
      // 高光
      g.strokeStyle = 'rgba(255,240,200,0.22)';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(x + 8, y + 10, 48, 40, 10);
      g.stroke();
    }
  }
  // 污渍
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(90,70,40,${0.05 + rnd() * 0.1})`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 128, 2 + rnd() * 7, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, 1);
}

// ------------------------------------------------------------
// 顶棚 (波纹钢板)
// ------------------------------------------------------------
export function roofTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(256, 256);
  const rnd = mulberry(555);
  g.fillStyle = '#8d7a5c';
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    g.fillStyle = 'rgba(60,48,32,0.5)';
    g.fillRect(x, 0, 3, 256);
    g.fillStyle = 'rgba(255,240,210,0.14)';
    g.fillRect(x + 3, 0, 3, 256);
  }
  for (let i = 0; i < 200; i++) {
    g.fillStyle = `rgba(70,54,34,${0.06 + rnd() * 0.1})`;
    g.fillRect(rnd() * 256, rnd() * 256, 3 + rnd() * 8, 2 + rnd() * 5);
  }
  return toTexture(c, 2);
}

// ------------------------------------------------------------
// 油桶 (军绿)
// ------------------------------------------------------------
export function barrelTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(128, 256);
  const rnd = mulberry(2024);
  g.fillStyle = '#6b7055';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(30,32,22,0.6)';
  g.fillRect(0, 30, 128, 5);
  g.fillRect(0, 123, 128, 5);
  g.fillRect(0, 220, 128, 5);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(${100 + rnd() * 40 | 0},${60 + rnd() * 20 | 0},30,${0.08 + rnd() * 0.14})`;
    g.fillRect(rnd() * 128, rnd() * 256, 2 + rnd() * 5, 2 + rnd() * 6);
  }
  g.fillStyle = 'rgba(230,220,190,0.55)';
  g.font = 'bold 22px monospace';
  g.textAlign = 'center';
  g.save();
  g.translate(64, 128); g.rotate(-Math.PI / 2);
  g.fillText('FUEL', 0, 7);
  g.restore();
  return toTexture(c, 1);
}

// ------------------------------------------------------------
// 岩石 (装饰)
// ------------------------------------------------------------
export function rockTexture(): THREE.CanvasTexture {
  const [c, g] = makeCanvas(128, 128);
  const rnd = mulberry(88);
  g.fillStyle = '#b08d5f';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    const v = 130 + rnd() * 90;
    g.fillStyle = `rgba(${v},${v * 0.78 | 0},${v * 0.52 | 0},${0.1 + rnd() * 0.25})`;
    g.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 4, 2 + rnd() * 4);
  }
  return toTexture(c, 1);
}
