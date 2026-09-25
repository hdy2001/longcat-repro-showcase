// ============================================================
// 故宫城格局：宫墙 / 护城河 / 广场 / 内金水河桥 / 中轴建筑群 / 东西六宫
// ============================================================
import * as THREE from 'three';
import { CFG, PAL } from './config.js';
import { hipRoofGeo } from './roof.js';

export function buildCity(kit, M) {
  const kitExtra = kit._extra = [];
  const g = (geo, mat, x, y, z) => kit._geo(geo, mat, x, y, z);
  const box = (mat, w, h, d, x, y, z) => kit.box(mat, w, h, d, x, y, z);
  const cyl = (mat, r1, r2, h, x, y, z, s) => kit.cyl(mat, r1, r2, h, x, y, z, s);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- 地面 ----------
  box('ground', 1500, 0.1, 1500, 0, -0.05, 0);
  // 外朝广场（太和门—三台）
  box('plaza', 210, 0.12, 250, 0, 0.06, 165);
  // 午门前广场
  box('plaza', 260, 0.12, 90, 0, 0.06, 440);
  // 内廷广场
  box('plaza', 120, 0.12, 130, 0, 0.06, -105);
  // 御花园地面
  box('plaza', 130, 0.12, 120, 0, 0.06, -392);

  // ---------- 护城河（环绕，南面最宽） ----------
  const moat = CFG.moat.w, wx = CFG.wall.x, wz = CFG.wall.z;
  box('water', wx * 2 + moat * 2 + 60, 0.1, moat, 0, -0.35, wz + moat / 2 + 4);
  box('water', wx * 2 + moat * 2 + 60, 0.1, moat, 0, -0.35, -wz - moat / 2 - 4);
  box('water', moat, 0.1, wz * 2, wx + moat / 2 + 4, -0.35, 0);
  box('water', moat, 0.1, wz * 2, -wx - moat / 2 - 4, -0.35, 0);
  // 河岸金色灯线
  for (const s of [1, -1]) {
    kit.trim([V3(-wx - moat, 0.15, s * (wz + 2)), V3(wx + moat, 0.15, s * (wz + 2))], 0.14);
    kit.trim([V3(s * (wx + 2), 0.15, -wz - moat), V3(s * (wx + 2), 0.15, wz + moat)], 0.14);
  }

  // ---------- 宫墙 ----------
  const wallT = CFG.wall.t, wallH = CFG.wall.h;
  box('wall', wx * 2 + wallT * 2, wallH, wallT, 0, wallH / 2, wz);
  box('wall', wx * 2 + wallT * 2, wallH, wallT, 0, wallH / 2, -wz);
  box('wall', wallT, wallH, wz * 2 - wallT * 2, wx, wallH / 2, 0);
  box('wall', wallT, wallH, wz * 2 - wallT * 2, -wx, wallH / 2, 0);
  // 墙顶金色压顶灯带（视觉证据：城墙顶部金色线条）
  for (const s of [1, -1]) {
    kit.trim([V3(-wx, wallH + 0.25, s * wz), V3(wx, wallH + 0.25, s * wz)], 0.18);
    kit.trim([V3(s * wx, wallH + 0.25, -wz), V3(s * wx, wallH + 0.25, wz)], 0.18);
  }
  // 垛口（城墙顶部锯齿）
  {
    const merlon = new THREE.BoxGeometry(1.0, 0.85, 0.55);
    const spots = [];
    for (let x = -wx; x <= wx; x += 2.6) { spots.push([x, wz - 0.3], [x, -wz + 0.3]); }
    for (let z = -wz + 2.6; z <= wz - 2.6; z += 2.6) { spots.push([wx - 0.3, z], [-wx + 0.3, z]); }
    const imM = new THREE.InstancedMesh(merlon, M.wallDark, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, z], i) => { m4.identity().setPosition(x, wallH + 0.42, z); imM.setMatrixAt(i, m4); });
    imM.instanceMatrix.needsUpdate = true;
    kitExtra.push(imM);
  }

  // ---------- 午门（凹字形门楼 + 两翼） ----------
  kit.gate({ x: 0, z: 398, W: 118, D: 46, baseH: 12, gates: 3, double: true, roofH: 12, hallH: 14 });
  // 雁翅楼（两翼向前伸出）
  for (const s of [1, -1]) {
    kit.box('wallDark', 30, 9, 24, s * 46, 4.5, 414);
    kit.parts.roof.push(hipRoofGeo(32, 26, 9, 15, 8, {}).translate(s * 46, 0, 414));
    kit.trim([V3(s * 46 - 16, 9.2, 414 - 13), V3(s * 46 + 16, 9.2, 414 - 13)], 0.1);
    kit.trim([V3(s * 46 - 16, 9.2, 414 + 13), V3(s * 46 + 16, 9.2, 414 + 13)], 0.1);
  }

  // ---------- 内金水河（弧形） + 五桥 ----------
  const river = riverGeo();
  g(river, 'water', 0, 0.02, 0);
  for (const s of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const x = -210 + (i / 24) * 420; pts.push(V3(x, 0.15, riverZ(x) + s * 4.6)); }
    kit.trim(pts, 0.12);
  }
  for (const bx of [-150, -75, 0, 75, 150]) {
    // 拱桥：微拱桥面 + 栏板
    const deck = new THREE.BoxGeometry(5.2, 0.8, 15, 1, 1, 4);
    const p = deck.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i); p.setY(i, p.getY(i) + Math.cos((z / 7.5) * Math.PI * 0.5) * 0.9);
    }
    deck.computeVertexNormals();
    g(deck, 'marble', bx, 0.9, riverZ(bx));
    for (const s of [1, -1]) {
      box('marble', 0.5, 1.1, 15, bx + s * 2.35, 1.8, riverZ(bx));
      kit.trim([V3(bx + s * 2.35, 2.5, riverZ(bx) - 7.5), V3(bx + s * 2.35, 2.5, riverZ(bx) + 7.5)], 0.08);
    }
  }

  // ---------- 三台 + 太和殿 ----------
  const tiers = [{ w: 178, d: 118, h: 1.15 }, { w: 156, d: 100, h: 1.15 }, { w: 134, d: 84, h: 1.3 }];
  let ty = 0;
  for (const t of tiers) {
    kit.box('marble', t.w, t.h, t.d, 0, ty + t.h / 2, 96);
    // 每层栏板
    railRect(kit, t.w + 0.8, t.d + 0.8, ty + t.h + 0.55);
    ty += t.h;
  }
  // 御道（中央斜坡，两侧金色灯条）
  box('marble', 7, 0.5, 110, 0, ty + 0.22, 40);
  kit.trim([V3(-3.5, ty + 0.55, -14), V3(-3.5, ty + 0.55, 94)], 0.12);
  kit.trim([V3(3.5, ty + 0.55, -14), V3(3.5, ty + 0.55, 94)], 0.12);
  // 太和殿（无自带台基，台基已建）
  kit.hall({ x: 0, z: 96, W: 58, D: 30, wallH: 15, roof: 'hip', double: true, roofH: 13.5, doorW: 6.5, winH: 5.0, terrace: null });
  kit.parts.marble.push(new THREE.BoxGeometry(58 + 5, 1.0, 30 + 5).translate(0, ty + 0.5, 96));
  // 体仁阁/弘义阁（两侧小攒尖）
  kit.pavilion({ x: 78, z: 96, r: 9, h: 7, roofH: 6 });
  kit.pavilion({ x: -78, z: 96, r: 9, h: 7, roofH: 6 });

  // ---------- 中和殿（方形攒尖） ----------
  kit.hall({ x: 0, z: 6, W: 22, D: 22, wallH: 9, roof: 'pyramid', square: true, roofH: 7.5, terrace: [{ w: 38, d: 38, h: 1.6 }, { w: 31, d: 31, h: 1.0 }], winH: 4.0 });

  // ---------- 保和殿 ----------
  kit.hall({ x: 0, z: -72, W: 46, D: 26, wallH: 14, roof: 'hip', double: true, roofH: 11.5, terrace: [{ w: 66, d: 46, h: 1.1 }, { w: 57, d: 39, h: 1.1 }, { w: 49, d: 33, h: 1.1 }], winH: 4.8 });

  // ---------- 乾清门 ----------
  kit.hall({ x: 0, z: -138, W: 38, D: 15, wallH: 9, roof: 'hip', roofH: 8, terrace: [{ w: 50, d: 24, h: 1.8 }], winH: 4.0 });

  // ---------- 乾清宫 ----------
  kit.hall({ x: 0, z: -186, W: 40, D: 22, wallH: 14, roof: 'hip', double: true, roofH: 11, terrace: [{ w: 54, d: 36, h: 1.1 }, { w: 46, d: 30, h: 1.1 }, { w: 38, d: 24, h: 1.1 }], winH: 4.6 });

  // ---------- 交泰殿（圆形攒尖） ----------
  {
    const r = 10.5, eaveY = 2.0 + 8;
    kit.cyl('wall', r, r, 8, 0, 2 + 4, -236, 14);
    kit.cyl('column', 0.45, 0.45, 8, r - 0.5, 2 + 4, -236, 8);
    kit.cyl('column', 0.45, 0.45, 8, -(r - 0.5), 2 + 4, -236, 8);
    kit.cyl('column', 0.45, 0.45, 8, 0, 2 + 4, -236 + r - 0.5, 8);
    kit.cyl('column', 0.45, 0.45, 8, 0, 2 + 4, -236 - (r - 0.5), 8);
    kit.box('marble', 30, 2, 30, 0, 1, -236);
    kit.parts.roof.push(roundRoof(r + 1.5, eaveY, eaveY + 7.5));
    kit.trimLines(roundRoofTrim(r + 1.5, eaveY), 0.13);
    kit.sphere('gold', 0.9, 0, eaveY + 8.1, -236, 12, 8);
    kit.cyl('gold', 0.2, 0.05, 2.4, 0, eaveY + 9.2, -236, 8);
  }

  // ---------- 坤宁宫 ----------
  kit.hall({ x: 0, z: -286, W: 36, D: 22, wallH: 13, roof: 'hip', double: true, roofH: 10.5, terrace: [{ w: 50, d: 34, h: 1.0 }, { w: 42, d: 28, h: 1.0 }], winH: 4.4 });

  // ---------- 御花园 ----------
  kit.hall({ x: 0, z: -360, W: 18, D: 14, wallH: 8, roof: 'xieshan', roofH: 7, terrace: [{ w: 28, d: 24, h: 1.4 }] });
  // 堆秀山（假山）
  for (const [rx, rz, rh] of [[-8, -398, 9], [6, -392, 7], [0, -404, 8], [-14, -388, 6], [12, -402, 6.5]]) {
    const rock = new THREE.ConeGeometry(3.5, rh, 7);
    rock.translate(rx, rh / 2, rz);
    kit.parts.dark.push(rock);
  }
  // 万春亭/千秋亭
  kit.pavilion({ x: 34, z: -414, r: 6.5, h: 6.5, roofH: 6 });
  kit.pavilion({ x: -34, z: -414, r: 6.5, h: 6.5, roofH: 6 });

  // ---------- 神武门 ----------
  kit.gate({ x: 0, z: -466, W: 74, D: 26, baseH: 13, gates: 3, double: true, roofH: 11, hallH: 13 });

  // ---------- 角楼 ----------
  for (const c of CFG.corners) kit.cornerTower(c.x, c.z, M);

  // ---------- 东西六宫 ----------
  for (const c of CFG.sideCourts) {
    const w = 38, d = 32;
    // 院墙
    kit.box('wallDark', w, 3.6, 0.8, c.x, 1.8, c.z - d / 2);
    kit.box('wallDark', w, 3.6, 0.8, c.x, 1.8, c.z + d / 2);
    kit.box('wallDark', 0.8, 3.6, d, c.x - w / 2, 1.8, c.z);
    kit.box('wallDark', 0.8, 3.6, d, c.x + w / 2, 1.8, c.z);
    // 正房
    kit.hall({ x: c.x, z: c.z - 6, W: 16, D: 11, wallH: 6, roof: 'xieshan', roofH: 5.5, winH: 3.2 });
    // 厢房
    kit.hall({ x: c.x - 11, z: c.z + 8, W: 8, D: 8, wallH: 4.5, roof: 'hip', roofH: 4, winH: 2.6 });
    kit.hall({ x: c.x + 11, z: c.z + 8, W: 8, D: 8, wallH: 4.5, roof: 'hip', roofH: 4, winH: 2.6 });
  }

  // ---------- 文华殿 / 武英殿 ----------
  kit.hall({ x: 236, z: 96, W: 30, D: 16, wallH: 8, roof: 'xieshan', roofH: 7, terrace: [{ w: 42, d: 26, h: 1.8 }] });
  kit.hall({ x: -236, z: 64, W: 30, D: 16, wallH: 8, roof: 'xieshan', roofH: 7, terrace: [{ w: 42, d: 26, h: 1.8 }] });
}

