// ============================================================
// arch.js — 参数化中式古建筑生成器（歇山/庑殿/攒尖、飞檐、斗拱、台基）
// 朝向约定：建筑正面朝南 = +Z，屋脊沿 X（东西）方向，单位：米
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------- 屋顶曲面 ----------------
// 庑殿（hip）：正脊沿 X，四角飞檐起翘
export function hipRoofGeometry(W, D, ridgeFrac, y0, h, lift = 1.15, over = 0.3, seg = 22) {
  const nx = seg, nz = Math.max(10, Math.round(seg * D / W));
  const ridgeHalf = W * ridgeFrac / 2, hx = W / 2, hz = D / 2;
  const pos = [], uv = [], idx = [];
  const heightAt = (x, z) => {
    const sx = Math.max(0, Math.abs(x) - ridgeHalf) / (hx - ridgeHalf);
    const sz = Math.abs(z) / hz;
    const d = Math.min(1, Math.max(sx, sz));
    let y = y0 + h * (1 - Math.pow(1 - d, 1.7));
    const corner = Math.min(1, (sx + sz) * 0.92);
    const t = smoothstep(0.7, 1, d);
    y += lift * t * t * corner + over * smoothstep(0.85, 1, d);
    return y;
  };
  for (let iz = 0; iz <= nz; iz++) {
    const z = (iz / nz - 0.5) * D;
    for (let ix = 0; ix <= nx; ix++) {
      const x = (ix / nx - 0.5) * W;
      pos.push(x, heightAt(x, z), z);
      uv.push(x * 0.32, z * 0.32);
    }
  }
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const a = iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 攒尖（pyramid）：方形平面，四坡汇于宝顶
export function pyramidRoofGeometry(W, D, y0, h, lift = 0.9, over = 0.28, seg = 16) {
  const nx = seg, nz = seg, hx = W / 2, hz = D / 2;
  const pos = [], uv = [], idx = [];
  const heightAt = (x, z) => {
    const d = Math.min(1, Math.max(Math.abs(x) / hx, Math.abs(z) / hz));
    let y = y0 + h * (1 - Math.pow(d, 1.55));
    const corner = smoothstep(0.55, 1, d);
    y += lift * corner * corner * corner + over * smoothstep(0.82, 1, d);
    return y;
  };
  for (let iz = 0; iz <= nz; iz++) {
    const z = (iz / nz - 0.5) * D;
    for (let ix = 0; ix <= nx; ix++) {
      const x = (ix / nx - 0.5) * W;
      pos.push(x, heightAt(x, z), z);
      uv.push(x * 0.32, z * 0.32);
    }
  }
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const a = iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 沿曲面采样生成脊条管（垂脊/戗脊）
function ridgeTube(getPos, mat, radius = 0.16) {
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push(getPos(i / 10));
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 5, false), mat);
}

