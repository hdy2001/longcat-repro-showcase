// ============ 工具：噪声 / 程序化贴图 / 几何 ============

// 值噪声
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return hash2(xi, yi) * (1 - u) * (1 - v) + hash2(xi + 1, yi) * u * (1 - v) +
         hash2(xi, yi + 1) * (1 - u) * v + hash2(xi + 1, yi + 1) * u * v;
}
function fbm(x, y) {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.13 + 5.2, y * 2.13 + 1.3) * 0.3 +
         vnoise(x * 4.31 + 9.1, y * 4.31 + 3.7) * 0.15;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// 合并多个 BufferGeometry（非索引化后拼接）
function mergeGeos(geos) {
  const pos = [], norm = [], uv = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array);
    norm.push(...ng.attributes.normal.array);
    if (ng.attributes.uv) uv.push(...ng.attributes.uv.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  if (uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

// 低多边形鱼几何（身体 + 尾鳍 + 背鳍），头朝 +Z
function makeFishGeometry() {
  const body = new THREE.ConeGeometry(0.26, 1.05, 6);
  body.rotateX(Math.PI / 2);          // 尖头朝 +Z
  body.scale(1, 0.55, 1);             // 压扁
  const tail = new THREE.PlaneGeometry(0.46, 0.34);
  tail.rotateY(Math.PI / 2);          // 竖直尾鳍
  tail.translate(0, 0, -0.68);
  const fin = new THREE.PlaneGeometry(0.2, 0.22);
  fin.rotateX(-Math.PI / 2);
  fin.translate(0, 0.2, -0.05);
  return mergeGeos([body, tail, fin]);
}

// ---- 太阳神鸟金饰贴图（1024，平面 UV 用于 RingGeometry）----
function drawSunbirdBird(x, r) {
  x.save();
  x.translate(r, 0);
  x.rotate(-Math.PI / 2);
  x.beginPath();
  x.moveTo(0, -26);
  x.bezierCurveTo(14, -18, 16, 2, 4, 10);
  x.bezierCurveTo(-2, 16, -14, 12, -16, 0);
  x.bezierCurveTo(-17, -10, -10, -20, 0, -26);
  x.fill();
  x.beginPath(); x.arc(2, -30, 7, 0, 7); x.fill();
  x.beginPath(); x.moveTo(6, -34); x.lineTo(21, -30); x.lineTo(6, -26); x.fill();
  x.beginPath();
  x.moveTo(-2, -6);
  x.bezierCurveTo(-30, -26, -46, -20, -42, -4);
  x.bezierCurveTo(-30, -8, -14, -4, -2, -6);
  x.fill();
  x.lineWidth = 5; x.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    x.beginPath(); x.moveTo(2, 10);
    x.quadraticCurveTo(i * 16, 34, i * 27, 60);
    x.stroke();
  }
  x.restore();
}
function drawSunbirdTooth(x, r) {
  x.save();
  x.translate(r, 0);
  x.beginPath();
  x.moveTo(0, -15);
  x.bezierCurveTo(27, -11, 31, 15, 8, 23);
  x.bezierCurveTo(-7, 27, -17, 16, -11, 2);
  x.bezierCurveTo(-5, 10, 8, 8, 10, -3);
  x.bezierCurveTo(11, -10, 6, -15, 0, -15);
  x.fill();
  x.restore();
}
function makeSunbirdTexture() {
  const c = makeCanvas(1024, 1024);
  const x = c.getContext('2d');
  const cx = 512, cy = 512;
  const g = x.createRadialGradient(cx, cy, 90, cx, cy, 512);
  g.addColorStop(0, '#f0c04a');
  g.addColorStop(0.5, '#cf9a2c');
  g.addColorStop(0.85, '#a06e18');
  g.addColorStop(1, '#7a5410');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 1024);
  // 拉丝纹理
  x.globalAlpha = 0.07;
  for (let i = 0; i < 380; i++) {
    x.strokeStyle = i % 2 ? '#ffe9a0' : '#5a3c08';
    x.lineWidth = 1 + Math.random() * 2;
    x.beginPath();
    const a0 = Math.random() * Math.PI * 2;
    x.arc(cx, cy, 60 + Math.random() * 440, a0, a0 + 0.6 + Math.random() * 2);
    x.stroke();
  }
  x.globalAlpha = 1;
  const dark = '#181004';
  x.fillStyle = dark; x.strokeStyle = dark;
  // 外圈四鸟
  for (let i = 0; i < 4; i++) {
    x.save(); x.translate(cx, cy); x.rotate(i * Math.PI / 2);
    drawSunbirdBird(x, 432);
    x.restore();
  }
  // 内圈十二道旋转火焰齿
  for (let i = 0; i < 12; i++) {
    x.save(); x.translate(cx, cy); x.rotate(i * Math.PI / 6);
    drawSunbirdTooth(x, 238);
    x.restore();
  }
  // 中心孔
  x.beginPath(); x.arc(cx, cy, 148, 0, 7); x.fill();
  // 划痕
  x.globalAlpha = 0.12;
  x.strokeStyle = '#3a2804';
  for (let i = 0; i < 40; i++) {
    x.lineWidth = 0.8;
    x.beginPath();
    const a = Math.random() * Math.PI * 2, r0 = 160 + Math.random() * 330;
    x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    x.lineTo(cx + Math.cos(a) * (r0 + 20 + Math.random() * 60), cy + Math.sin(a) * (r0 + 20 + Math.random() * 60));
    x.stroke();
  }
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---- 青铜锈蚀贴图 ----
function makePatinaTexture() {
  const c = makeCanvas(512, 512);
  const x = c.getContext('2d');
  x.fillStyle = '#5c6b52';
  x.fillRect(0, 0, 512, 512);
  const cols = ['#4a7a5e', '#6b5a3a', '#3d5c48', '#7a8c66', '#2e4a3c', '#8a7a4a'];
  for (let i = 0; i < 260; i++) {
    const px = Math.random() * 512, py = Math.random() * 512;
    const r = 8 + Math.random() * 55;
    const gg = x.createRadialGradient(px, py, 0, px, py, r);
    const col = cols[(Math.random() * cols.length) | 0];
    gg.addColorStop(0, col);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalAlpha = 0.12 + Math.random() * 0.3;
    x.fillStyle = gg;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  x.globalAlpha = 0.5;
  for (let i = 0; i < 900; i++) {
    x.fillStyle = Math.random() < 0.5 ? '#1e2e24' : '#9ab89a';
    x.globalAlpha = 0.05 + Math.random() * 0.2;
    x.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
  }
  x.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---- 焦散贴图（海床 / 文物光斑）----
function makeCausticsTexture() {
  const c = makeCanvas(512, 512);
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const px = Math.random() * 512, py = Math.random() * 512;
    const r = 18 + Math.random() * 80;
    const gg = x.createRadialGradient(px, py, 0, px, py, r);
    gg.addColorStop(0, 'rgba(190,255,215,0.20)');
    gg.addColorStop(0.6, 'rgba(140,230,190,0.08)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gg;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  x.strokeStyle = 'rgba(220,255,235,0.10)';
  for (let i = 0; i < 26; i++) {
    x.lineWidth = 1 + Math.random() * 2;
    x.beginPath();
    const px = Math.random() * 512, py = Math.random() * 512;
    x.moveTo(px, py);
    x.quadraticCurveTo(px + 60 - Math.random() * 120, py + 40 - Math.random() * 80,
      px + 120 - Math.random() * 240, py + 90 - Math.random() * 180);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---- 水面贴图（从水下仰望）----
function makeWaterTexture() {
  const c = makeCanvas(512, 512);
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 46; i++) {
    const py = Math.random() * 512;
    x.strokeStyle = `rgba(170,255,205,${0.04 + Math.random() * 0.09})`;
    x.lineWidth = 2 + Math.random() * 8;
    x.beginPath();
    for (let px = 0; px <= 512; px += 16) {
      const yy = py + Math.sin(px * 0.02 + i) * 14 + Math.sin(px * 0.005 + i * 2) * 22;
      px === 0 ? x.moveTo(px, yy) : x.lineTo(px, yy);
    }
    x.stroke();
  }
  for (let i = 0; i < 30; i++) {
    const px = Math.random() * 512, py = Math.random() * 512;
    const r = 20 + Math.random() * 70;
    const gg = x.createRadialGradient(px, py, 0, px, py, r);
    gg.addColorStop(0, 'rgba(200,255,225,0.10)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gg;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---- 光柱贴图 ----
function makeGodrayTexture() {
  const c = makeCanvas(128, 512);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 512);
  x.globalCompositeOperation = 'destination-in';
  const g2 = x.createLinearGradient(0, 0, 128, 0);
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(0.5, 'rgba(0,0,0,1)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g2;
  x.fillRect(0, 0, 128, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- 径向辉光贴图 ----
function makeGlowTexture() {
  const c = makeCanvas(128, 128);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- 金杖贴图 ----
function makeStaffTexture() {
  const c = makeCanvas(128, 512);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, '#8a5f14');
  g.addColorStop(0.5, '#e8b83a');
  g.addColorStop(1, '#8a5f14');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 512);
  x.fillStyle = '#3a2804';
  x.strokeStyle = '#3a2804';
  // 两组纹饰带：鱼 / 鸟 / 箭
  for (const bandY of [120, 330]) {
    x.save();
    x.beginPath(); x.rect(0, bandY, 128, 110); x.clip();
    for (let i = 0; i < 3; i++) {
      const bx = 22 + i * 42;
      // 鱼形
      x.beginPath();
      x.moveTo(bx, bandY + 40);
      x.quadraticCurveTo(bx + 14, bandY + 22, bx + 26, bandY + 40);
      x.quadraticCurveTo(bx + 14, bandY + 58, bx, bandY + 40);
      x.fill();
      x.beginPath();
      x.moveTo(bx + 26, bandY + 40); x.lineTo(bx + 36, bandY + 30); x.lineTo(bx + 36, bandY + 50);
      x.closePath(); x.fill();
      // 箭形
      x.lineWidth = 3;
      x.beginPath(); x.moveTo(bx + 2, bandY + 78); x.lineTo(bx + 30, bandY + 78); x.stroke();
      x.beginPath(); x.moveTo(bx + 30, bandY + 78); x.lineTo(bx + 22, bandY + 72);
      x.moveTo(bx + 30, bandY + 78); x.lineTo(bx + 22, bandY + 84); x.stroke();
    }
    x.restore();
    x.lineWidth = 4;
    x.beginPath(); x.moveTo(0, bandY - 6); x.lineTo(128, bandY - 6); x.stroke();
    x.beginPath(); x.moveTo(0, bandY + 116); x.lineTo(128, bandY + 116); x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---- 表面脏灰（CSS 噪点）----
function makeGrimeDataURL() {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  const img = x.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 30 + Math.random() * 60;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c.toDataURL();
}
