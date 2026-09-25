// ============================================================
// 9:16 竖屏视频页：电影运镜 + 解说字幕叠加 + 无头录制接口
// URL 参数（由 crate-vibe-motion-3D 注入）：
//   shots=[{t0,t1,label,text}] 分镜字幕
//   dur=58 时长（秒） title=片名
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world.js';

const VW = 540, VH = 960;
const params = new URLSearchParams(location.search);
const SHOTS = params.get('shots') ? JSON.parse(decodeURIComponent(params.get('shots'))) : [];
const DUR = parseFloat(params.get('dur') || '58');
const TITLE = params.get('title') || '故宫 · 夜游';
const NO_FX = params.get('fx') === '0';

// ---------- 渲染器 ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(VW, VH);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.autoClear = false;

const camera = new THREE.PerspectiveCamera(58, VW / VH, 0.5, 4000);

// ---------- 世界（与交互页同一套场景） ----------
const world = buildWorld();

// ---------- 字幕叠加层（绘制进画布，随 canvas 一起被录制） ----------
const overlay = document.createElement('canvas');
overlay.width = VW; overlay.height = VH;
const octx = overlay.getContext('2d');
const overlayTex = new THREE.CanvasTexture(overlay);
overlayTex.colorSpace = THREE.SRGBColorSpace;
const overlayScene = new THREE.Scene();
const overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const overlayQuad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, depthTest: false })
);
overlayScene.add(overlayQuad);

// ---------- 后期 ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(world.scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(VW, VH), 1.05, 0.6, 0.45);
if (!NO_FX) composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- 电影运镜（位置 + 注视点 关键帧） ----------
const KEYS = [
  { t: 0,    p: [0, 52, 565],   l: [0, 22, 398] },
  { t: 7,    p: [0, 32, 492],   l: [0, 16, 330] },
  { t: 12,   p: [0, 15, 396],   l: [0, 8, 300] },
  { t: 18,   p: [0, 20, 310],   l: [0, 16, 210] },
  { t: 24,   p: [0, 55, 195],   l: [0, 26, 92] },
  { t: 30,   p: [78, 50, 175],  l: [0, 24, 96] },
  { t: 35,   p: [-60, 38, 205], l: [0, 22, 96] },
  { t: 40,   p: [0, 20, 55],    l: [0, 12, -150] },
  { t: 46,   p: [0, 22, -268],  l: [0, 14, -370] },
  { t: 52,   p: [0, 64, -468],  l: [0, 32, -190] },
  { t: 56,   p: [0, 118, -330], l: [0, 8, 60] },
  { t: 58,   p: [0, 128, -290], l: [0, 8, 100] },
];
const posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...k.p)), false, 'centripetal', 0.5);
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...k.l)), false, 'centripetal', 0.5);
const _p = new THREE.Vector3(), _l = new THREE.Vector3();