// ---------------- 屋顶总成 ----------------
// opts: { style:'hip'|'xieshan'|'pyramid', tiers:[{W,D,y0,h}], ridgeFrac }
export function buildRoof(M, opts) {
  const group = new THREE.Group();
  const style = opts.style || 'hip';
  const rf = opts.ridgeFrac || 0.42;
  const tiers = opts.tiers || [{ W: opts.W, D: opts.D, y0: opts.y0, h: opts.h }];
  let apexY = 0;

  tiers.forEach((t, ti) => {
    const isTop = ti === tiers.length - 1;
    let surf;
    if (style === 'pyramid') surf = pyramidRoofGeometry(t.W, t.D, t.y0, t.h);
    else surf = hipRoofGeometry(t.W, t.D, rf, t.y0, t.h, isTop ? 1.25 : 0.9);
    const roof = new THREE.Mesh(surf, M.roof);
    roof.rotation.y = 0;
    group.add(roof);

    const ridgeHalf = t.W * rf / 2, hx = t.W / 2, hz = t.D / 2;
    const topY = t.y0 + t.h + 0.35;

    if (style === 'pyramid') {
      // 四条垂脊：宝顶 → 四角
      const apex = new THREE.Vector3(0, t.y0 + t.h + 0.35, 0);
      apexY = apex.y;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const corner = new THREE.Vector3(sx * hx, t.y0 + 0.15, sz * hz);
        group.add(ridgeTube((s) => apex.clone().lerp(corner, s).add(new THREE.Vector3(0, 0.12 * (1 - s), 0)), M.ridge, 0.17));
      });
      // 宝顶
      const fin = new THREE.Group();
      const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), M.finial); s1.position.y = 0.55;
      const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.9, 8), M.finial); s2.position.y = 1.2;
      const s3 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M.finial); s3.position.y = 1.75;
      fin.add(s1, s2, s3); fin.position.copy(apex);
      group.add(fin);
    } else {
      // 正脊
      const main = new THREE.Mesh(new THREE.BoxGeometry(t.W * rf + 0.7, 0.62, 0.72), M.ridge);
      main.position.set(0, topY, 0);
      group.add(main);
      // 鸱吻 ×2
      [-1, 1].forEach((s) => {
        const orn = new THREE.Group();
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.35, 0.85), M.ridgeEnd); b1.position.y = 0.5;
        const b2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 6), M.ridgeEnd); b2.position.y = 1.45; b2.rotation.y = 0.6;
        orn.add(b1, b2);
        orn.position.set(s * (t.W * rf / 2 + 0.15), topY + 0.15, 0);
        group.add(orn);
      });
      // 四条垂脊（脊端 → 角）
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const start = new THREE.Vector3(sx * ridgeHalf, topY - 0.1, 0);
        const end = new THREE.Vector3(sx * hx, t.y0 + 0.42, sz * hz);
        group.add(ridgeTube((s) => start.clone().lerp(end, s).add(new THREE.Vector3(0, 0.14 * Math.sin(s * Math.PI), 0)), M.ridge, 0.19));
        // 脊端小兽
        const beast = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.55, 0.4), M.ridgeEnd);
        beast.position.copy(end).add(new THREE.Vector3(0, 0.28, 0));
        group.add(beast);
      });
      if (isTop) apexY = topY + 1.6;
    }

    // 歇山：上层前后加山花（三角灰塑）
    if (style === 'xieshan' && isTop) {
      const up = tiers[tiers.length - 1];
      const low = tiers[tiers.length - 2] || t;
      [-1, 1].forEach((s) => {
        const g = new THREE.BufferGeometry();
        const hw = up.W / 2;
        const yBase = low.y0 + low.h * 0.62;
        g.setAttribute('position', new THREE.Float32BufferAttribute(
          [-hw, up.y0, 0, hw, up.y0, 0, 0, yBase, 0], 3));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, M.wallDark);
        m.position.z = s * (up.D / 2 + 0.06);
        m.rotation.y = s > 0 ? 0 : Math.PI;
        group.add(m);
      });
    }

    // 檐口板（出檐底缘，暗色）
    const edge = [];
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      // 参数化檐口椭圆角
      const ex = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.55) * hx;
      const ez = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.55) * hz;
      const hy = (style === 'pyramid' ? pyramidRoofHeightAt(ex, ez, t) : hipRoofHeightAt(ex, ez, t));
      edge.push(new THREE.Vector3(ex, hy - 0.05, ez));
    }
    const eave = new THREE.Group();
    const ew = 0.34, ed = 0.42;
    for (let i = 0; i < edge.length - 1; i++) {
      const p0 = edge[i], p1 = edge[i + 1];
      const len = p0.distanceTo(p1);
      if (len < 0.01) continue;
      const geo = new THREE.BoxGeometry(len, ed, ew);
      const mesh = new THREE.Mesh(geo, M.eaveBoard);
      mesh.position.copy(p0).lerp(p1, 0.5).add(new THREE.Vector3(0, -ed / 2, 0));
      mesh.lookAt(p1.x, p1.y - ed / 2, p1.z);
      mesh.rotateY(Math.PI / 2);
      eave.add(mesh);
    }
    group.add(eave);
  });

  // 斗拱层（檐下）— 整圈
  const dougong = buildDougongRing(M, tiers[0], rf, style);
  group.add(dougong);

  return { group, apexY };
}

// 供檐口采样的高度函数（与曲面公式一致）
function hipRoofHeightAt(x, z, t) {
  const ridgeHalf = t.W * (0.42) / 2, hx = t.W / 2, hz = t.D / 2;
  const sx = Math.max(0, Math.abs(x) - ridgeHalf) / (hx - ridgeHalf);
  const sz = Math.abs(z) / hz;
  const d = Math.min(1, Math.max(sx, sz));
  let y = t.y0 + t.h * (1 - Math.pow(1 - d, 1.7));
  const corner = Math.min(1, (sx + sz) * 0.92);
  const s = smoothstep(0.7, 1, d);
  y += 1.0 * s * s * corner + 0.28 * smoothstep(0.85, 1, d);
  return y;
}
function pyramidRoofHeightAt(x, z, t) {
  const d = Math.min(1, Math.max(Math.abs(x) / (t.W / 2), Math.abs(z) / (t.D / 2)));
  let y = t.y0 + t.h * (1 - Math.pow(d, 1.55));
  const corner = smoothstep(0.55, 1, d);
  y += 1.0 * corner ** 3 + 0.26 * smoothstep(0.82, 1, d);
  return y;
}

