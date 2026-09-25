// ============================================================
// cinematic.js — 9:16 竖屏电影时间线：相机路径 + 中文解说字幕
// ============================================================
import * as THREE from 'three';

// ---------- 时间轴关键帧（秒） ----------
// pos: 相机位置；look: 注视点；fov: 视场角
const KEYS = [
  { t: 0,  pos: [2, 7, 640],      look: [0, 14, 452],    fov: 58 },
  { t: 8,  pos: [0, 5.5, 516],    look: [0, 14, 452],    fov: 58 },
  { t: 14, pos: [0, 4.2, 468],    look: [0, 11, 415],    fov: 60 },
  { t: 19, pos: [0, 3.4, 424],    look: [0, 8, 380],     fov: 60 },
  { t: 25, pos: [0, 3.1, 382],    look: [0, 9, 352],     fov: 58 },
  { t: 28, pos: [0, 6, 322],      look: [0, 16, 285],    fov: 58 },
  { t: 31, pos: [0, 10, 330],     look: [0, 18, 285],    fov: 58 },
  { t: 36, pos: [10, 12, 332],    look: [0, 16, 285],    fov: 58 },
  { t: 42, pos: [72, 20, 332],    look: [0, 13, 285],    fov: 60 },
  { t: 48, pos: [20, 26, 360],    look: [0, 10, 275],    fov: 62 },
  { t: 54, pos: [0, 42, 300],     look: [0, 8, 210],     fov: 64 },
  { t: 60, pos: [0, 55, 180],     look: [0, 4, -30],     fov: 64 },
  { t: 66, pos: [0, 36, 30],      look: [0, 2, -100],    fov: 62 },
  { t: 71, pos: [0, 20, -70],     look: [0, 3, -170],    fov: 60 },
  { t: 76, pos: [0, 38, -100],    look: [0, 5, -210],    fov: 60 },
  { t: 81, pos: [90, 70, -40],    look: [0, 0, -60],     fov: 66 },
  { t: 86, pos: [240, 130, 320],  look: [0, 15, -40],    fov: 68 },
  { t: 92, pos: [330, 170, 520],  look: [0, 20, -20],    fov: 70 },
  { t: 98, pos: [180, 105, 470],  look: [0, 18, 0],      fov: 68 },
  { t: 104, pos: [60, 42, 330],    look: [0, 26, -140],   fov: 64 },
  { t: 110, pos: [0, 18, 240],     look: [0, 42, -500],   fov: 60 },
  { t: 116, pos: [0, 10, 210],     look: [0, 45, -500],   fov: 58 },
];

// ---------- 解说字幕 ----------
const SUBS = [
  { t0: 9,  t1: 17, text: '午门 —— 紫禁城的正门，建于明永乐十八年（1420年）' },
  { t0: 17, t1: 25, text: '内金水河如玉带环绕，五座汉白玉石桥跨河而过' },
  { t0: 25, t1: 33, text: '太和殿 —— 金銮殿，紫禁城第一大殿' },
  { t0: 33, t1: 42, text: '面阔十一间 · 重檐庑殿顶，帝王登基、大典于此举行' },
  { t0: 42, t1: 50, text: '三层汉白玉台基，鸱吻相望，斗拱层叠' },
  { t0: 50, t1: 58, text: '过乾清门入内廷：乾清宫 · 交泰殿 · 坤宁宫' },
  { t0: 58, t1: 66, text: '御花园古柏参天，钦安殿静立园北' },
  { t0: 66, t1: 76, text: '中轴线绵延九百六十米，大小宫殿七十多座' },
  { t0: 76, t1: 86, text: '房屋九千余间，世界第一木结构古建筑群' },
  { t0: 86, t1: 96, text: '六百年风雨，二十四位帝王，今夜灯火依旧' },
  { t0: 96, t1: 106, text: '斗转星移，城还是那座城' },
];

