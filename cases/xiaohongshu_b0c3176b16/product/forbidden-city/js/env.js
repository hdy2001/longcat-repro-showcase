// ============================================================
// env.js — 夜空（星/月/云）、地面、护城河、内金水河、广场
// ============================================================
import * as THREE from 'three';
import { makeGlowTexture, makeCloudTexture, makeGroundTexture, makePlazaTexture } from './materials.js';
import { createWall } from './arch.js';

// ---------------- 天空穹顶（渐变 + 地平线暖光） ----------------
export function createSky() {
  const geo = new THREE.SphereGeometry(1600, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDir;
      void main(){
        float y = clamp(vDir.y, -0.05, 1.0);
        vec3 zen = vec3(0.012, 0.020, 0.055);
        vec3 mid = vec3(0.045, 0.085, 0.175);
        vec3 hor = vec3(0.10, 0.13, 0.22);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, y));
        col = mix(col, zen, smoothstep(0.18, 0.75, y));
        // 地平线附近的暖色城市辉光
        float glow = pow(max(dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(0.0, 0.0, 1.0))), 0.0), 6.0);
        col += vec3(0.20, 0.10, 0.045) * glow * smoothstep(0.25, 0.0, y);
        col += vec3(0.35, 0.18, 0.07) * glow * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  return mesh;
}

// ---------------- 星空（闪烁） ----------------
export function createStars(count = 2400) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // 上半球均匀分布
    const a = Math.random() * Math.PI * 2;
    const y = 0.06 + Math.random() * 0.94;
    const r = Math.sqrt(1 - y * y);
    const R = 1500;
    pos[i * 3] = Math.cos(a) * r * R;
    pos[i * 3 + 1] = y * R;
    pos[i * 3 + 2] = Math.sin(a) * r * R;
    const b = 0.35 + Math.random() * 0.65;
    const warm = Math.random() * 0.25;
    col[i * 3] = b * (1 - warm * 0.5); col[i * 3 + 1] = b * (1 - warm * 0.15); col[i * 3 + 2] = b;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.4 + Math.random() * 1.6;
    size[i] = 1.0 + Math.random() * 2.2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute vec3 aColor; attribute float aPhase, aSpeed, aSize;
      uniform float uTime;
      varying vec3 vColor;
      void main(){
        vColor = aColor;
        float tw = 0.72 + 0.28 * sin(uTime * aSpeed + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * tw;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(vColor * a, a);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = -9;
  pts.userData.mat = mat;
  return pts;
}

// ---------------- 月亮（圆盘 + 双层光晕） ----------------
export function createMoon() {
  const g = new THREE.Group();
  const R = 46;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 40), new THREE.MeshBasicMaterial({ color: 0xf6efdd, fog: false }));
  // 月面斑驳
  const texC = document.createElement('canvas'); texC.width = texC.height = 256;
  const ctx = texC.getContext('2d');
  ctx.fillStyle = '#f6efdd'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const r = 6 + Math.random() * 26;
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, 'rgba(190,180,160,0.20)'); grd.addColorStop(1, 'rgba(190,180,160,0)');
    ctx.save(); ctx.translate(Math.random() * 256, Math.random() * 256);
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.restore();
  }
  const tex = new THREE.CanvasTexture(texC); tex.colorSpace = THREE.SRGBColorSpace;
  disc.material.map = tex;
  g.add(disc);
  const glow1 = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(250,240,215,1)'), transparent: true, opacity: 0.38,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow1.scale.setScalar(180);
  const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(230,225,205,1)', 'rgba(230,225,205,0)'), transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow2.scale.setScalar(520);
  g.add(glow1, glow2);
  g.position.set(430, 620, -1150);
  g.userData.mat = disc.material;
  return g;
}

// ---------------- 云 ----------------
export function createClouds(n = 7) {
  const g = new THREE.Group();
  const tex = makeCloudTexture();
  const sprites = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.5 + Math.random() * 0.3,
      color: 0x8fa3cc, depthWrite: false, fog: false,
    }));
    s.position.set((Math.random() - 0.5) * 2200, 180 + Math.random() * 260, (Math.random() - 0.5) * 2200);
    s.scale.set(420 + Math.random() * 420, 130 + Math.random() * 90, 1);
    s.userData.speed = 1.2 + Math.random() * 1.6;
    sprites.push(s);
    g.add(s);
  }
  g.userData.update = (dt) => {
    sprites.forEach((s) => {
      s.position.x += s.userData.speed * dt;
      if (s.position.x > 1400) s.position.x = -1400;
    });
  };
  return g;
}