// 斗拱圈：一斗三升简化（坐斗+拱），InstancedMesh
function buildDougongRing(M, tier, rf, style) {
  const W = tier.W + 1.2, D = tier.D + 1.2;
  const per = [];
  const step = Math.max(1.5, Math.min(2.2, W / 26));
  for (let x = -W / 2 + 0.6; x <= W / 2 - 0.6; x += step) { per.push([x, D / 2]); per.push([x, -D / 2]); }
  const stepZ = Math.max(1.5, Math.min(2.2, D / 12));
  for (let z = -D / 2 + stepZ; z <= D / 2 - stepZ; z += stepZ) { per.push([W / 2, z]); per.push([-W / 2, z]); }
  const box = new THREE.BoxGeometry(0.52, 0.3, 0.52);
  const arm = new THREE.BoxGeometry(1.05, 0.2, 0.3);
  const im1 = new THREE.InstancedMesh(box, M.dougong, per.length);
  const im2 = new THREE.InstancedMesh(arm, M.dougong, per.length);
  const m4 = new THREE.Matrix4();
  per.forEach(([x, z], i) => {
    const front = z > 0;
    m4.makeRotationY(front || z < 0 ? 0 : Math.PI / 2);
    m4.setPosition(x, tier.y0 - 0.32, z);
    im1.setMatrixAt(i, m4);
    const m5 = new THREE.Matrix4();
    m5.makeRotationY(front ? 0 : z < 0 ? Math.PI : Math.PI / 2);
    m5.setPosition(x, tier.y0 - 0.08, z + (front ? 0.28 : z < 0 ? -0.28 : 0));
    im2.setMatrixAt(i, m5);
  });
  im1.instanceMatrix.needsUpdate = true; im2.instanceMatrix.needsUpdate = true;
  const g = new THREE.Group(); g.add(im1, im2);
  return g;
}

