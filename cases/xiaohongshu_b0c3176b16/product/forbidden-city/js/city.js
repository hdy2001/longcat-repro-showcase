// ============================================================
// city.js — 故宫总平面：中轴前朝后寝 + 东西六宫 + 午门/神武门
// 坐标：中轴沿 Z，南 = +Z；单位米；地面 y=0
// ============================================================
import * as THREE from 'three';
import { createHall, createTerrace, createGateTower, createCornerTower, createWall, createBridge, createLampPost, eaveLanternRow, buildRoof } from './arch.js';

// ---------------- 庭院（东西六宫模数） ----------------
function createCourtyard(M, cx, cz, w, d, opts = {}) {
  const g = new THREE.Group();
  const wallH = 3.2, th = 0.8;
  const gateW = opts.gateW || 8;
  // 围墙（南墙留门）
  const mk = (len, x, z, rot) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, th), M.wall);
    m.position.set(x, wallH / 2, z); m.rotation.y = rot;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.5, th + 0.7), M.ridge);
    cap.position.set(x, wallH + 0.25, z); cap.rotation.y = rot;
    g.add(m, cap);
  };
  mk(w, 0, -d / 2, 0); mk(w, 0, d / 2, 0);
  mk(d, -w / 2, 0, Math.PI / 2); mk(d, w / 2, 0, Math.PI / 2);
  // 正房（北，坐北朝南）
  const main = createHall(M, {
    W: opts.mainW || 17, D: 9.5, bays: 5, bodyH: 4.6,
    roof: { style: 'xieshan', h: 4.2, over: 3.5, tiers: [{ W: opts.mainW || 17, D: 13, y0: 4.6 + 0.6, h: 4.2 }, { W: (opts.mainW || 17) * 0.7, D: 9.5, y0: 4.6 + 0.6 + 3.6, h: 3.4 }] },
  });
  main.position.set(0, 0, -d / 2 + 6);
  g.add(main);
  // 东西厢房
  [-1, 1].forEach((s) => {
    const side = createHall(M, {
      W: 9, D: 5.5, bays: 3, bodyH: 3.4,
      roof: { style: 'hip', h: 3.2, over: 2.5 },
    });
    side.rotation.y = s * Math.PI / 2;
    side.position.set(s * (w / 2 - 5.5), 0, 0);
    g.add(side);
  });
  // 院门（南）
  const gate = createHall(M, {
    W: gateW, D: 6, bays: 3, bodyH: 3.6,
    roof: { style: 'xieshan', h: 3, over: 2.5 },
  });
  gate.position.set(0, 0, d / 2 - 4);
  g.add(gate);
  g.position.set(cx, 0, cz);
  return g;
}

// ---------------- 主殿快速定义 ----------------
function mainHall(M, x, z, def) {
  const h = createHall(M, def);
  h.position.set(x, 0, z);
  return h;
}

// ---------------- 树 ----------------
export function createTree(M, x, z, s = 1, opts = {}) {
  const g = new THREE.Group();
  const h = (3.2 + Math.random() * 1.6) * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, h * 0.62, 7), M.bark);
  trunk.position.y = h * 0.31;
  g.add(trunk);
  const n = 2 + (Math.random() * 2 | 0);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const r = (1.7 + Math.random() * 1.1) * s;
    const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), opts.lit ? M.foliageLit : M.foliage);
    blob.position.set((Math.random() - 0.5) * 1.8 * s, h * (0.62 + 0.28 * i / n) + r * 0.3, (Math.random() - 0.5) * 1.8 * s);
    blob.scale.y = 0.82;
    blobs.push(blob);
    g.add(blob);
  }
  g.position.set(x, 0, z);
  g.userData.canopyY = h * 0.8;
  g.userData.canopyR = 1.9 * s;
  return g;
}

