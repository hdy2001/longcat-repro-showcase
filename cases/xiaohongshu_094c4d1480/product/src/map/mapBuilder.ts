// ===== 地图构建：Three.js 网格 + Rapier 碰撞体 =====
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WALLS, COVER, PLATFORM, STAIRS, TUNNEL_ROOF, LAMPS, SITE_MARKERS, MAP } from './mapData';
import { getMaterial, groundTexture, siteMarkerTexture } from './textures';

export interface BuiltMap {
  group: THREE.Group;
  colliderDescs: RAPIER.ColliderDesc[]; // 静态碰撞体（不含刚体）
}

export function buildMapMeshes(): THREE.Group {
  const group = new THREE.Group();

  // 地面
  const groundGeo = new THREE.PlaneGeometry(MAP.maxX - MAP.minX, MAP.maxZ - MAP.minZ);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((MAP.minX + MAP.maxX) / 2, 0, (MAP.minZ + MAP.maxZ) / 2);
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  // 围墙
  const stoneMat = getMaterial('stone');
  for (const w of WALLS) {
    const dx = Math.abs(w.x2 - w.x1) + 1; // 厚度 1
    const dz = Math.abs(w.z2 - w.z1) + 1;
    const cx = (w.x1 + w.x2) / 2;
    const cz = (w.z1 + w.z2) / 2;
    const h = w.h ?? MAP.wallH;
    const geo = new THREE.BoxGeometry(Math.max(dx, 1), h, Math.max(dz, 1));
    const mesh = new THREE.Mesh(geo, stoneMat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 隧道顶板
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(TUNNEL_ROOF.sx, TUNNEL_ROOF.sy, TUNNEL_ROOF.sz),
    getMaterial('darkstone'),
  );
  roof.position.set(TUNNEL_ROOF.x, TUNNEL_ROOF.y, TUNNEL_ROOF.z);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // A 区平台 + 楼梯
  const plat = new THREE.Mesh(
    new THREE.BoxGeometry(PLATFORM.sx, PLATFORM.sy, PLATFORM.sz),
    getMaterial('stone'),
  );
  plat.position.set(PLATFORM.x, PLATFORM.y, PLATFORM.z);
  plat.castShadow = true;
  plat.receiveShadow = true;
  group.add(plat);

  for (const s of STAIRS) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(s.sx, s.sy, s.sz),
      stoneMat,
    );
    step.position.set(s.x, s.y, s.z);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  // 掩体
  for (const b of COVER) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.sx, b.sy, b.sz),
      getMaterial(b.mat),
    );
    mesh.position.set(b.x, b.y, b.z);
    if (b.rotY) mesh.rotation.y = b.rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 灯具（发光灯罩）
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe6b0, emissive: 0xffc86e, emissiveIntensity: 2.2,
  });
  const lampGeo = new THREE.BoxGeometry(0.7, 0.18, 0.35);
  for (const l of LAMPS) {
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(l.x, l.y, l.z);
    group.add(lamp);
    // 灯杆
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6),
      getMaterial('metal'),
    );
    pole.position.set(l.x, l.y + 0.35, l.z);
    group.add(pole);
  }

  // 包点标记
  for (const s of SITE_MARKERS) {
    const mat = new THREE.MeshBasicMaterial({
      map: siteMarkerTexture(s.label), transparent: true, depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(s.x, s.y, s.z);
    group.add(plane);
  }

  return group;
}

// ---------- Rapier 静态碰撞体 ----------
export function buildStaticColliders(): RAPIER.ColliderDesc[] {
  const descs: RAPIER.ColliderDesc[] = [];
  const friction = 0.9;

  // 地面
  descs.push(
    RAPIER.ColliderDesc.cuboid(
      (MAP.maxX - MAP.minX) / 2, 0.5, (MAP.maxZ - MAP.minZ) / 2,
    )
      .setTranslation((MAP.minX + MAP.maxX) / 2, -0.5, (MAP.minZ + MAP.maxZ) / 2)
      .setFriction(friction),
  );

  const pushBox = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) => {
    descs.push(
      RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2)
        .setTranslation(cx, cy, cz)
        .setFriction(friction),
    );
  };

  for (const w of WALLS) {
    const dx = Math.abs(w.x2 - w.x1) + 1;
    const dz = Math.abs(w.z2 - w.z1) + 1;
    const cx = (w.x1 + w.x2) / 2;
    const cz = (w.z1 + w.z2) / 2;
    pushBox(cx, (w.h ?? MAP.wallH) / 2, cz, Math.max(dx, 1), w.h ?? MAP.wallH, Math.max(dz, 1));
  }

  pushBox(TUNNEL_ROOF.x, TUNNEL_ROOF.y, TUNNEL_ROOF.z, TUNNEL_ROOF.sx, TUNNEL_ROOF.sy, TUNNEL_ROOF.sz);
  pushBox(PLATFORM.x, PLATFORM.y, PLATFORM.z, PLATFORM.sx, PLATFORM.sy, PLATFORM.sz);
  for (const s of STAIRS) pushBox(s.x, s.y, s.z, s.sx, s.sy, s.sz);
  const rotQuat = new THREE.Quaternion();
  const upAxis = new THREE.Vector3(0, 1, 0);
  for (const b of COVER) {
    if (b.rotY) {
      rotQuat.setFromAxisAngle(upAxis, b.rotY);
      const r = Math.max(b.sx, b.sz) / 2;
      descs.push(
        RAPIER.ColliderDesc.cuboid(r, b.sy / 2, r)
          .setTranslation(b.x, b.y, b.z)
          .setRotation({ x: rotQuat.x, y: rotQuat.y, z: rotQuat.z, w: rotQuat.w })
          .setFriction(friction),
      );
    } else {
      pushBox(b.x, b.y, b.z, b.sx, b.sy, b.sz);
    }
  }

  return descs;
}
