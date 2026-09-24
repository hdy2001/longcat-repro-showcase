// ============ 角色：潜水员 / 鱼群 / 粒子 ============

const A = {}; // 角色引用

function initDiver() {
  const g = new THREE.Group();
  const body = new THREE.Group(); // 用于游动动画
  g.add(body);

  const suitMat = new THREE.MeshStandardMaterial({ color: 0x14201c, roughness: 0.7, metalness: 0.1 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.75, 4, 10), suitMat);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  // 头盔
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a7a4a, metalness: 0.9, roughness: 0.3 }));
  helmet.position.set(0, 0.06, 0.55);
  body.add(helmet);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x9fd8c8, transparent: true, opacity: 0.35 }));
  glass.scale.set(1, 0.9, 0.7);
  glass.position.set(0, 0.06, 0.62);
  body.add(glass);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xd8a828, metalness: 0.9, roughness: 0.3 }));
  rim.position.set(0, 0.06, 0.58);
  body.add(rim);
  // 氧气瓶
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.75, 10),
    new THREE.MeshStandardMaterial({ color: 0x9aa8a4, metalness: 0.85, roughness: 0.35 }));
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0.34, -0.12);
  body.add(tank);
  // 手臂
  const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6);
  const armL = new THREE.Mesh(armGeo, suitMat);
  armL.position.set(-0.34, -0.04, 0.32);
  armL.rotation.set(1.25, 0, 0.25);
  const armR = new THREE.Mesh(armGeo, suitMat);
  armR.position.set(0.34, -0.04, 0.32);
  armR.rotation.set(1.25, 0, -0.25);
  body.add(armL, armR);
  // 腿 + 脚蹼
  const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.6, 6);
  const finGeo = new THREE.BoxGeometry(0.18, 0.04, 0.55);
  const finMat = new THREE.MeshStandardMaterial({ color: 0xc9922a, roughness: 0.6 });
  A.legL = new THREE.Mesh(legGeo, suitMat);
  A.legL.position.set(-0.14, 0, -0.72);
  A.legL.rotation.x = Math.PI / 2;
  A.legR = new THREE.Mesh(legGeo, suitMat);
  A.legR.position.set(0.14, 0, -0.72);
  A.legR.rotation.x = Math.PI / 2;
  const finL = new THREE.Mesh(finGeo, finMat);
  finL.position.set(-0.14, 0, -1.2);
  const finR = new THREE.Mesh(finGeo, finMat);
  finR.position.set(0.14, 0, -1.2);
  body.add(A.legL, A.legR, finL, finR);
  A.finL = finL; A.finR = finR;
  // 头灯
  const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8, roughness: 0.4 }));
  lampBody.rotation.x = Math.PI / 2;
  lampBody.position.set(0, 0.14, 0.86);
  body.add(lampBody);
  const headlamp = new THREE.SpotLight(0xfff0c8, 140, 55, 0.4, 0.55, 1.5);
  headlamp.position.set(0, 0.14, 0.9);
  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0, -0.4, 8);
  body.add(lampTarget);
  headlamp.target = lampTarget;
  body.add(headlamp);
  const lampGlow = new THREE.PointLight(0xffe0a0, 9, 9, 1.8);
  lampGlow.position.set(0, 0.14, 0.95);
  body.add(lampGlow);

  g.position.set(0, -6, 15);
  W.scene.add(g);
  A.diver = g;
  A.diverBody = body;
}

