/**
 * 恒山悬空寺 · 程序化三维模型
 * 依据 inputs/img_00.webp 参考图（真实照片 + 3D 效果图）重建：
 * 翠屏峰崖壁 / 南楼 / 北楼 / 大雄宝殿 / 长线桥 / 悬空柱 / 插岩横梁 / 斗拱 / 山门 / 唐峪河
 *
 * 该模块同时被使用于：
 *  - Node 端 OBJ 导出（tools/export-obj.mjs）
 *  - 浏览器端 3D 展示页 / 渲染脚本（index.html / tools/render*.mjs）
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ================= 确定性噪声 ================= */
function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f); norm += a; f *= 2.03; a *= 0.5;
  }
  return s / norm; // 0..1
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/* ================= 材质注册表 ================= */
export const MATERIALS = {
  rock:      { color: 0x8b5a3c, label: '红褐色砂岩',   category: '岩壁山体' },
  stone:     { color: 0x9a938a, label: '青白石',       category: '石作' },
  woodRed:   { color: 0xa03a2a, label: '红漆木构',     category: '木作' },
  plaster:   { color: 0xe6ddca, label: '白粉墙',       category: '木作' },
  roofGold:  { color: 0xd9a53f, label: '金色琉璃瓦',   category: '瓦作' },
  ridgeGold: { color: 0xb8862f, label: '琉璃脊饰',     category: '瓦作' },
  bracket:   { color: 0x2f6f5e, label: '青绿彩画斗拱', category: '彩画' },
  beamWood:  { color: 0x6e4a2e, label: '原木横梁',     category: '木作' },
  lattice:   { color: 0x4a2c20, label: '门窗棂格',     category: '木作' },
  deck:      { color: 0x7c5a3a, label: '木楼地板',     category: '木作' },
  trunk:     { color: 0x5a4030, label: '树干',         category: '配景' },
  leaf:      { color: 0x4a7a3a, label: '松柏林木',     category: '配景' },
  ground:    { color: 0x77804f, label: '山地草地',     category: '配景' },
  water:     { color: 0x4e8f8a, label: '唐峪河',       category: '配景' },
  plaza:     { color: 0x8f8a80, label: '广场铺地',     category: '石作' },
  glow:      { color: 0xffb45c, label: '室内灯光',     category: '夜景', emissive: 0xff9a3c },
};
/** 材质分析模式下的 ID 配色 */
export const MATERIAL_ID_COLORS = {
  rock: 0xc0392b, stone: 0x95a5a6, woodRed: 0xe74c3c, plaster: 0xecf0f1,
  roofGold: 0xf1c40f, ridgeGold: 0xd35400, bracket: 0x27ae60, beamWood: 0x8e5a2b,
  lattice: 0x2c3e50, deck: 0xa04000, trunk: 0x6e4a2e, leaf: 0x2ecc71,
  ground: 0x9acd32, water: 0x3498db, plaza: 0xbdc3c7, glow: 0xffeaa7,
};

