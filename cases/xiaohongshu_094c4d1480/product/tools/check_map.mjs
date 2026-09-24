// 地图导航验证器：node tools/check_map.mjs
// 1) 每条导航边做真实 Rapier 射线 LOS 校验
// 2) 从出生点 BFS 全图连通性
// 3) 出生点 / 包点不在墙内
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 打包纯数据模块（不依赖 three）
const tmp = '/tmp/mapdata.bundle.mjs';
await build({
  entryPoints: [path.join(root, 'src/mapdata.ts')],
  bundle: true, format: 'esm', outfile: tmp, logLevel: 'silent',
});

const RAPIER = await import('@dimforge/rapier3d-compat');
await RAPIER.init();
const md = await import(tmp);

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

// 静态碰撞体（与游戏一致： cuboid 盒子）
const colliders = [];
for (const s of md.STATICS) {
  if (s.mat === 'ground' || s.mat === 'desert') continue;
  const c = world.createCollider(
    RAPIER.ColliderDesc.cuboid(s.w / 2, s.h / 2, s.d / 2)
      .setTranslation(s.x, s.y + s.h / 2, s.z)
      .setFriction(0.8),
  );
  colliders.push(c);
}

function losClear(ax, az, bx, bz, y = 0.9) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return true;
  const ray = new RAPIER.Ray({ x: ax, y, z: az }, { x: dx / len, y: 0, z: dz / len });
  const hit = world.castRay(ray, len, true, undefined, undefined, undefined, undefined);
  if (!hit) return true;
  const toi = hit.timeOfImpact ?? hit.toi;
  return toi >= len - 0.05;
}

// ---- 1) 导航边校验 ----
let bad = 0;
for (const [a, b] of md.NAV_EDGES) {
  const A = md.WAYPOINTS[a], B = md.WAYPOINTS[b];
  if (!losClear(A.x, A.z, B.x, B.z)) {
    console.log(`  ✗ 边 ${a}(${A.x},${A.z}) → ${b}(${B.x},${B.z}) 被阻挡`);
    bad++;
  }
}
console.log(bad === 0 ? `✓ 全部 ${md.NAV_EDGES.length} 条导航边 LOS 畅通` : `✗ ${bad} 条边被阻挡`);

// ---- 2) 连通性 BFS ----
const adj = new Map();
for (const [a, b] of md.NAV_EDGES) {
  if (!adj.has(a)) adj.set(a, []);
  if (!adj.has(b)) adj.set(b, []);
  adj.get(a).push(b);
  adj.get(b).push(a);
}
const seen = new Set([0]);
const queue = [0];
while (queue.length) {
  const n = queue.shift();
  for (const m of adj.get(n) || []) if (!seen.has(m)) { seen.add(m); queue.push(m); }
}
const unreachable = md.WAYPOINTS.filter(w => !seen.has(w.id)).map(w => w.id);
console.log(unreachable.length === 0
  ? `✓ 从出生点可达全部 ${md.WAYPOINTS.length} 个路径点`
  : `✗ 不可达路径点: ${unreachable.join(',')}`);

// ---- 3) 出生点 / 包点校验 ----
let ok = true;
for (const [name, list] of [['蓝方', md.BLUE_SPAWNS], ['红方', md.RED_SPAWNS]]) {
  for (const [x, z] of list) {
    const ray = new RAPIER.Ray({ x, y: 0.9, z }, { x: 0, y: 1, z: 0 });
    const hit = world.castRay(ray, 0.9, true);
    if (hit) { console.log(`  ✗ ${name}出生点 (${x},${z}) 在障碍内`); ok = false; }
  }
}
for (const s of md.SITES) {
  const ray = new RAPIER.Ray({ x: s.x, y: 0.9, z: s.z }, { x: 0, y: 1, z: 0 });
  if (world.castRay(ray, 0.9, true)) { console.log(`  ✗ ${s.name} 包点在障碍内`); ok = false; }
}
console.log(ok ? '✓ 出生点与包点均有效' : '✗ 存在无效点');

// ---- 4) 打印地图统计 ----
console.log(`\n静态盒: ${md.STATICS.length}, 路径点: ${md.WAYPOINTS.length}, 边: ${md.NAV_EDGES.length}`);
const walls = md.STATICS.filter(s => s.mat === 'wall').length;
console.log(`墙 ${walls}, 箱子 ${md.STATICS.filter(s => s.mat === 'crate').length}, 沙袋 ${md.STATICS.filter(s => s.mat === 'sandbag').length}`);

process.exit(bad === 0 && unreachable.length === 0 && ok ? 0 : 1);
