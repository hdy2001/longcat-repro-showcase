#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""组装可交互3D网页：内嵌 three.js r147 + GLB(base64)，单HTML文件"""
import base64, pathlib

WS = pathlib.Path("workspace")
T = pathlib.Path("/tmp/threejs")

glb_b64 = base64.b64encode(open("/tmp/pagoda.glb", "rb").read()).decode()
three_js = (T / "three.min.js").read_text()
orbit_js = (T / "OrbitControls.js").read_text()
gltf_js = (T / "GLTFLoader.js").read_text()

app_js = r"""
const LAYERS = [
  ["台基", "双层八角石台基，承托全塔，高0.9米"],
  ["副阶 · 重檐下檐", "底层外绕副阶外廊，斗拱48朵，与一层檐构成重檐"],
  ["明层一", "第一层明层：外槽24柱＋内槽8柱，格子门环绕，内供4.6米高佛像"],
  ["一层檐", "斗拱铺作层：双杪双昂、多层出跳，灰蓝瓦面、瓦当齐整"],
  ["暗层一", "暗层（结构层）：斜撑加固，抗风抗震，不可登临"],
  ["明层二", "第二层明层：礼佛空间，双跑楼梯沿塔壁盘旋而上"],
  ["二层檐", "斗拱铺作层：44朵斗拱，出跳承檐"],
  ["暗层二", "暗层（结构层）：斜撑加固"],
  ["明层三", "第三层明层：礼佛空间"],
  ["三层檐", "斗拱铺作层：40朵斗拱"],
  ["暗层三", "暗层（结构层）：斜撑加固"],
  ["明层四", "第四层明层：礼佛空间"],
  ["四层檐", "斗拱铺作层：36朵斗拱"],
  ["暗层四", "暗层（结构层）：斜撑加固"],
  ["明层五", "第五层明层：顶层礼佛空间"],
  ["五层檐", "斗拱铺作层：32朵斗拱"],
  ["攒尖顶", "八角攒尖顶：瓦垄整齐、檐角起翘，上承宝顶"],
  ["塔刹", "刹杆、七重相轮、宝珠、铁链，全刹高10.6米"],
];
const NL = LAYERS.length;
const GAP = 2.6;

let renderer, scene, camera, controls, clock;
let pagoda = null;
let layerObjs = [];      // layerObjs[i] = [mesh...]
for (let i = 0; i < NL; i++) layerObjs.push([]);
let cur = 0, target = 0; // 爆炸因子
let stepK = -1;          // 逐层拆解模式：-1=整体滑杆
let autoDir = 0;         // 自动播放方向
let hovered = -1;
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
let mouseXY = {x: 0, y: 0};
let pointerDirty = false;
let autoRot = false;

function init() {
  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe7ee);
  scene.fog = new THREE.Fog(0xdfe7ee, 280, 620);

  camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 1500);
  camera.position.set(80, -96, 52);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 33);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 6;
  controls.maxDistance = 520;
  controls.maxPolarAngle = Math.PI * 0.52;

  scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x8a7f6a, 0.85));
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.55);
  sun.position.set(70, -40, 110);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
  fill.position.set(-60, 50, 40);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(460, 64),
    new THREE.MeshStandardMaterial({color: 0xc9c2b2, roughness: 1}));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(27, 8),
    new THREE.MeshStandardMaterial({color: 0xbdb5a4, roughness: 0.95}));
  plaza.rotation.x = -Math.PI / 2;
  plaza.rotation.z = Math.PI / 8;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  scene.add(plaza);

  clock = new THREE.Clock();
  addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointermove', e => {
    mouseXY = {x: e.clientX, y: e.clientY};
    mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;
    pointerDirty = true;
  });

  loadGLB();
  buildLegend();
  animate();
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function loadGLB() {
  const bin = atob(GLB_B64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(arr.buffer, '', gltf => {
    pagoda = gltf.scene;
    layerObjs = [];
    for (let i = 0; i < NL; i++) layerObjs.push([]);
    pagoda.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        const m = /^L(\d{2})_/.exec(o.name);
        const li = m ? parseInt(m[1]) : 0;
        o.userData.layer = li;
        layerObjs[li].push(o);
      }
    });
    scene.add(pagoda);
    document.getElementById('loading').style.display = 'none';
  }, err => {
    document.getElementById('loading').textContent = '模型加载失败: ' + err;
  });
}

function setExplode(s, fromStep) {
  target = Math.max(0, Math.min(1, s));
  if (!fromStep) stepK = -1;
  document.getElementById('slider').value = Math.round(target * 100);
  updateStepLabel();
}
function updateStepLabel() {
  const k = Math.round(target * (NL - 1));
  document.getElementById('stepLabel').textContent =
    target <= 0.001 ? '已组装' : (target >= 0.999 ? '已全部拆解' : ('拆解至第 ' + (k + 1) + ' / ' + NL + ' 层'));
}

function applyExplode() {
  cur += (target - cur) * 0.09;
  if (Math.abs(target - cur) < 0.0005) cur = target;
  for (let i = 0; i < NL; i++) {
    const dz = cur * i * GAP;
    const arr = layerObjs[i];
    if (!arr) continue;
    for (const o of arr) o.position.z = dz;
  }
}

function highlight(li) {
  if (hovered === li) return;
  clearHover();
  hovered = li;
  if (li < 0) { document.getElementById('tip').style.display = 'none'; return; }
  for (const o of layerObjs[li]) {
    if (!o.userData.matCloned) { o.material = o.material.clone(); o.userData.matCloned = true; }
    o.material.emissive = new THREE.Color(0x2a4a66);
    o.material.emissiveIntensity = 0.55;
  }
  const tip = document.getElementById('tip');
  tip.innerHTML = '<b>' + LAYERS[li][0] + '</b><span>' + LAYERS[li][1] + '</span>';
  tip.style.display = 'block';
  document.body.style.cursor = 'pointer';
}
function clearHover() {
  if (hovered < 0) return;
  for (const o of layerObjs[hovered]) {
    if (o.userData.matCloned) { o.material.emissive = new THREE.Color(0x000000); o.material.emissiveIntensity = 0; }
  }
  hovered = -1;
  document.body.style.cursor = 'default';
}

function doRaycast() {
  if (!pagoda || !pointerDirty) return;
  pointerDirty = false;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObjects(pagoda.children, true);
  let li = -1;
  for (const h of hits) {
    let o = h.object;
    if (o.userData.layer !== undefined) { li = o.userData.layer; break; }
  }
  highlight(li);
  const tip = document.getElementById('tip');
  if (li >= 0) {
    tip.style.left = (mouseXY.x + 16) + 'px';
    tip.style.top = (mouseXY.y + 14) + 'px';
  } else {
    tip.style.display = 'none';
  }
}

function buildLegend() {
  const el = document.getElementById('legend');
  LAYERS.forEach((L, i) => {
    const d = document.createElement('div');
    d.className = 'chip';
    d.innerHTML = '<i>' + (i + 1) + '</i>' + L[0];
    d.title = L[1];
    d.onclick = () => { stepK = i; setExplode(i / (NL - 1), true); flashChip(i); };
    d.onmouseenter = () => highlight(i);
    d.onmouseleave = () => clearHover();
    el.appendChild(d);
  });
}
function flashChip(i) {
  document.querySelectorAll('.chip')[i].classList.add('on');
  setTimeout(() => document.querySelectorAll('.chip')[i].classList.remove('on'), 600);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (autoDir !== 0) {
    let t = target + autoDir * dt * 0.12;
    if (t >= 1) { t = 1; autoDir = 0; syncPlayBtn(); }
    if (t <= 0) { t = 0; autoDir = 0; syncPlayBtn(); }
    setExplode(t);
  }
  applyExplode();
  doRaycast();
  if (autoRot && pagoda) pagoda.rotation.y += dt * 0.15;
  controls.update();
  renderer.render(scene, camera);
}

function syncPlayBtn() {
  document.getElementById('playBtn').textContent = autoDir !== 0 ? '⏸ 暂停' : (target >= 1 ? '⬇ 组装' : '⬆ 拆解');
}

init();

document.getElementById('slider').addEventListener('input', e => {
  stepK = -1; autoDir = 0; syncPlayBtn();
  setExplode(e.target.value / 100);
});
document.getElementById('playBtn').onclick = () => {
  if (autoDir !== 0) { autoDir = 0; }
  else { autoDir = target >= 1 ? -1 : 1; }
  syncPlayBtn();
};
document.getElementById('resetBtn').onclick = () => {
  stepK = -1; autoDir = 0; syncPlayBtn(); setExplode(0);
  camera.position.set(80, -96, 52);
  controls.target.set(0, 0, 33);
};
document.getElementById('rotBtn').onclick = e => {
  autoRot = !autoRot;
  e.target.classList.toggle('on', autoRot);
};
document.getElementById('stepUp').onclick = () => {
  autoDir = 0; syncPlayBtn();
  let k = Math.round(target * (NL - 1)) + 1;
  k = Math.max(0, Math.min(NL - 1, k));
  stepK = k; setExplode(k / (NL - 1), true);
};
document.getElementById('stepDown').onclick = () => {
  autoDir = 0; syncPlayBtn();
  let k = Math.round(target * (NL - 1)) - 1;
  k = Math.max(0, Math.min(NL - 1, k));
  stepK = k; setExplode(k / (NL - 1), true);
};
addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') document.getElementById('stepUp').click();
  if (e.key === 'ArrowDown') document.getElementById('stepDown').click();
});
"""