/* ================= 构件档案 ================= */
export const PART_INFO = {
  cliff:    { label: '翠屏峰崖壁', desc: '恒山翠屏峰半山腰的陡峭崖壁，红褐色水平层理砂岩，悬空寺即依崖而建、坐西朝东。', construct: '岩壁上凿孔插梁，建筑荷载经横梁传至岩体。' },
  mound:    { label: '山脚岩坡',   desc: '崖壁底部的崩积岩坡，悬空柱下端落脚于岩坡岩架之上。', construct: '红褐色砂岩，层理水平，表层风化碎裂。' },
  terrace:  { label: '石砌台基',   desc: '建筑群底部的青石台基，半嵌入崖壁，承托全部楼阁。', construct: '青白条石垒砌，顶面铺石板。' },
  southTower:{ label: '南楼',      desc: '寺内南端三层楼阁，自台基起高三层，每层檐下均设平坐勾栏，金琉璃歇山顶。', construct: '三层通高 ~11m；红柱白粉墙，檐下青绿斗拱，翼角起翘。' },
  northTower:{ label: '北楼',      desc: '北端三层楼阁，顶层设三教殿（儒释道三教合一），为全寺最高建筑。', construct: '三层通高 ~12m；结构与南楼呼应，以长线桥与南楼相连。' },
  mainHall: { label: '大雄宝殿',   desc: '南北楼之间的主殿，重檐金顶，体量最大，为全寺视觉中心。', construct: '两层，面阔五间，四阿顶，正脊两端设琉璃吻兽。' },
  sideHall: { label: '三教殿配殿', desc: '主殿东侧配殿，单层歇山顶，与主殿以廊道相接。', construct: '单层三开间，金琉璃瓦。' },
  bridge:   { label: '长线桥',     desc: '连接南楼、北楼的木构栈道，横空飞渡于两楼之间，下以插岩横梁承重。', construct: '长约 15m，宽 2.4m，两侧设勾栏，桥面木板平铺。' },
  stilts:   { label: '悬空柱',     desc: '自楼阁挑台斜撑至岩坡的细长圆木柱，远观纤细欲坠，为"悬空"意象之源。', construct: '"半插飞梁为基，巧借岩石暗托"，柱脚垫石于岩架。' },
  beams:    { label: '插岩横梁',     desc: '水平插入崖壁孔洞的原木横梁，是悬空寺承重体系的核心。', construct: '直径 ~30cm 圆木，外露端头承托楼地板与立柱。' },
  brackets: { label: '斗拱',       desc: '檐柱顶与屋檐之间的青绿彩画斗拱层，出跳承檐，减冲减震。', construct: '一斗二升 + 双臂拱，青绿旋子彩画。' },
  gate:     { label: '山门',       desc: '山脚广场入口的山门，为游线起点。', construct: '四柱三间，金琉璃瓦顶。' },
  path:     { label: '登山石阶',   desc: '自广场蜿蜒而上的石阶步道，连接山门与寺前平台。', construct: '青石板条踏步，随岩坡转折。' },
  plaza:    { label: '寺前广场',   desc: '寺前平整的集散广场，遥望全寺的最佳位置。', construct: '青石板铺地。' },
  river:    { label: '唐峪河',     desc: '寺前峡谷中的唐峪河，碧水映崖，为悬空寺的天然前景。', construct: '四季清水，河滩卵石。' },
  trees:    { label: '林木',       desc: '崖顶与河畔的油松与灌木，四季常青。', construct: '崖顶水土保持林。' },
  ground:   { label: '山体地面',   desc: '河谷山地地面。', construct: '草坡与裸土相间。' },
};

