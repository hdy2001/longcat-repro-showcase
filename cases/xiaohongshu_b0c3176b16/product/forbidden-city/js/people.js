// ============================================================
// people.js —— 夜间游人（低多边形人群，InstancedMesh，行走/驻足/拍照）
// ============================================================
import * as THREE from 'three';

const COAT_COLORS = [0x1c2430, 0x2a2028, 0x20303a, 0x33261e, 0x241a2e, 0x2e2e34, 0x3a2c22, 0x1e2e28, 0x402028, 0x263040];
const SKIN = [0xd9b08c, 0xc99878, 0xe8c4a0];

function makePersonGeometry(withHat) {
  // 身体：胶囊；头：球
  const body = new THREE.CapsuleGeometry(0.21, 0.72, 3, 8);
  body.translate(0, 0.75, 0);
  const head = new THREE.SphereGeometry(0.145, 10, 8);
  head.translate(0, 1.42, 0);
  const geoms = [body, head];
  if (withHat) {
    const hat = new THREE.CylinderGeometry(0.17, 0.19, 0.12, 10);
    hat.translate(0, 1.56, 0);
    const brim = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 10);
    brim.translate(0, 1.5, 0);
    geoms.push(hat, brim);
  }
  return geoms;
}

export function createCrowd(scene, M, count = 170) {
  const withHatGeo = makePersonGeometry(true);
  const noHatGeo = makePersonGeometry(false);
  // 使用两个 InstancedMesh：带帽/不带帽
  const hatRatio = 0.45;
  const nHat = Math.floor(count * hatRatio), nNo = count - nHat;
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, color: 0xffffff, emissive: 0x1c1410, emissiveIntensity: 0.55 });
  const headMat = new THREE.MeshStandardMaterial({ roughness: 0.8, color: 0xffffff, emissive: 0x2a1a12, emissiveIntensity: 0.5 });
  const hatMat = new THREE.MeshStandardMaterial({ roughness: 0.9, color: 0x222630 });

  const mk = (geoms, n) => {
    const g = new THREE.Group();
    const bodies = new THREE.InstancedMesh(geoms[0], bodyMat.clone(), n);
    const heads = new THREE.InstancedMesh(geoms[1], headMat.clone(), n);
    g.add(bodies, heads);
    if (geoms.length > 2) {
      const hats = new THREE.InstancedMesh(geoms[2], hatMat, n);
      const brims = new THREE.InstancedMesh(geoms[3], hatMat, n);
      g.add(hats, brims);
      g.userData.hats = [hats, brims];
    }
    g.userData.bodies = bodies; g.userData.heads = heads;
    g.userData.n = n;
    return g;
  };

  const gHat = mk(withHatGeo, nHat);
  const gNo = mk(noHatGeo, nNo);
  scene.add(gHat, gNo);

  // 路径定义：环线 + 轴线往返 + 花园小径
  const paths = [
    // 中轴主线（南→北往返）
    { pts: [[-8, 440], [-8, -200]], r: 7, speed: [0.9, 1.4], n: 22 },
    { pts: [[8, -200], [8, 440]], r: 7, speed: [0.9, 1.3], n: 20 },
    // 午门—太和门广场
    { pts: [[-30, 420], [30, 380]], r: 16, speed: [0.7, 1.1], n: 14 },
    { pts: [[30, 430], [-35, 395]], r: 14, speed: [0.7, 1.0], n: 14 },
    // 内金水桥
    { pts: [[-60, 395], [60, 395]], r: 6, speed: [0.5, 0.8], n: 10 },
    // 太和殿前广场
    { pts: [[-45, 350], [45, 240]], r: 10, speed: [0.6, 1.0], n: 18 },
    { pts: [[40, 355], [-42, 245]], r: 10, speed: [0.6, 1.0], n: 16 },
    // 后三宫
    { pts: [[-25, 180], [25, -150]], r: 8, speed: [0.55, 0.95], n: 14 },
    { pts: [[25, 180], [-25, -140]], r: 8, speed: [0.55, 0.95], n: 12 },
    // 御花园
    { pts: [[-60, -160], [60, -160]], r: 30, speed: [0.5, 0.85], n: 12 },
    { pts: [[60, -240], [-60, -240]], r: 28, speed: [0.5, 0.85], n: 12 },
    // 东西六宫
    { pts: [[-240, 60], [-140, 60]], r: 12, speed: [0.5, 0.8], n: 10 },
    { pts: [[140, 40], [240, 40]], r: 12, speed: [0.5, 0.8], n: 10 },
  ];

  const people = [];
  const dummy = new THREE.Object3D();
  let id = 0;

  const alloc = (grp, k) => {
    // 在 grp 上分配第 k 个实例
    return { grp, k };
  };

  const assign = [];
  let hi = 0, hn = 0;
  paths.forEach((p) => {
    for (let i = 0; i < p.n; i++) {
      const useHat = Math.random() < hatRatio;
      const slot = useHat ? { g: gHat, k: hi++ } : { g: gNo, k: hn++ };
      const a = p.pts[0], b = p.pts[1];
      const off = (Math.random() - 0.5) * 2 * p.r;
      const t0 = Math.random();
      const spd = p.speed[0] + Math.random() * (p.speed[1] - p.speed[0]);
      const dir = Math.random() < 0.5 ? 1 : -1;
      people.push({
        ...slot, a, b, off, t: t0, spd, dir,
        coat: COAT_COLORS[(Math.random() * COAT_COLORS.length) | 0],
        skin: SKIN[(Math.random() * SKIN.length) | 0],
        phase: Math.random() * Math.PI * 2,
        pose: 'walk',
      });
      assign.push(people[people.length - 1]);
    }
  });

  // 驻足/拍照人群（静止，抬头或举手机）
  const standSpots = [];
  paths.forEach((p) => {
    const n = Math.floor(p.n * 0.5);
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      const x = p.pts[0][0] + (p.pts[1][0] - p.pts[0][0]) * t + (Math.random() - 0.5) * p.r * 1.6;
      const z = p.pts[0][1] + (p.pts[1][1] - p.pts[0][1]) * t + (Math.random() - 0.5) * p.r * 1.6;
      standSpots.push({ x, z, phase: Math.random() * Math.PI * 2, photo: Math.random() < 0.4 });
    }
  });
  standSpots.forEach((s) => {
    const useHat = Math.random() < hatRatio;
    const slot = useHat ? { g: gHat, k: hi++ } : { g: gNo, k: hn++ };
    people.push({ ...slot, x: s.x, z: s.z, pose: 'stand', photo: s.photo, phase: s.phase, coat: COAT_COLORS[(Math.random() * COAT_COLORS.length) | 0], skin: SKIN[(Math.random() * SKIN.length) | 0] });
  });

  // 颜色初始化
  const cA = new THREE.Color();
  people.forEach((p) => {
    cA.setHex(p.coat);
    p.g.userData.bodies.setColorAt(p.k, cA);
    cA.setHex(p.skin);
    p.g.userData.heads.setColorAt(p.k, cA);
  });
  if (gHat.userData.bodies.instanceColor) gHat.userData.bodies.instanceColor.needsUpdate = true;
  if (gNo.userData.bodies.instanceColor) gNo.userData.bodies.instanceColor.needsUpdate = true;
  if (gHat.userData.heads.instanceColor) gHat.userData.heads.instanceColor.needsUpdate = true;
  if (gNo.userData.heads.instanceColor) gNo.userData.heads.instanceColor.needsUpdate = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const look = new THREE.Matrix4();

  function update(dt, time) {
    for (const p of people) {
      if (p.pose === 'walk') {
        p.t += (p.spd * dt * p.dir) / Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) * 40;
        if (p.t > 1) { p.t = 1; p.dir = -1; }
        if (p.t < 0) { p.t = 0; p.dir = 1; }
        const x = p.a[0] + (p.b[0] - p.a[0]) * p.t + p.off;
        const z = p.a[1] + (p.b[1] - p.a[1]) * p.t + p.off * 0.4;
        const bob = Math.abs(Math.sin(time * 7 * p.spd + p.phase)) * 0.05;
        pos.set(x, bob, z);
        const yaw = Math.atan2((p.b[0] - p.a[0]) * p.dir, (p.b[1] - p.a[1]) * p.dir);
        q.setFromAxisAngle(up, yaw);
        scl.setScalar(1);
      } else {
        const sway = Math.sin(time * 0.8 + p.phase) * 0.012;
        pos.set(p.x, 0, p.z);
        q.setFromAxisAngle(up, p.phase + sway);
        scl.setScalar(1);
        if (p.photo) q.setFromAxisAngle(up, p.phase);
      }
      m4.compose(pos, q, scl);
      p.g.userData.bodies.setMatrixAt(p.k, m4);
      p.g.userData.heads.setMatrixAt(p.k, m4);
      if (p.g.userData.hats) {
        p.g.userData.hats[0].setMatrixAt(p.k, m4);
        p.g.userData.hats[1].setMatrixAt(p.k, m4);
      }
    }
    gHat.userData.bodies.instanceMatrix.needsUpdate = true;
    gHat.userData.heads.instanceMatrix.needsUpdate = true;
    gNo.userData.bodies.instanceMatrix.needsUpdate = true;
    gNo.userData.heads.instanceMatrix.needsUpdate = true;
    if (gHat.userData.hats) {
      gHat.userData.hats[0].instanceMatrix.needsUpdate = true;
      gHat.userData.hats[1].instanceMatrix.needsUpdate = true;
    }
  }

  return { update, count: people.length };
}