// ---------------- 台基（汉白玉须弥座简化：层叠 + 栏杆 + 台阶御路） ----------------
// tiers: [{w,d,h}] 从下往上；朝南(z+)设台阶
export function createTerrace(M, tiers, opts = {}) {
  const g = new THREE.Group();
  let y = opts.y0 || 0;
  const parts = { stone: [], rail: [], posts: [] };
  const stairXs = opts.stairs !== false ? [-0.22, 0, 0.22] : [];
  tiers.forEach((t, ti) => {
    const geo = new THREE.BoxGeometry(t.w, t.h, t.d);
    geo.translate(0, y + t.h / 2, 0);
    parts.stone.push(geo);
    const topY = y + t.h;
    // 栏杆：望柱 + 栏板 沿顶面四周
    const inset = 0.55;
    const w2 = t.w / 2 - inset, d2 = t.d / 2 - inset;
    const postStep = 2.3;
    const rails = [];
    const edges = [
      { from: [-w2, -d2], to: [w2, -d2] }, { from: [-w2, d2], to: [w2, d2] },
      { from: [-w2, -d2], to: [-w2, d2] }, { from: [w2, -d2], to: [w2, d2] },
    ];
    edges.forEach((e) => {
      const dx = e.to[0] - e.from[0], dz = e.to[1] - e.from[1];
      const len = Math.hypot(dx, dz);
      const n = Math.max(1, Math.round(len / postStep));
      for (let i = 0; i <= n; i++) {
        const px = e.from[0] + (dx * i) / n, pz = e.from[1] + (dz * i) / n;
        parts.posts.push([px, topY, pz]);
        if (i < n) {
          const mx = e.from[0] + (dx * (i + 0.5)) / n, mz = e.from[1] + (dz * (i + 0.5)) / n;
          const rg = new THREE.BoxGeometry(len / n - 0.24, 0.16, 0.1);
          rg.translate(mx, topY + 0.44, mz);
          rg.rotateY(-Math.atan2(dz, dx));
          const rg2 = rg.clone(); rg2.translate(0, -0.34, 0);
          rails.push(rg, rg2);
        }
      }
    });
    // 台阶（南立面中央与两侧，逐级下降）+ 御路石雕
    if (ti === 0 && opts.stairs !== false) {
      stairXs.forEach((fx, si) => {
        const sw = si === 1 ? 9 : 5.5;
        const steps = Math.max(4, Math.round(t.h / 0.42));
        const sh = t.h / steps, sd = 1.15;
        for (let i = 0; i < steps; i++) {
          const sg = new THREE.BoxGeometry(sw, sh, sd);
          const topY2 = t.h - sh * i;
          sg.translate(fx * t.w * 0.62, y + topY2 - sh / 2, t.d / 2 + 0.55 + (steps - 1 - i) * sd);
          parts.stone.push(sg);
        }
        // 御路（中央台阶石雕斜面）
        if (si === 1) {
          const run = t.h * 2.4, L = Math.hypot(run, t.h) + 0.8;
          const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, L), M.carved);
          ramp.rotation.x = Math.atan2(t.h, run);
          ramp.position.set(0, y + t.h / 2 + 0.12, t.d / 2 + run / 2 - 0.2);
          g.add(ramp);
        }
      });
    }
    y = topY;
  });

  const merged = mergeGeometries(parts.stone, false);
  const stoneMesh = new THREE.Mesh(merged, M.stone);
  g.add(stoneMesh);
  if (parts.rail.length) g.add(new THREE.Mesh(mergeGeometries(parts.rail, false), M.stoneDark));

  // 望柱（Instanced）
  const postGeo = new THREE.BoxGeometry(0.22, 0.62, 0.22);
  const capGeo = new THREE.BoxGeometry(0.3, 0.12, 0.3);
  const posts = new THREE.InstancedMesh(postGeo, M.stoneDark, parts.posts.length);
  const caps = new THREE.InstancedMesh(capGeo, M.stoneDark, parts.posts.length);
  const m4 = new THREE.Matrix4();
  parts.posts.forEach(([x, py, z], i) => {
    m4.identity(); m4.setPosition(x, py + 0.31, z); posts.setMatrixAt(i, m4);
    m4.setPosition(x, py + 0.68, z); caps.setMatrixAt(i, m4);
  });
  posts.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
  g.add(posts, caps);
  g.userData.topY = y;
  return g;
}

// ---------------- 殿堂 ----------------
// opts: { W,D, bays, bodyH, roof:{style,tiers}, plaque, terraceTiers, name }
export function createHall(M, opts) {
  const g = new THREE.Group();
  const { W, D, bays = 5, bodyH = 7 } = opts;
  const terrace = opts.terrace || null;
  let baseY = 0;

  if (terrace) {
    const t = createTerrace(M, terrace.tiers);
    g.add(t);
    baseY = t.userData.topY;
  } else {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, 1.1, D * 1.02), M.plinth);
    plinth.position.y = 0.55;
    g.add(plinth);
    baseY = 1.1;
  }

  // 墙体
  const wallH = bodyH - 1.2;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, D), M.wall);
  wall.position.y = baseY + wallH / 2;
  g.add(wall);
  // 墙裙
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W + 0.15, 1.0, D + 0.15), M.plinth);
  skirt.position.y = baseY + 0.5;
  g.add(skirt);

  // 柱子（前檐一排 + 后檐一排）
  const colGeo = new THREE.CylinderGeometry(0.34, 0.38, wallH, 10);
  const cols = new THREE.InstancedMesh(colGeo, M.column, bays * 2);
  const m4 = new THREE.Matrix4();
  let ci = 0;
  for (let i = 0; i < bays; i++) {
    const x = -W / 2 + (i * W) / (bays - 1);
    m4.identity(); m4.setPosition(x, baseY + wallH / 2, D / 2 - 0.45); cols.setMatrixAt(ci++, m4);
    m4.setPosition(x, baseY + wallH / 2, -D / 2 + 0.45); cols.setMatrixAt(ci++, m4);
  }
  cols.count = ci; cols.instanceMatrix.needsUpdate = true;
  g.add(cols);

  // 槂扇门窗（前檐每间一块暖光透棂）
  const latticeW = W / bays - 1.15;
  const latticeH = wallH - 1.7;
  const latGeo = new THREE.PlaneGeometry(latticeW, latticeH);
  const latParts = [];
  for (let i = 0; i < bays; i++) {
    const x = (i - (bays - 1) / 2) * (W / bays);
    const p = latGeo.clone();
    p.translate(x, baseY + 1.1 + latticeH / 2, D / 2 + 0.06);
    latParts.push(p);
    const p2 = latGeo.clone();
    p2.rotateY(Math.PI);
    p2.translate(x, baseY + 1.1 + latticeH / 2, -D / 2 - 0.06);
    latParts.push(p2);
  }
  const latMesh = new THREE.Mesh(mergeGeometries(latParts, false), M.lattice);
  g.add(latMesh);

  // 匾额
  if (opts.plaque) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 0.18), M.plaque(opts.plaque));
    pl.position.set(0, baseY + wallH + 1.35, D / 2 + 0.35);
    g.add(pl);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.85, 0.1), M.finial);
    frame.position.set(0, baseY + wallH + 1.35, D / 2 + 0.28);
    g.add(frame);
  }

  // 屋顶
  const roofOpts = opts.roof;
  const roofY0 = baseY + wallH + (roofOpts.eaveGap || 0.55);
  const built = buildRoof(M, {
    style: roofOpts.style || 'hip',
    tiers: roofOpts.tiers || [{ W: W + roofOpts.over || 6, D: D + roofOpts.over || 6, y0: roofY0, h: roofOpts.h || 7 }],
    ridgeFrac: roofOpts.ridgeFrac,
  });
  g.add(built.group);
  g.userData.roofY0 = roofY0;
  g.userData.totalH = (roofOpts.tiers ? roofOpts.tiers[roofOpts.tiers.length - 1].y0 + roofOpts.tiers[roofOpts.tiers.length - 1].h : roofY0 + (roofOpts.h || 7));
  return g;
}