const TITLE = { t0: 0.5, t1: 8, main: '紫 禁 城', sub: '夜 · 游', en: 'THE FORBIDDEN CITY · NIGHT' };
const ENDING = { t0: 108, t1: 116, main: '故 宫', sub: '世界文化遗产 · 1987', en: 'PALACE MUSEUM · UNESCO WORLD HERITAGE' };

// ---------- Catmull-Rom 时间采样 ----------
function makeTrack(keys, field) {
  return (t, out) => {
    const n = keys.length;
    if (t <= keys[0].t) return out.set(...keys[0][field]);
    if (t >= keys[n - 1].t) return out.set(...keys[n - 1][field]);
    let i = 0;
    while (i < n - 2 && keys[i + 1].t < t) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
    const s = (t - k1.t) / (k2.t - k1.t);
    const s2 = s * s, s3 = s2 * s;
    const r = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      const p0 = k0[field][j], p1 = k1[field][j], p2 = k2[field][j], p3 = k3[field][j];
      r[j] = 0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3);
    }
    return out.set(r[0], r[1], r[2]);
  };
}

export function createCinematic(camera, W, H) {
  const posTrack = makeTrack(KEYS, 'pos');
  const lookTrack = makeTrack(KEYS, 'look');
  const duration = KEYS[KEYS.length - 1].t;
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  const fovKeys = KEYS.map((k) => ({ t: k.t, v: k.fov }));

  // 2D 叠加层：字幕 / 标题 / 暗角 / 噪点
  const overlay = document.createElement('canvas');
  overlay.width = W; overlay.height = H;
  const octx = overlay.getContext('2d');
  // 预渲染噪点
  const noiseC = document.createElement('canvas');
  noiseC.width = 256; noiseC.height = 256;
  const nctx = noiseC.getContext('2d');
  const nid = nctx.createImageData(256, 256);
  for (let i = 0; i < nid.data.length; i += 4) {
    const v = 118 + Math.random() * 20 | 0;
    nid.data[i] = nid.data[i + 1] = nid.data[i + 2] = v; nid.data[i + 3] = 22;
  }
  nctx.putImageData(nid, 0, 0);
  // 预渲染暗角
  const vigC = document.createElement('canvas');
  vigC.width = W; vigC.height = H;
  const vctx = vigC.getContext('2d');
  const vg = vctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
  vg.addColorStop(0, 'rgba(4,6,14,0)'); vg.addColorStop(1, 'rgba(3,5,12,0.52)');
  vctx.fillStyle = vg; vctx.fillRect(0, 0, W, H);

  function sampleFov(t) {
    for (let i = 0; i < fovKeys.length - 1; i++) {
      const a = fovKeys[i], b = fovKeys[i + 1];
      if (t >= a.t && t <= b.t) return a.v + (b.v - a.v) * ((t - a.t) / (b.t - a.t));
    }
    return fovKeys[fovKeys.length - 1].v;
  }

  function drawCard(c, t, fade) {
    const cx = W / 2, cy = H * 0.40;
    octx.save();
    octx.globalAlpha = fade;
    octx.textAlign = 'center';
    // 主标
    octx.fillStyle = '#e8c87a';
    octx.font = `600 ${Math.floor(H * 0.062)}px "Kaiti SC","KaiTi","STKaiti",serif`;
    octx.shadowColor = 'rgba(255,190,90,0.45)'; octx.shadowBlur = 26;
    octx.fillText(c.main, cx, cy);
    octx.shadowBlur = 0;
    // 分隔线
    octx.strokeStyle = 'rgba(232,200,122,0.75)'; octx.lineWidth = 2;
    octx.beginPath(); octx.moveTo(cx - W * 0.16, cy + H * 0.035); octx.lineTo(cx + W * 0.16, cy + H * 0.035); octx.stroke();
    // 副标
    octx.fillStyle = 'rgba(235,235,240,0.92)';
    octx.font = `${Math.floor(H * 0.026)}px "PingFang SC","Hiragino Sans GB",sans-serif`;
    octx.fillText(c.sub, cx, cy + H * 0.075);
    // 英文
    octx.fillStyle = 'rgba(200,205,220,0.55)';
    octx.font = `${Math.floor(H * 0.016)}px "Helvetica Neue",sans-serif`;
    octx.fillText(c.en, cx, cy + H * 0.115);
    octx.restore();
  }

  function drawSub(text, t, t0, t1) {
    const fadeIn = Math.min(1, (t - t0) / 0.6);
    const fadeOut = Math.min(1, (t1 - t) / 0.6);
    const a = Math.max(0, Math.min(fadeIn, fadeOut));
    octx.save();
    octx.globalAlpha = a;
    octx.font = `500 ${Math.floor(H * 0.0235)}px "PingFang SC","Hiragino Sans GB",sans-serif`;
    octx.textAlign = 'center';
    const cx = W / 2, y = H * 0.86;
    const w = octx.measureText(text).width;
    octx.fillStyle = 'rgba(6,10,20,0.55)';
    const padX = 26, padY = 12, r = 18;
    const x0 = cx - w / 2 - padX, y0 = y - H * 0.017 - padY, bw = w + padX * 2, bh = H * 0.0235 + padY * 2;
    octx.beginPath();
    octx.roundRect(x0, y0, bw, bh, r);
    octx.fill();
    octx.fillStyle = '#f2ede2';
    octx.textBaseline = 'middle';
    octx.fillText(text, cx, y);
    octx.restore();
  }

  let time = 0;
  function update(dt, tAbs) {
    time = tAbs;
    // 手持微晃
    const sway = 0.5 + 0.5 * Math.min(1, Math.abs(tAbs - 8));
    const hx = Math.sin(tAbs * 0.9) * 0.35 * sway + Math.sin(tAbs * 2.3) * 0.08 * sway;
    const hy = Math.cos(tAbs * 1.1) * 0.28 * sway + Math.sin(tAbs * 3.1) * 0.06 * sway;

    posTrack(tAbs, pos); lookTrack(tAbs, look);
    camera.position.set(pos.x + hx, pos.y + hy, pos.z);
    const lk = new THREE.Vector3(look.x + hx * 0.4, look.y + hy * 0.4, look.z);
    camera.lookAt(lk);
    const fov = sampleFov(tAbs);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  function drawOverlay(tAbs) {
    octx.clearRect(0, 0, overlay.width, overlay.height);
    // 顶部细条（片名水印）
    octx.save();
    octx.textAlign = 'left';
    octx.font = `500 ${Math.floor(H * 0.015)}px "PingFang SC",sans-serif`;
    octx.fillStyle = 'rgba(230,220,200,0.4)';
    octx.fillText('紫禁城 · 夜', 34, 56);
    octx.restore();

    if (tAbs >= TITLE.t0 && tAbs <= TITLE.t1) {
      const a = Math.min((tAbs - TITLE.t0) / 1.2, (TITLE.t1 - tAbs) / 1.2, 1);
      drawCard(TITLE, tAbs, Math.max(0, a));
    }
    for (const s of SUBS) {
      if (tAbs >= s.t0 && tAbs <= s.t1) drawSub(s.text, tAbs, s.t0, s.t1);
    }
    if (tAbs >= ENDING.t0 && tAbs <= ENDING.t1) {
      const a = Math.min((tAbs - ENDING.t0) / 1.4, (ENDING.t1 - tAbs) / 1.4, 1);
      drawCard(ENDING, tAbs, Math.max(0, a));
    }
    // 暗角 + 噪点
    octx.drawImage(vigC, 0, 0);
    octx.save();
    octx.globalAlpha = 0.5;
    const ox = (Math.random() * 256) | 0, oy = (Math.random() * 256) | 0;
    for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) octx.drawImage(noiseC, x, y);
    octx.restore();
  }

  return { update, drawOverlay, duration, time: () => time, overlay };
}
