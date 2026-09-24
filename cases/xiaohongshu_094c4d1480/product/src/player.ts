// 玩家：第一人称控制器（Rapier 角色控制器）+ 武器视图模型
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CFG } from './config';

export class Player {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  mesh: THREE.Group;

  hp = CFG.playerHP;
  alive = true;

  yaw = 0;
  pitch = 0;
  keys = new Set<string>();
  reloading = false;
  reloadT = 0;
  mag = CFG.magSize;
  reserve = CFG.reserve;
  lastShot = 0;
  triggerHeld = false;
  adsHeld = false;
  adsK = 0;             // 0..1
  spreadBloom = 0;      // 连射扩散
  recoilPitch = 0;
  recoilYaw = 0;
  bobT = 0;
  stepT = 0;
  fovKick = 0;

  onShot: (() => void) | null = null;
  onReload: (() => void) | null = null;
  onStep: ((sprint: boolean) => void) | null = null;
  onAmmoChanged: (() => void) | null = null;

  constructor(world: RAPIER.World, camera: THREE.PerspectiveCamera, spawn: [number, number]) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn[0], 0.9, spawn[1]),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, CFG.radius).setFriction(0.2),
      this.body,
    );
    this.controller = world.createCharacterController(0.02);
    this.controller.enableAutostep(0.45, 0.2, true);
    this.controller.setMaxSlopeClimbAngle(0.8);
    this.controller.setMinSlopeSlideAngle(0.9);
    this.controller.setApplyImpulsesToDynamicBodies(false);

    // 武器视图模型（挂在相机上）
    this.mesh = buildViewModel();
    camera.add(this.mesh);
  }

  get pos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get eyePos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y + CFG.eyeHeight, t.z);
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  lookDelta(dx: number, dy: number): void {
    const s = 0.0021 * (1 - this.adsK * 0.45);
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  startReload(): void {
    if (this.reloading || this.mag >= CFG.magSize || this.reserve <= 0 || !this.alive) return;
    this.reloading = true;
    this.reloadT = CFG.reloadTime;
    this.onReload?.();
  }

  update(dt: number, now: number): void {
    if (!this.alive) return;

    // ---- 移动 ----
    const f = this.forward;
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW')) wish.add(f);
    if (this.keys.has('KeyS')) wish.sub(f);
    if (this.keys.has('KeyD')) wish.add(r);
    if (this.keys.has('KeyA')) wish.sub(r);
    const sprint = this.keys.has('ShiftLeft') && !this.adsHeld && wish.dot(f) > 0;
    let speed = sprint ? CFG.sprintSpeed : this.adsHeld ? CFG.adsSpeed : CFG.walkSpeed;
    if (wish.lengthSq() > 0) wish.normalize();

    // 跳跃：对运动学刚体直接位移 + 维护垂直速度
    if (this.controller.computedGrounded()) this.vy = -0.5;
    if (this.keys.has('Space') && this.controller.computedGrounded()) this.vy = CFG.jumpVel;
    this.vy += CFG.worldGravity * dt;
    const t = this.body.translation();
    const desired = { x: wish.x * speed * dt, y: this.vy * dt, z: wish.z * speed * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    const m = this.controller.computedMovement();
    const nt = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
    this.body.setNextKinematicTranslation(nt);

    // 脚步声
    if (wish.lengthSq() > 0 && this.controller.computedGrounded()) {
      this.stepT -= dt * (sprint ? 1.5 : 1);
      if (this.stepT <= 0) {
        this.stepT = 0.42;
        this.onStep?.(sprint);
      }
    }

    // ---- 视角 ----
    this.bobT += dt * (wish.lengthSq() > 0 ? (sprint ? 11 : 8) : 2);
    const bobY = Math.sin(this.bobT * 2) * 0.018 * (1 - this.adsK);
    const bobX = Math.cos(this.bobT) * 0.01 * (1 - this.adsK);

    // ---- 射击 ----
    this.spreadBloom = Math.max(0, this.spreadBloom - dt * 0.25);
    this.recoilPitch = Math.max(0, this.recoilPitch - dt * 0.09);
    this.recoilYaw = Math.max(-1, Math.min(1, this.recoilYaw - this.recoilYaw * dt * 9));

    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = CFG.magSize - this.mag;
        const take = Math.min(need, this.reserve);
        this.mag += take;
        this.reserve -= take;
        this.reloading = false;
        this.onAmmoChanged?.();
      }
    }

    if (this.triggerHeld && !this.reloading && now - this.lastShot >= CFG.fireInterval) {
      if (this.mag > 0) {
        this.lastShot = now;
        this.mag--;
        this.spreadBloom = Math.min(1, this.spreadBloom + 0.16);
        this.recoilPitch += CFG.recoil;
        this.recoilYaw += (Math.random() - 0.5) * CFG.recoil * 0.5;
        this.pitch += CFG.recoil * 0.35;
        this.yaw += (Math.random() - 0.5) * CFG.recoil * 0.3;
        this.onShot?.();
        if (this.mag === 0) this.startReload();
        this.onAmmoChanged?.();
      } else {
        this.startReload();
      }
    }

    this.adsK += ((this.adsHeld ? 1 : 0) - this.adsK) * Math.min(dt * 10, 1);

    // ---- 相机 ----
    const cam = this.mesh.parent as THREE.PerspectiveCamera;
    cam.position.set(this.eyePos.x + bobX, this.eyePos.y + bobY, this.eyePos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + this.recoilYaw * 0.02;
    cam.rotation.x = this.pitch - this.recoilPitch * 0.035;
    const targetFov = 75 - this.adsK * 28 + this.fovKick;
    if (Math.abs(cam.fov - targetFov) > 0.1) {
      cam.fov += (targetFov - cam.fov) * Math.min(dt * 12, 1);
      cam.updateProjectionMatrix();
    }

    // ---- 视图模型姿态 ----
    const vm = this.mesh;
    vm.position.set(0.28 - this.adsK * 0.145, -0.26 + this.adsK * 0.075 + bobY * 0.4, -0.5 + this.adsK * 0.1);
    vm.rotation.x = -this.recoilPitch * 0.12;
    const rl = this.reloading ? Math.sin(Math.min((CFG.reloadTime - this.reloadT) / CFG.reloadTime, 1) * Math.PI) : 0;
    vm.rotation.x -= rl * 0.7;
    vm.position.y -= rl * 0.12;
    vm.visible = true;
  }

  private vy = 0;

  get isMoving(): boolean { return this.keys.size > 0; }

  currentSpread(): number {
    const move = this.isMoving ? CFG.spreadMove : 0;
    return CFG.spreadBase + move * (1 - this.adsK * 0.6) + this.spreadBloom * CFG.spreadMove * 2.4 - (this.adsK * (CFG.spreadBase - CFG.spreadAds));
  }

  teleport(x: number, z: number): void {
    this.body.setTranslation({ x, y: 0.9, z }, true);
    this.vy = 0;
  }

  die(): void {
    this.alive = false;
    this.mesh.visible = false;
  }

  revive(): void {
    this.alive = true;
    this.hp = CFG.playerHP;
    this.mag = CFG.magSize;
    this.reserve = CFG.reserve;
    this.reloading = false;
    this.spreadBloom = 0;
  }
}

// ---------- 步枪视图模型 ----------
function buildViewModel(): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x2e2a26 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    g.add(m);
    return m;
  };

  add(new THREE.BoxGeometry(0.055, 0.09, 0.5), metal, 0, 0, -0.1);            // 机匣
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 8), metal, 0, 0.012, -0.5, Math.PI / 2); // 枪管
  add(new THREE.BoxGeometry(0.05, 0.07, 0.22), wood, 0, -0.01, -0.32);        // 护木
  add(new THREE.BoxGeometry(0.045, 0.16, 0.07), wood, 0, -0.11, 0.06, 0.35); // 握把
  add(new THREE.BoxGeometry(0.04, 0.2, 0.09), wood, 0, -0.14, 0.16, 0.15);    // 枪托
  const mag = add(new THREE.BoxGeometry(0.045, 0.22, 0.08), metal, 0, -0.16, -0.08, 0.25); // 弹匣
  mag.name = 'mag';
  add(new THREE.BoxGeometry(0.02, 0.05, 0.02), metal, 0, 0.065, -0.28);      // 准星
  return g;
}