function riverZ(x) { return 330 + 24 * (1 - Math.pow(x / 225, 2)); }
function riverGeo() {
  const segs = 48, pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const x = -218 + (i / segs) * 436;
    const zc = riverZ(x);
    pos.push(x, 0, zc - 4.6, x, 0, zc + 4.6);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function roundRoof(R, eaveY, apexY) {
  // 圆形攒尖（交泰殿）
  const segs = 14, tsegs = 8, pos = [], idx = [];
  for (let i = 0; i < segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    for (let j = 0; j <= tsegs; j++) {
      const t = j / tsegs;
      const r = Math.pow(t, 0.85) * R;
      const corner = Math.pow(Math.abs(Math.sin((th * segs) / 2)), 1.6);
      let y = apexY + (eaveY - apexY) * Math.pow(t, 0.65) + 1.2 * corner * Math.pow(t, 3);
      pos.push(r * Math.cos(th), y, r * Math.sin(th));
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < tsegs; j++) {
    const a = i * (tsegs + 1) + j, b = ((i + 1) % segs) * (tsegs + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function roundRoofTrim(R, eaveY) {
  const segs = 14, pts = [];
  for (let k = 0; k < segs; k++) {
    const th = (k / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(R * Math.cos(th), eaveY + 1.2, R * Math.sin(th)));
  }
  return [pts];
}

// 白玉石栏板（栏杆圈）
function railRect(kit, w, d, y) {
  const t = 0.35, h = 1.0;
  kit.box('marble', w, h, t, 0, y - h / 2, d / 2);
  kit.box('marble', w, h, t, 0, y - h / 2, -d / 2);
  kit.box('marble', t, h, d, w / 2, y - h / 2, 0);
  kit.box('marble', t, h, d, -w / 2, y - h / 2, 0);
}