// ---------------- 城台 + 门楼（神武门/午门主楼） ----------------
export function createGateTower(M, opts) {
  const g = new THREE.Group();
  const { W = 70, D = 22, wallH = 10, archN = 3 } = opts;
  // 城台
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, D), M.wall);
  base.position.y = wallH / 2;
  g.add(base);
  // 台顶檐口线脚
  const band = new THREE.Mesh(new THREE.BoxGeometry(W + 1.6, 0.9, D + 1.6), M.ridge);
  band.position.y = wallH - 0.45;
  g.add(band);
  // 拱形门洞（深色）
  for (let i = 0; i < archN; i++) {
    const x = (i - (archN - 1) / 2) * (W * 0.26);
    const arch = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 6.2), M.archDark);
    arch.position.set(x, 3.1, D / 2 + 0.05);
    g.add(arch);
    const archT = arch.clone(); archT.rotation.y = Math.PI; archT.position.z = -D / 2 - 0.05;
    g.add(archT);
  }
  // 城楼：重檐庑殿
  const roof = buildRoof(M, {
    style: 'hip',
    tiers: [
      { W: W * 0.72, D: D * 0.9, y0: wallH + 0.9, h: 5.5 },
      { W: W * 0.58, D: D * 0.78, y0: wallH + 0.9 + 4.6, h: 5.2 },
    ],
    ridgeFrac: 0.5,
  });
  g.add(roof.group);
  // 城楼墙体
  const tw = new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, 6.4, D * 0.82), M.wall);
  tw.position.y = wallH + 4.1;
  g.add(tw);
  // 城楼槂扇
  const lg = new THREE.PlaneGeometry(W * 0.5, 3.6);
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * (W * 0.12);
    const p = lg.clone(); p.translate(x, wallH + 4.2, D * 0.42 + 0.06);
    g.add(new THREE.Mesh(p, M.latticeDim));
    const p2 = lg.clone(); p2.rotateY(Math.PI); p2.translate(x, wallH + 4.2, -D * 0.42 - 0.06);
    g.add(new THREE.Mesh(p2, M.latticeDim));
  }
  g.userData.topY = wallH;
  return g;
}

