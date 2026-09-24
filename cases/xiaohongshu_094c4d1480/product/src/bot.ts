// 机器人：导航 AI（A* 路径点）+ 视线感知 + 点射交火 + 撤退
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CFG, TEAM, TEAM_INFO, type TeamId } from './config';
import { BLUE_SPAWNS, RED_SPAWNS } from './mapdata';
import type { NavGraph } from './map';
import { makeCamoTexture, makeTextSprite } from './textures';

const BOT_NAMES: Array<[string, TeamId]> = [
  ['毒蝎', TEAM.RED], ['响尾蛇', TEAM.RED], ['秃鹫', TEAM.RED], ['沙暴', TEAM.RED], ['眼镜蛇', TEAM.RED],
  ['猎鹰', TEAM.BLUE], ['孤狼', TEAM.BLUE], ['夜鹰', TEAM.BLUE], ['闪电', TEAM.BLUE],
];

export type BotState = 'patrol' | 'engage' | 'pursue' | 'retreat';

let camoTex: THREE.Texture | null = null;

export class Bot {
  id: number;
  name: string;
  team: TeamId;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  mesh: THREE.Group;
  hp = CFG.botHP;
  alive = true;

  state: BotState = 'patrol';
  path: number[] = [];
  pathI = 0;
  repathT = 0;
  objective = -1;
  lastKnown = new THREE.Vector3();
  lastSeenT = 0;
  reactT = 0;
  burstLeft = 0;
  burstPause = 0;
  aimYaw = 0;
  aimPitch = 0;
  stuckT = 0;
  lastPos = new THREE.Vector3();
  private vy = 0;
  private deadT = 0;
  private mats: THREE.Material[] = [];
  private ring: THREE.Mesh;

  // 回调（由 Game 注入）
  onFire: ((bot: Bot, from: THREE.Vector3, to: THREE.Vector3) => void) | null = null;

