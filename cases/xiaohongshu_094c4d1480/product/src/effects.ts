// ============================================================
// 战斗特效 —— 曳光弹 / 枪口闪光 / 弹着点火花 / 血液
// ============================================================
import * as THREE from 'three';

interface Tracer { mesh: THREE.Mesh; life: number; maxLife: number }
interface Spark { pts: THREE.Points; vel: Float32Array; life: number; maxLife: number }

export class Effects {
  private scene: THREE.Scene;
  private tracers: Tracer[] = [];
  private sparks: Spark[] = [];
  private flashLight: THREE.PointLight;
  private flashLife = 0;
  private muzzleSprite: THREE.Sprite;
  private sparkTex: THREE.Texture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // 枪口光源 (仅玩家开枪时短暂开启)
    this.flashLight = new THREE.PointLight(0xffc26e, 0, 9, 2);
    scene.add(this.flashLight);
    // 枪口闪光面片
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,240,190,1)');
    grad.addColorStop(0.4, 'rgba(255,190,90,0.85)');
    grad.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.muzzleSprite.scale.setScalar(0.55);
    this.muzzleSprite.visible = false;
    scene.add(this.muzzleSprite);
    // 火花点纹理
    const sc = document.createElement('canvas');
    sc.width = sc.height = 32;
    const sg = sc.getContext('2d')!;
    const sgrad = sg.createRadialGradient(16, 16, 1, 16, 16, 15);
    sgrad.addColorStop(0, 'rgba(255,230,170,1)');
    sgrad.addColorStop(1, 'rgba(255,160,60,0)');
    sg.fillStyle = sgrad;
    sg.fillRect(0, 0, 32, 32);
    this.sparkTex = new THREE.CanvasTexture(sc);
  }

  /** 曳光: 从 from 到 to 的光线 */
  tracer(from: THREE.Vector3, to: THREE.Vector3, color = 0xffd27a): void {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.5) return;
    const geo = new THREE.CylinderGeometry(0.015, 0.015, len, 4, 1, true);
    geo.translate(0, len / 2, 0);
    geo.rotateX(Math.PI / 2); // 沿 z 轴
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.07, maxLife: 0.07 });
  }

  /** 枪口闪光 */
  muzzleFlash(pos: THREE.Vector3, isPlayer: boolean): void {
    this.muzzleSprite.position.copy(pos);
    this.muzzleSprite.visible = true;
    this.muzzleSprite.scale.setScalar(isPlayer ? 0.55 : 0.4);
    (this.muzzleSprite.material as THREE.SpriteMaterial).rotation = Math.random() * Math.PI;
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = isPlayer ? 14 : 6;
    this.flashLife = 0.05;
  }

  /** 弹着点火花/尘土 */
  impact(pos: THREE.Vector3, normal: THREE.Vector3, onFlesh: boolean): void {
    const n = 10;
    const positions = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
      const spread = onFlesh ? 1.6 : 2.2;
      vel[i * 3] = (Math.random() - 0.5) * spread + normal.x * 1.5;
      vel[i * 3 + 1] = Math.random() * 2.2 + normal.y * 1.5;
      vel[i * 3 + 2] = (Math.random() - 0.5) * spread + normal.z * 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: onFlesh ? 0.14 : 0.11, map: this.sparkTex, transparent: true,
      color: onFlesh ? 0xc0202a : 0xd8b06a,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.sparks.push({ pts, vel, life: onFlesh ? 0.35 : 0.3, maxLife: onFlesh ? 0.35 : 0.3 });
  }

  update(dt: number): void {
    // 曳光
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      const k = Math.max(t.life / t.maxLife, 0);
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = k * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        (t.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    // 火花
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      const posAttr = s.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let j = 0; j < posAttr.count; j++) {
        s.vel[j * 3 + 1] -= 9.8 * dt;
        posAttr.setXYZ(j,
          posAttr.getX(j) + s.vel[j * 3] * dt,
          posAttr.getY(j) + s.vel[j * 3 + 1] * dt,
          posAttr.getZ(j) + s.vel[j * 3 + 2] * dt);
      }
      posAttr.needsUpdate = true;
      (s.pts.material as THREE.PointsMaterial).opacity = Math.max(s.life / s.maxLife, 0);
      if (s.life <= 0) {
        this.scene.remove(s.pts);
        s.pts.geometry.dispose();
        (s.pts.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
      }
    }
    // 枪口闪光衰减
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) {
        this.muzzleSprite.visible = false;
        this.flashLight.intensity = 0;
      } else {
        this.flashLight.intensity *= 0.7;
      }
    }
  }
}