// ---------------- 角楼（十字脊三重檐，简化意象） ----------------
export function createCornerTower(M) {
  const g = new THREE.Group();
  const bodyH = 9, core = 11, arm = 13, armLen = 17;
  // 十字形平面主体
  const parts = [];
  const c1 = new THREE.BoxGeometry(core + armLen * 2, bodyH, core); c1.translate(0, bodyH / 2, 0);
  const c2 = new THREE.BoxGeometry(core, bodyH, core + armLen * 2); c2.translate(0, bodyH / 2, 0);
  parts.push(c1, c2);
  g.add(new THREE.Mesh(mergeGeometries(parts, false), M.wall));
  // 三层屋檐：大庑殿 → 小庑殿 → 攒尖宝顶
  const r1 = buildRoof(M, { style: 'hip', tiers: [{ W: core + armLen * 2 + 7, D: core + armLen * 2 + 7, y0: bodyH + 0.6, h: 5 }], ridgeFrac: 0.56 });
  g.add(r1.group);
  const r2 = buildRoof(M, { style: 'hip', tiers: [{ W: core + armLen + 5, D: core + armLen + 5, y0: bodyH + 4.6, h: 4 }], ridgeFrac: 0.58 });
  g.add(r2.group);
  const r3 = buildRoof(M, { style: 'pyramid', tiers: [{ W: core + 3, D: core + 3, y0: bodyH + 8.4, h: 4.6 }] });
  g.add(r3.group);
  // 暖光窗
  const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), M.latticeDim);
  win.position.set(0, bodyH * 0.55, core / 2 + armLen + 0.1);
  g.add(win);
  g.userData.topY = bodyH + 8.4;
  return g;
}

// ---------------- 城墙段（带垛口） ----------------
export function createWall(M, len, h = 10, th = 8, merlonH = 1.7, merlonW = 2.4, gap = 2.6) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, h, th), M.wall);
  wall.position.y = h / 2;
  g.add(wall);
  // 墙顶步道
  const walk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, th - 1.6), M.plinth);
  walk.position.y = h + 0.25;
  g.add(walk);
  // 垛口（内侧一排）
  const n = Math.floor(len / (merlonW + gap));
  const merlons = new THREE.InstancedMesh(new THREE.BoxGeometry(merlonW, merlonH, 0.7), M.merlon, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m4.identity();
    m4.setPosition(-len / 2 + (i + 0.5) * (merlonW + gap), h + 0.5 + merlonH / 2, th / 2 - 0.7);
    merlons.setMatrixAt(i, m4);
  }
  merlons.instanceMatrix.needsUpdate = true;
  g.add(merlons);
  g.userData = { h, len, th };
  return g;
}

// ---------------- 内金水桥（单孔/三孔石拱桥） ----------------
export function createBridge(M, opts = {}) {
  const g = new THREE.Group();
  const { w = 10, len = 13, arches = 1, rise = 1.6 } = opts;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, len / 2); shape.lineTo(-w / 2, len / 2); shape.closePath();
  if (arches >= 1) {
    const hole = new THREE.Path();
    const aw = Math.min(3.2, w * 0.22);
    hole.moveTo(-aw, 0); hole.lineTo(-aw, rise);
    hole.absarc(0, rise, aw, Math.PI, 0, true);
    hole.lineTo(aw, 0); hole.closePath();
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, M.bridgeArch);
  mesh.position.y = 0.12;
  g.add(mesh);
  // 桥栏
  [-1, 1].forEach((s) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, len), M.stoneDark);
    rail.position.set(s * (w / 2 - 0.3), 0.95, 0);
    g.add(rail);
    const n = Math.floor(len / 2.4);
    for (let i = 0; i <= n; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.26), M.stoneDark);
      post.position.set(s * (w / 2 - 0.3), 1.55, -len / 2 + (i * len) / n);
      g.add(post);
    }
  });
  // 桥头暖光
  return g;
}

// ---------------- 宫灯（落地灯杆 + 灯笼） ----------------
export function createLampPost(M, opts = {}) {
  const g = new THREE.Group();
  const h = opts.h || 6.5;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, h, 8), M.dougong);
  pole.position.y = h / 2;
  g.add(pole);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.16), M.dougong);
  cross.position.y = h - 0.25;
  g.add(cross);
  // 横杆两端挂灯笼
  [-1.25, 1.25].forEach((x) => {
    const lan = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), M.lanternRed);
    body.scale.y = 0.82;
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.12, 8), M.finial); capT.position.y = 0.42;
    const capB = capT.clone(); capB.position.y = -0.42;
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.5, 6), M.finial); tassel.position.y = -0.72;
    lan.add(body, capT, capB, tassel);
    lan.position.set(x, h - 0.85, 0);
    g.add(lan);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), M.dougong);
    hook.position.set(x, h - 0.35, 0);
    g.add(hook);
  });
  return g;
}

// ---------------- 檐下挂灯笼排 ----------------
export function eaveLanternRow(M, x0, x1, y, z, n) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    const lan = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M.lanternRed);
    lan.scale.y = 0.8;
    lan.position.set(x, y, z);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), M.eaveBoard);
    wire.position.set(x, y + 0.55, z);
    g.add(lan, wire);
  }
  return g;
}