html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>应县木塔 · 佛宫寺释迦塔 — 交互式3D结构拆解</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:100%; height:100%; overflow:hidden; background:#dfe7ee;
    font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif; }
  #c { position:fixed; inset:0; display:block; }
  .panel { position:fixed; background:rgba(20,26,34,.82); color:#e8e2d4;
    border:1px solid rgba(214,188,140,.35); border-radius:12px;
    backdrop-filter:blur(8px); box-shadow:0 6px 24px rgba(0,0,0,.25); z-index:10; }
  #title { top:16px; left:16px; padding:14px 18px; max-width:380px; }
  #title h1 { font-size:21px; color:#e6c87a; letter-spacing:1px; font-weight:700; }
  #title h2 { font-size:12px; color:#b8ad96; margin-top:3px; font-weight:400; }
  #title .data { margin-top:9px; font-size:12px; line-height:1.75; color:#d8d0bd; }
  #title .data b { color:#f0d489; font-weight:600; }
  #ctrl { left:16px; bottom:16px; padding:14px 16px; width:340px; }
  #ctrl .row { display:flex; align-items:center; gap:8px; margin-top:9px; }
  #ctrl .row:first-child { margin-top:0; }
  #ctrl label { font-size:12px; color:#c9bfa8; white-space:nowrap; }
  #slider { flex:1; -webkit-appearance:none; height:5px; border-radius:3px;
    background:linear-gradient(90deg,#c8a558,#7a6a45); outline:none; }
  #slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px;
    border-radius:50%; background:#e6c87a; border:2px solid #8a6f35; cursor:pointer; }
  #stepLabel { font-size:11px; color:#e6c87a; min-width:118px; text-align:right; }
  button { background:rgba(230,200,122,.14); color:#e6c87a; border:1px solid rgba(230,200,122,.45);
    border-radius:8px; padding:6px 11px; font-size:12px; cursor:pointer; white-space:nowrap;
    transition:background .15s; font-family:inherit; }
  button:hover { background:rgba(230,200,122,.30); }
  button.on { background:#c8a558; color:#1c222b; font-weight:600; }
  #hint { position:fixed; bottom:16px; right:16px; font-size:11px; color:#6a7480; z-index:10;
    background:rgba(255,255,255,.55); padding:5px 10px; border-radius:8px; }
  #legend { top:16px; right:16px; padding:10px 12px; max-width:300px; }
  #legend .lt { font-size:12px; color:#e6c87a; margin-bottom:6px; font-weight:600; }
  #legend .chips { display:flex; flex-wrap:wrap; gap:5px; }
  .chip { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#d8d0bd;
    background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12);
    border-radius:6px; padding:3px 7px; cursor:pointer; transition:all .15s; }
  .chip i { font-style:normal; font-size:9px; color:#9a8f74; }
 .chip:hover, .chip.on { background:rgba(230,200,122,.28); border-color:#c8a558; color:#f0d489; }
  #tip { position:fixed; display:none; z-index:20; pointer-events:none; max-width:250px;
    background:rgba(20,26,34,.92); border:1px solid rgba(214,188,140,.5); border-radius:9px;
    padding:8px 11px; box-shadow:0 4px 16px rgba(0,0,0,.35); }
  #tip b { display:block; font-size:13px; color:#e6c87a; margin-bottom:3px; }
  #tip span { font-size:11px; color:#cfc7b2; line-height:1.5; }
  #loading { position:fixed; inset:0; z-index:100; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:14px; background:#dfe7ee; color:#5a6470; }
  #loading .spin { width:42px; height:42px; border:4px solid #c8bfa8; border-top-color:#a8894a;
    border-radius:50%; animation:sp 1s linear infinite; }
  @keyframes sp { to { transform:rotate(360deg); } }
  #loading p { font-size:13px; }
  @media (max-width:760px) {
    #title { max-width:62vw; padding:10px 12px; } #title .data { display:none; }
    #legend { display:none; } #ctrl { width:calc(100vw - 32px); }
  }