/* ================= 几何累加器 ================= */
class Bucket {
  constructor(part, label) { this.part = part; this.label = label; this.geoms = new Map(); }
  add(mat, geom, matrix) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!this.geoms.has(mat)) this.geoms.set(mat, []);
    this.geoms.get(mat).push(g);
  }
  addRaw(mat, geom) {
    if (!this.geoms.has(mat)) this.geoms.set(mat, []);
    this.geoms.get(mat).push(geom.index ? geom.toNonIndexed() : geom);
  }
  build(matFactory, parent) {
    const group = new THREE.Group();
    group.name = this.part;
    for (const [mat, geoms] of this.geoms) {
      if (!geoms.length) continue;
      const merged = mergeGeometries(geoms, false);
      geoms.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(merged, matFactory(mat));
      mesh.name = `${this.part}_${mat}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.part = this.part;
      group.add(mesh);
    }
    group.userData.label = this.label;
    if (parent) parent.add(group);
    return group;
  }
}

/* ================= 基础工具 ================= */
function mat4(px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sx, sy, sz));
  return m;
}
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** 两点之间的梁（沿 Y 轴对齐后旋转） */
function strutBetween(a, b, w, h, mat, bucket) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = BOX(w, len, h);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  bucket.add(mat, g, m);
}

/* ================= 歇山/四阿屋顶 ================= */
/**
 * 四阿顶（庑殿）曲面：檐口矩形 → 脊线矩形放样，凹曲屋面 + 翼角起翘
 * 局部坐标：原点位于檐口底面中心，X 沿脊方向
 */
export function hipRoofGeometry(w, d, h, { overhang = 1.0, uplift = 0.9, curve = 1.6, rings = 12, around = 40 } = {}) {
  const hw = w / 2 + overhang, hd = d / 2 + overhang;
  const hwR = Math.max(0.18, Math.abs(hw - hd) * 0.92);
  const hdR = 0.12;
  const slopeLen = Math.hypot(hw - hwR, h) + 0.5;
  const perimLen = 2 * (2 * hw + 2 * hd);
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const hwV = hw + (hwR - hw) * v;
    const hdV = hd + (hdR - hd) * v;
    for (let i = 0; i <= around; i++) {
      const u = i / around;
      // 矩形周长参数化（起点为角点 (hw, hd)）
      let px, pz;
      const t = u * 4;
      if (t < 1) { px = hwV; pz = -hdV + 2 * hdV * t; }
      else if (t < 2) { px = hwV - 2 * hwV * (t - 1); pz = hdV; }
      else if (t < 3) { px = -hwV; pz = hdV - 2 * hdV * (t - 2); }
      else { px = -hwV + 2 * hwV * (t - 3); pz = -hdV; }
      const corner = Math.pow(Math.max(0, Math.cos(u * 4 * Math.PI)), 1.6);
      const y = h * Math.pow(v, curve) + uplift * corner * Math.pow(1 - v, 2.2);
      pos.push(px, y, pz);
      uv.push(u * perimLen / 0.62, v * slopeLen / 0.85);
    }
  }
  const row = around + 1;
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < around; i++) {
      const a = j * row + i, b = a + 1, c = a + row, e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 屋顶组合：瓦面 + 脊 + 檐口枋 + 脊端吻兽 */
function makeRoof(bucket, cx, cz, yBase, w, d, h, opts = {}) {
  const { overhang = 1.0, uplift = 0.9, ridge = 'ridgeGold' } = opts;
  bucket.add('roofGold', hipRoofGeometry(w, d, h, { overhang, uplift }), mat4(cx, yBase, cz));
  // 正脊（沿 X）与四条垂脊
  const hwR = Math.max(0.18, Math.abs(w / 2 + overhang - (d / 2 + overhang)) * 0.92);
  const ridgeY = yBase + h + 0.12;
  bucket.add(ridge, CYL(0.2, 0.2, hwR * 2 + 0.5, 8), mat4(cx, ridgeY, cz, 0, 0, Math.PI / 2));
  const ew = w / 2 + overhang * 0.98, ed = d / 2 + overhang * 0.98;
  const ey = yBase + uplift * 0.96;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const a = new THREE.Vector3(cx + sx * hwR, ridgeY - 0.06, cz);
    const b = new THREE.Vector3(cx + sx * ew, ey, cz + sz * ed);
    strutBetween(a, b, 0.15, 0.15, ridge, bucket);
    // 脊端小兽
    bucket.add(ridge, new THREE.IcosahedronGeometry(0.22, 0), mat4(b.x, b.y + 0.1, b.z));
  }
  // 檐口枋（深色木沿）
  bucket.add('beamWood', BOX(2 * ew + 0.15, 0.22, 0.18), mat4(cx, yBase + 0.02, cz + ed));
  bucket.add('beamWood', BOX(2 * ew + 0.15, 0.22, 0.18), mat4(cx, yBase + 0.02, cz - ed));
  bucket.add('beamWood', BOX(0.18, 0.22, 2 * ed + 0.15), mat4(cx + ew, yBase + 0.02, cz));
  bucket.add('beamWood', BOX(0.18, 0.22, 2 * ed + 0.15), mat4(cx - ew, yBase + 0.02, cz));
}

/* ================= 斗拱 ================= */
function dougong(bucket, x, y, z) {
  bucket.add('bracket', BOX(0.5, 0.26, 0.5), mat4(x, y, z));                    // 大斗
  bucket.add('bracket', BOX(1.5, 0.2, 0.26), mat4(x, y + 0.22, z));             // 横拱
  bucket.add('bracket', BOX(0.26, 0.2, 1.1), mat4(x, y + 0.22, z));             // 纵向拱
  bucket.add('bracket', BOX(0.9, 0.18, 0.9), mat4(x, y + 0.42, z));             // 上枋
  bucket.add('bracket', BOX(1.9, 0.16, 0.24), mat4(x, y + 0.58, z));            // 出跳臂
}

/* ================= 勾栏 ================= */
function railingRun(bucket, x1, z1, x2, z2, y, h = 0.95) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return;
  const ang = Math.atan2(dx, dz);
  const nx = dx / len, nz = dz / len;
  // 扶手 + 地栿
  bucket.add('woodRed', BOX(0.14, 0.12, len), mat4((x1 + x2) / 2, y + h, (z1 + z2) / 2, 0, ang, 0));
  bucket.add('woodRed', BOX(0.16, 0.12, len), mat4((x1 + x2) / 2, y + 0.06, (z1 + z2) / 2, 0, ang, 0));
  // 望柱（端部）与栏杆板条
  const n = Math.max(2, Math.round(len / 0.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x1 + dx * t, pz = z1 + dz * t;
    bucket.add('woodRed', BOX(0.09, h, 0.09), mat4(px, y + h / 2, pz));
  }
}

/* ================= 楼阁 ================= */
/**
 * 多层楼阁：台基上逐层收分，每层 柱→墙→窗→平坐勾栏→檐顶
 */
function pavilion(bucket, { x, z, w, d, floors = 3, floorH = 3.2, baseY = 17, main = false, door = true }) {
  const frontZ = z + d / 2, backZ = z - d / 2;
  const slabT = 0.32, balconyF = 1.15, balconyS = 0.8;
  let topY = baseY;
  for (let f = 0; f < floors; f++) {
    const wallY = topY;
    const wallTop = wallY + floorH - 0.32;
    // 前檐柱 & 转角柱
    const colXs = [x - w / 2, x - w / 6, x + w / 6, x + w / 2];
    for (const cx of colXs) {
      bucket.add('woodRed', CYL(0.2, 0.23, floorH - 0.3, 8), mat4(cx, wallY + (floorH - 0.3) / 2, frontZ - 0.18));
      bucket.add('woodRed', CYL(0.2, 0.23, floorH - 0.3, 8), mat4(cx, wallY + (floorH - 0.3) / 2, backZ + 0.18));
    }
    for (const cx of [x - w / 2, x + w / 2]) {
      bucket.add('woodRed', CYL(0.2, 0.23, floorH - 0.3, 8), mat4(cx, wallY + (floorH - 0.3) / 2, z));
    }
    // 墙体（前/左/右；背墙隐入崖壁）
    const wallH = floorH - 0.32;
    bucket.add('woodRed', BOX(w - 0.5, wallH - 0.9, 0.16), mat4(x, wallY + 0.45 + wallH / 2 - 0.225, frontZ - 0.18));
    bucket.add('plaster', BOX(w - 0.5, 0.85, 0.18), mat4(x, wallY + 0.45 + 0.425, frontZ - 0.18)); // 白粉墙裙
    bucket.add('woodRed', BOX(0.16, wallH, d - 0.6), mat4(x - w / 2 + 0.08, wallY + wallH / 2, z));
    bucket.add('woodRed', BOX(0.16, wallH, d - 0.6), mat4(x + w / 2 - 0.08, wallY + wallH / 2, z));
    // 门窗棂格（正面）
    const bays = Math.max(2, Math.round(w / 2.2));
    for (let bIdx = 0; bIdx < bays; bIdx++) {
      const bx = x - w / 2 + (bIdx + 0.5) * (w / bays);
      const isDoor = door && f === 0 && bIdx === Math.floor(bays / 2);
      const ww = isDoor ? 1.3 : 1.1, wh = isDoor ? 2.0 : 1.15;
      const wy = wallY + (isDoor ? 0.15 : 0.9 + wh / 2);
      bucket.add('lattice', BOX(ww + 0.15, wh + 0.15, 0.1), mat4(bx, wy, frontZ - 0.1));
      const bars = isDoor ? 5 : 3;
      for (let k = 1; k < bars; k++) {
        bucket.add('beamWood', BOX(0.05, wh, 0.06), mat4(bx - ww / 2 + (k * ww) / bars, wy, frontZ - 0.045));
      }
      for (const hy of [wy - wh / 2 + wh * 0.33, wy - wh / 2 + wh * 0.66]) {
        bucket.add('beamWood', BOX(ww, 0.05, 0.06), mat4(bx, hy, frontZ - 0.045));
      }
    }
    // 平坐（挑台）+ 楼板
    const slabY = wallTop;
    bucket.add('deck', BOX(w + balconyF * 2 + balconyS * 0.4, slabT, d + balconyF + balconyS), mat4(x, slabY - slabT / 2, z + (balconyF - balconyS) / 2));
    // 平坐下插岩横梁（前檐一排）
    const nBeam = Math.max(2, Math.round(w / 1.9));
    for (let bIdx = 0; bIdx < nBeam; bIdx++) {
      const bx = x - w / 2 + (bIdx + 0.5) * (w / nBeam);
      bucket.add('beamWood', BOX(0.26, 0.34, d / 2 + balconyF + 3.4), mat4(bx, slabY - slabT - 0.3, frontZ - (d / 2 + balconyF) / 2 + 1.2));
    }
    // 斗拱（檐口一圈）
    const dby = slabY + 0.66;
    for (let bIdx = 0; bIdx <= Math.round(w / 2.1); bIdx++) {
      const bx = x - w / 2 + bIdx * 2.1;
      if (bx > x + w / 2) break;
      dougong(bucket, bx, dby, frontZ - 0.15);
      dougong(bucket, bx, dby, backZ + 0.15);
    }
    for (const sx of [x - w / 2, x + w / 2]) {
      for (let bIdx = 0; bIdx <= Math.round(d / 2.1); bIdx++) {
        dougong(bucket, sx, dby, backZ + 0.6 + bIdx * 2.1);
      }
    }
    // 勾栏（前缘 + 两侧）
    const rY = slabY + 0.02, rF = frontZ + balconyF - 0.08;
    railingRun(bucket, x - w / 2 - balconyF, rF, x + w / 2 + balconyF, rF, rY);
    railingRun(bucket, x - w / 2 - balconyF, rF, x - w / 2 - balconyF, frontZ - 0.1, rY);
    railingRun(bucket, x + w / 2 + balconyF, rF, x + w / 2 + balconyF, frontZ - 0.1, rY);
    // 檐顶（顶层更陡更高）
    const isTop = f === floors - 1;
    const rh = isTop ? (main ? 3.0 : 2.5) : 2.0;
    makeRoof(bucket, x, z + 0.15, slabY + 0.02, w + (isTop ? 0.6 : 0), d + 0.4, rh,
      { overhang: isTop ? 1.5 : 1.15, uplift: isTop ? 1.25 : 0.85 });
    topY = slabY;
  }
  return topY;
}

/* ================= 长线桥 ================= */
function bridge(bucket, { x1, x2, y, z, w = 2.4 }) {
  const len = x2 - x1, cx = (x1 + x2) / 2;
  bucket.add('deck', BOX(len, 0.2, w), mat4(cx, y - 0.1, z));
  bucket.add('beamWood', BOX(len, 0.3, 0.24), mat4(cx, y - 0.36, z - w / 2 + 0.1));
  bucket.add('beamWood', BOX(len, 0.3, 0.24), mat4(cx, y - 0.36, z + w / 2 - 0.1));
  // 桥板缝
  const n = Math.floor(len / 0.55);
  for (let i = 1; i < n; i++) {
    bucket.add('beamWood', BOX(0.05, 0.03, w - 0.1), mat4(x1 + i * 0.55, y + 0.005, z));
  }
  // 两侧勾栏
  railingRun(bucket, x1, z - w / 2 + 0.07, x2, z - w / 2 + 0.07, y);
  railingRun(bucket, x1, z + w / 2 - 0.07, x2, z + w / 2 - 0.07, y);
  // 端部斜撑入岩
  for (const sx of [x1, x2]) {
    strutBetween(new THREE.Vector3(sx + (sx === x1 ? 1.2 : -1.2), y - 0.3, z + w / 2 - 0.3),
      new THREE.Vector3(sx + (sx === x1 ? 0.4 : -0.4), y - 2.6, z - w / 2 + 0.4), 0.22, 0.26, 'beamWood', bucket);
  }
  // 桥中段下横梁
  bucket.add('beamWood', BOX(0.3, 0.36, w + 2.6), mat4(cx, y - 0.55, z));
}

/* ================= 山门 ================= */
function gate(bucket, { x, z, baseY = 0.35 }) {
  const w = 9, d = 4.6;
  for (const px of [x - w / 2 + 0.5, x - w / 6, x + w / 6, x + w / 2 - 0.5]) {
    bucket.add('woodRed', CYL(0.22, 0.26, 4.6, 8), mat4(px, baseY + 2.3, z));
  }
  bucket.add('plaster', BOX(w - 1.6, 1.6, 0.15), mat4(x - w / 2 + 1.6, baseY + 1.6, z + d / 2 - 0.3));
  bucket.add('plaster', BOX(w - 1.6, 1.6, 0.15), mat4(x + w / 2 - 1.6, baseY + 1.6, z + d / 2 - 0.3));
  bucket.add('lattice', BOX(2.2, 2.6, 0.12), mat4(x, baseY + 2.1, z + d / 2 - 0.28));
  makeRoof(bucket, x, z, baseY + 4.6, w, d, 1.9, { overhang: 1.2, uplift: 0.9 });
}

/* ================= 树木 ================= */
const LEAF_TONES = [0x3f7030, 0x4a7a3a, 0x39632c, 0x557f35];
function tree(bucket, x, z, s = 1, groundY = 0) {
  const h = 2.6 + hash2(x, z) * 1.6;
  bucket.add('trunk', CYL(0.14 * s, 0.22 * s, h, 7), mat4(x, groundY + h / 2, z, 0, 0, (hash2(z, x) - 0.5) * 0.14));
  const tone = Math.floor(hash2(x * 3, z * 7) * LEAF_TONES.length);
  const leafMat = 'leaf';
  const blobs = 2 + Math.floor(hash2(x * 5, z * 2) * 2);
  for (let i = 0; i < blobs; i++) {
    const r = (1.1 + hash2(x + i, z - i) * 0.9) * s;
    const bx = x + (hash2(x - i, z + i) - 0.5) * 1.4 * s;
    const bz = z + (hash2(x + i * 2, z - i * 3) - 0.5) * 1.4 * s;
    const by = groundY + h + (hash2(x * i, z * i) - 0.3) * 1.6 * s;
    bucket.add(leafMat, new THREE.IcosahedronGeometry(r, 1), mat4(bx, by, bz, hash2(i, x) * 3, hash2(i, z) * 3, 0, 1, 0.75 + hash2(i, x + z) * 0.3, 1));
  }
  bucket.userDataLeafTone = tone;
}

/* ================= 地面高度 ================= */
export function groundH(x, z) {
  if (z > 55) return 0; // 河道
  let h = (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 2.4;
  h *= 1 - smoothstep(22, 34, Math.hypot(x, z - 34)); // 广场平整
  h *= 1 - smoothstep(40, 55, z);                     // 河道边缘平整
  return h;
}

/* ================= 主构建 ================= */
export function buildTempleModel(opts = {}) {
  const group = new THREE.Group();
  group.name = 'HengshanHangingTemple';
  const parts = {};
  const mk = (key) => {
    if (!parts[key]) parts[key] = new Bucket(key, PART_INFO[key] ? PART_INFO[key].label : key);
    return parts[key];
  };

  /* ---- 崖壁 ---- */
  {
    const b = mk('cliff');
    const W = 150, H = 84, D = 52;
    const g = new THREE.BoxGeometry(W, H, D, 78, 46, 1);
    g.translate(0, H / 2, -D / 2); // 前面 z=0
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z > -0.5) { // 前面层
        let nz = (fbm(x * 0.09, y * 0.07, 4) - 0.5) * 5.2;         // 大起伏
        nz += Math.sin(y * 1.15 + fbm(x * 0.04, y * 0.05) * 3.0) * 0.55; // 水平层理
        nz -= smoothstep(42, 55, y) * 2.2;                          // 顶部外挑
        nz += smoothstep(30, 12, y) * 1.2;                          // 底部内收
        // 中部岩架凹槽（悬空柱落脚）
        for (const sy of [6.2, 10.5]) {
          const band = Math.exp(-Math.pow((y - sy) / 1.1, 2));
          nz -= band * 1.5;
        }
        // 建筑贴合区整平
        const fit = smoothstep(38, 26, Math.abs(x)) * smoothstep(42, 30, y);
        nz = nz * (1 - fit * 0.55) - fit * 0.8;
        pos.setZ(i, z + nz);
      } else if (y > H - 0.5) { // 顶面起伏
        pos.setY(i, y + (fbm(x * 0.08, -z * 0.08, 3) - 0.5) * 3);
      }
      // UV 按实际尺寸重复（每 8m）
      const nx = Math.abs(g.attributes.normal.getX(i)), ny = Math.abs(g.attributes.normal.getY(i));
      let su = 1, sv = 1;
      if (nx > 0.5) { su = D / 8; sv = H / 8; }
      else if (ny > 0.5) { su = W / 8; sv = D / 8; }
      else { su = W / 8; sv = H / 8; }
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    g.computeVertexNormals();
    b.addRaw('rock', g);
    // 顶部几株树
    for (let i = 0; i < 9; i++) {
      const tx = -52 + i * 12 + (hash2(i, 1) - 0.5) * 6;
      const tz = -12 - hash2(i, 2) * 26;
      tree(b, tx, tz, 1.1 + hash2(i, 3) * 0.5, 81.5);
    }
    b.build(matFactory => matFactory, group);
  }

  /* ---- 山脚岩坡 ---- */
  {
    const b = mk('mound');
    const segX = 72, segY = 12, W = 136, H = 15.5;
    const pos = [], uvA = [], idx = [];
    for (let j = 0; j <= segY; j++) {
      const v = j / segY, y = v * H;
      for (let i = 0; i <= segX; i++) {
        const u = i / segX, x = -W / 2 + u * W;
        let z = 18.5 - 19.5 * Math.pow(v, 0.92) + (fbm(x * 0.13, y * 0.5, 3) - 0.5) * 1.7;
        z += smoothstep(52, 66, Math.abs(x)) * 7; // 两侧展开
        z -= Math.exp(-Math.pow((y - 6.2) / 0.9, 2)) * 1.1;
        z -= Math.exp(-Math.pow((y - 10.5) / 0.9, 2)) * 1.1;
        pos.push(x, y, z);
        uvA.push(u * W / 7, v * H / 7);
      }
    }
    const row = segX + 1;
    for (let j = 0; j < segY; j++) for (let i = 0; i < segX; i++) {
      const a = j * row + i, c = a + row;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    b.addRaw('rock', g);
    b.build(matFactory => matFactory, group);
  }

  /* ---- 石砌台基 ---- */
  {
    const b = mk('terrace');
    b.add('stone', BOX(76, 3.2, 15), mat4(0, 15.4, -0.6));
    b.add('stone', BOX(77, 0.5, 16), mat4(0, 17.05, -0.6)); // 顶面檐线
    b.add('plaster', BOX(76, 1.1, 0.24), mat4(0, 14.2, 6.9)); // 正面白灰缝带
    b.build(matFactory => matFactory, group);
  }

  /* ---- 南楼 / 北楼 ---- */
  const southTop = pavilion(mk('southTower'), { x: -28, z: 0, w: 11, d: 6.4, floors: 3, floorH: 3.15, baseY: 17 });
  const northTop = pavilion(mk('northTower'), { x: 28, z: 0, w: 11, d: 6.4, floors: 3, floorH: 3.35, baseY: 17 });

  /* ---- 大雄宝殿（主殿，两层大顶）与配殿 ---- */
  pavilion(mk('mainHall'), { x: 1, z: -0.4, w: 13.5, d: 7.2, floors: 2, floorH: 3.6, baseY: 17, main: true });
  pavilion(mk('sideHall'), { x: 16.5, z: 0.6, w: 6.4, d: 5.2, floors: 1, floorH: 3.3, baseY: 17, door: false });

  /* ---- 长线桥（连接南北楼二层挑台） ---- */
  bridge(mk('bridge'), { x1: -23.2, x2: 23.2, y: 21.6, z: 2.1, w: 2.5 });

  /* ---- 悬空柱（斜撑至岩坡） ---- */
  {
    const b = mk('stilts');
    const rows = [
      // [x, 顶部z, 顶部y, 落脚y]
      [-31.5, 3.6, 19.6, 6.4], [-28, 3.7, 19.6, 5.2], [-24.5, 3.6, 19.6, 7.6],
      [-8, 3.8, 19.4, 8.2], [-3, 3.8, 19.4, 6.8], [2.5, 3.8, 19.4, 9.0], [7.5, 3.8, 19.4, 6.0],
      [24.5, 3.7, 19.6, 7.2], [28, 3.7, 19.6, 5.6], [31.5, 3.6, 19.6, 6.6],
    ];
    for (const [sx, szTop, syTop, fy] of rows) {
      // 岩坡表面 z（与 mound 同公式近似）
      const fz = 18.5 - 19.5 * Math.pow(fy / 15.5, 0.92) + 0.6;
      const top = new THREE.Vector3(sx, syTop, szTop - 0.1);
      const foot = new THREE.Vector3(sx + (hash2(sx, fy) - 0.5) * 0.3, fy, fz + 0.25);
      strutBetween(top, foot, 0.3, 0.34, 'beamWood', b);
      b.add('stone', BOX(0.7, 0.3, 0.7), mat4(foot.x, fy - 0.15, foot.z)); // 柱脚垫石
      dougong(b, top.x, syTop - 0.4, top.z);
    }
    b.build(matFactory => matFactory, group);
  }

  /* ---- 插岩横梁（殿前深挑部分） ---- */
  {
    const b = mk('beams');
    for (const bx of [-4.5, 0, 4.5, 9]) {
      b.add('beamWood', BOX(0.3, 0.38, 8.6), mat4(bx, 19.1, 1.6));
    }
    b.build(matFactory => matFactory, group);
  }

  /* ---- 山门 / 石阶 / 广场 ---- */
  {
    gate(mk('gate'), { x: -6, z: 46, baseY: 0.3 });
    const b = mk('path');
    // 之字形登山道：三段踏步 + 平台
    const flights = [
      { x0: -6, z0: 44, y0: 0.5, x1: -2, z1: 30, y1: 3.6 },
      { x0: -2, z0: 30, y0: 3.6, x1: 2, z1: 18, y1: 7.4 },
      { x0: 2, z0: 18, y0: 7.4, x1: 0.5, z1: 10, y1: 11.6 },
    ];
    for (const f of flights) {
      const len = Math.hypot(f.x1 - f.x0, f.z1 - f.z0, f.y1 - f.y0);
      const steps = Math.round(len / 0.55);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = f.x0 + (f.x1 - f.x0) * t, pz = f.z0 + (f.z1 - f.z0) * t, py = f.y0 + (f.y1 - f.y0) * t;
        const ang = Math.atan2(f.x1 - f.x0, f.z1 - f.z0);
        b.add('stone', BOX(2.6, 0.22, 0.62), mat4(px, py - 0.11, pz, 0, ang, 0));
      }
      // 平台
      b.add('stone', BOX(3.4, 0.3, 3.2), mat4(f.x1, f.y1 - 0.15, f.z1));
    }
    // 河岸步道
    b.add('stone', BOX(46, 0.25, 2.6), mat4(18, 0.35, 58));
    b.build(matFactory => matFactory, group);
  }
  {
    const b = mk('plaza');
    b.add('plaza', BOX(52, 0.32, 30), mat4(0, 0.16, 36));
    b.add('plaza', BOX(53, 0.2, 31), mat4(0, 0.1, 36));
    b.build(matFactory => matFactory, group);
  }

  /* ---- 河流 / 地面 ---- */
  {
    const b = mk('river');
    const g = new THREE.PlaneGeometry(420, 90, 80, 16);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.12, 105);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 24, uv.getY(i) * 5);
    b.addRaw('water', g);
    b.build(matFactory => matFactory, group);
  }
  {
    const b = mk('ground');
    const g = new THREE.PlaneGeometry(420, 300, 100, 72);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 30);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i) + 30;
      pos.setY(i, groundH(x, z));
    }
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 26, uv.getY(i) * 18);
    g.computeVertexNormals();
    b.addRaw('ground', g);
    // 河畔与广场树木
    const treeSpots = [
      [-30, 62, 1.2], [-18, 66, 1.4], [-6, 63, 1.1], [8, 67, 1.5], [22, 64, 1.2], [34, 68, 1.3],
      [-34, 30, 1.0], [36, 32, 1.05], [-24, 12, 0.9], [30, 10, 0.85], [12, 8, 0.8], [-40, 48, 1.25], [44, 46, 1.15],
    ];
    for (const [tx, tz, ts] of treeSpots) tree(b, tx, tz, ts, groundH(tx, tz));
    b.build(matFactory => matFactory, group);
  }

  /* ---- 合并小件：斗拱/勾栏已随构件并入 ---- */

  const bounds = new THREE.Box3().setFromObject(group);
  return { group, parts: Object.keys(parts), bounds, materials: MATERIALS };
}
