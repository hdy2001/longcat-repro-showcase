// ============================================================
// 玩家控制器 —— 运动学胶囊 + Rapier 角色控制器 + 鼠标视角 + 步枪手感
// ============================================================
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export const PLAYER_R = 0.38;
export const PLAYER_HH = 0.62;      // 圆柱半高, 总高 ~2.0
export const EYE_H = 1.62;
const WALK_SPEED = 5.4;
const JUMP_V = 5.0;
const GRAVITY = 14;

export interface PlayerWeaponState {
  ammo: number;        // 弹匣内
  reserve: number;     // 备弹
  reloading: boolean;
  reloadEnd: number;
  nextFire: number;    // 下次可开火时间戳
  bloom: number;       // 连射扩散
}

export class Player {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  yaw = Math.PI;       // 初始面向北 (-z)
  pitch = 0;
  hp = 100;
  alive = false;
  weapon: PlayerWeaponState = {
    ammo: 30, reserve: 9999, reloading: false, reloadEnd: 0, nextFire: 0, bloom: 0,
  };
  keys = new Set<string>();
  // 视角感受
  recoilPitch = 0;
  recoilYaw = 0;
  bobPhase = 0;
  private vy = 0;
  private grounded = false;
  /** 枪口世界坐标 (供特效/弹道起点) */
  muzzle = new THREE.Vector3();
  /** 视线方向 */
  lookDir = new THREE.Vector3(0, 0, -1);
  stepCb: (() => void) | null = null;
  onFire: ((origin: THREE.Vector3, dir: THREE.Vector3) => void) | null = null;
  private fireHeld = false;

  constructor(private world: RAPIER.World, x: number, z: number) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 1.2, z),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER_HH, PLAYER_R).setFriction(0.2),
      this.body,
    );
    this.controller = world.createCharacterController(0.02);
    this.controller.enableAutostep(0.55, 0.25, false);
    this.controller.enableSnapToGround(0.6);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  }

  get pos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  spawn(x: number, z: number): void {
    this.hp = 100;
    this.alive = true;
    this.weapon.ammo = 30;
    this.weapon.reserve = 9999;
    this.weapon.reloading = false;
    this.weapon.bloom = 0;
    this.body.setTranslation({ x, y: 1.2, z }, true);
    this.body.setLinvel?.({ x: 0, y: 0, z: 0 }, true);
    this.vy = 0;
  }

  die(): void {
    this.alive = false;
  }

  look(dx: number, dy: number, sens = 0.0021): void {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  startFire(): void { this.fireHeld = true; }
  stopFire(): void { this.fireHeld = false; }

  reload(now: number): void {
    const w = this.weapon;
    if (w.reloading || w.ammo >= 30 || w.reserve <= 0) return;
    w.reloading = true;
    w.reloadEnd = now + 2.0;
  }

  /** 每帧: now 秒 */
  update(dt: number, now: number, frozen: boolean): void {
    if (!this.alive) return;
    const w = this.weapon;

    // ---------- 换弹 ----------
    if (w.reloading && now >= w.reloadEnd) {
      const need = 30 - w.ammo;
      const take = Math.min(need, w.reserve);
      w.ammo += take;
      w.reserve -= take;
      w.reloading = false;
    }

    // ---------- 移动 ----------
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    let mx = 0, mz = 0;
    if (!frozen) {
      if (this.keys.has('KeyW')) mz += 1;
      if (this.keys.has('KeyS')) mz -= 1;
      if (this.keys.has('KeyD')) mx += 1;
      if (this.keys.has('KeyA')) mx -= 1;
    }
    const moving = mx !== 0 || mz !== 0;
    const wish = new THREE.Vector3();
    wish.addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (wish.lengthSq() > 0) wish.normalize();

    // 重力 + 跳跃
    this.vy -= GRAVITY * dt;
    if (!frozen && this.keys.has('Space') && this.grounded) {
      this.vy = JUMP_V;
      this.grounded = false;
    }
    const delta = { x: wish.x * WALK_SPEED * dt, y: this.vy * dt, z: wish.z * WALK_SPEED * dt };
    this.controller.computeColliderMovement(this.collider, delta);
    const m = this.controller.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = -0.5;

    // 掉出世界兜底
    if (t.y < -10) this.body.setTranslation({ x: 0, y: 2, z: 40 }, true);

    // ---------- 视角 ----------
    // 呼吸/走路晃动
    if (moving && this.grounded) {
      this.bobPhase += dt * 9;
      this.stepCb?.();
    }
    const bobY = moving && this.grounded ? Math.sin(this.bobPhase * 2) * 0.035 : 0;
    const bobX = moving && this.grounded ? Math.cos(this.bobPhase) * 0.02 : 0;
    // 后坐力恢复
    this.recoilPitch *= Math.max(0, 1 - dt * 9);
    this.recoilYaw *= Math.max(0, 1 - dt * 9);
    w.bloom = Math.max(0, w.bloom - dt * 3.5);

    const eye = this.pos;
    this.muzzle.set(
      eye.x + fwd.x * 0.7 + right.x * 0.25,
      eye.y + EYE_H - 0.12,
      eye.z + fwd.z * 0.7 + right.z * 0.25,
    );
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch + this.recoilPitch),
      Math.sin(this.pitch + this.recoilPitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch + this.recoilPitch),
    );
    this.lookDir.copy(dir);

    // ---------- 开火 ----------
    if (this.fireHeld && !frozen && !w.reloading && now >= w.nextFire) {
      if (w.ammo <= 0) {
        this.reload(now);
      } else {
        w.ammo--;
        w.nextFire = now + 0.1; // 600 RPM
        w.bloom = Math.min(w.bloom + 0.35, 2.2);
        this.recoilPitch += 0.006 + Math.random() * 0.004;
        this.recoilYaw += (Math.random() - 0.5) * 0.005;
        // 散布: 基础 0.35° + bloom
        const spread = (0.006 + w.bloom * 0.011) * (moving ? 1.8 : 1);
        const shot = this.lookDir.clone();
        shot.x += (Math.random() - 0.5) * 2 * spread;
        shot.y += (Math.random() - 0.5) * 2 * spread;
        shot.z += (Math.random() - 0.5) * 2 * spread;
        shot.normalize();
        this.onFire?.(this.muzzle.clone(), shot);
      }
    }
    void bobY; void bobX;
  }

  /** 相机矩阵应用 */
  applyCamera(cam: THREE.PerspectiveCamera): void {
    const eye = this.pos;
    const bobY = this.alive ? 0 : 0;
    cam.position.set(eye.x, eye.y + EYE_H + bobY, eye.z);
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch + this.recoilPitch),
      Math.sin(this.pitch + this.recoilPitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch + this.recoilPitch),
    );
    cam.lookAt(cam.position.clone().add(dir));
  }
}
