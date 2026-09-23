// ===== Rapier 物理世界 + 角色控制器 + 射线工具 =====
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PHYS, WP_MARGIN } from './config';
import { WAYPOINTS, WAYPOINT_EDGES } from './map/mapData';

export let world: RAPIER.World | null = null;
export let rapierReady = false;

export async function initPhysics(): Promise<RAPIER.World> {
  await RAPIER.init();
  rapierReady = true;
  world = new RAPIER.World({ x: 0, y: PHYS.gravity, z: 0 });
  world.timestep = PHYS.fixedDt;
  return world;
}

// 添加静态碰撞体
export function addStaticColliders(descs: RAPIER.ColliderDesc[]) {
  if (!world) return;
  for (const d of descs) {
    world.createCollider(d);
  }
}

// ---------- 角色（玩家/机器人共用） ----------
export interface Character {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  pos: THREE.Vector3;      // 脚底位置
  vel: THREE.Vector3;      // 自定义垂直速度
  grounded: boolean;
  halfHeight: number;
  radius: number;
}

export function createCharacter(
  x: number, y: number, z: number,
  halfHeight: number, radius: number,
): Character {
  if (!world) throw new Error('physics not initialized');
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(halfHeight, radius).setFriction(0.1),
    body,
  );
  const controller = world.createCharacterController(0.04);
  controller.enableAutostep(0.55, 0.25, true);
  controller.enableSnapToGround(0.5);
  controller.setApplyImpulsesToDynamicBodies(false);
  controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((55 * Math.PI) / 180);
  return {
    body, collider, controller,
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    grounded: false,
    halfHeight, radius,
  };
}

const _desired = { x: 0, y: 0, z: 0 };

// 移动角色；wishDir 为期望速度向量（已含速率与重力积分）
export function moveCharacter(ch: Character, wishDx: number, wishDy: number, wishDz: number, dt: number) {
  if (!world) return;
  _desired.x = wishDx * dt;
  _desired.y = wishDy * dt;
  _desired.z = wishDz * dt;
  ch.controller.computeColliderMovement(ch.collider, _desired);
  const m = ch.controller.computedMovement();
  ch.pos.x += m.x;
  ch.pos.y += m.y;
  ch.pos.z += m.z;
  ch.grounded = ch.controller.computedGrounded();
  // 地面贴合：controller 未贴地且正在下落时向下找地
  if (!ch.grounded && wishDy <= 0.01) {
    const probe = new RAPIER.Ray(
      { x: ch.pos.x, y: ch.pos.y + 0.3, z: ch.pos.z },
      { x: 0, y: -1, z: 0 },
    );
    const hit = world.castRay(probe, 0.6, true, undefined, undefined, ch.collider);
    if (hit) {
      const toi = hit.timeOfImpact;
      const targetY = ch.pos.y + 0.3 - toi;
      if (targetY < ch.pos.y) {
        ch.pos.y = Math.max(targetY, ch.pos.y - 0.35 * dt * 60);
      }
    }
  }
  ch.body.setNextKinematicTranslation({ x: ch.pos.x, y: ch.pos.y, z: ch.pos.z });
}

// ---------- 射线 ----------
const _ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

// 返回 { dist, point, normal } 或 null；可排除指定碰撞体
export function raycastWorld(
  origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number,
  exclude?: RAPIER.Collider,
): { dist: number; point: THREE.Vector3; normal: THREE.Vector3 } | null {
  if (!world) return null;
  _ray.origin.x = origin.x; _ray.origin.y = origin.y; _ray.origin.z = origin.z;
  _ray.dir.x = dir.x; _ray.dir.y = dir.y; _ray.dir.z = dir.z;
  const hit = world.castRayAndGetNormal(
    _ray, maxDist, true, undefined, undefined, exclude ?? undefined,
  );
  if (!hit) return null;
  const toi = hit.timeOfImpact;
  const n = hit.normal;
  return {
    dist: toi,
    point: new THREE.Vector3(origin.x + dir.x * toi, origin.y + dir.y * toi, origin.z + dir.z * toi),
    normal: new THREE.Vector3(n.x, n.y, n.z),
  };
}

// 射线与竖直胶囊（机器人身体）求交
// 返回 { dist, headshot } 或 null
export function rayVsCharacter(
  origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number,
  feetPos: THREE.Vector3, radius: number, height: number,
): { dist: number; headshot: boolean } | null {
  // 头部球体
  const headC = new THREE.Vector3(feetPos.x, feetPos.y + height - 0.18, feetPos.z);
  const headR = 0.24;
  const headHit = rayVsSphere(origin, dir, headC, headR, maxDist);
  // 身体：从 y+0.25 到 y+height-0.3 的竖直线段
  const segA = new THREE.Vector3(feetPos.x, feetPos.y + 0.25, feetPos.z);
  const segB = new THREE.Vector3(feetPos.x, feetPos.y + height - 0.3, feetPos.z);
  const bodyHit = rayVsVerticalSegment(origin, dir, segA, segB, radius, maxDist);
  let bestDist = Infinity;
  let bestHead = false;
  if (headHit !== null && headHit < bestDist) { bestDist = headHit; bestHead = true; }
  if (bodyHit !== null && bodyHit < bestDist) { bestDist = bodyHit; bestHead = false; }
  return bestDist < Infinity ? { dist: bestDist, headshot: bestHead } : null;
}

function rayVsSphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number, maxDist: number): number | null {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > maxDist) return null;
  return t;
}

// 射线到竖直线段的最短距离垂足（近似：采样投影）
function rayVsVerticalSegment(
  o: THREE.Vector3, d: THREE.Vector3,
  a: THREE.Vector3, b: THREE.Vector3,
  radius: number, maxDist: number,
): number | null {
  // 把线段按高度采样若干点做射线-球近似
  const segs = 5;
  let best: number | null = null;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const px = a.x, py = a.y + (b.y - a.y) * t, pz = a.z;
    const hit = rayVsSphere(o, d, { x: px, y: py, z: pz } as THREE.Vector3, radius * 0.92, maxDist);
    if (hit !== null && (best === null || hit < best)) best = hit;
  }
  return best;
}

// ---------- 路点图验证 ----------
interface WpBox { minX: number; maxX: number; minZ: number; maxZ: number; top: number; }

// 从碰撞体描述中构建阻挡盒（简化：直接从 mapData 的墙/覆盖物重建，在 waypoints.ts 中实现）
export function getNavDebugInfo() {
  return { wpCount: WAYPOINTS.length, edgeCount: WAYPOINT_EDGES.length };
}

export { WP_MARGIN };