function initFish() {
  const fishGeo = makeFishGeometry();
  A.fishGeo = fishGeo;

  // --- 金色漩涡鱼群（环绕太阳神鸟） ---
  const N1 = 320;
  A.vortex = new THREE.InstancedMesh(fishGeo,
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }), N1);
  A.vortexData = [];
  const cGold = new THREE.Color(0xffb84d), cPale = new THREE.Color(0xffe08a), cDeep = new THREE.Color(0xff8a2a);
  for (let i = 0; i < N1; i++) {
    A.vortexData.push({
      a: Math.random() * Math.PI * 2,
      r: 7 + Math.random() * 13,
      h: -7 + Math.random() * 15,
      s: 0.22 + Math.random() * 0.45,
      w: Math.random() * 10,
      sz: 0.45 + Math.random() * 0.85
    });
    const cc = Math.random();
    A.vortex.setColorAt(i, cc < 0.6 ? cGold : (cc < 0.85 ? cPale : cDeep));
  }
  A.vortex.instanceColor.needsUpdate = true;
  W.scene.add(A.vortex);

  // --- 金色流群（穿越遗迹） ---
  const N2 = 220;
  A.stream = new THREE.InstancedMesh(fishGeo, A.vortex.material.clone(), N2);
  A.streamData = [];
  for (let i = 0; i < N2; i++) {
    A.streamData.push({
      t: Math.random(),
      ox: (Math.random() - 0.5) * 5, oy: (Math.random() - 0.5) * 4, oz: (Math.random() - 0.5) * 5,
      s: 0.010 + Math.random() * 0.014,
      w: Math.random() * 10,
      sz: 0.4 + Math.random() * 0.8
    });
    A.stream.setColorAt(i, Math.random() < 0.7 ? cGold : cPale);
  }
  A.stream.instanceColor.needsUpdate = true;
  W.scene.add(A.stream);

  // --- 白色小鱼群 ---
  const N3 = 90;
  A.whitefish = new THREE.InstancedMesh(fishGeo,
    new THREE.MeshBasicMaterial({
      color: 0xcfe8dd, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }), N3);
  A.whiteData = [];
  for (let i = 0; i < N3; i++) {
    A.whiteData.push({
      bx: (Math.random() - 0.5) * 70, by: -16 - Math.random() * 12, bz: -100 - Math.random() * 70,
      a: Math.random() * Math.PI * 2,
      r: 5 + Math.random() * 22,
      s: 0.08 + Math.random() * 0.25,
      w: Math.random() * 10,
      sz: 0.3 + Math.random() * 0.45
    });
  }
  W.scene.add(A.whitefish);
}

function initParticles() {
  // --- 海雪 ---
  const NS = 1200;
  const pos = new Float32Array(NS * 3);
  A.snowVel = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 170;
    pos[i * 3 + 1] = -45 + Math.random() * 85;
    pos[i * 3 + 2] = -100 + (Math.random() - 0.5) * 170;
    A.snowVel[i] = 0.25 + Math.random() * 0.6;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  A.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
    color: 0x9fc8b8, size: 0.16, transparent: true, opacity: 0.45,
    depthWrite: false, sizeAttenuation: true
  }));
  W.scene.add(A.snow);

  // --- 气泡 ---
  const NB = 60;
  const bpos = new Float32Array(NB * 3);
  A.bubbles = [];
  for (let i = 0; i < NB; i++) {
    A.bubbles.push({ x: 0, y: -999, z: 0, v: 0, wob: Math.random() * 10 });
    bpos[i * 3 + 1] = -999;
  }
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  A.bubblePoints = new THREE.Points(bGeo, new THREE.PointsMaterial({
    color: 0xcfe8dd, size: 0.28, transparent: true, opacity: 0.55,
    depthWrite: false, sizeAttenuation: true
  }));
  W.scene.add(A.bubblePoints);
  A.bubbleTimer = 0;

  // --- 神鸟周围金色浮游光点 ---
  const NG = 90;
  const gpos = new Float32Array(NG * 3);
  A.plankton = [];
  for (let i = 0; i < NG; i++) {
    A.plankton.push({
      a: Math.random() * Math.PI * 2,
      r: 5 + Math.random() * 16,
      y: -20 + (Math.random() - 0.5) * 16,
      s: 0.1 + Math.random() * 0.3,
      w: Math.random() * 10
    });
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  A.planktonPoints = new THREE.Points(gGeo, new THREE.PointsMaterial({
    color: 0xffc860, size: 0.3, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  }));
  W.scene.add(A.planktonPoints);
}

const _td = new THREE.Object3D();
const _tv1 = new THREE.Vector3();
const _tv2 = new THREE.Vector3();

