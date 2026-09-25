// ============================================================
// 入口：渲染器 + Bloom 后期 + 交互 + UI
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world.js';
import { TouristControls, TourRig } from './controls.js';
import { CFG } from './config.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 4000);
camera.position.set(CFG.cam.x, CFG.cam.y, CFG.cam.z);

// ---------- 世界 ----------
const world = buildWorld();

// ---------- 后期：Bloom 让轮廓灯带/窗棂/火树泛光 ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(world.scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.15, 0.65, 0.42);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- 交互 ----------
const controls = new TouristControls(camera, canvas);
const tour = new TourRig(camera);
controls.reset(CFG.cam);

// UI 元素
const ui = {
  tourBtn: document.getElementById('btn-tour'),
  resetBtn: document.getElementById('btn-reset'),
  speedBtn: document.getElementById('btn-speed'),
  hint: document.getElementById('hint'),
  tourState: document.getElementById('tour-state'),
};
let speedIdx = 0;
const speeds = [1, 2, 4];
const speedLabels = ['速度 ×1', '速度 ×2', '速度 ×4'];

function setTour(on) {
  tour.active = on;
  controls.enabled = !on;
  ui.tourBtn.textContent = on ? '⏸ 停止巡游' : '▶ 中轴自动巡游';
  ui.tourState.textContent = on ? '自动巡游中（任意操作可随时接管）' : '自由游览';
  ui.tourState.classList.toggle('on', on);
}
ui.tourBtn.addEventListener('click', () => setTour(!tour.active));
ui.resetBtn.addEventListener('click', () => { setTour(false); controls.reset(CFG.cam); });
ui.speedBtn.addEventListener('click', () => {
  speedIdx = (speedIdx + 1) % speeds.length;
  tour.speedMul = speeds[speedIdx];
  controls.baseSpeed = 16 * speeds[speedIdx];
  ui.speedBtn.textContent = speedLabels[speedIdx];
});
// 巡游中任何拖拽/按键 → 接管
canvas.addEventListener('pointerdown', () => { if (tour.active) setTour(false); });
window.addEventListener('keydown', e => {
  if (tour.active && !['ShiftLeft', 'ShiftRight'].includes(e.code)) setTour(false);
  if (e.code === 'KeyR') { setTour(false); controls.reset(CFG.cam); }
  if (e.code === 'KeyT') setTour(!tour.active);
});

// 初始提示 8 秒后淡出
setTimeout(() => ui.hint.classList.add('fade'), 9000);

// 调试钩子
window.__dbg = { camera, controls, tour, world };

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let frames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  world.update(dt, t);
  if (tour.active) tour.update(dt);
  else controls.update(dt);
  composer.render();
  frames++;
  window.__frames = frames;
});
