// ============================================================
// 地图数据 —— 原创沙漠军事基地「沙尘行动」
// 纯数据模块：不依赖 three.js，可在 Node 中独立验证
// 坐标系：x 向东，z 向南，y 向上。单位：米
// ============================================================

export interface Box {
  x: number; y: number; z: number;   // 中心 x/z，底部 y
  w: number; h: number; d: number;   // 宽 / 高 / 深
  mat: 'wall' | 'crate' | 'sandbag' | 'step' | 'ground' | 'desert' | 'ceil' | 'deco';
}

export interface Waypoint { id: number; x: number; z: number }
export type Edge = [number, number];

const W = 4; // 墙高

function box(x: number, y: number, z: number, w: number, h: number, d: number, mat: Box['mat']): Box {
  return { x, y, z, w, h, d, mat };
}

// ---------- 楼梯 ----------
function stairs(
  out: Box[], xStart: number, zCenter: number, width: number,
  dir: 1 | -1, steps: number, rise: number, run: number, mat: Box['mat'] = 'step',
): void {
  for (let i = 0; i < steps; i++) {
    const top = rise * (steps - i);
    const cx = xStart + dir * (run * i + run / 2);
    out.push(box(cx, 0, zCenter, run, top, width, mat));
  }
}

// ---------- 箱子堆 ----------
function crate(out: Box[], x: number, z: number, level: number): void {
  out.push(box(x, level + 0.5, z, 1, 1, 1, 'crate'));
}

