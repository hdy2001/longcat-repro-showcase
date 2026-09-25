// ============================================================
// 游客第一视角控制：拖拽环视 / 滚轮推拉 / WASD+QE 飞行 / 自动巡游
// ============================================================
import * as THREE from 'three';

export class TouristControls {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.yaw = 0;                // 初始朝北（-Z）
    this.pitch = -0.12;
    this.pos = new THREE.Vector3(0, 52, 505);
    this.keys = new Set();
    this.baseSpeed = 16;         // 基础飞行速度 m/s（已加快）
    this.boost = 4;              // Shift 加速倍率
    this.enabled = true;
    this.moved = 0;

    dom.addEventListener('pointerdown', e => { this.dragging = true; this.lx = e.clientX; this.ly = e.clientY; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => {
      if (!this.dragging || !this.enabled) return;
      const dx = e.clientX - this.lx, dy = e.clientY - this.ly;
      this.lx = e.clientX; this.ly = e.clientY;
      this.yaw -= dx * 0.0032;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0032, -1.45, 1.45);
    });
    dom.addEventListener('pointerup', () => this.dragging = false);
    dom.addEventListener('wheel', e => {
      if (!this.enabled) return;
      e.preventDefault();
      const d = -Math.sign(e.deltaY) * 9;
      this._dolly(d);
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    // 触屏双指推拉
    dom.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (this._pd) this._dolly((d - this._pd) * 0.12);
        this._pd = d;
      }
    }, { passive: true });
    dom.addEventListener('touchend', () => this._pd = null);
  }

  _dolly(d) {
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.pos.addScaledVector(dir, d);
  }

  reset(v) {
    this.pos.set(v.x, v.y, v.z);
    this.yaw = 0; this.pitch = -0.12;   // 朝北俯瞰中轴
    this.moved = 0;
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const sp = this.baseSpeed * (k.has('ShiftLeft') || k.has('ShiftRight') ? this.boost : 1) * dt;
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(e);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(e);
    const fwdFlat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    const rightFlat = new THREE.Vector3(right.x, 0, right.z).normalize();
    if (k.has('KeyW') || k.has('ArrowUp')) this.pos.addScaledVector(fwd, sp);
    if (k.has('KeyS') || k.has('ArrowDown')) this.pos.addScaledVector(fwd, -sp);
    if (k.has('KeyA') || k.has('ArrowLeft')) this.pos.addScaledVector(rightFlat, -sp);
    if (k.has('KeyD') || k.has('ArrowRight')) this.pos.addScaledVector(rightFlat, sp);
    if (k.has('KeyE') || k.has('Space')) this.pos.y += sp;
    if (k.has('KeyQ') || k.has('KeyC')) this.pos.y -= sp;
    // 限制范围与高度
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -560, 560);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -640, 660);
    this.pos.y = THREE.MathUtils.clamp(this.pos.y, 2.2, 260);
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}

// ============================================================
// 中轴线自动巡游（南→北→南，CatmullRom 闭环）
// ============================================================
const PATH_PTS = [
  [0, 46, 545], [0, 26, 432], [0, 17, 352], [0, 30, 268], [0, 54, 168],
  [0, 38, 98], [0, 24, 28], [0, 19, -120], [0, 21, -262], [0, 34, -422],
  [0, 72, -545], [0, 96, -385], [0, 74, 60], [0, 50, 385],
];
const LOOK_PTS = [
  [0, 16, 380], [0, 14, 300], [0, 10, 240], [0, 26, 120], [0, 26, 60],
  [0, 18, -40], [0, 14, -120], [0, 14, -220], [0, 16, -360], [0, 24, -520],
  [0, 30, -200], [0, 12, 60], [0, 14, 300], [0, 16, 120],
];

export class TourRig {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.t = 0;
    this.dir = 1;
    this.speedMul = 1;
    this.duration = 62;               // 一圈 62 秒
    this.pause = 0;
    this.posCurve = new THREE.CatmullRomCurve3(PATH_PTS.map(p => new THREE.Vector3(...p)), true, 'centripetal', 0.4);
    this.lookCurve = new THREE.CatmullRomCurve3(LOOK_PTS.map(p => new THREE.Vector3(...p)), true, 'centripetal', 0.4);
    this._pos = new THREE.Vector3(); this._look = new THREE.Vector3();
  }
  start() { this.active = true; }
  stop() { this.active = false; }
  toggle() { this.active ? this.stop() : this.start(); return this.active; }
  update(dt) {
    if (!this.active) return;
    if (this.pause > 0) { this.pause -= dt; }
    else {
      this.t += (dt * this.dir * this.speedMul) / this.duration;
      if (this.t >= 1) { this.t = 1; this.dir = -1; this.pause = 2.2; }
      if (this.t <= 0) { this.t = 0; this.dir = 1; this.pause = 2.2; }
    }
    this.posCurve.getPointAt(THREE.MathUtils.clamp(this.t, 0, 1), this._pos);
    this.lookCurve.getPointAt(THREE.MathUtils.clamp(this.t, 0, 1), this._look);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }
}