</style>
</head>
<body>
<canvas id="c"></canvas>

<div id="title" class="panel">
  <h1>应县木塔 · 佛宫寺释迦塔</h1>
  <h2>辽清宁二年（1056年）· 世界现存最高最古纯木结构楼阁式建筑</h2>
  <div class="data">
    <b>总高 67.31 m</b> · 底层直径 30.27 m · 八角形平面<br>
    外观五层六檐 · <b>明五暗四共九重</b> · 内外两圈柱网（外槽24柱 / 内槽8柱）<br>
    斗拱 54 种 · 双杪双昂多层出跳 · 暗层斜撑加固 · 楼梯盘旋贯通全塔<br>
    顶部八角攒尖顶 + 塔刹（刹杆 · 七重相轮 · 宝珠）
  </div>
</div>

<div id="legend" class="panel">
  <div class="lt">结构层级（点击逐层拆解 / 悬停查看）</div>
  <div class="chips" id="chips"></div>
</div>

<div id="ctrl" class="panel">
  <div class="row">
    <label>爆炸分解</label>
    <input id="slider" type="range" min="0" max="100" value="0">
    <span id="stepLabel">已组装</span>
  </div>
  <div class="row">
    <button id="playBtn">⬆ 拆解</button>
    <button id="stepDown">◀ 逐层</button>
    <button id="stepUp">逐层 ▶</button>
    <button id="resetBtn">复位视角</button>
    <button id="rotBtn">自动旋转</button>
  </div>
</div>

<div id="hint">左键拖动 旋转 · 右键拖动 平移 · 滚轮 缩放 · ↑/↓ 键逐层拆解</div>
<div id="tip"></div>
<div id="loading"><div class="spin"></div><p>应县木塔模型加载中…</p></div>

<script>__THREE__</script>
<script>__ORBIT__</script>
<script>__GLTF__</script>
<script>const GLB_B64="__GLB__";</script>
<script>__APP__</script>
</body>
</html>
"""

html = html.replace("__THREE__", three_js).replace("__ORBIT__", orbit_js).replace("__GLTF__", gltf_js)
html = html.replace("__GLB__", glb_b64).replace("__APP__", app_js)
out = WS / "yixian_pagoda.html"
out.write_text(html)
print(f"written {out} size={out.stat().st_size/1e6:.1f}MB")
