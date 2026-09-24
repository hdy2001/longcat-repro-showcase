// 战斗特效：弹道曳光 / 枪口火光 / 命中粒子 / 血雾
import * as THREE from 'three';

interface Tracer { line: THREE.Line; life: number; maxLife: number }
interface Particle { pts: THREE.Points; vel: Float32Array; life: number; maxLife: number; per: number }
interface Flash { sprite: THREE.Sprite; light: THREE.PointLight; life: number }

export class Effects {
  private scene: THREE.Scene;
  private tracers: Tracer[] = [];
  private particles: Particle[] = [];
  private flashes: Flash[] = [];
  private tracerMat = new THREE.LineBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.9 });
  private sparkGeo = new THREE.BufferGeometry();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // 共享火花几何
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
  }

  /** 曳光：从 from 到 to 的亮线，快速消散 */
  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, this.tracerMat.clone());
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07, maxLife: 0.07 });
  }

  /** 枪口火光：精灵 + 点光，1~2 帧 */
  muzzleFlash(pos: THREE.Vector3, big = false): void {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,220,1)');
    grad.addColorStop(0.4, 'rgba(255,190,80,0.9)');
    grad.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(pos);
    const s = big ? 0.9 : 0.45;
    sp.scale.set(s, s, 1);
    const light = new THREE.PointLight(0xffb050, big ? 14 : 5, big ? 9 : 5);
    light.position.copy(pos);
    this.scene.add(sp, light);
    this.flashes.push({ sprite: sp, light, life: 0.045 });
  }

  /** 命中扬尘 / 碎木屑 */
  impact(pos: THREE.Vector3, color = 0xc8a870, count = 10, spread = 2.2): void {
    const n = count;
    const posArr = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      posArr[i * 3] = pos.x; posArr[i * 3 + 1] = pos.y; posArr[i * 3 + 2] = pos.z;
      vel[i * 3] = (Math.random() - 0.5) * spread;
      vel[i * 3 + 1] = Math.random() * spread * 0.9;
      vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.09, transparent: true, opacity: 1, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.particles.push({ pts, vel, life: 0.45, maxLife: 0.45, per: n });
  }

  update(dt: number): void {
    // 曳光
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      const k = Math.max(tr.life / tr.maxLife, 0);
      (tr.line.material as THREE.LineBasicMaterial).opacity = k * 0.9;
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const arr = p.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      const a = arr.array as Float32Array;
      for (let j = 0; j < p.per; j++) {
        p.vel[j * 3 + 1] -= 7 * dt;
        a[j * 3] += p.vel[j * 3] * dt;
        a[j * 3 + 1] = Math.max(0.02, a[j * 3 + 1] + p.vel[j * 3 + 1] * dt);
        a[j * 3 + 2] += p.vel[j * 3 + 2] * dt;
      }
      arr.needsUpdate = true;
      (p.pts.material as THREE.PointsMaterial).opacity = Math.max(p.life / p.maxLife, 0);
      if (p.life <= 0) {
        this.scene.remove(p.pts);
        p.pts.geometry.dispose();
        (p.pts.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    // 火光
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      f.light.intensity *= 0.6;
      f.sprite.material.opacity = Math.max(f.life / 0.045, 0);
      if (f.life <= 0) {
        this.scene.remove(f.sprite, f.light);
        f.sprite.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
  }
}
