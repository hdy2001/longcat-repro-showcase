// ===== 武器：视模 + 射击 =====
import * as THREE from 'three';
import { WEAPON } from './config';

export interface ShotResult {
  hit: boolean;
  killed: boolean;
  headshot: boolean;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  victimName?: string;
  victimTeam?: number;
  wallDist: number;
}

export class Weapon {
  group: THREE.Group;          // 挂在相机下
  private muzzle: THREE.Object3D;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private kickZ = 0;
  private reloadDip = 0;
  private swayX = 0;
  private swayY = 0;

  // 状态
  mag = WEAPON.magSize;
  reserve = WEAPON.magSize * WEAPON.reserveMags;
  reloading = false;
  reloadT = 0;
  private cooldown = 0;
  bloom = 0; // 当前额外散布
  lastShotTime = 0;
  triggerHeld = false;

  // 由 main 注入的回调
  onShot: ((origin: THREE.Vector3, dir: THREE.Vector3) => void) | null = null;
  onDryFire: (() => void) | null = null;
  onReloadStart: (() => void) | null = null;
  onAmmoChanged: (() => void) | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0.28, -0.26, -0.55);
    this.buildModel();
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.06, -0.72);
    this.group.add(this.muzzle);
  }

  private buildModel() {
    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.45, metalness: 0.75 });
    const gunDark = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6, metalness: 0.5 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6e4f2a, roughness: 0.8, metalness: 0.05 });

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      this.group.add(m);
      return m;
    };

    // 机匣
    add(new THREE.BoxGeometry(0.09, 0.13, 0.5), gunMetal, 0, 0, -0.1);
    // 枪管
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10), gunDark, 0, 0.025, -0.5, Math.PI / 2);
    // 护木
    add(new THREE.BoxGeometry(0.08, 0.09, 0.3), wood, 0, 0.01, -0.42);
    // 弹匣
    add(new THREE.BoxGeometry(0.06, 0.18, 0.1), gunDark, 0, -0.14, -0.08, 0.25);
    // 枪托
    add(new THREE.BoxGeometry(0.07, 0.11, 0.22), wood, 0, -0.02, 0.22);
    // 握把
    add(new THREE.BoxGeometry(0.055, 0.13, 0.07), gunDark, 0, -0.12, 0.06, 0.35);
    // 瞄具
    add(new THREE.BoxGeometry(0.03, 0.05, 0.12), gunDark, 0, 0.095, -0.12);
    add(new THREE.BoxGeometry(0.012, 0.03, 0.012), gunDark, 0, 0.135, -0.16);
  }

  getMuzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.muzzle.getWorldPosition(out);
  }

  get isMagEmpty() { return this.mag <= 0; }

  startReload(): boolean {
    if (this.reloading || this.mag >= WEAPON.magSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadT = WEAPON.reloadTime;
    this.onReloadStart?.();
    return true;
  }

  // 每帧：返回是否击发；origin/dir 为相机射线
  update(
    dt: number,
    firing: boolean,
    moveFactor: number, // 0 静止 ~ 1 全速移动
    airFactor: number,  // 0 地面 ~ 1 空中
    origin: THREE.Vector3,
    dir: THREE.Vector3,
  ): boolean {
    this.cooldown -= dt;
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.reloading = false;
        const need = WEAPON.magSize - this.mag;
        const take = Math.min(need, this.reserve);
        this.mag += take;
        this.reserve -= take;
        this.onAmmoChanged?.();
      }
    }

    // 散布恢复
    this.bloom = Math.max(0, this.bloom - dt * 3.2);
    // 后坐力恢复
    this.recoilPitch = Math.max(0, this.recoilPitch - dt * 5.5);
    this.recoilYaw *= Math.max(0, 1 - dt * 7);
    this.kickZ = Math.max(0, this.kickZ - dt * 6);
    this.reloadDip = this.reloading ? Math.min(1, this.reloadDip + dt * 4) : Math.max(0, this.reloadDip - dt * 4);

    // 呼吸/移动摇摆
    const t = performance.now() / 1000;
    this.swayX = Math.sin(t * 1.7) * 0.0012 * (1 + moveFactor * 2);
    this.swayY = Math.cos(t * 2.3) * 0.0012 * (1 + moveFactor * 2);

    if (!firing || this.reloading || this.cooldown > 0) return false;
    if (this.mag <= 0) {
      if (this.triggerHeld) {
        this.triggerHeld = false;
        this.onDryFire?.();
        this.cooldown = 0.3;
      }
      return false;
    }

    // 击发
    this.cooldown = 60 / WEAPON.rpm;
    this.mag--;
    this.lastShotTime = t;
    this.bloom = Math.min(WEAPON.bloomMaxDeg, this.bloom + WEAPON.bloomPerShotDeg);
    this.recoilPitch += WEAPON.recoilPitchDeg;
    this.recoilYaw += (Math.random() - 0.5) * 2 * WEAPON.recoilYawDeg;
    this.kickZ = 1;
    this.triggerHeld = true;
    this.onAmmoChanged?.();

    // 实际射线（含散布）由 onShot 回调处理
    this.onShot?.(origin, dir);
    return true;
  }

  // 当前总散布（弧度）
  currentSpread(moveFactor: number, airFactor: number): number {
    const deg = WEAPON.baseSpreadDeg
      + moveFactor * WEAPON.moveSpreadDeg
      + airFactor * WEAPON.airSpreadDeg
      + this.bloom;
    return (deg * Math.PI) / 180;
  }

  // 视模应用到相机
  applyToCamera(camera: THREE.Camera) {
    this.group.position.set(
      0.28 + this.swayX,
      -0.26 + this.swayY - this.reloadDip * 0.3,
      -0.55 + this.kickZ * 0.09,
    );
    this.group.rotation.set(
      -this.recoilPitch * 0.5 - this.reloadDip * 0.9,
      this.recoilYaw * 0.5,
      0,
    );
  }

  reset() {
    this.mag = WEAPON.magSize;
    this.reserve = WEAPON.magSize * WEAPON.reserveMags;
    this.reloading = false;
    this.bloom = 0;
    this.cooldown = 0;
    this.triggerHeld = false;
  }
}
