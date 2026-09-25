// ============================================================
// 建筑营造：殿/门/楼/亭 —— 全部几何程序化生成
// 全局合并同类构件 → 整城建筑仅 ~10 个 draw call
// ============================================================
import * as THREE from 'three';
import { hipRoofGeo, pyramidGeo, xieshanRoofGeo, skirtGeo, roofTrims, pyramidTrims } from './roof.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class BuildKit {
  constructor(M) {
    this.M = M;
    this.parts = { roof: [], roofAlt: [], wall: [], wallDark: [], column: [], window: [], marble: [], dark: [], gable: [], ground: [], plaza: [], water: [], gold: [] };
    this.trims = [];   // 金色灯带 TubeGeometry 列表
    this.dougong = []; // 实例矩阵
    this.finials = []; // 宝顶位置（加灯）
  }

  // ---------- 基础件 ----------
  _geo(g, mat, x = 0, y = 0, z = 0, ry = 0, s = 1) {
    if (ry) g.rotateY(ry);
    if (s !== 1) g.scale(s, s, s);
    g.translate(x, y, z);
    this.parts[mat].push(g);
    return g;
  }
  box(mat, w, h, d, x, y, z, ry) {
    return this._geo(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry);
  }
  cyl(mat, r1, r2, h, x, y, z, seg = 10) {
    return this._geo(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z);
  }
  sphere(mat, r, x, y, z, w = 10, hgt = 8) {
    return this._geo(new THREE.SphereGeometry(r, w, hgt), mat, x, y, z);
  }

  trim(points, r = 0.16, mat = 'gold') {
    const curve = new THREE.CatmullRomCurve3(points);
    const g = new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), r, 5, false);
    this.trims.push(g);
  }
  trimLines(lines, r) { for (const pts of lines) this.trim(pts, r); }

  // 斗拱层：檐口下两圈错缝小方块
  dougongRow(W, D, y, overhang = 1.6) {
    const b = 0.62;
    for (const side of [1, -1]) {
      const n = Math.max(3, Math.round(W / (b * 2.2)));
      for (let i = 0; i <= n; i++) {
        const u = -W / 2 + (i / n) * W;
        this._dg(u, y, side * (D / 2 + overhang * 0.5));
        if (i < n) this._dg(u + W / n / 2, y - 0.42, side * (D / 2 + overhang));
      }
      const m = Math.max(3, Math.round(D / (b * 2.2)));
      for (let i = 0; i <= m; i++) {
        const u = -D / 2 + (i / m) * D;
        this._dg(side * (W / 2 + overhang * 0.5), y, u);
        if (i < m) this._dg(side * (W / 2 + overhang), y - 0.42, u + D / m / 2);
      }
    }
  }
  _dg(x, y, z) {
    const m4 = new THREE.Matrix4().makeRotationY((Math.random() - 0.5) * 0.06);
    m4.setPosition(x, y, z);
    this.dougong.push(m4);
  }

  // ----------  windows：棂条透光窗（合并到全城单 Mesh） ----------
  // face = 墙面到中心距离（外侧）；side 'z' 前后立面，'x' 左右立面
  windowsRow(W, y, face, side, bays, h = 4.2, w = 3.0) {
    for (let i = 0; i < bays; i++) {
      const off = -W / 2 + ((i + 0.5) / bays) * W;
      const gg = new THREE.PlaneGeometry(w, h);
      if (side === 'x') {
        gg.rotateY(Math.PI / 2);
        gg.translate(face + Math.sign(face) * 0.1, y, off);
      } else {
        if (face < 0) gg.rotateY(Math.PI);
        gg.translate(off, y, face + Math.sign(face) * 0.1);
      }
      this.parts.window.push(gg);
    }
  }

  // 红墙（前/后/左/右，含 doorway 暗门洞）
  walls(W, D, y0, h, doorW = 5) {
    const t = 1.2;
    const gF = new THREE.BoxGeometry(W, h, t); gF.translate(0, y0 + h / 2, D / 2 - t / 2);
    const gB = gF.clone(); gB.translate(0, 0, -(D - t));
    const gL = new THREE.BoxGeometry(t, h, D - 2 * t); gL.translate(-W / 2 + t / 2, y0 + h / 2, 0);
    const gR = gL.clone(); gR.translate(W - t, 0, 0);
    this.parts.wall.push(gF, gB, gL, gR);
    // 门洞（前面中央）
    const door = new THREE.BoxGeometry(doorW, h * 0.72, t + 0.3);
    door.translate(0, y0 + h * 0.36, D / 2 - t / 2);
    this.parts.dark.push(door);
    // 门楣暖光灯带
    const lintel = new THREE.BoxGeometry(doorW + 1.6, 0.35, 0.3);
    lintel.translate(0, y0 + h * 0.72 + 0.3, D / 2 + 0.1);
    this.parts.dark.push(lintel);
  }

  // 柱廊：檐柱一圈 + 金边
  columns(W, D, y0, h, r = 0.55) {
    const n = Math.max(3, Math.round(W / 9));
    for (let i = 0; i <= n; i++) {
      const x = -W / 2 + (i / n) * W;
      this.cyl('column', r, r, h, x, y0 + h / 2, D / 2 + 0.4, 8);
      this.cyl('column', r, r, h, x, y0 + h / 2, -D / 2 - 0.4, 8);
    }
    const m = Math.max(3, Math.round(D / 9));
    for (let i = 1; i < m; i++) {
      const z = -D / 2 + (i / m) * D;
      this.cyl('column', r, r, h, W / 2 + 0.4, y0 + h / 2, z, 8);
      this.cyl('column', r, r, h, -W / 2 - 0.4, y0 + h / 2, z, 8);
    }
  }

  // ---------- 殿宇 ----------
  // o: {x,z,W,D,wallH,terrace:[{w,d,h}],roof:'hip'|'xieshan'|'pyramid',double,ridgeHalf,roofH,skew}
  hall(o) {
    const { W, D } = o;
    let y = 0;
    // 台基（可多层）
    const tiers = o.terrace && o.terrace.length ? o.terrace : null;
    if (tiers) {
      for (const t of tiers) {
        this.box('marble', t.w, t.h, t.d, o.x, y + t.h / 2, o.z);
        y += t.h;
      }
    } else {
      this.box('marble', W + 6, 1.2, D + 6, o.x, 0.6, o.z);
      y = 1.2;
    }
    const wallY = y, wallH = o.wallH;
    const bays = Math.max(3, Math.round(W / 9));
    // 墙体与门窗
    this.walls(W, D, wallY, wallH, o.doorW);
    this.columns(W, D, wallY, wallH);
    // 前后面窗
    this.windowsRow(W, wallY + wallH * 0.32, D / 2, 'z', bays, o.winH || 4.4);
    this.windowsRow(W, wallY + wallH * 0.32, -D / 2, 'z', bays, o.winH || 4.4);
    const baysZ = Math.max(2, Math.round(D / 9));
    this.windowsRow(D, wallY + wallH * 0.32, W / 2, 'x', baysZ, o.winH || 4.4);
    this.windowsRow(D, wallY + wallH * 0.32, -W / 2, 'x', baysZ, o.winH || 4.4);

    const eaveY = wallY + wallH;
    const roofH = o.roofH ?? W * 0.24 + 4;
    const type = o.roof || 'hip';
    const ridgeHalf = o.ridgeHalf ?? W * (type === 'hip' ? 0.45 : 0.28);

    if (o.double) {
      // 重檐：下檐裙边 + 上层红墙带窗 + 上檐
      const skirtY0 = eaveY - 3.6;
      this.parts.roof.push(skirtGeo(W + 2, D + 2, eaveY - 0.2, skirtY0, 2.4, {}));
      // 上层带窗墙（重檐间红色腰线）
      const band = new THREE.BoxGeometry(W * 0.96, 2.2, D * 0.96);
      band.translate(o.x, eaveY - 1.1, o.z);
      this.parts.wall.push(band);
      this.dougongRow(W + 2, D + 2, skirtY0 - 0.2, 2.0);
      this.trimLines(eaveTrimLines(W + 4, D + 4, skirtY0 - 0.4, 2.4, 1.2), 0.13);
      this.dougongRow(W, D, eaveY - 0.2, 1.4);
    } else {
      this.dougongRow(W, D, eaveY - 0.2, 1.2);
    }

    const ridgeY = eaveY + roofH;
    if (type === 'hip') {
      this.parts[o.alt ? 'roofAlt' : 'roof'].push(hipRoofGeo(W, D, eaveY, ridgeY, ridgeHalf, {}));
      this.trimLines(roofTrims(W, D, eaveY, ridgeY, ridgeHalf, {}), 0.16);
      // 鸱吻（正脊两端金色小构件）
      this.box('gold', 1.4, 2.6, 1.0, o.x - ridgeHalf - 0.4, ridgeY + 1.0, o.z);
      this.box('gold', 1.4, 2.6, 1.0, o.x + ridgeHalf + 0.4, ridgeY + 1.0, o.z);
    } else if (type === 'xieshan') {
      this.parts[o.alt ? 'roofAlt' : 'roof'].push(xieshanRoofGeo(W, D, eaveY, ridgeY, { ridgeHalf, skirtDrop: roofH * 0.42 }));
      this.trimLines(roofTrims(W, D, eaveY, ridgeY, ridgeHalf, {}), 0.16);
      // 山花金色描边
      const gD = D * 0.58;
      for (const s of [1, -1]) {
        this.trim([V3(s * ridgeHalf, ridgeY, 0), V3(s * ridgeHalf, eaveY, -gD / 2)], 0.12);
        this.trim([V3(s * ridgeHalf, ridgeY, 0), V3(s * ridgeHalf, eaveY, gD / 2)], 0.12);
        this.trim([V3(s * ridgeHalf, eaveY, -gD / 2), V3(s * ridgeHalf, eaveY, gD / 2)], 0.12);
      }
    } else if (type === 'pyramid') {
      this.parts[o.alt ? 'roofAlt' : 'roof'].push(pyramidGeo(W / 2, eaveY, ridgeY, { square: o.square }));
      this.trimLines(pyramidTrims(W / 2, eaveY, ridgeY, { square: o.square }), 0.15);
      // 宝顶
      this.sphere('gold', 1.0, o.x, ridgeY + 0.6, o.z, 12, 8);
      this.cyl('gold', 0.22, 0.05, 2.6, o.x, ridgeY + 2.0, o.z, 8);
      this.finials.push([o.x, ridgeY + 1.4, o.z, 16]);
    }
    return y;
  }

  // 城墙上的门楼（午门/神武门）：高台 + 主楼 + 门洞
  gate(o) {
    const { W, D } = o;
    this.box('wallDark', W, o.baseH, D, o.x, o.baseH / 2, o.z);
    // 门洞（3个）
    const nG = o.gates || 3;
    for (let i = 0; i < nG; i++) {
      const gx = o.x + (i - (nG - 1) / 2) * (W * 0.26);
      const door = new THREE.BoxGeometry(7, o.baseH * 0.66, 2);
      door.translate(gx, o.baseH * 0.33, o.z + D / 2 - 1);
      this.parts.dark.push(door);
      // 门洞暖光描边
      this.trim([V3(gx - 4, o.baseH * 0.68, o.z + D / 2 + 0.15), V3(gx, o.baseH * 0.68 + 2.4, o.z + D / 2 + 0.15), V3(gx + 4, o.baseH * 0.68, o.z + D / 2 + 0.15)], 0.1);
    }
    // 墙顶金色压顶灯带
    this.trim([V3(o.x - W / 2, o.baseH + 0.2, o.z - D / 2), V3(o.x + W / 2, o.baseH + 0.2, o.z - D / 2)], 0.14);
    this.trim([V3(o.x - W / 2, o.baseH + 0.2, o.z + D / 2), V3(o.x + W / 2, o.baseH + 0.2, o.z + D / 2)], 0.14);
    // 楼体
    const hallH = o.hallH || 15;
    const eaveY = o.baseH;
    const ridgeY = eaveY + (o.roofH || 12);
    this.walls(W * 0.82, D * 0.6, eaveY, hallH, 8);
    this.columns(W * 0.82, D * 0.6, eaveY, hallH, 0.5);
    this.windowsRow(W * 0.82, eaveY + hallH * 0.35, D * 0.3, 'z', 6, 4.6);
    this.windowsRow(W * 0.82, eaveY + hallH * 0.35, -D * 0.3, 'z', 6, 4.6);
    if (o.double) {
      this.parts.roof.push(skirtGeo(W * 0.86, D * 0.64, eaveY + hallH - 0.2, eaveY + hallH - 4.2, 2.0, {}));
      this.trimLines(eaveTrimLines(W * 0.9, D * 0.7, eaveY + hallH - 4.6, 2.0, 1.0), 0.12);
      this.dougongRow(W * 0.86, D * 0.64, eaveY + hallH - 4.4, 1.6);
      this.dougongRow(W * 0.82, D * 0.6, eaveY + hallH - 0.2, 1.2);
      this.parts.roof.push(hipRoofGeo(W * 0.82, D * 0.6, eaveY + hallH, ridgeY, W * 0.3, {}));
      this.trimLines(roofTrims(W * 0.82, D * 0.6, eaveY + hallH, ridgeY, W * 0.3, {}), 0.15);
    } else {
      this.dougongRow(W * 0.82, D * 0.6, eaveY + hallH - 0.2, 1.2);
      this.parts.roof.push(hipRoofGeo(W * 0.82, D * 0.6, eaveY + hallH, ridgeY, W * 0.3, {}));
      this.trimLines(roofTrims(W * 0.82, D * 0.6, eaveY + hallH, ridgeY, W * 0.3, {}), 0.15);
    }
  }

  // 角楼：十字平面三层檐 + 攒尖宝顶（视觉证据：四角金色灯塔）
  cornerTower(cx, cz, M) {
    const g = (w, h, d, x, y, z) => this.box('wallDark', w, h, d, x, y + h / 2, z);
    const tier1 = 15, t1w = 24;
    g(t1w, tier1, t1w, cx, 0, cz);                       // 一层主楼
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {  // 十字翼
      g(10, tier1 - 2, 16, cx + sx * (t1w / 2 + 5), 0, cz);
      g(16, tier1 - 2, 10, cx, 0, cz + sz * (t1w / 2 + 5));
    }
    const y1 = tier1, w2 = 17;
    g(w2, 7, w2, cx, y1, cz);                            // 二层
    const y2 = y1 + 7, w3 = 11;
    g(w3, 5.5, w3, cx, y2, cz);                           // 三层
    // 各层屋顶
    this.parts.roof.push(hipRoofGeo(t1w + 4, t1w + 4, y1 + 0.5, y1 + 6.5, t1w * 0.18, { lift: 2.8, upturn: 2.0 }));
    this.trimLines(roofTrims(t1w + 4, t1w + 4, y1 + 0.5, y1 + 6.5, t1w * 0.18, {}), 0.16);
    this.parts.roof.push(hipRoofGeo(w2 + 3, w2 + 3, y2 + 0.5, y2 + 5.0, w2 * 0.16, { lift: 2.4, upturn: 1.8 }));
    this.trimLines(roofTrims(w2 + 3, w2 + 3, y2 + 0.5, y2 + 5.0, w2 * 0.16, {}), 0.14);
    this.parts.roof.push(hipRoofGeo(w3 + 2.5, w3 + 2.5, y2 + 5.5, y2 + 9.5, w3 * 0.14, { lift: 2.0, upturn: 1.5 }));
    this.trimLines(roofTrims(w3 + 2.5, w3 + 2.5, y2 + 5.5, y2 + 9.5, w3 * 0.14, {}), 0.12);
    // 金色宝顶
    const ay = y2 + 9.5;
    this.sphere('gold', 1.2, cx, ay + 0.5, cz, 12, 8);
    this.cyl('gold', 0.3, 0.06, 3.2, cx, ay + 2.2, cz, 8);
    this.trim([V3(cx - t1w / 2 - 2, y1 + 0.4, cz), V3(cx + t1w / 2 + 2, y1 + 0.4, cz)], 0.13);
    this.finials.push([cx, ay + 1.6, cz, 34]);
    // 楼身小窗透光（四面）
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const wg = new THREE.PlaneGeometry(8, 3.2);
      if (sz !== 0) wg.rotateY(Math.PI / 2);
      wg.translate(cx + sx * (t1w / 2 + 0.4), y1 * 0.45, cz + sz * (t1w / 2 + 0.4));
      this.parts.window.push(wg);
    }
  }

  // 小亭（攒尖）
  pavilion(o) {
    const r = o.r || 7;
    this.box('marble', r * 2.6, 1.0, r * 2.6, o.x, 0.5, o.z);
    this.cyl('column', 0.4, 0.4, o.h || 6, o.x + r * 0.7, 1 + (o.h || 6) / 2, o.z + r * 0.7, 8);
    this.cyl('column', 0.4, 0.4, o.h || 6, o.x - r * 0.7, 1 + (o.h || 6) / 2, o.z + r * 0.7, 8);
    this.cyl('column', 0.4, 0.4, o.h || 6, o.x + r * 0.7, 1 + (o.h || 6) / 2, o.z - r * 0.7, 8);
    this.cyl('column', 0.4, 0.4, o.h || 6, o.x - r * 0.7, 1 + (o.h || 6) / 2, o.z - r * 0.7, 8);
    const eaveY = 1 + (o.h || 6), ridgeY = eaveY + (o.roofH || 5.5);
    this.parts.roof.push(pyramidGeo(r, eaveY, ridgeY, { segs: o.segs || 8, square: o.square, lift: 1.6 }));
    this.trimLines(pyramidTrims(r, eaveY, ridgeY, { segs: o.segs || 8, square: o.square }), 0.12);
    this.sphere('gold', 0.7, o.x, ridgeY + 0.4, o.z, 10, 7);
    this.cyl('gold', 0.16, 0.04, 1.8, o.x, ridgeY + 1.4, o.z, 8);
    this.finials.push([o.x, ridgeY + 1.0, o.z, 12]);
  }

  // 合并输出
  build(scene, M) {
    const meshes = [];
    const matOf = { roof: M.roof, roofAlt: M.roofAlt, wall: M.wall, wallDark: M.wallDark, column: M.column, window: M.windowGlow, marble: M.marble, dark: M.dark, gable: M.wall, ground: M.ground, plaza: M.plaza, water: M.water, gold: M.goldGlow };
    for (const k of Object.keys(this.parts)) {
      const arr = this.parts[k];
      if (!arr.length) continue;
      const merged = mergeGeo(arr);
      const mesh = new THREE.Mesh(merged, matOf[k] || M.wall);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      meshes.push(mesh);
    }
    // 金色轮廓灯带（全城一根 Mesh）
    if (this.trims.length) {
      const mesh = new THREE.Mesh(mergeGeo(this.trims), M.goldGlow);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      meshes.push(mesh);
    }
    // 斗拱（全城一个 InstancedMesh）
    if (this.dougong.length) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.34, 0.3), M.dougong, this.dougong.length);
      this.dougong.forEach((m4, i) => im.setMatrixAt(i, m4));
      im.instanceMatrix.needsUpdate = true;
      scene.add(im);
      meshes.push(im);
    }
    return meshes;
  }
}

function eaveTrimLines(W, D, eaveY, lift, up) {
  const lines = [];
  for (const s of [1, -1]) lines.push([V3(-W / 2, eaveY + lift, s * D / 2), V3(W / 2, eaveY + lift, s * D / 2)]);
  for (const s of [1, -1]) lines.push([V3(s * W / 2, eaveY + lift, -D / 2), V3(s * W / 2, eaveY + lift, D / 2)]);
  return lines;
}

// 手工 merge（避免引入 BufferGeometryUtils 的索引差异问题）
function mergeGeo(geos) {
  let total = 0;
  const nonIndexed = geos.map(g => g.index ? g.toNonIndexed() : g);
  for (const g of nonIndexed) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), norm = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o3 = 0, o2 = 0;
  for (const g of nonIndexed) {
    const p = g.attributes.position.array, n = g.attributes.normal ? g.attributes.normal.array : null, u = g.attributes.uv ? g.attributes.uv.array : null;
    pos.set(p, o3);
    if (n) norm.set(n, o3);
    if (u) uv.set(u, o2);
    o3 += p.length; o2 += u ? u.length : 0;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  if (o2 > 0) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
