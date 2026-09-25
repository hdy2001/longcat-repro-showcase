// ============================================================
// main.js — 交互游览入口（16:9 自适应，第一人称 + 环绕预览）
// ============================================================
import * as THREE from 'three';
import { createScene } from './scene.js';
import { createComposer } from './fx.js';
import { Tour } from './tour.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 7, 620);

const { scene, city, update } = createScene(renderer);
const { composer, bloom } = createComposer(renderer, scene, camera, 0.85);

const tour = new Tour(camera, canvas, city, { speed: 15 });

// ---------- HUD ----------
const locEl = document.getElementById('loc');
const modeEl = document.getElementById('mode');
const spdEl = document.getElementById('spd');
tour.onLocation = (name, mode, spd) => {
  locEl.textContent = name;
  modeEl.textContent = `${mode} · ${spd.toFixed(0)} m/s`;
};

// ---------- 进入游览 ----------
const startEl = document.getElementById('start');
startEl.addEventListener('click', () => {
  startEl.classList.add('hidden');
  tour.enter();
});
tour.onUnlock = () => { startEl.classList.remove('hidden'); };

// ---------- 空闲环绕 ----------
let idleAngle = 0;
function idleCam(dt) {
  idleAngle += dt * 0.021;
  const r = 560;
  camera.position.set(Math.sin(idleAngle) * r, 190 + Math.sin(idleAngle * 0.6) * 30, Math.cos(idleAngle) * r * 0.75 + 60);
  camera.lookAt(0, 30, 40);
  if (Math.abs(camera.fov - 58) > 0.1) { camera.fov = 58; camera.updateProjectionMatrix(); }
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let frames = 0, warmUntil = performance.now() + 2500;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  update(dt, t);
  if (tour.locked) tour.update(dt);
  else idleCam(dt);
  composer.render();
  if (performance.now() < warmUntil) frames++;
}
loop();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// 供自动化 QA
window.__APP = { renderer, scene, camera, composer, tour, THREE };
window.__READY = true;
