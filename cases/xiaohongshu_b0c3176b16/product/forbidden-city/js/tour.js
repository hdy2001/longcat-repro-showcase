// ============================================================
// tour.js — 游客第一视角：WASD + 鼠标视角，行走/飞行，Shift 加速
// ============================================================
import * as THREE from 'three';

const LOCATIONS = [
  { z: 480, name: '午门 · 紫禁城正门' },
  { z: 400, name: '内金水河 · 五龙桥' },
  { z: 352, name: '太和门广场' },
  { z: 285, name: '太和殿 · 金銮殿' },
  { z: 205, name: '中和殿' },
  { z: 140, name: '保和殿' },
  { z: 62, name: '乾清门' },
  { z: -15, name: '乾清宫' },
  { z: -58, name: '交泰殿' },
  { z: -105, name: '坤宁宫' },
  { z: -200, name: '御花园' },
  { z: -412, name: '神武门 · 北门' },
];

export class Tour {
  constructor(camera, dom, city, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.city = city;
    this.enabled = false;
    this.fly = false;
    this.keys = {};
    this.yaw = Math.PI;      // 初始面向北（-Z）
    this.pitch = -0.05;
    this.baseSpeed = opts.speed || 14;   // 基础步行速度（加快）
    this.boostMul = 3.2;
    this.eyeHeight = 1.7;
    this.pos = new THREE.Vector3(0, this.eyeHeight, 505);
    this.velY = 0;
    this.locked = false;
    this.onLocation = null;

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyF' && this.locked) { this.fly = !this.fly; this.velY = 0; }
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      if (!this.locked && this.onUnlock) this.onUnlock();
    });
    this.wheel = 0;
    document.addEventListener('wheel', (e) => { this.wheel += e.deltaY; }, { passive: true });
  }

  enter() { this.dom.requestPointerLock(); }

  update(dt) {
    const k = this.keys;
    const speed = (this.baseSpeed + Math.abs(this.wheel) * 0.02) *
      ((k['ShiftLeft'] || k['ShiftRight']) ? this.boostMul : 1) * (this.fly ? 2.6 : 1);
    this.wheel *= 0.9;

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (k['KeyW']) move.add(fwd);
    if (k['KeyS']) move.sub(fwd);
    if (k['KeyD']) move.add(right);
    if (k['KeyA']) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);

    this.pos.x += move.x; this.pos.z += move.z;

    const ground = this.city.groundHeightAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.fly) {
      let vy = 0;
      if (k['Space']) vy += 1;
      if (k['KeyC'] || k['ControlLeft']) vy -= 1;
      this.velY = vy * speed * 0.9;
      this.pos.y += this.velY * dt;
      this.pos.y = Math.max(2, Math.min(260, this.pos.y));
    } else {
      // 地面贴合（含台阶缓升）
      const target = ground + this.eyeHeight;
      this.pos.y += (target - this.pos.y) * Math.min(1, dt * 10);
    }

    // 碰撞
    const [nx, nz] = this.city.collide(this.pos.x, this.pos.z, this.pos.y - this.eyeHeight, 0.7);
    this.pos.x = nx; this.pos.z = nz;

    this.camera.position.copy(this.pos);
    const look = new THREE.Vector3(
      this.pos.x - Math.sin(this.yaw) * Math.cos(this.pitch),
      this.pos.y + Math.sin(this.pitch),
      this.pos.z - Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.lookAt(look);

    // 位置播报
    if (this.onLocation) {
      let name = '紫禁城外 · 护城河';
      for (const L of LOCATIONS) { if (this.pos.z <= L.z + 30) { name = L.name; break; } }
      if (this.pos.z > 510) name = '紫禁城外 · 护城河';
      this.onLocation(name, this.fly ? '飞行' : '步行', speed);
    }
  }
}
