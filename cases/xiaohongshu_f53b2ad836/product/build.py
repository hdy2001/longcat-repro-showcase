#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build a single-file HTML: Dunhuang caisson kaleidoscope (embedded images)."""
import base64, io, json, os
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(BASE, "inputs")

# (filename, display name, category)
ENTRIES = [
    ("img_00.jpg",    "莲花飞天", "莲花飞天"),
    ("uniform_04.jpg", "莲花飞天", "莲花飞天"),
    ("uniform_05.jpg", "莲花飞天", "莲花飞天"),
    ("uniform_03.jpg", "莲花飞天", "莲花飞天"),
    ("uniform_01.jpg", "凤鸟",     "凤鸟"),
    ("uniform_02.jpg", "凤鸟",     "凤鸟"),
    ("uniform_09.jpg", "龙纹",     "龙纹"),
    ("uniform_06.jpg", "几何纹",   "几何纹"),
    ("uniform_07.jpg", "几何纹",   "几何纹"),
    ("uniform_08.jpg", "宝相花",   "宝相花"),
]

CATS = ["莲花飞天", "凤鸟", "龙纹", "几何纹", "宝相花"]

def encode(path, max_side=1280, quality=85):
    im = Image.open(path)
    im = im.convert("RGB")
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    # 构建期预提亮（等效 brightness(1.32) saturate(1.18) contrast(1.05)）
    from PIL import ImageEnhance
    im = ImageEnhance.Brightness(im).enhance(1.32)
    im = ImageEnhance.Color(im).enhance(1.18)
    im = ImageEnhance.Contrast(im).enhance(1.05)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")

imgs = []
total = 0
for fn, name, cat in ENTRIES:
    b64 = encode(os.path.join(IN, fn))
    total += len(b64)
    imgs.append({"src": "data:image/jpeg;base64," + b64,
                 "name": name, "cat": CATS.index(cat)})
    print(f"{fn:16s} -> {len(b64)//1024:5d} KB  ({name})")
print(f"total base64: {total//1024} KB")

HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>敦煌藻井 · 旋转万花筒</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:100%; height:100%; overflow:hidden; background:#160605; }
  body { font-family:"Songti SC","STSong","SimSun","Noto Serif CJK SC","Source Han Serif SC",serif; }
  #stage { position:fixed; inset:0; width:100%; height:100%; display:block; cursor:pointer; }

  .title {
    position:fixed; top:26px; left:0; right:0; text-align:center;
    pointer-events:none; z-index:5;
  }
  .title h1 {
    display:inline-block; font-size:26px; font-weight:600; letter-spacing:.35em; text-indent:.35em;
    background:linear-gradient(180deg,#F7E0A0 10%,#E3B95C 55%,#B9832F 100%);
    -webkit-background-clip:text; background-clip:text; color:transparent;
    text-shadow:0 0 24px rgba(231,194,94,.18);
    padding:0 18px;
  }
  .title .sub {
    margin-top:8px; font-size:12px; letter-spacing:.5em; text-indent:.5em;
    color:rgba(232,199,120,.55);
  }
  .title .line {
    display:inline-block; vertical-align:middle; width:64px; height:1px; margin:0 14px;
    background:linear-gradient(90deg,transparent,rgba(231,194,94,.6));
  }
  .title .line.r { background:linear-gradient(90deg,rgba(231,194,94,.6),transparent); }

  .caption {
    position:fixed; left:0; right:0; bottom:74px; text-align:center; z-index:5;
    pointer-events:none; transition:opacity .22s ease, transform .22s ease;
  }
  .caption.out { opacity:0; transform:translateY(6px); }
  .caption .name {
    font-size:21px; letter-spacing:.3em; text-indent:.3em; color:#F2D48A;
    text-shadow:0 1px 12px rgba(0,0,0,.6), 0 0 18px rgba(231,194,94,.25);
  }
  .caption .src {
    margin-top:6px; font-size:12px; letter-spacing:.28em; text-indent:.28em;
    color:rgba(240,214,150,.55);
  }

  .chips {
    position:fixed; left:0; right:0; bottom:30px; display:flex; justify-content:center;
    gap:10px; z-index:5; pointer-events:none; flex-wrap:wrap; padding:0 12px;
  }
  .chip {
    display:inline-flex; align-items:center; gap:7px;
    font-size:12px; letter-spacing:.18em; text-indent:.05em;
    color:rgba(242,212,138,.38);
    border:1px solid rgba(231,194,94,.16); border-radius:999px;
    padding:5px 13px; background:rgba(22,6,5,.35);
    transition:all .45s ease;
  }
  .chip i {
    width:7px; height:7px; border-radius:50%; display:inline-block;
    background:var(--c); opacity:.35; transition:all .45s ease;
  }
  .chip.on {
    color:#F5D98D; border-color:rgba(238,206,110,.75);
    background:rgba(58,20,12,.55);
    box-shadow:0 0 14px rgba(231,194,94,.28), inset 0 0 8px rgba(231,194,94,.12);
  }
  .chip.on i { opacity:1; box-shadow:0 0 8px var(--c); }

  .hint {
    position:fixed; left:18px; bottom:16px; z-index:5; pointer-events:none;
    font-size:11px; letter-spacing:.22em; color:rgba(240,214,150,.34);
  }
  .badge {
    position:fixed; right:18px; top:20px; z-index:5; pointer-events:none;
    font-size:11px; letter-spacing:.3em; text-indent:.3em; color:rgba(240,214,150,.4);
    border:1px solid rgba(231,194,94,.22); border-radius:3px; padding:5px 10px;
    background:rgba(22,6,5,.3);
  }

  #loading {
    position:fixed; inset:0; z-index:20; display:flex; align-items:center; justify-content:center;
    background:radial-gradient(circle at 50% 46%, #571811 0%, #33100B 48%, #160605 100%);
    color:#E8C778; font-size:15px; letter-spacing:.5em; text-indent:.5em;
    transition:opacity 1s ease;
  }
  #loading.done { opacity:0; pointer-events:none; }
  @media (max-width:640px){
    .title h1 { font-size:20px; }
    .caption .name { font-size:17px; }
    .hint { display:none; }
  }
</style>
</head>
<body>
<canvas id="stage"></canvas>

<header class="title">
  <h1>敦煌藻井</h1><br>
  <div class="sub"><span class="line"></span>旋转万花筒 · 仰视窟顶<span class="line r"></span></div>
</header>

<div class="badge">莫高窟 · 藻井纹样</div>

<div class="caption" id="caption">
  <div class="name" id="capName">宝相花</div>
  <div class="src" id="capSrc">敦煌莫高窟藻井 · 点击画面切换纹样</div>
</div>

<nav class="chips" id="chips"></nav>
<div class="hint">点击画面切换纹样 · 自动轮播</div>
<div id="loading">藻 井 加 载 中</div>

<script>
"use strict";
const TAU = Math.PI * 2;
const IMAGES = __IMAGES_JSON__;
const CATS = __CATS_JSON__;
const CAT_COLORS = ["#d96c5f", "#e3b23c", "#5b8db8", "#4e9a6e", "#c98a9b"];
const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 预加载 + 提亮预处理 ---------- */
function makeBright(im) {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d");
  const side = Math.min(im.naturalWidth || im.width, im.naturalHeight || im.height);
  const sx = ((im.naturalWidth || im.width) - side) / 2;
  const sy = ((im.naturalHeight || im.height) - side) / 2;
  // 提亮已在构建期用 PIL 完成，此处仅做方形裁剪
  x.drawImage(im, sx, sy, side, side, 0, 0, S, S);
  return c;
}

/* ---------- 图层配置：6 层同心环（含中心圆），纹样始终显示、持续旋转 ---------- */
const FR = [0, 0.14, 0.30, 0.48, 0.68, 0.92, 1.7]; // 各环半径（占 R 比例，外圈延伸至接近四角）
const CFG = [ // 外层 -> 中心；初始纹样覆盖全部 5 类
  { seg: 30, speed:  5, start: 7 },  // 几何纹
  { seg: 24, speed: -8, start: 4 },  // 凤鸟
  { seg: 18, speed: 12, start: 1 },  // 莲花飞天
  { seg: 12, speed: -16, start: 6 }, // 龙纹
  { seg: 8,  speed: 22, start: 9 },  // 宝相花
  { seg: 6,  speed: 26, start: 0 },  // 莲花飞天（中心）
];
const FADE = 1.5;          // 交叉淡变时长（秒）
const INTERVAL = 7.5;      // 轮播间隔（秒）

const layers = CFG.map((c, i) => ({
  r0: FR[i], r1: FR[i + 1], seg: c.seg,
  speed: REDUCED ? c.speed * 0.3 : c.speed,
  img: c.start, prev: -1, fade: 1,
  angle: (i * 1.7) % TAU,
  nextAt: 0,
}));
const CENTER = layers.length - 1;

/* ---------- 画布 ---------- */
const cv = document.getElementById("stage");
const ctx = cv.getContext("2d");
let W = 0, H = 0, CX = 0, CY = 0, R = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  CX = W / 2; CY = H / 2;
  R = Math.min(W, H) / 2;
}
window.addEventListener("resize", resize);
resize();