function buildStatics(): Box[] {
  const b: Box[] = [];

  // ===== 地面 =====
  b.push(box(0, -0.5, 0, 92, 1, 64, 'ground'));       // 可行走地面
  b.push(box(0, -1.0, 0, 420, 0.9, 420, 'desert'));   // 外围沙漠

  // ===== 周边墙 =====
  b.push(box(0, 0, -30, 88, W, 1, 'wall'));   // 北
  b.push(box(0, 0, 30, 88, W, 1, 'wall'));    // 南
  b.push(box(-44, 0, 0, 1, W, 60, 'wall'));   // 西
  b.push(box(44, 0, 0, 1, W, 60, 'wall'));    // 东

  // ===== 蓝方出生区（西南） x[-44,-30] z[2,28] =====
  b.push(box(-30, 0, 9, 1, W, 14, 'wall'));          // 东墙 z2..16
  b.push(box(-30, 0, 26, 1, W, 4, 'wall'));          // 东墙 z24..28
  b.push(box(-30, 2.4, 20, 1, 1.6, 8, 'wall'));      // 门楣 z16..24（通往长廊）
  b.push(box(-41, 0, 2, 6, W, 1, 'wall'));           // 北墙 x-44..-38
  b.push(box(-32, 0, 2, 4, W, 1, 'wall'));           // 北墙 x-34..-30
  b.push(box(-36, 2.4, 2, 4, 1.6, 1, 'wall'));       // 北墙门楣（通往B区）
  b.push(box(-37, 0, 28, 14, W, 1, 'wall'));         // 南墙（封闭）

  // ===== B区（西侧大院） x[-44,-5] z[-30,2] =====
  b.push(box(-5, 0, -21.5, 1, W, 17, 'wall'));       // 东墙 z-30..-13
  b.push(box(-5, 0, -3.5, 1, W, 11, 'wall'));        // 东墙 z-9..2（隧道口 z-13..-9）

  // ===== 隧道（B区→中路） x[-22,-3] z[-13,-9] =====
  b.push(box(-12.5, 0, -13, 19, W, 1, 'wall'));      // 隧道北墙
  b.push(box(-12.5, 0, -9, 19, W, 1, 'wall'));       // 隧道南墙
  b.push(box(-12.5, 3, -11, 19, 0.6, 4, 'ceil'));    // 隧道顶

  // ===== 中路 x[-3,3] z[-20,18] =====
  b.push(box(-3, 0, -16.5, 1, W, 7, 'wall'));        // 西墙 z-20..-13
  b.push(box(-3, 0, 4.5, 1, W, 27, 'wall'));         // 西墙 z-9..18（隧道口 z-13..-9）
  b.push(box(3, 0, -5, 1, W, 22, 'wall'));           // 东墙 z-16..6
  b.push(box(3, 0, 14, 1, W, 8, 'wall'));           // 东墙 z10..18
  b.push(box(3, 2.4, -18, 1, 1.6, 4, 'wall'));      // 门楣 z-20..-16（通往红方走廊）
  b.push(box(3, 2.4, 8, 1, 1.6, 4, 'wall'));        // 门楣 z6..10（A门）
  // 中路双扇门柱 z[0,2]
  b.push(box(-2, 0, 1, 2, W, 2, 'wall'));
  b.push(box(2, 0, 1, 2, W, 2, 'wall'));
  b.push(box(0, 2.4, 0, 2, 1.6, 1, 'wall'));
  b.push(box(0, 2.4, 2, 2, 1.6, 1, 'wall'));

  // ===== 长廊（西部） x[-36,-6] z[16,23] =====
  b.push(box(-21, 0, 23, 30, W, 1, 'wall'));         // 北墙
  b.push(box(-23.5, 0, 16, 25, W, 1, 'wall'));       // 南墙 x-36..-11（东口 x-11..-6 通往连接廊）

  // ===== 西连接廊 x[-11,-6] z[2,16] =====
  b.push(box(-11, 0, 9, 1, W, 14, 'wall'));
  b.push(box(-6, 0, 9, 1, W, 14, 'wall'));

  // ===== 红方链接走廊 x[-3,34] z[-30,-16] =====
  b.push(box(18.5, 0, -16, 31, W, 1, 'wall'));       // 南墙 x3..34

  // ===== 红方出生区（东北） x[34,44] z[-30,-6] =====
  // x=34 长墙（开口：红走廊 z-20..-16，南侧通道 z-6..4，A区东口 z10..18）
  b.push(box(34, 0, -25, 1, W, 10, 'wall'));
  b.push(box(34, 0, -11, 1, W, 10, 'wall'));
  b.push(box(34, 0, 7, 1, W, 6, 'wall'));
  b.push(box(34, 0, 24, 1, W, 12, 'wall'));
  b.push(box(34, 2.4, -18, 1, 1.6, 4, 'wall'));
  b.push(box(34, 2.4, -1, 1, 1.6, 10, 'wall'));
  b.push(box(34, 2.4, 14, 1, 1.6, 8, 'wall'));
  b.push(box(43, 0, -6, 2, W, 1, 'wall'));           // 南墙 x42..44
  b.push(box(38, 2.4, -6, 8, 1.6, 1, 'wall'));       // 南墙门楣（通道口 x34..42）
  b.push(box(42, 0, -1, 1, W, 10, 'wall'));          // 南侧通道东墙 z-6..4

  // ===== A区（东南） x[5,34] z[4,28] =====
  b.push(box(19.5, 0, 4, 29, W, 1, 'wall'));         // 北墙
  b.push(box(5, 0, 16, 1, W, 24, 'wall'));           // 西墙
  b.push(box(19, 0, 28, 28, W, 1, 'wall'));          // 南墙
  b.push(box(39, 0, 28, 10, W, 1, 'wall'));          // 东条带南墙
  b.push(box(5, 0, 29, 1, W, 2, 'wall'));

  // ===== B区狙击台（高台+楼梯） =====
  b.push(box(-41, 0, -21, 6, 2.4, 18, 'step'));      // 台体 x-44..-38 z-30..-12
  stairs(b, -38, -21, 6, 1, 6, 0.4, 0.9);            // 东侧台阶

  // ===== A区 bunker 平台+楼梯 =====
  b.push(box(27, 0, 13, 6, 1.2, 6, 'step'));         // 平台 x24..30 z10..16
  stairs(b, 24, 13, 6, -1, 3, 0.4, 0.9);             // 西侧台阶

  // ===== 木箱掩体 =====
  crate(b, -26, 17, 0); crate(b, -26, 17, 1);
  crate(b, -24, 22, 0);
  crate(b, -30, -6, 0); crate(b, -30, -6, 1);
  crate(b, -16, -20, 0); crate(b, -16, -20, 1);
  crate(b, -10, -6, 0);
  crate(b, -20, -15, 0);
  crate(b, 12, 8, 0);
  crate(b, 24, 20, 0); crate(b, 24, 20, 1);
  crate(b, 28, 6, 0);
  crate(b, 14, 22, 0);
  crate(b, -40, 10, 0); crate(b, -40, 10, 1);
  crate(b, -34, 26, 0);
  crate(b, 38, -14, 0);
  crate(b, 42, -28, 0);
  crate(b, 10, -18, 0);
  crate(b, 24, -24, 0);
  crate(b, -18, 24, 0);
  crate(b, -6, 5, 0);
  crate(b, 6, 5, 0);

  // ===== 沙袋掩体 =====
  const bags: Array<[number, number]> = [
    [-5.5, 4.5], [5.5, 4.5], [-18, -4], [16, 20], [22, 8],
    [-36, 14], [40, -16], [16, -20], [40, 20], [-32, 19], [36, 2],
  ];
  for (const [x, z] of bags) b.push(box(x, 0, z, 1.6, 0.55, 0.7, 'sandbag'));

  return b;
}

