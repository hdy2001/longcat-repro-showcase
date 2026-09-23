// ===== 玩家：输入 + 指针锁定 + 移动 + 相机 =====
import * as THREE from 'three';
import { PLAYER } from './config';
import { Character, createCharacter, moveCharacter } from './physics';

export class Player {
  char: Character;
  camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0;
  hp = PLAYER.maxHp;
  alive = true;
  spawnProtecT = 0;

  keys = new Set<string>();
  firing = false;
  locked = false;

  // 移动状态（供武器/音效读取）
  moveFactor = 0;   // 0~1
  airFactor = 0;    // 0~1
  sprinting = false;
  private stepTimer = 0;
  private bobPhase = 0;
  private recoilAccum = 0;

  onFootstep: ((sprint: boolean) => void) | null = null;
  onJump: (() => void) | null = null;
  onLand: (() => void) | null = null;
  onDeath: (() => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(camera: THREE.PerspectiveCamera, x: number, z: number, yaw: number) {
    this.camera = camera;
    this.yaw = yaw;
    this.char = createCharacter(x, 0, z, PLAYER.height / 2 - PLAYER.radius, PLAYER.radius);
    this.spawnProtecT = PLAYER.spawnProtectTime;
  }

  get pos() { return this.char.pos; }
  get eyePos(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + PLAYER.eyeHeight, this.pos.z);
  }

  bind(canvas: HTMLCanvasElement) {
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.firing = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.alive) return;
      const sens = 0.0021;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch = Math.max(-1.52, Math.min(1.52, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.firing = false;
      this.onLockChange?.(this.locked);
    });
  }

  requestLock(canvas: HTMLCanvasElement) {
    if (!this.locked) canvas.requestPointerLock();
  }

  // 当前视线方向
  getLookDir(out: THREE.Vector3): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return out.set(
      -Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp,
    ).normalize();
  }

  // 射击时施加后坐力
  addRecoil(pitchDeg: number, yawDeg: number) {
    this.pitch += (pitchDeg * Math.PI) / 180;
    this.yaw += (yawDeg * Math.PI) / 180;
    this.recoilAccum = Math.min(1.5, this.recoilAccum + 0.25);
  }

  takeDamage(dmg: number, fromPos: THREE.Vector3): boolean {
    if (!this.alive || this.spawnProtecT > 0) return false;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    return false;
  }

  private die() {
    this.alive = false;
    this.firing = false;
    this.onDeath?.();
  }

  respawn(x: number, z: number, yaw: number) {
    this.alive = true;
    this.hp = PLAYER.maxHp;
    this.yaw = yaw;
    this.pitch = 0;
    this.spawnProtecT = PLAYER.spawnProtectTime;
    this.char.pos.set(x, 0, z);
    this.char.vel.set(0, 0, 0);
    this.char.body.setNextKinematicTranslation({ x, y: 0, z });
  }

  update(dt: number) {
    this.spawnProtecT = Math.max(0, this.spawnProtecT - dt);
    if (!this.alive) {
      // 死亡视角缓降
      this.camera.position.set(this.pos.x, Math.max(0.4, this.pos.y + 0.5), this.pos.z);
      this.camera.rotation.set(0, this.yaw, 0, 'YXZ');
      return;
    }

    const k = this.keys;
    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    this.sprinting = k.has('ShiftLeft') && fwd > 0;

    let speed = this.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;

    // 期望速度（相对朝向）
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = (-sin * fwd + cos * strafe);
    let wz = (-cos * fwd - sin * strafe);
    const wlen = Math.hypot(wx, wz);
    if (wlen > 0.01) { wx = (wx / wlen) * speed; wz = (wz / wlen) * speed; }

    // 简单加速模型
    const accel = this.char.grounded ? PLAYER.accel : PLAYER.airAccel;
    const cur = this.char.vel;
    const dx = wx - cur.x;
    const dz = wz - cur.z;
    const dlen = Math.hypot(dx, dz);
    if (dlen > 0.01) {
      const step = Math.min(dlen, accel * dt);
      cur.x += (dx / dlen) * step;
      cur.z += (dz / dlen) * step;
    } else { cur.x = 0; cur.z = 0; }

    // 跳跃
    if (k.has('Space') && this.char.grounded) {
      this.char.vel.y = PLAYER.jumpVel;
      this.onJump?.();
    }

    // 重力
    const vy = this.char.vel.y - PLAYER.gravity * dt;
    const wasAirborne = !this.char.grounded;
    const fallSpeed = this.char.vel.y;
    this.char.vel.y = Math.max(vy, -24);
    moveCharacter(this.char, cur.x, this.char.vel.y * dt, cur.z, dt);
    if (wasAirborne && this.char.grounded && fallSpeed < -6) this.onLand?.();
    if (this.char.grounded) this.char.vel.y = Math.max(this.char.vel.y, -0.5);

    // 移动因子
    const hSpeed = Math.hypot(cur.x, cur.z);
    this.moveFactor = Math.min(1, hSpeed / PLAYER.sprintSpeed);
    this.airFactor = this.char.grounded ? 0 : 1;

    // 脚步声
    if (this.char.grounded && hSpeed > 0.5) {
      this.stepTimer -= dt * hSpeed;
      if (this.stepTimer <= 0) {
        this.stepTimer = 3.4;
        this.onFootstep?.(this.sprinting);
      }
      this.bobPhase += dt * hSpeed * 1.6;
    }

    // 相机：位置 + 呼吸摆动 + 后坐力恢复
    this.recoilAccum = Math.max(0, this.recoilAccum - dt * 3);
    const bobY = Math.sin(this.bobPhase * 2) * 0.025 * (1 - this.airFactor * 0.7) * (hSpeed > 0.5 ? 1 : 0);
    const bobX = Math.cos(this.bobPhase) * 0.015 * (1 - this.airFactor * 0.7) * (hSpeed > 0.5 ? 1 : 0);
    this.camera.position.set(
      this.pos.x + bobX * Math.cos(this.yaw),
      this.pos.y + PLAYER.eyeHeight + bobY,
      this.pos.z - bobX * Math.sin(this.yaw),
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // 死亡时稍微侧倾
    if (!this.alive) this.camera.rotation.z = 0.4;
  }
}