// ---------- 字幕绘制 ----------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawOverlay(t) {
  octx.clearRect(0, 0, VW, VH);

  // 顶部品牌条
  octx.fillStyle = 'rgba(8,10,20,0.35)';
  roundRect(octx, 18, 20, 150, 40, 20); octx.fill();
  octx.font = '600 24px "PingFang SC","Microsoft YaHei",sans-serif';
  octx.fillStyle = '#ffd98a';
  octx.textBaseline = 'middle';
  octx.textAlign = 'left';
  octx.fillText(TITLE, 34, 41);

  // 当前分镜
  const shot = SHOTS.find(s => t >= s.t0 && t < s.t1);
  if (shot) {
    octx.textAlign = 'center';
    octx.font = '700 30px "PingFang SC","Microsoft YaHei",sans-serif';
    const lw = octx.measureText(shot.label).width + 48;
    octx.fillStyle = 'rgba(8,10,20,0.45)';
    roundRect(octx, (VW - lw) / 2, 74, lw, 46, 23); octx.fill();
    octx.fillStyle = '#ffe9c0';
    octx.fillText(shot.label, VW / 2, 98);
  }

  // 解说字幕（底部两行内）
  if (shot && shot.text) {
    octx.font = '600 25px "PingFang SC","Microsoft YaHei",sans-serif';
    octx.textAlign = 'center';
    octx.lineWidth = 7;
    octx.strokeStyle = 'rgba(0,0,0,0.85)';
    octx.fillStyle = '#fff3d8';
    const maxW = VW - 72;
    const chars = shot.text;
    let line = '', lines = [];
    for (const ch of chars) {
      if (octx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
      else line += ch;
    }
    lines.push(line);
    const lh = 38, base = VH - 66 - (lines.length - 1) * lh;
    lines.forEach((ln, i) => {
      const y = base + i * lh;
      octx.strokeText(ln, VW / 2, y);
      octx.fillText(ln, VW / 2, y);
    });
  }

  // 片头黑场淡入 / 片尾标题卡
  if (t < 2) {
    octx.fillStyle = `rgba(0,0,0,${1 - t / 2})`;
    octx.fillRect(0, 0, VW, VH);
  }
  if (t > DUR - 5) {
    const a = Math.min(1, (t - (DUR - 5)) / 2.5);
    octx.fillStyle = `rgba(3,4,10,${0.88 * a})`;
    octx.fillRect(0, 0, VW, VH);
    octx.textAlign = 'center';
    octx.globalAlpha = a;
    octx.font = '700 64px "PingFang SC","Microsoft YaHei",sans-serif';
    octx.fillStyle = '#ffd98a';
    octx.fillText(TITLE, VW / 2, VH / 2 - 30);
    octx.font = '400 24px "PingFang SC",sans-serif';
    octx.fillStyle = 'rgba(255,233,192,0.85)';
    octx.fillText('FORBIDDEN CITY · NIGHT', VW / 2, VH / 2 + 26);
    octx.globalAlpha = 1;
  }
  overlayTex.needsUpdate = true;
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let elapsed = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed = Math.min(elapsed + dt, DUR);
  const t = elapsed;

  // 运镜：按 DUR 归一化
  const u = THREE.MathUtils.clamp(t / DUR, 0, 1);
  // 关键帧时间映射到曲线参数
  const n = KEYS.length - 1;
  const ft = u * n;
  const i0 = Math.min(Math.floor(ft), n - 1);
  const f = ft - i0;
  const kA = KEYS[i0], kB = KEYS[i0 + 1];
  const smooth = f * f * (3 - 2 * f);
  camera.position.set(
    THREE.MathUtils.lerp(kA.p[0], kB.p[0], smooth),
    THREE.MathUtils.lerp(kA.p[1], kB.p[1], smooth),
    THREE.MathUtils.lerp(kA.p[2], kB.p[2], smooth)
  );
  _l.set(
    THREE.MathUtils.lerp(kA.l[0], kB.l[0], smooth),
    THREE.MathUtils.lerp(kA.l[1], kB.l[1], smooth),
    THREE.MathUtils.lerp(kA.l[2], kB.l[2], smooth)
  );
  camera.lookAt(_l);

  world.update(dt, t);
  drawOverlay(t);
  renderer.clear();
  composer.render();
  renderer.render(overlayScene, overlayCam);
});

// ---------- 录制接口（供 crate-vibe-motion-3D 调用） ----------
window.__video = {
  ready: true,
  duration: DUR,
  startRecording() {
    const stream = canvas.captureStream(60);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    this._done = new Promise(res => { rec.onstop = res; });
    rec.start(500);
    this._rec = rec;
    this._chunks = chunks;
    return true;
  },
  async stopRecording() {
    this._rec.stop();
    await this._done;
    const blob = new Blob(this._chunks, { type: 'video/webm' });
    const buf = await blob.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(bin);
  },
  seek(t) { elapsed = t; },
};
