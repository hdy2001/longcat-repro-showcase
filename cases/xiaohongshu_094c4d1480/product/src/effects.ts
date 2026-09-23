// ===== 特效：曳光弹 / 枪口火光 / 命中粒子 =====
import * as THREE from 'three';

interface Tracer {
  line: THREE.Line;
  life: number;
  maxLife: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

const MAX_TRACERS = 64;
const MAX_PARTICLES = 400;

export class Effects {
  private scene: THREE.Scene;
  private tracers: Tracer[] = [];
  private particles: Particle[] = [];
  private tracerPool: THREE.Line[] = [];
  private particleGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  private sandMat = new THREE.MeshBasicMaterial({ color: 0xd8bd85 });
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  private bloodMat = new THREE.MeshBasicMaterial({ color: 0x8a2020 });
  private flashMat: THREE.SpriteMaterial;
  private flashLight: THREE.PointLight;
  private flashLightLife = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.flashMat = new THREE.SpriteMaterial({
      map: makeFlashTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flashLight = new THREE.PointLight(0xffc36b, 0, 9, 2);
    scene.add(this.flashLight);
    // 曳光池
    for (let i = 0; i < MAX_TRACERS; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xffe0a0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.tracerPool.push(line);
    }
    // 粒子池
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, this.sandMat);
      mesh.visible = false;
      scene.add(mesh);
    }
  }

  // 曳光：从 from 到 to
  tracer(from: THREE.Vector3, to: THREE.Vector3, color = 0xffe0a0) {
    const line = this.tracerPool.find(l => !l.visible);
    if (!line) return;
    const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    (line.material as THREE.LineBasicMaterial).color.setHex(color);
    line.visible = true;
    this.tracers.push({ line, life: 0.07, maxLife: 0.07 });
  }

  // 枪口火光
  muzzleFlash(pos: THREE.Vector3, withLight: boolean) {
    const mat = this.flashMat.clone();
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    const s = 0.5 + Math.random() * 0.25;
    sprite.scale.set(s, s, 1);
    this.scene.add(sprite);
    setTimeout(() => {
      this.scene.remove(sprite);
      mat.dispose();
    }, 45);
    if (withLight) {
      this.flashLight.position.copy(pos);
      this.flashLight.intensity = 26;
      this.flashLightLife = 0.05;
    }
  }

  // 弹着点粒子
  impact(point: THREE.Vector3, normal: THREE.Vector3, kind: 'sand' | 'stone' | 'flesh') {
    const mat = kind === 'flesh' ? this.bloodMat : kind === 'stone' ? this.sparkMat : this.sandMat;
    const count = kind === 'flesh' ? 10 : 8;
    for (let i = 0; i < count; i++) {
      const mesh = this.particles.length < MAX_PARTICLES
        ? (() => {
            const m = new THREE.Mesh(this.particleGeo, mat);
            m.visible = false;
            this.scene.add(m);
            return m;
          })()
        : this.particles.find(p => p.life <= 0)?.mesh;
      if (!mesh) return;
      mesh.visible = true;
      mesh.position.copy(point).addScaledVector(normal, 0.03);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3 + normal.x * (1 + Math.random() * 2),
        Math.random() * 3 + normal.y * 2,
        (Math.random() - 0.5) * 3 + normal.z * (1 + Math.random() * 2),
      );
      this.particles.push({
        mesh, vel, life: 0.45 + Math.random() * 0.2, maxLife: 0.6, gravity: 9,
      });
    }
  }

  update(dt: number) {
    // 曳光衰减
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      const k = Math.max(0, t.life / t.maxLife);
      (t.line.material as THREE.LineBasicMaterial).opacity = k * 0.9;
      if (t.life <= 0) {
        t.line.visible = false;
        this.tracers.splice(i, 1);
      }
    }
    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = Math.max(0.2, p.life / p.maxLife);
      p.mesh.scale.setScalar(s);
    }
    // 枪口灯衰减
    if (this.flashLightLife > 0) {
      this.flashLightLife -= dt;
      if (this.flashLightLife <= 0) this.flashLight.intensity = 0;
    }
  }
}

function makeFlashTexture(): THREE.CanvasTexture {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.3, 'rgba(255,210,120,0.8)');
  g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // 星芒
  ctx.strokeStyle = 'rgba(255,230,160,0.9)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2);
    ctx.lineTo(S / 2 + Math.cos(a) * S * 0.48, S / 2 + Math.sin(a) * S * 0.48);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
