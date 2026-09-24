// 地图构建：Three.js 网格 + Rapier 碰撞体 + 导航图（A*）
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { STATICS, WAYPOINTS, NAV_EDGES, SITES, type Box } from './mapdata';
import { makeSandTexture, makeWallTexture, makeCrateTexture, makeSandbagTexture, makeTextSprite } from './textures';

export interface NavGraph {
  nodes: { x: number; z: number }[];
  adj: { to: number; cost: number }[][];
  nearestNode(x: number, z: number): number;
  findPath(from: number, to: number): number[];
}

export function buildNavGraph(): NavGraph {
  const adj = WAYPOINTS.map(() => [] as { to: number; cost: number }[]);
  for (const [a, b] of NAV_EDGES) {
    const A = WAYPOINTS[a], B = WAYPOINTS[b];
    const cost = Math.hypot(B.x - A.x, B.z - A.z);
    adj[a].push({ to: b, cost });
    adj[b].push({ to: a, cost });
  }
  const nearestNode = (x: number, z: number): number => {
    let best = 0, bd = Infinity;
    for (const n of WAYPOINTS) {
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  };
  // A*
  const findPath = (from: number, to: number): number[] => {
    const open = new Map<number, number>([[from, 0]]);
    const g = new Map<number, number>([[from, 0]]);
    const came = new Map<number, number>();
    const closed = new Set<number>();
    while (open.size) {
      let cur = -1, cf = Infinity;
      for (const [id, f] of open) if (f < cf) { cf = f; cur = id; }
      open.delete(cur);
      if (cur === to) break;
      closed.add(cur);
      const H = WAYPOINTS[cur];
      for (const e of adj[cur]) {
        if (closed.has(e.to)) continue;
        const ng = g.get(cur)! + e.cost;
        if (ng < (g.get(e.to) ?? Infinity)) {
          g.set(e.to, ng);
          came.set(e.to, cur);
          const T = WAYPOINTS[e.to];
          open.set(e.to, ng + Math.hypot(T.x - WAYPOINTS[to].x, T.z - WAYPOINTS[to].z));
        }
      }
    }
    if (!came.has(to) && from !== to) return [from];
    const path: number[] = [to];
    let c = to;
    while (c !== from) { c = came.get(c)!; path.unshift(c); }
    return path;
  };
  return { nodes: WAYPOINTS.map(n => ({ x: n.x, z: n.z })), adj, nearestNode, findPath };
}

export interface BuiltMap {
  group: THREE.Group;
  colliderMeshes: Map<number, THREE.Mesh>;   // collider handle → mesh（用于命中反馈）
  nav: NavGraph;
}

export function buildMap(world: RAPIER.World, scene: THREE.Scene): BuiltMap {
  const group = new THREE.Group();
  const colliderMeshes = new Map<number, THREE.Mesh>();

  const sandTex = makeSandTexture();
  const wallTex = makeWallTexture();
  const crateTex = makeCrateTexture();
  const bagTex = makeSandbagTexture();

  const mats: Record<string, THREE.MeshLambertMaterial> = {
    wall: new THREE.MeshLambertMaterial({ map: wallTex }),
    crate: new THREE.MeshLambertMaterial({ map: crateTex }),
    sandbag: new THREE.MeshLambertMaterial({ map: bagTex }),
    step: new THREE.MeshLambertMaterial({ map: wallTex, color: 0xd8c8a8 }),
    ground: new THREE.MeshLambertMaterial({ map: sandTex.clone() }),
    desert: new THREE.MeshLambertMaterial({ map: sandTex.clone() }),
    ceil: new THREE.MeshLambertMaterial({ color: 0x8a7454 }),
    deco: new THREE.MeshLambertMaterial({ color: 0x777777 }),
  };
  mats.ground.map!.repeat.set(22, 15);
  mats.desert.map!.repeat.set(46, 46);

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  for (const s of STATICS) {
    const mesh = new THREE.Mesh(unitBox, mats[s.mat] ?? mats.wall);
    mesh.scale.set(s.w, s.h, s.d);
    mesh.position.set(s.x, s.y + s.h / 2, s.z);
    mesh.castShadow = s.mat === 'wall' || s.mat === 'ceil';
    mesh.receiveShadow = true;
    group.add(mesh);

    if (s.mat !== 'ground' && s.mat !== 'desert') {
      const col = world.createCollider(
        RAPIER.ColliderDesc.cuboid(s.w / 2, s.h / 2, s.d / 2)
          .setTranslation(s.x, s.y + s.h / 2, s.z)
          .setFriction(0.7),
      );
      colliderMeshes.set(col.handle, mesh);
    }
  }

  // A / B 区地面标识
  for (const site of SITES) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.strokeStyle = site.name === 'A' ? 'rgba(255,170,40,0.9)' : 'rgba(90,160,255,0.9)';
    g.lineWidth = 14;
    g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke();
    g.font = 'bold 130px "Arial Black", Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.strokeText(site.name, 128, 132);
    g.fillStyle = site.name === 'A' ? 'rgba(255,170,40,0.85)' : 'rgba(90,160,255,0.85)';
    g.fillText(site.name, 128, 132);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const ring = new THREE.Mesh(
      new THREE.PlaneGeometry(site.r * 2, site.r * 2),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.02, site.z);
    group.add(ring);

    const label = makeTextSprite(`${site.name} 区`, site.name === 'A' ? '#ffaa28' : '#5aa0ff', 40);
    label.position.set(site.x, 4.6, site.z);
    group.add(label);
  }

  // 双方旗帜
  const flag = (x: number, z: number, color: number) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6), mats.deco);
    pole.position.set(x, 3, z);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1),
      new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
    );
    cloth.position.set(x + 0.85, 5.4, z);
    group.add(pole, cloth);
  };
  flag(-41, 25, 0x3d7bd9);
  flag(41, -9, 0xd9483d);

  scene.add(group);
  return { group, colliderMeshes, nav: buildNavGraph() };
}