export const STATICS: Box[] = buildStatics();

// ---------- 路径点（导航图节点） ----------
const WP: Array<[number, number]> = [
  [-38, 22],   // 0 蓝方出生区
  [-33, 20],   // 1 蓝区东门（通往长廊）
  [-36, 4],    // 2 蓝区北门（通往B区）
  [-20, 20],   // 3 长廊中段
  [-8, 20],    // 4 长廊东口
  [-8.5, 9],   // 5 连接廊中段
  [-8.5, 3],   // 6 连接廊北口（B区东南角）
  [-20, -6],   // 7 B区中南
  [-34, -8],   // 8 狙击台东
  [-12, -11],  // 9 隧道西
  [-4, -11],   // 10 隧道东
  [0, 14],     // 11 中路南
  [0, -2],     // 12 中路中央（双扇门）
  [0, -12],    // 13 中路北
  [-1, -23],   // 14 中路北端外
  [8, -23],    // 15 红走廊西
  [20, -23],   // 16 红走廊中
  [33, -18],   // 17 红走廊东口（红区西门）
  [6, 0],      // 18 链接院西
  [16, 0],     // 19 链接院中
  [28, 0],     // 20 链接院东
  [31, -13],   // 21 凹室
  [36, 0],     // 22 南侧通道
  [40, 16],    // 23 东条带南
  [8, 8],      // 24 A区西
  [19, 16],    // 25 A区中央（A包点）
  [28, 12],    // 26 A区东
  [19, 24],    // 27 A区南
  [36, -4],    // 28 红区南通道口
  [39, -14],   // 29 红区中央
  [40, -24],   // 30 红区北
  [38, -8],    // 31 红区南
  [4, 8],      // 32 A门东侧
  [0, 8],      // 33 中路东段内
];
export const WAYPOINTS: Waypoint[] = WP.map(([x, z], id) => ({ id, x, z }));

const EDGES: Edge[] = [
  [0, 1], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [7, 9],
  [9, 10], [10, 13], [13, 12], [12, 11], [11, 1], [1, 2], [2, 7],
  [8, 9], [13, 14], [14, 15], [15, 16], [16, 17], [17, 29], [29, 30],
  [29, 31], [31, 28], [28, 22], [22, 23], [23, 26], [26, 25], [25, 24],
  [24, 32], [32, 33], [33, 12], [11, 33], [19, 33], [18, 19], [19, 20],
  [20, 21], [21, 22], [13, 11], [26, 27], [27, 25],
];
export const NAV_EDGES: Edge[] = EDGES;

// ---------- 出生点 ----------
export const BLUE_SPAWNS: Array<[number, number]> = [
  [-40, 18], [-36, 25], [-39, 24], [-34, 17], [-37, 10],
];
export const RED_SPAWNS: Array<[number, number]> = [
  [36, -9], [41, -12], [42, -26], [38, -27], [37, -20],
];

// ---------- 包点 ----------
export const SITES = [
  { name: 'A', x: 19, z: 16, r: 5 },
  { name: 'B', x: -24, z: -14, r: 5 },
];