/* ---------- UI：纹样名 / 分类 chips ---------- */
const capEl = document.getElementById("caption");
const capName = document.getElementById("capName");
const chipsEl = document.getElementById("chips");
const chipEls = CATS.map((c, i) => {
  const s = document.createElement("span");
  s.className = "chip";
  s.style.setProperty("--c", CAT_COLORS[i]);
  s.innerHTML = "<i></i>" + c;
  chipsEl.appendChild(s);
  return s;
});
let capToken = 0;
function updateCaption() {
  const L = layers[CENTER];
  const my = ++capToken;
  capEl.classList.add("out");
  setTimeout(() => {
    if (my !== capToken) return;
    capName.textContent = IMAGES[L.img].name;
    capEl.classList.remove("out");
  }, 230);
}
function updateChips() {
  for (let c = 0; c < CATS.length; c++) {
    const on = layers.some(L => IMAGES[L.img].cat === c);
    if (chipEls[c].classList.contains("on") !== on) chipEls[c].classList.toggle("on", on);
  }
}

/* ---------- 金粉粒子 ---------- */
const MOTES = [];
function initMotes() {
  MOTES.length = 0;
  const n = REDUCED ? 0 : 46;
  for (let i = 0; i < n; i++) {
    MOTES.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.8 + Math.random() * 1.9,
      v: 6 + Math.random() * 15,
      ph: Math.random() * TAU, tw: 0.6 + Math.random() * 1.6,
    });
  }
}
initMotes();

/* ---------- 切换纹样：旧图淡出 + 新图淡入（交叉淡变，无黑屏） ---------- */
function switchLayer(L, now) {
  L.prev = L.img;
  L.img = (L.img + 1) % IMAGES.length;
  L.fade = 0;
  L.nextAt = now + INTERVAL * 1000;
  updateChips();
  if (L === layers[CENTER]) updateCaption();
}
function advanceAll(now) {
  layers.forEach((L, i) => setTimeout(() => switchLayer(L, performance.now()), i * 110));
}
cv.addEventListener("click", () => advanceAll(performance.now()));

/* ---------- 绘制 ---------- */
function drawLayerImg(L, idx, alpha, bright) {
  if (alpha <= 0.004) return;
  const S = 2 * R * L.r1 * 1.04;
  const ov = (TAU / L.seg) * 0.07; // 扇区两侧微重叠，消除拼缝
  for (let k = 0; k < L.seg; k++) {
    const a0 = (k * TAU) / L.seg - ov;
    const a1 = ((k + 1) * TAU) / L.seg + ov;
    ctx.save();
    ctx.beginPath();
    if (L.r0 <= 0.001) {
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R * L.r1, a0, a1);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, R * L.r1, a0, a1);
      ctx.arc(0, 0, R * L.r0, a1, a0, true);
      ctx.closePath();
    }
    ctx.clip();
    ctx.rotate((a0 + a1) / 2);
    if (k % 2) ctx.scale(-1, 1); // 镜像对称 -> 万花筒
    ctx.globalAlpha = alpha;
    ctx.drawImage(bright[idx], -S / 2, -S / 2, S, S);
    ctx.restore();
  }
}

let last = 0, started = false, DT = 0;
const FF = parseFloat(new URLSearchParams(location.search).get("ff") || "NaN"); // 测试：快进到指定秒数渲染单帧
function frame(now) {
  if (!isNaN(FF)) {
    drawAll(now);
    if (!started) {
      started = true;
      document.getElementById("loading").classList.add("done");
    }
    return;
  }
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
  last = now;
  DT = dt;

  for (const L of layers) {
    L.angle += L.speed * dt;
    if (L.fade < 1) L.fade = Math.min(1, L.fade + dt / FADE);
    if (now >= L.nextAt) switchLayer(L, now);
  }
  if (!started) { started = true; document.getElementById("loading").classList.add("done"); }

  drawAll(now);
  updateChips();
  if (isNaN(FF)) requestAnimationFrame(frame);
}