function updateActors(dt, t) {
  // ---- 潜水员游动动画 ----
  if (A.diverBody) {
    const kick = Math.sin(t * 5.2) * 0.45;
    A.legL.rotation.x = Math.PI / 2 + kick;
    A.legR.rotation.x = Math.PI / 2 - kick;
    A.finL.position.z = -1.2 - kick * 0.3;
    A.finR.position.z = -1.2 + kick * 0.3;
    A.diverBody.position.y = Math.sin(t * 1.8) * 0.08;
    A.diverBody.rotation.z = Math.sin(t * 0.9) * 0.06;
    A.diverBody.rotation.x = Math.sin(t * 0.7) * 0.04;
  }

  // ---- 漩涡鱼群 ----
  const sb = W.sunbird.position;
  for (let i = 0; i < A.vortexData.length; i++) {
    const d = A.vortexData[i];
    d.a += d.s * dt;
    const r = d.r + Math.sin(t * 0.4 + d.w) * 1.3;
    const px = sb.x + Math.cos(d.a) * r;
    const pz = sb.z + Math.sin(d.a) * r;
    const py = sb.y + d.h + Math.sin(t * 0.9 + d.w) * 0.8;
    _td.position.set(px, py, pz);
    _tv1.set(-Math.sin(d.a), 0.12 * Math.cos(t + d.w), Math.cos(d.a));
    _td.lookAt(px + _tv1.x, py + _tv1.y, pz + _tv1.z);
    _td.scale.set(d.sz, d.sz, d.sz);
    _td.updateMatrix();
    A.vortex.setMatrixAt(i, _td.matrix);
  }
  A.vortex.instanceMatrix.needsUpdate = true;

  // ---- 流群 ----
  for (let i = 0; i < A.streamData.length; i++) {
    const d = A.streamData[i];
    d.t += d.s * dt;
    if (d.t > 1) d.t -= 1;
    W.streamCurve.getPointAt(d.t, _tv1);
    W.streamCurve.getTangentAt(d.t, _tv2);
    const wob = Math.sin(t * 1.5 + d.w) * 0.8;
    _td.position.set(
      _tv1.x + d.ox + _tv2.z * wob,
      _tv1.y + d.oy + Math.cos(t * 1.2 + d.w) * 0.6,
      _tv1.z + d.oz - _tv2.x * wob
    );
    _td.lookAt(_td.position.x + _tv2.x, _td.position.y + _tv2.y, _td.position.z + _tv2.z);
    _td.scale.set(d.sz, d.sz, d.sz);
    _td.updateMatrix();
    A.stream.setMatrixAt(i, _td.matrix);
  }
  A.stream.instanceMatrix.needsUpdate = true;

  // ---- 白色小鱼 ----
  for (let i = 0; i < A.whiteData.length; i++) {
    const d = A.whiteData[i];
    d.a += d.s * dt;
    const px = d.bx + Math.cos(d.a) * d.r;
    const pz = d.bz + Math.sin(d.a) * d.r;
    const py = d.by + Math.sin(t * 0.7 + d.w) * 2;
    _td.position.set(px, py, pz);
    _td.lookAt(px - Math.sin(d.a), py + 0.3, pz + Math.cos(d.a));
    _td.scale.set(d.sz, d.sz, d.sz);
    _td.updateMatrix();
    A.whitefish.setMatrixAt(i, _td.matrix);
  }
  A.whitefish.instanceMatrix.needsUpdate = true;

  // ---- 海雪 ----
  const sp = A.snow.geometry.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    let y = sp.getY(i) - A.snowVel[i] * dt;
    if (y < -45) y = 40;
    sp.setY(i, y);
    sp.setX(i, sp.getX(i) + Math.sin(t * 0.5 + i) * 0.02);
  }
  sp.needsUpdate = true;

  // ---- 气泡 ----
  A.bubbleTimer -= dt;
  if (A.bubbleTimer <= 0) {
    A.bubbleTimer = 0.25 + Math.random() * 0.5;
    const b = A.bubbles.find(b => b.v === 0);
    if (b) {
      A.diver.getWorldPosition(_tv1);
      b.x = _tv1.x + (Math.random() - 0.5) * 0.3;
      b.y = _tv1.y + 0.2;
      b.z = _tv1.z + (Math.random() - 0.5) * 0.3;
      b.v = 1.2 + Math.random() * 1.2;
    }
  }
  const bp = A.bubblePoints.geometry.attributes.position;
  for (let i = 0; i < A.bubbles.length; i++) {
    const b = A.bubbles[i];
    if (b.v > 0) {
      b.y += b.v * dt;
      b.x += Math.sin(t * 6 + b.wob) * 0.15 * dt;
      if (b.y > 40) b.v = 0;
    }
    bp.setXYZ(i, b.x, b.y, b.z);
  }
  bp.needsUpdate = true;

  // ---- 金色浮游光点 ----
  const gp = A.planktonPoints.geometry.attributes.position;
  for (let i = 0; i < A.plankton.length; i++) {
    const d = A.plankton[i];
    d.a += d.s * dt;
    gp.setXYZ(i,
      sb.x + Math.cos(d.a) * d.r,
      sb.y + d.y + Math.sin(t * 0.8 + d.w) * 1.2,
      sb.z + Math.sin(d.a) * d.r);
  }
  gp.needsUpdate = true;
}
