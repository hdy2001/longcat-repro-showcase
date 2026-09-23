// ===== 路点图：A* 寻路 + 边可行性验证 =====
import { WAYPOINTS, WAYPOINT_EDGES, WALLS, COVER, PLATFORM, STAIRS, TUNNEL_ROOF } from './map/mapData';

export interface NavNode { x: number; z: number; y: number }

// 阻挡盒（考虑高度的 2D 盒）
interface BlockBox { minX: number; maxX: number; minZ: number; maxZ: number; top: number }

const blockers: BlockBox[] = [];

function addBlocker(cx: number, cz: number, sx: number, sz: number, top: number) {
  blockers.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, top });
}

let built = false;
function buildBlockers() {
  if (built) return;
  built = true;
  for (const w of WALLS) {
    const dx = Math.abs(w.x2 - w.x1) + 1;
    const dz = Math.abs(w.z2 - w.z1) + 1;
    addBlocker((w.x1 + w.x2) / 2, (w.z1 + w.z2) / 2, Math.max(dx, 1), Math.max(dz, 1), w.h ?? 4.5);
  }
  addBlocker(TUNNEL_ROOF.x, TUNNEL_ROOF.z, TUNNEL_ROOF.sx, TUNNEL_ROOF.sz, TUNNEL_ROOF.y + TUNNEL_ROOF.sy / 2);
  addBlocker(PLATFORM.x, PLATFORM.z, PLATFORM.sx, PLATFORM.sz, PLATFORM.y + PLATFORM.sy / 2);
  for (const s of STAIRS) {
    // 楼梯台阶低，可通过 autostep 越过 → 不作为阻挡
    if (s.sy > 0.55) addBlocker(s.x, s.z, s.sx, s.sz, s.y + s.sy / 2);
  }
  for (const b of COVER) {
    if (b.sy <= 0.55) continue; // 可跨越
    const r = Math.max(b.sx, b.sz) / 2;
    addBlocker(b.x, b.z, r * 2, r * 2, b.y + b.sy / 2);
  }
}

// 边采样点是否被阻挡（考虑两端点高度插值）
function edgeBlocked(i: number, j: number): boolean {
  const a = WAYPOINTS[i], b = WAYPOINTS[j];
  const steps = 10;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const y = a.y + (b.y - a.y) * t;
    for (const box of blockers) {
      if (x > box.minX - 0.45 && x < box.maxX + 0.45 && z > box.minZ - 0.45 && z < box.maxZ + 0.45) {
        // 阻挡条件：盒子顶部高于脚底+0.55 且盒子底部低于头顶
        const feetY = y;
        if (box.top > feetY + 0.55 && feetY + 1.7 > 0.0) {
          // 隧道顶板例外：其下方通道高度足够
          if (box.top > 3.5) continue;
          return true;
        }
      }
    }
  }
  return false;
}

// ---------- A* ----------
const adj: Map<number, { to: number; cost: number }[]> = new Map();

export function buildGraph(): { removedEdges: number } {
  buildBlockers();
  adj.clear();
  let removed = 0;
  const validEdges: [number, number][] = [];
  for (const [i, j] of WAYPOINT_EDGES) {
    if (edgeBlocked(i, j)) {
      removed++;
      continue;
    }
    validEdges.push([i, j]);
  }
  for (const [i, j] of validEdges) {
    const a = WAYPOINTS[i], b = WAYPOINTS[j];
    const cost = Math.hypot(a.x - b.x, a.z - b.z, (a.y - b.y) * 1.5);
    if (!adj.has(i)) adj.set(i, []);
    if (!adj.has(j)) adj.set(j, []);
    adj.get(i)!.push({ to: j, cost });
    adj.get(j)!.push({ to: i, cost });
  }
  return { removedEdges: removed };
}

export function nearestWaypoint(x: number, z: number, y = 0): number {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const w = WAYPOINTS[i];
    const d = Math.hypot(w.x - x, w.z - z) + Math.abs(w.y - y) * 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function findPath(from: number, to: number): number[] {
  if (from === to) return [from];
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const open: { id: number; f: number }[] = [];
  const h = (id: number) => {
    const a = WAYPOINTS[id], b = WAYPOINTS[to];
    return Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y);
  };
  dist.set(from, h(from));
  open.push({ id: from, f: h(from) });
  const closed = new Set<number>();
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    if (cur.id === to) {
      const path: number[] = [to];
      let p = to;
      while (p !== from) {
        p = prev.get(p)!;
        path.unshift(p);
      }
      return path;
    }
    if (closed.has(cur.id)) continue;
    closed.add(cur.id);
    const edges = adj.get(cur.id) ?? [];
    for (const e of edges) {
      if (closed.has(e.to)) continue;
      const g = (dist.get(cur.id) ?? Infinity) - h(cur.id) + e.cost;
      const old = dist.get(e.to) ?? Infinity;
      if (g < old) {
        dist.set(e.to, g + h(e.to));
        prev.set(e.to, cur.id);
        open.push({ id: e.to, f: g + h(e.to) });
      }
    }
  }
  // 不可达：直接直线（兜底）
  return [from, to];
}

// 供调试输出
export function debugGraph(): string {
  let edges = 0;
  for (const [, list] of adj) edges += list.length;
  return `nodes=${WAYPOINTS.length} edges=${edges / 2}`;
}