function drawAll(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  /* 背景：深红暖色径向渐变（非黑色） */
  let g = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.72);
  g.addColorStop(0, "#631d13");
  g.addColorStop(0.45, "#421310");
  g.addColorStop(1, "#1d0806");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* 中心金色呼吸光晕 */
  const breathe = REDUCED ? 0 : Math.sin(now * 0.00012) * 0.5 + 0.5;
  g = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 0.9);
  g.addColorStop(0, "rgba(231,194,94," + (0.12 + breathe * 0.08) + ")");
  g.addColorStop(0.6, "rgba(231,194,94,0.04)");
  g.addColorStop(1, "rgba(231,194,94,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* 世界整体缓慢缩放（仰视呼吸感） */
  const zoom = REDUCED ? 1 : 1 + Math.sin(now * 0.0001) * 0.022;
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(zoom, zoom);
  ctx.translate(-CX, -CY);

  /* 各层图案：外 -> 内绘制，交叉淡变期间新旧同画 */
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(L.angle);
    const e = L.fade * L.fade * (3 - 2 * L.fade); // smoothstep
    if (L.fade < 1 && L.prev >= 0) drawLayerImg(L, L.prev, 1 - e, BRIGHT);
    drawLayerImg(L, L.img, L.fade >= 1 ? 1 : e, BRIGHT);
    ctx.restore();
  }

  /* 金色环带（层间分隔）+ 中心宝珠 */
  ctx.save();
  ctx.translate(CX, CY);
  for (let i = 0; i < FR.length; i++) {
    const r = FR[i] * R;
    if (r <= 0.01) continue;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.lineWidth = i === FR.length - 1 ? 3 : 2;
    ctx.strokeStyle = "rgba(231,194,94,0.85)";
    ctx.shadowColor = "rgba(231,194,94,0.8)";
    ctx.shadowBlur = 10;
    ctx.stroke();
  }
  /* 中心金色宝珠 */
  const pr = Math.max(R * 0.045, 8);
  const pg = ctx.createRadialGradient(-pr * 0.3, -pr * 0.3, pr * 0.1, 0, 0, pr);
  pg.addColorStop(0, "#FBE9B8");
  pg.addColorStop(0.55, "#E3B95C");
  pg.addColorStop(1, "#9A6A1E");
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, TAU);
  ctx.fillStyle = pg;
  ctx.shadowColor = "rgba(231,194,94,0.9)";
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.restore();

  /* 石青 / 石绿 虚线饰环（缓慢反向旋转） */
  ctx.save();
  ctx.translate(CX, CY);
  const accents = [
    { r: 0.39, color: "rgba(91,141,184,0.55)", w: 2, sp: 0.05, dash: [3, 11] },
    { r: 0.80, color: "rgba(78,154,110,0.5)", w: 2, sp: -0.04, dash: [3, 11] },
  ];
  for (const a of accents) {
    ctx.beginPath();
    ctx.setLineDash(a.dash);
    ctx.lineDashOffset = now * 0.02 * a.sp * 10;
    ctx.arc(0, 0, a.r * R, 0, TAU);
    ctx.lineWidth = a.w;
    ctx.strokeStyle = a.color;
    ctx.shadowColor = a.color;
    ctx.shadowBlur = 8;
    ctx.stroke();
  }
  ctx.restore();

  /* 金粉漂浮 */
  for (const m of MOTES) {
    m.y -= m.v * DT;
    if (m.y < -12) { m.y = H + 12; m.x = Math.random() * W; }
    const a = 0.16 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.001 * m.tw + m.ph));
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.fillStyle = "rgba(238,206,110," + a + ")";
    ctx.shadowColor = "rgba(238,206,110,0.8)";
    ctx.shadowBlur = 6;
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  /* 暗角 */
  g = ctx.createRadialGradient(CX, CY, R * 0.5, CX, CY, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(10,2,2,0)");
  g.addColorStop(1, "rgba(14,4,4,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.restore(); // world zoom
}

/* ---------- 启动 ---------- */
function boot(bright) {
  window.BRIGHT = bright;
  if (!isNaN(FF)) {
    /* 测试模式：把状态快进到 FF 秒，直接渲染一帧 */
    layers.forEach((L, i) => {
      const t0i = 2.5 + i * 1.6; // 首次切换时间（秒）
      L.angle = L.speed * FF;
      if (FF >= t0i) {
        const n = Math.floor((FF - t0i) / INTERVAL);
        L.img = (L.img + n + 1) % IMAGES.length; // L.img 初始即 CFG.start
        L.prev = (L.img + IMAGES.length - 1) % IMAGES.length;
        L.fade = Math.min(1, Math.max(0, (FF - (t0i + n * INTERVAL)) / FADE));
        L.nextAt = Infinity;
      } else {
        L.prev = -1;
        L.fade = 1;
        L.nextAt = t0i * 1000;
      }
    });
    capName.textContent = IMAGES[layers[CENTER].img].name;
    updateChips();
    requestAnimationFrame(frame);
    return;
  }
  const t0 = performance.now();
  layers.forEach((L, i) => { L.nextAt = t0 + (2.5 + i * 1.6) * 1000; });
  updateChips();
  requestAnimationFrame(frame);
}

Promise.all(IMAGES.map(d => new Promise(res => {
  const im = new Image();
  im.onload = () => res(makeBright(im));
  im.onerror = () => res(null);
  im.src = d.src;
}))).then(arr => {
  const ok = arr.every(Boolean);
  if (!ok) { document.getElementById("loading").textContent = "部分纹样加载失败"; return; }
  boot(arr);
});
</script>
</body>
</html>
"""

html = (HTML
        .replace("__IMAGES_JSON__", json.dumps(imgs, ensure_ascii=False))
        .replace("__CATS_JSON__", json.dumps(CATS, ensure_ascii=False)))

out = os.path.join(BASE, "index.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("written:", out, f"({os.path.getsize(out)//1024} KB)")