// ---------------- 地面 + 广场 + 御道 ----------------
export function createGround(M) {
  const g = new THREE.Group();
  const groundTex = makeGroundTexture(); groundTex.repeat.set(30, 30);
  M.ground.map = groundTex;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), M.ground);
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);

  // 中轴御道（南段广场 + 主路）
  const plazaTex = makePlazaTexture(); plazaTex.repeat.set(3, 26);
  M.plaza.map = plazaTex;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(150, 420), M.plaza);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.03, 270);
  g.add(plaza);
  const roadTex = makePlazaTexture(); roadTex.repeat.set(2, 40);
  M.plaza.map = roadTex;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(26, 700), M.plaza);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.035, 90);
  g.add(road);
  return g;
}

// ---------------- 护城河（环） ----------------
export function createMoat(M) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const X = 430, Z0 = -500, Z1 = 540; // 外缘
  const iX = 392, iZ0 = -462, iZ1 = 502; // 内缘
  shape.moveTo(-X, Z1); shape.lineTo(X, Z1); shape.lineTo(X, Z0); shape.lineTo(-X, Z0); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-iX, iZ1); hole.lineTo(iX, iZ1); hole.lineTo(iX, iZ0); hole.lineTo(-iX, iZ0); hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 4);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, M.water);
  mesh.position.y = -0.9;
  g.add(mesh);
  // 河岸
  const bank = new THREE.Mesh(new THREE.BoxGeometry(2 * X + 40, 1.4, 2 * (Z1 - Z0) + 40), M.plinth);
  bank.position.y = -1.6;
  // 用环形压顶边即可（视觉忽略重叠）
  g.add(bank);
  return g;
}

// ---------------- 内金水河（S 形河道 + 5 桥由 city 放置） ----------------
export function createInnerRiver(M) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  // S 形：南岸线
  const pts = [];
  const N = 40, x0 = -210, x1 = 210, zc = 408;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([x0 + (x1 - x0) * t, zc + Math.sin(t * Math.PI * 2) * 7 - 7 * t]);
  }
  shape.moveTo(x0, pts[0][1] - 5);
  pts.forEach(([x, z]) => shape.lineTo(x, z - 5));
  for (let i = N; i >= 0; i--) shape.lineTo(pts[i][0], pts[i][1] + 5);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 8);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, M.water);
  mesh.position.y = 0.06;
  g.add(mesh);
  // 河岸条
  const bankMat = M.stoneDark;
  [pts.map(([x, z]) => [x, z - 5]), pts.map(([x, z]) => [x, z + 5])].forEach((line, li) => {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.5, 0.7), bankMat);
      seg.position.set((ax + bx) / 2, 0.25, (az + bz) / 2 + (li === 0 ? -0.1 : 0.1));
      seg.rotation.y = -Math.atan2(bz - az, bx - ax);
      g.add(seg);
    }
  });
  return g;
}

// ---------------- 宫墙（四面，含门洞缺口） ----------------
export function createPalaceWalls(M) {
  const g = new THREE.Group();
  const H = 10, TH = 9;
  const X = 370, ZN = -430, ZS = 470;
  const segs = [
    { from: [-X, ZS], to: [-52, ZS] }, { from: [52, ZS], to: [X, ZS] }, // 南墙（午门缺口）
    { from: [-X, ZN], to: [-46, ZN] }, { from: [46, ZN], to: [X, ZN] }, // 北墙（神武门缺口）
    { from: [-X, ZN], to: [-X, ZS] },                                      // 西墙
    { from: [X, ZN], to: [X, ZS] },                                        // 东墙
  ];
  segs.forEach((s) => {
    const dx = s.to[0] - s.from[0], dz = s.to[1] - s.from[1];
    const len = Math.hypot(dx, dz);
    const wall = createWall(M, len + TH, H, TH);
    wall.position.set((s.from[0] + s.to[0]) / 2, 0, (s.from[1] + s.to[1]) / 2);
    wall.rotation.y = -Math.atan2(dz, dx);
    g.add(wall);
  });
  // 墙顶四角排水小兽省略
  return g;
}