// ============================================================
export function buildCity(scene, M) {
  const root = new THREE.Group();
  const colliders = [];   // {minX,maxX,minZ,maxZ,top}
  const walkTiers = [];   // 可站立面 {minX,maxX,minZ,maxZ,top}
  const trees = [];
  const animated = [];
  const glowAnchors = []; // 英雄光晕位置 {pos:Vector3, scale, color}

  const addCol = (x, z, w, d, top) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top });
  const addWalk = (x, z, w, d, top) => { walkTiers.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top }); addCol(x, z, w, d, top); };

  // ============ 中轴建筑（南→北） ============
  const axis = new THREE.Group();

  // ---- 午门（凹字形：主楼 + 两翼 + 阙亭） ----
  {
    const wumen = createGateTower(M, { W: 122, D: 26, wallH: 10, archN: 3 });
    wumen.position.set(0, 0, 452);
    axis.add(wumen);
    addCol(0, 452, 122, 26, 20);
    // 两翼（斜向南展开）+ 端部崇楼
    [-1, 1].forEach((s) => {
      const x0 = s * 52, x1 = s * 148;
      const z0 = 452, z1 = 424;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const wing = createWall(M, len, 6.5, 6);
      wing.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      wing.rotation.y = -Math.atan2(z1 - z0, x1 - x0) + (s > 0 ? Math.PI : 0);
      axis.add(wing);
      const end = createHall(M, {
        W: 17, D: 12, bays: 5, bodyH: 5,
        roof: { style: 'xieshan', h: 4.5, over: 3.5, tiers: [{ W: 19, D: 15, y0: 5.6, h: 4.5 }, { W: 13, D: 10, y0: 9.4, h: 3.6 }] },
      });
      end.position.set(x1, 0, z1);
      end.rotation.y = s > 0 ? -0.42 : Math.PI + 0.42;
      axis.add(end);
      addCol(x1, z1, 17, 12, 10);
    });
    // 阙亭（明楼两侧）
    [-1, 1].forEach((s) => {
      const q = createHall(M, {
        W: 10, D: 10, bays: 3, bodyH: 4.5,
        roof: { style: 'pyramid', h: 4.2, over: 3 },
      });
      q.position.set(s * 76, 0, 428);
      axis.add(q);
      addCol(s * 76, 428, 10, 10, 10);
    });
  }

  // ---- 内金水桥 ----
  for (let i = 0; i < 5; i++) {
    const x = -120 + i * 60;
    const b = createBridge(M, { w: i === 2 ? 14 : 9, len: 15, arches: i === 2 ? 2 : 1, rise: i === 2 ? 1.9 : 1.5 });
    b.position.set(x, 0, 408 + Math.sin((i / 4) * Math.PI * 2) * 3 - 3 * (i / 4));
    b.rotation.y = Math.PI / 2;
    axis.add(b);
    addWalk(x, 408, i === 2 ? 13 : 8.5, 15, 1.35);
  }

  // ---- 太和门 ----
  axis.add(mainHall(M, 0, 352, {
    W: 62, D: 24, bays: 9, bodyH: 8,
    plaque: '太和门',
    terrace: { tiers: [{ w: 46, d: 22, h: 2.6 }] },
    roof: {
      style: 'hip', h: 6, over: 6.5,
      tiers: [
        { W: 69, D: 31, y0: 2.6 + 8 + 0.6, h: 6 },
        { W: 57, D: 25, y0: 2.6 + 8 + 0.6 + 5.2, h: 5.5 },
      ],
    },
  }));
  addWalk(0, 352, 46, 22, 2.6);

  // ---- 太和殿（三台重檐庑殿） ----
  {
    const h = mainHall(M, 0, 285, {
      W: 60, D: 32, bays: 11, bodyH: 10,
      plaque: '太和殿',
      terrace: { tiers: [{ w: 80, d: 54, h: 2.8 }, { w: 75, d: 49, h: 2.8 }, { w: 70, d: 44, h: 2.8 }] },
      roof: {
        style: 'hip', h: 6.5, over: 7,
        tiers: [
          { W: 69, D: 41, y0: 8.4 + 10 + 0.6, h: 6.5 },
          { W: 57, D: 33, y0: 8.4 + 10 + 0.6 + 5.6, h: 6 },
        ],
      },
    });
    axis.add(h);
    addWalk(0, 285, 80, 54, 2.8); addWalk(0, 285, 75, 49, 5.6); addWalk(0, 285, 70, 44, 8.4);
    glowAnchors.push({ pos: new THREE.Vector3(0, 8.4 + 8, 285 + 24), scale: 9, color: 'red' });
    glowAnchors.push({ pos: new THREE.Vector3(-20, 12, 300), scale: 5, color: 'warm' });
    glowAnchors.push({ pos: new THREE.Vector3(20, 12, 300), scale: 5, color: 'warm' });
  }

  // ---- 中和殿（四角攒尖） ----
  axis.add(mainHall(M, 0, 205, {
    W: 22, D: 22, bays: 5, bodyH: 8,
    plaque: '中和殿',
    terrace: { tiers: [{ w: 34, d: 34, h: 2.4 }] },
    roof: { style: 'pyramid', h: 7, over: 4 },
  }));
  addWalk(0, 205, 34, 34, 2.4);

  // ---- 保和殿（重檐歇山） ----
  axis.add(mainHall(M, 0, 140, {
    W: 56, D: 30, bays: 9, bodyH: 9,
    plaque: '保和殿',
    terrace: { tiers: [{ w: 54, d: 36, h: 2.6 }, { w: 49, d: 32, h: 2.6 }] },
    roof: {
      style: 'xieshan', h: 6, over: 6.5,
      tiers: [
        { W: 64, D: 38, y0: 5.2 + 9 + 0.6, h: 6 },
        { W: 50, D: 28, y0: 5.2 + 9 + 0.6 + 5.2, h: 5.5 },
      ],
    },
  }));
  addWalk(0, 140, 54, 36, 2.6); addWalk(0, 140, 49, 32, 5.2);

  // ---- 乾清门 ----
  axis.add(mainHall(M, 0, 62, {
    W: 40, D: 16, bays: 7, bodyH: 6.5,
    plaque: '乾清门',
    terrace: { tiers: [{ w: 32, d: 17, h: 2.2 }] },
    roof: { style: 'hip', h: 6, over: 5 },
  }));
  addWalk(0, 62, 32, 17, 2.2);

  // ---- 乾清宫 ----
  axis.add(mainHall(M, 0, -15, {
    W: 44, D: 24, bays: 9, bodyH: 8.5,
    plaque: '乾清宫',
    terrace: { tiers: [{ w: 48, d: 30, h: 2.6 }, { w: 44, d: 27, h: 2.6 }] },
    roof: {
      style: 'hip', h: 6, over: 6,
      tiers: [
        { W: 52, D: 31, y0: 5.2 + 8.5 + 0.6, h: 6 },
        { W: 42, D: 24, y0: 5.2 + 8.5 + 0.6 + 5.2, h: 5.5 },
      ],
    },
  }));
  addWalk(0, -15, 48, 30, 2.6); addWalk(0, -15, 44, 27, 5.2);

  // ---- 交泰殿 ----
  axis.add(mainHall(M, 0, -58, {
    W: 18, D: 18, bays: 5, bodyH: 7,
    plaque: '交泰殿',
    terrace: { tiers: [{ w: 24, d: 20, h: 2.0 }] },
    roof: { style: 'pyramid', h: 7, over: 3.5 },
  }));
  addWalk(0, -58, 24, 20, 2.0);

  // ---- 坤宁宫 ----
  axis.add(mainHall(M, 0, -105, {
    W: 42, D: 24, bays: 9, bodyH: 8,
    plaque: '坤宁宫',
    terrace: { tiers: [{ w: 46, d: 28, h: 2.5 }, { w: 42, d: 25, h: 2.5 }] },
    roof: {
      style: 'hip', h: 6, over: 6,
      tiers: [
        { W: 50, D: 31, y0: 5 + 8 + 0.6, h: 6 },
        { W: 40, D: 24, y0: 5 + 8 + 0.6 + 5.2, h: 5.5 },
      ],
    },
  }));
  addWalk(0, -105, 46, 28, 2.5); addWalk(0, -105, 42, 25, 5.0);

  // ============ 御花园 ============
  {
    const garden = new THREE.Group();
    // 钦安殿
    const qin = mainHall(M, 0, -195, {
      W: 22, D: 18, bays: 5, bodyH: 7,
      plaque: '钦安殿',
      terrace: { tiers: [{ w: 27, d: 23, h: 2.2 }] },
      roof: { style: 'pyramid', h: 6.5, over: 3.5 },
    });
    garden.add(qin);
    addWalk(0, -195, 27, 23, 2.2);
    // 天一门
    const tym = mainHall(M, 0, -152, {
      W: 15, D: 10, bays: 5, bodyH: 4.5,
      roof: { style: 'xieshan', h: 3.5, over: 3 },
    });
    garden.add(tym);
    addCol(0, -152, 15, 10, 8);
    // 千秋亭 / 万春亭
    [-1, 1].forEach((s) => {
      const p = createHall(M, {
        W: 9.5, D: 9.5, bays: 3, bodyH: 4,
        roof: { style: 'pyramid', h: 4.6, over: 2.8 },
      });
      p.position.set(s * 36, 0, -195);
      garden.add(p);
      addCol(s * 36, -195, 9.5, 9.5, 9);
    });
    // 堆秀山（假山）
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(7, 1), M.rock);
    rock.scale.set(1.2, 0.85, 1.1);
    rock.position.set(0, 2.5, -245);
    garden.add(rock);
    addCol(0, -245, 15, 13, 6);
    // 园门（北）
    const ng = createHall(M, {
      W: 12, D: 8, bays: 3, bodyH: 3.8,
      roof: { style: 'hip', h: 3.2, over: 2.5 },
    });
    ng.position.set(0, 0, -262);
    garden.add(ng);
    addCol(0, -262, 12, 8, 7);
    // 园中树木
    const treePos = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 28 + (i % 3) * 12;
      treePos.push([Math.cos(a) * r + (Math.random() - 0.5) * 6, -200 + Math.sin(a) * r * 0.45 + (Math.random() - 0.5) * 8]);
    }
    treePos.push([-14, -165], [16, -168], [-24, -225], [22, -222], [0, -172]);
    treePos.forEach(([x, z]) => {
      const t = createTree(M, x, z, 0.9 + Math.random() * 0.5, { lit: true });
      garden.add(t);
      trees.push({ x, z, canopyY: t.userData.canopyY, canopyR: t.userData.canopyR });
    });
    axis.add(garden);
  }

  // ---- 神武门（北） ----
  {
    const sm = createGateTower(M, { W: 76, D: 22, wallH: 10, archN: 1 });
    sm.position.set(0, 0, -412);
    axis.add(sm);
    addCol(0, -412, 76, 22, 20);
  }

  // ---- 东华门 / 西华门 ----
  [-1, 1].forEach((s) => {
    const g = createGateTower(M, { W: 20, D: 14, wallH: 10, archN: 1 });
    g.rotation.y = s * Math.PI / 2;
    g.position.set(s * 370, 0, 60);
    axis.add(g);
    addCol(s * 370, 60, 14, 20, 20);
  });

  root.add(axis);

  // ============ 文华殿 / 武英殿 ============
  [[1, '文华殿'], [-1, '武英殿']].forEach(([s, name]) => {
    const h = mainHall(M, s * 165, 330, {
      W: 38, D: 20, bays: 7, bodyH: 6,
      plaque: name,
      terrace: { tiers: [{ w: 44, d: 25, h: 2.2 }] },
      roof: { style: 'xieshan', h: 5, over: 5, tiers: [{ W: 43, D: 25, y0: 2.2 + 6 + 0.6, h: 5 }, { W: 32, D: 18, y0: 2.2 + 6 + 0.6 + 4.4, h: 4 }] },
    });
    root.add(h);
    addWalk(s * 165, 330, 44, 25, 2.2);
  });

  // ============ 东西六宫 ============
  const palaceNames = ['储秀宫', '翊坤宫', '咸福宫', '长春宫', '启祥宫', '永和宫'];
  for (let side = -1; side <= 1; side += 2) {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = side * (150 + c * 62);
        const cz = -20 - r * 78;
        const court = createCourtyard(M, cx, cz, 52, 66);
        root.add(court);
        addCol(cx, cz - 30, 52, 10, 5); // 正房
        addCol(cx, cz + 28, 52, 8, 4.5); // 院门
        addCol(cx - 22, cz, 8, 52, 3.6); // 西厢
        addCol(cx + 22, cz, 8, 52, 3.6); // 东厢
        glowAnchors.push({ pos: new THREE.Vector3(cx, 4, cz + 26), scale: 3.5, color: 'warm' });
      }
    }
    // 宫墙间长房（廊房）
    for (let i = 0; i < 6; i++) {
      const z = 130 - i * 52;
      const lang = createHall(M, {
        W: 12, D: 6.5, bays: 4, bodyH: 3.2,
        roof: { style: 'hip', h: 3, over: 2 },
      });
      lang.rotation.y = side * Math.PI / 2;
      lang.position.set(side * 340, 0, z);
      root.add(lang);
      addCol(side * 340, z, 6.5, 12, 6);
    }
  }

  // ============ 慈宁宫 / 宁寿宫 ============
  [[-1, '慈宁宫'], [1, '宁寿宫']].forEach(([s, name]) => {
    const h = mainHall(M, s * 190, -230, {
      W: 40, D: 22, bays: 7, bodyH: 7,
      plaque: name,
      terrace: { tiers: [{ w: 46, d: 27, h: 2.4 }] },
      roof: { style: 'hip', h: 5.5, over: 5.5 },
    });
    root.add(h);
    addWalk(s * 190, -230, 46, 27, 2.4);
    // 花园角楼亭
    const p = createHall(M, {
      W: 10, D: 10, bays: 3, bodyH: 4,
      roof: { style: 'pyramid', h: 4, over: 2.6 },
    });
    p.position.set(s * 255, 0, -245);
    root.add(p);
    addCol(s * 255, -245, 10, 10, 8.5);
  });

  // ============ 角楼 ×4 ============
  [[-370, 470], [370, 470], [-370, -430], [370, -430]].forEach(([x, z]) => {
    const t = createCornerTower(M);
    t.position.set(x, 10, z);
    root.add(t);
    addCol(x, z, 42, 42, 20);
  });

  // ============ 中轴线树木（火树银花载体） ============
  const axisTrees = [];
  for (let z = 390; z > -135; z -= 27) {
    [-1, 1].forEach((s) => {
      const x = s * (19 + Math.random() * 3);
      const t = createTree(M, x, z + (Math.random() - 0.5) * 6, 1.05 + Math.random() * 0.35, { lit: true });
      root.add(t);
      trees.push({ x, z, canopyY: t.userData.canopyY, canopyR: t.userData.canopyR });
      axisTrees.push({ x, z, canopyY: t.userData.canopyY, canopyR: t.userData.canopyR });
    });
  }
  // 古柏（西侧）
  for (let i = 0; i < 8; i++) {
    const x = -250 - Math.random() * 60, z = -140 - Math.random() * 160;
    const t = createTree(M, x, z, 1.5, { lit: false });
    root.add(t);
    trees.push({ x, z, canopyY: t.userData.canopyY, canopyR: t.userData.canopyR });
  }
  // 午门前广场树
  for (let i = 0; i < 10; i++) {
    const s = i % 2 ? 1 : -1;
    const x = s * (55 + (i % 3) * 22), z = 480 + (i % 5) * 14;
    const t = createTree(M, x, z, 0.95, { lit: true });
    root.add(t);
    trees.push({ x, z, canopyY: t.userData.canopyY, canopyR: t.userData.canopyR });
  }

  // ============ 宫灯杆（中轴） ============
  for (let z = 430; z > -210; z -= 30) {
    [-1, 1].forEach((s) => {
      const lp = createLampPost(M, { h: 6.5 });
      lp.position.set(s * 12.5, 0, z);
      root.add(lp);
    });
  }
  // 内金水桥灯
  for (let i = 0; i < 5; i++) {
    [-1, 1].forEach((s) => {
      const lp = createLampPost(M, { h: 5.5 });
      lp.position.set(-120 + i * 60 + s * 8, 0, 398);
      root.add(lp);
    });
  }

  // ============ 檐下灯笼排（主殿） ======
  const eaveRows = [
    { z: 352, W: 62, baseY: 2.6 + 8, D: 24, n: 7 },   // 太和门
    { z: 285, W: 60, baseY: 8.4 + 10, D: 32, n: 9 },  // 太和殿
    { z: 140, W: 56, baseY: 5.2 + 9, D: 30, n: 7 },   // 保和殿
    { z: -15, W: 44, baseY: 5.2 + 8.5, D: 24, n: 7 },  // 乾清宫
    { z: -105, W: 42, baseY: 5 + 8, D: 24, n: 7 },     // 坤宁宫
    { z: 62, W: 40, baseY: 2.2 + 6.5, D: 16, n: 5 },  // 乾清门
  ];
  eaveRows.forEach((r) => {
    const row = eaveLanternRow(M, -r.W / 2 + 3, r.W / 2 - 3, r.baseY + 0.4, r.z + r.D / 2 + 0.75, r.n);
    root.add(row);
  });
  // 午门城楼灯笼
  root.add(eaveLanternRow(M, -40, 40, 14.5, 452 + 13.6, 9));

  // 收集树的装饰灯（fx 使用）
  root.userData.axisTrees = axisTrees;
  root.userData.trees = trees;
  root.userData.glowAnchors = glowAnchors;
  root.userData.colliders = colliders;
  root.userData.walkTiers = walkTiers;
  scene.add(root);

  // 地面高度查询（含台阶坡道）
  function groundHeightAt(x, z, curY = 0) {
    let g = 0;
    // 台基层
    for (const t of walkTiers) {
      if (x >= t.minX && x <= t.maxX && z >= t.minZ && z <= t.maxZ) {
        if (t.top <= curY + 1.0 && t.top > g) g = t.top;
      }
    }
    // 台阶坡（南侧）：太和殿三台、主殿前
    const stairs = [
      { x: 0, z: 285, w: 24, top: 8.4, dir: 1 }, { x: 0, z: 140, w: 20, top: 5.2, dir: 1 },
      { x: 0, z: 352, w: 20, top: 2.6, dir: 1 }, { x: 0, z: 62, w: 16, top: 2.2, dir: 1 },
      { x: 0, z: -15, w: 20, top: 5.2, dir: 1 }, { x: 0, z: -105, w: 18, top: 5, dir: 1 },
      { x: 0, z: -195, w: 14, top: 2.2, dir: 1 }, { x: 165, z: 330, w: 18, top: 2.2, dir: 1 },
      { x: -165, z: 330, w: 18, top: 2.2, dir: 1 }, { x: 0, z: -58, w: 12, top: 2.0, dir: 1 },
    ];
    for (const s of stairs) {
      const half = s.w / 2 + 14;
      if (Math.abs(x - s.x) < half && z > s.z + 0 && z < s.z + 12) {
        // 从 z=s.z+12(地面) 升到 z=s.z(台面)
        const t = Math.min(1, Math.max(0, (s.z + 12 - z) / 12));
        const h = t * s.top;
        if (h <= curY + 1.0 && h > g) g = h;
      }
    }
    return g;
  }

  function collide(px, pz, py, radius = 0.6) {
    for (const c of colliders) {
      if (py > c.top - 0.9) continue; // 可以从上方站上
      const nx = Math.max(c.minX, Math.min(px, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - nx, dz = pz - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 < 1e-6) { // 在盒内：往最近边推出
          const pushL = px - c.minX, pushR = c.maxX - px, pushB = pz - c.minZ, pushF = c.maxZ - pz;
          const m = Math.min(pushL, pushR, pushB, pushF);
          if (m === pushL) px = c.minX - radius; else if (m === pushR) px = c.maxX + radius;
          else if (m === pushB) pz = c.minZ - radius; else pz = c.maxZ + radius;
        } else {
          const d = Math.sqrt(d2);
          px = nx + (dx / d) * radius;
          pz = nz + (dz / d) * radius;
        }
      }
    }
    // 世界边界
    px = Math.max(-520, Math.min(520, px));
    pz = Math.max(-560, Math.min(560, pz));
    return [px, pz];
  }

  return { root, colliders, walkTiers, trees, groundHeightAt, collide };
}