  constructor(world: RAPIER.World, id: number) {
    this.id = id;
    this.name = BOT_NAMES[id % BOT_NAMES.length][0];
    this.team = BOT_NAMES[id % BOT_NAMES.length][1];
    const spawns = this.team === TEAM.BLUE ? BLUE_SPAWNS : RED_SPAWNS;
    const [sx, sz] = spawns[id % spawns.length];

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(sx, 0.9, sz),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, CFG.radius).setFriction(0.2),
      this.body,
    );
    this.controller = world.createCharacterController(0.02);
    this.controller.enableAutostep(0.45, 0.2, true);
    this.controller.setMaxSlopeClimbAngle(0.8);
    this.controller.setApplyImpulsesToDynamicBodies(false);

    // ---- 外观 ----
    if (!camoTex) camoTex = makeCamoTexture();
    const teamColor = TEAM_INFO[this.team].color;
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ map: camoTex });
    const helmMat = new THREE.MeshLambertMaterial({ color: teamColor });
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x22201e });
    this.mats = [bodyMat, helmMat, gunMat];

    const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(CFG.radius, 1.0, 4, 10), bodyMat);
    bodyMesh.castShadow = true;
    g.add(bodyMesh);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), helmMat);
    head.position.y = 0.72;
    head.castShadow = true;
    g.add(head);

    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.62), gunMat);
    gun.position.set(0.22, 0.32, -0.3);
    g.add(gun);

    // 脚下队伍光环
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 20),
      new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = -0.82;
    g.add(this.ring);

    // 名字标签
    const tag = makeTextSprite(this.name, TEAM_INFO[this.team].css, 40);
    tag.position.y = 1.35;
    g.add(tag);

    this.mesh = g;
  }

  get pos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get eyePos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y + 0.55, t.z);
  }

  /** 枪口位置 */
  get muzzlePos(): THREE.Vector3 {
    const p = this.eyePos;
    const f = new THREE.Vector3(-Math.sin(this.aimYaw), 0, -Math.cos(this.aimYaw));
    return p.add(f.multiplyScalar(0.5)).add(new THREE.Vector3(0, -0.15, 0));
  }

  die(): void {
    this.alive = false;
    this.deadT = 0;
  }

  revive(): void {
    const spawns = this.team === TEAM.BLUE ? BLUE_SPAWNS : RED_SPAWNS;
    const [sx, sz] = spawns[Math.floor(Math.random() * spawns.length)];
    this.body.setTranslation({ x: sx, y: 0.9, z: sz }, true);
    this.hp = CFG.botHP;
    this.alive = true;
    this.state = 'patrol';
    this.path = [];
    this.objective = -1;
    this.mats.forEach(m => { m.transparent = false; m.opacity = 1; });
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = true;
  }

  /** 选取战略目标点 */
  private pickObjective(nav: NavGraph): void {
    const p = this.pos;
    const nodes = nav.nodes;
    const enemyX = this.team === TEAM.BLUE ? 20 : -20;
    let target: number;
    const roll = Math.random();
    if (roll < 0.55) {
      // 敌方腹地中随机
      const far = nodes.map((n, i) => ({ n, i }))
        .filter(({ n }) => Math.abs(n.x - enemyX) < 32 && Math.abs(n.x - p.x) > 25);
      target = far.length
        ? far[Math.floor(Math.random() * far.length)].i
        : Math.floor(Math.random() * nodes.length);
    } else if (roll < 0.8) {
      // 中路一带随机
      const mid = nodes.filter(n => Math.abs(n.x) < 12 && Math.abs(n.z) < 24);
      target = mid.length ? nodes.indexOf(mid[Math.floor(Math.random() * mid.length)]) : Math.floor(Math.random() * nodes.length);
    } else {
      target = Math.floor(Math.random() * nodes.length);
    }
    const from = nav.nearestNode(p.x, p.z);
    this.path = nav.findPath(from, target);
    this.pathI = 0;
    this.objective = target;
  }

  update(
    dt: number,
    now: number,
    nav: NavGraph,
    world: RAPIER.World,
    enemies: Array<{ pos: THREE.Vector3; alive: boolean; isPlayer: boolean; ref: unknown }>,
    onShot: (bot: Bot, from: THREE.Vector3, to: THREE.Vector3) => void,
  ): void {
    if (!this.alive) {
      // 死亡倒地 + 淡出
      this.deadT += dt;
      this.mesh.rotation.z = Math.min(this.deadT * 4, Math.PI / 2);
      if (this.deadT > 1.2) {
        const k = Math.max(1 - (this.deadT - 1.2) / 0.8, 0);
        this.mats.forEach(m => { m.transparent = true; m.opacity = k; });
        this.mesh.visible = k > 0.02;
      }
      return;
    }

    const p = this.pos;
    const eye = this.eyePos;

    // ---------- 感知 ----------
    let visible: { pos: THREE.Vector3; ref: unknown; isPlayer: boolean } | null = null;
    let visibleDist = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - p.x, dz = e.pos.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > CFG.botSightRange || dist >= visibleDist) continue;
      // 视野角
      const ang = Math.atan2(-dx, -dz);
      let dAng = ang - this.aimYaw;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      if (Math.abs(dAng) > CFG.botFov / 2 && dist > 6) continue;
      // LOS 射线
      const dir = new THREE.Vector3(dx / dist, (e.pos.y + 0.3 - eye.y) / dist, dz / dist);
      const ray = new RAPIER.Ray({ x: eye.x, y: eye.y, z: eye.z }, { x: dir.x, y: dir.y, z: dir.z });
      const hit = world.castRay(ray, dist, true, undefined, undefined, this.collider, undefined);
      if (hit) {
        if (hit.toi < dist - 0.6) continue; // 被墙挡住
      }
      visible = { pos: e.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), ref: e.ref, isPlayer: e.isPlayer };
      visibleDist = dist;
    }

    if (visible) {
      if (this.state !== 'engage') this.reactT = now + CFG.botReaction * (0.7 + Math.random() * 0.6);
      this.state = 'engage';
      this.lastKnown.copy(visible.pos);
      this.lastSeenT = now;
    } else if (this.state === 'engage') {
      this.state = now - this.lastSeenT < 2.5 ? 'pursue' : 'patrol';
    }
    if (this.hp < 35 && this.state === 'patrol') this.state = 'retreat';

    // ---------- 行为 ----------
    let moveDir: THREE.Vector3 | null = null;
    if (this.state === 'engage' && visible) {
      // 面向敌人
      const dx = visible.pos.x - p.x, dz = visible.pos.z - p.z;
      this.aimYaw = Math.atan2(-dx, -dz);
      const distY = (visible.pos.y + 0.2) - eye.y;
      this.aimPitch = Math.atan2(distY, Math.hypot(dx, dz));
      // 射击窗口
      if (now >= this.reactT) this.combatFire(dt, visible.pos, visibleDist, visible.isPlayer, onShot);
      // 近距离侧移
      if (visibleDist < 8) {
        const strafe = new THREE.Vector3(-(visible.pos.z - p.z), 0, visible.pos.x - p.x).normalize().multiplyScalar(this.id % 2 === 0 ? 1 : -1);
        moveDir = strafe;
      }
    } else {
      // 沿路径移动
      if (this.pathI >= this.path.length || this.repathT <= 0) {
        if (this.state === 'retreat') {
          const sx = this.team === TEAM.BLUE ? BLUE_SPAWNS[0] : RED_SPAWNS[0];
          this.path = nav.findPath(nav.nearestNode(p.x, p.z), nav.nearestNode(sx[0], sx[1]));
          this.pathI = 0;
          this.repathT = 6;
          if (this.hp > 60) this.state = 'patrol';
        } else {
          this.pickObjective(nav);
          this.repathT = 7 + Math.random() * 5;
        }
      }
      const targetNode = this.path[this.pathI];
      if (targetNode !== undefined) {
        const n = nav.nodes[targetNode];
        const dx = n.x - p.x, dz = n.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8) {
          this.pathI++;
        } else {
          moveDir = new THREE.Vector3(dx / d, 0, dz / d);
          if (this.state !== 'pursue') this.aimYaw = Math.atan2(-dx / d, -dz / d);
        }
      } else {
        this.pathI = this.path.length;
      }
      // pursue：到达最后可见点后转巡逻
      if (this.state === 'pursue') {
        const d = Math.hypot(this.lastKnown.x - p.x, this.lastKnown.z - p.z);
        if (d < 2) this.state = 'patrol';
        else {
          // 朝最后已知位置走
          const dir = new THREE.Vector3(this.lastKnown.x - p.x, 0, this.lastKnown.z - p.z).normalize();
          moveDir = dir;
          this.aimYaw = Math.atan2(-dir.x, -dir.z);
        }
      }
      this.aimPitch *= 0.9;
    }
    this.repathT -= dt;

    // ---------- 移动 ----------
    if (moveDir) {
      const desired = { x: moveDir.x * CFG.botSpeed * dt, y: this.vy * dt, z: moveDir.z * CFG.botSpeed * dt };
      if (this.controller.computedGrounded()) this.vy = -0.5;
      this.vy += CFG.worldGravity * dt;
      this.controller.computeColliderMovement(this.collider, desired);
      const m = this.controller.computedMovement();
      const t = this.body.translation();
      this.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    } else {
      // 站立：贴地
      if (this.controller.computedGrounded()) this.vy = -0.5;
      this.vy += CFG.worldGravity * dt;
      this.controller.computeColliderMovement(this.collider, { x: 0, y: this.vy * dt, z: 0 });
      const m = this.controller.computedMovement();
      const t = this.body.translation();
      this.body.setNextKinematicTranslation({ x: t.x, y: t.y + m.y, z: t.z });
    }

    // 卡死检测：长时间不动则重寻路
    if (moveDir && p.distanceToSquared(this.lastPos) < (dt * 0.4) ** 2) {
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        this.stuckT = 0;
        this.pathI = this.path.length;
        this.repathT = 0;
      }
    } else this.stuckT = 0;
    this.lastPos.copy(p);

    // ---------- 同步网格 ----------
    this.mesh.position.copy(p);
    this.mesh.rotation.y = this.aimYaw + Math.PI;
    this.mesh.rotation.x = this.state === 'engage' ? -this.aimPitch * 0.4 : 0;
  }

  private combatFire(
    dt: number,
    targetPos: THREE.Vector3,
    dist: number,
    isPlayer: boolean,
    onShot: (bot: Bot, from: THREE.Vector3, to: THREE.Vector3) => void,
  ): void {
    if (this.burstPause > 0) {
      this.burstPause -= dt;
      return;
    }
    if (this.burstLeft <= 0) {
      this.burstLeft = CFG.botBurst[0] + Math.floor(Math.random() * (CFG.botBurst[1] - CFG.botBurst[0] + 1));
    }
    this.burstLeft--;
    if (this.burstLeft <= 0) {
      this.burstPause = CFG.botBurstPause[0] + Math.random() * (CFG.botBurstPause[1] - CFG.botBurstPause[0]);
    }

    // 从眼睛发射，带误差
    const from = this.eyePos;
    const aimAt = targetPos.clone();
    const err = CFG.botAimError * (0.7 + dist / 45);
    aimAt.x += (Math.random() - 0.5) * 2 * err * dist * 0.14;
    aimAt.y += (Math.random() - 0.5) * 2 * err * dist * 0.06;
    aimAt.z += (Math.random() - 0.5) * 2 * err * dist * 0.14;
    const dir = aimAt.sub(from).normalize();
    void isPlayer;
    onShot(this, from.clone(), from.clone().add(dir.multiplyScalar(CFG.range)));
  }
}
