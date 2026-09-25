// ============================================================
// 机器人 (Bot) —— 动态胶囊体 + 路点寻路 + 战斗 AI
// ============================================================
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WAYPOINT_MAP, WAYPOINTS, findPath, PATROL_TARGETS } from './mapdata';
import type { TeamId } from './types';

/** 机器人与外部世界的接口 (由 game.ts 实现, 避免循环依赖) */
export interface BotWorld {
  world: RAPIER.World;
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  playerTeam: TeamId;
  bots: Bot[];
  now: number; // 秒
  onBotShoot: (bot: Bot, origin: THREE.Vector3, dir: THREE.Vector3) => void;
  onBotDamaged: (bot: Bot, dmg: number, attacker: Bot | 'player') => void;
  onPlayerDamaged: (dmg: number, attacker: Bot) => void;
  onKill: (killer: Bot | 'player', victim: Bot) => void;
  audioDist: (pos: THREE.Vector3) => number;
}

const BOT_R = 0.38;          // 胶囊半径
const BOT_HH = 0.62;         // 胶囊圆柱半高 (总高约 2.0)
const BOT_SPEED = 4.3;
const BOT_HP = 100;
const VIEW_DIST = 60;
const FOV_COS = Math.cos((115 / 2) * Math.PI / 180);
const REACTION_MIN = 0.28, REACTION_MAX = 0.6;
const BURST_LEN = [3, 4, 5, 6];
const BURST_PAUSE = [0.45, 0.7, 0.95];
const BOT_DMG = [9, 13];
const BOT_SPREAD = 0.055;    // 弧度

let botIdCounter = 0;

export class Bot {
  readonly id: number;
  readonly name: string;
  readonly team: TeamId;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Group;
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private armR: THREE.Mesh;
  private gunMesh: THREE.Mesh;
  hp = BOT_HP;
  alive = true;
  respawnAt = 0;
  // 移动
  path: string[] = [];
  pathIdx = 0;
  repathAt = 0;
  stuckTime = 0;
  lastPos = new THREE.Vector3();
  walkPhase = 0;
  // 战斗
  target: Bot | 'player' | null = null;
  lastSeenPos = new THREE.Vector3();
  lastSeenTime = -99;
  reactionAt = 0;
  burstLeft = 0;
  nextShotAt = 0;
  nextBurstAt = 0;
  lastFiredAt = -99;   // 用于小地图开火暴露
  strafeDir = 1;
  strafeAt = 0;
  // 感知缓存
  private senseAt = 0;
  private sensedTarget: Bot | 'player' | null = null;

  constructor(
    private ctx: BotWorld,
    scene: THREE.Scene,
    team: TeamId,
    name: string,
    x: number, z: number,
    body: RAPIER.RigidBody,
    collider: RAPIER.Collider,
  ) {
    this.id = botIdCounter++;
    this.team = team;
    this.name = name;
    this.body = body;
    this.collider = collider;

    // ---------- 视觉模型 ----------
    const g = new THREE.Group();
    const uniform = team === 'T' ? 0x4a6b8a : 0x8a4636;
    const uniformDark = team === 'T' ? 0x3a5570 : 0x6e352a;
    const skin = 0xc9a184;
    const mat = new THREE.MeshLambertMaterial({ color: uniform });
    const matDark = new THREE.MeshLambertMaterial({ color: uniformDark });
    const matSkin = new THREE.MeshLambertMaterial({ color: skin });
    const matGun = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });

    // 躯干
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), mat);
    torso.position.y = 1.12;
    torso.castShadow = true;
    g.add(torso);
    // 战术背心
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.4), matDark);
    vest.position.y = 1.18;
    vest.castShadow = true;
    g.add(vest);
    // 头
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), matSkin);
    head.position.y = 1.66;
    head.castShadow = true;
    g.add(head);
    // 头盔
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.36), matDark);
    helmet.position.y = 1.82;
    helmet.castShadow = true;
    g.add(helmet);
    // 腿
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), matDark);
    this.legL.position.set(-0.16, 0.38, 0);
    this.legL.castShadow = true;
    g.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    g.add(this.legR);
    // 持枪手臂 + 枪
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), mat);
    this.armR.position.set(0.3, 1.3, 0.25);
    g.add(this.armR);
    this.gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.85), matGun);
    this.gunMesh.position.set(0.3, 1.32, 0.62);
    this.gunMesh.castShadow = true;
    g.add(this.gunMesh);
    // 左臂
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.42), mat);
    armL.position.set(-0.3, 1.28, 0.2);
    armL.rotation.y = 0.3;
    g.add(armL);

    g.position.set(x, 0, z);
    scene.add(g);
    this.mesh = g;
    this.lastPos.set(x, 0, z);
  }

  get pos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get eyePos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y + 1.55, t.z);
  }

  /** 当前朝向 (弧度, 绕 y) */
  get yaw(): number {
    return this.mesh.rotation.y;
  }

  // ----------------------------------------------------------
  // 主更新
  // ----------------------------------------------------------
  update(dt: number): void {
    if (!this.alive) {
      // 尸体倒下动画
      if (this.mesh.rotation.x > -Math.PI / 2 + 0.05) {
        this.mesh.rotation.x -= dt * 4;
        this.mesh.position.y = Math.max(this.mesh.position.y - dt * 0.4, 0.15);
      }
      return;
    }

    const now = this.ctx.now;
    this.sense(now);

    // ---------- 战斗决策 ----------
    if (this.sensedTarget && this.sensedTarget !== null) {
      const tp = this.targetPos();
      const dist = this.pos.distanceTo(tp);
      // 面向目标
      const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z;
      const desiredYaw = Math.atan2(dx, dz);
      this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, desiredYaw, Math.min(1, dt * 10));
      // 反应时间
      if (now >= this.reactionAt && dist < VIEW_DIST) {
        this.combatMove(dt, tp, dist);
        this.tryShoot(now, tp, dist);
      }
    } else {
      // ---------- 巡逻/进攻 ----------
      this.followPath(dt, now);
    }

    // ---------- 卡住检测 ----------
    const moved = this.pos.distanceTo(this.lastPos);
    if (this.pathIdx < this.path.length) {
      const expect = BOT_SPEED * dt;
      if (moved < expect * 0.25) {
        this.stuckTime += dt;
        if (this.stuckTime > 0.5) {
          // 尝试跳跃
          const v = this.body.linvel();
          this.body.setLinvel({ x: v.x, y: 4.5, z: v.z }, true);
          this.stuckTime = 0;
          if (Math.random() < 0.4) this.repath(); // 换条路
        }
      } else {
        this.stuckTime = 0;
      }
    }
    this.lastPos.copy(this.pos);

    // ---------- 视觉同步 ----------
    const t = this.body.translation();
    this.mesh.position.set(t.x, t.y - BOT_HH - BOT_R, t.z);
    // 走路摆动
    const speed = Math.hypot(this.body.linvel().x, this.body.linvel().z);
    this.walkPhase += dt * speed * 2.4;
    const sw = Math.min(speed / BOT_SPEED, 1) * 0.5;
    this.legL.rotation.x = Math.sin(this.walkPhase) * sw;
    this.legR.rotation.x = -Math.sin(this.walkPhase) * sw;
    this.armR.rotation.x = -Math.sin(this.walkPhase) * sw * 0.4;
  }

  // ----------------------------------------------------------
  // 感知: 找视野内敌人
  // ----------------------------------------------------------
  private sense(now: number): void {
    if (now - this.senseAt < 0.12) { // 8Hz 感知
      this.target = this.sensedTarget;
      return;
    }
    this.senseAt = now;
    let best: Bot | 'player' | null = null;
    let bestD = VIEW_DIST;
    const eye = this.eyePos;
    const fwd = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));

    const consider = (pos: THREE.Vector3, obj: Bot | 'player') => {
      const d = eye.distanceTo(pos);
      if (d > bestD) return;
      const dir = new THREE.Vector3().subVectors(pos, eye).normalize();
      if (dir.dot(fwd) < FOV_COS && d > 3) return;
      if (this.ctx.world.castRay(
        new RAPIER.Ray({ x: eye.x, y: eye.y, z: eye.z }, { x: dir.x, y: dir.y, z: dir.z }),
        d, true, undefined, undefined, this.collider, undefined, undefined,
      )) return; // 有遮挡
      best = obj; bestD = d;
    };

    for (const b of this.ctx.bots) {
      if (b.team === this.team || !b.alive) continue;
      consider(b.eyePos.clone().setY(b.eyePos.y - 0.3), b);
    }
    if (this.ctx.playerAlive && this.ctx.playerTeam !== this.team) {
      consider(this.ctx.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)), 'player');
    }
    this.sensedTarget = best;
    this.target = best;
    if (best) {
      this.lastSeenPos.copy(this.targetPos());
      this.lastSeenTime = now;
      if (this.reactionAt < now) {
        this.reactionAt = now + REACTION_MIN + Math.random() * (REACTION_MAX - REACTION_MIN);
      }
    }
  }

  private targetPos(): THREE.Vector3 {
    if (this.target === 'player') return this.ctx.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0));
    if (this.target instanceof Bot) return this.target.eyePos.clone().setY(this.target.eyePos.y - 0.3);
    return this.lastSeenPos.clone();
  }

  // ----------------------------------------------------------
  // 战斗移动: 保持距离 + 左右横移
  // ----------------------------------------------------------
  private combatMove(dt: number, tp: THREE.Vector3, dist: number): void {
    const now = this.ctx.now;
    if (now > this.strafeAt) {
      this.strafeAt = now + 0.7 + Math.random() * 0.9;
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    }
    const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len, nz = dz / len;
    // 理想交战距离 10~26m
    let mx = 0, mz = 0;
    if (dist > 26) { mx += nx; mz += nz; }
    else if (dist < 8) { mx -= nx; mz -= nz; }
    mx += -nz * this.strafeDir * 0.8;
    mz += nx * this.strafeDir * 0.8;
    const ml = Math.hypot(mx, mz) || 1;
    const v = this.body.linvel();
    this.body.setLinvel({ x: (mx / ml) * BOT_SPEED * 0.75, y: v.y, z: (mz / ml) * BOT_SPEED * 0.75 }, true);
    void dt;
  }

  // ----------------------------------------------------------
  // 射击
  // ----------------------------------------------------------
  private tryShoot(now: number, tp: THREE.Vector3, dist: number): void {
    if (now < this.nextShotAt) return;
    if (this.burstLeft <= 0) {
      if (now < this.nextBurstAt) return;
      this.burstLeft = BURST_LEN[Math.floor(Math.random() * BURST_LEN.length)];
    }
    this.burstLeft--;
    this.nextShotAt = now + (this.burstLeft > 0 ? 0.11 : 0);
    if (this.burstLeft === 0) {
      this.nextBurstAt = now + BURST_PAUSE[Math.floor(Math.random() * BURST_PAUSE.length)];
    }
    // 瞄准点 + 散布 (距离越远越不准)
    const spread = BOT_SPREAD * (1 + dist / 45);
    const aim = tp.clone();
    aim.x += (Math.random() - 0.5) * spread * dist;
    aim.y += (Math.random() - 0.5) * spread * dist * 0.6;
    aim.z += (Math.random() - 0.5) * spread * dist;
    const origin = this.eyePos;
    const dir = aim.sub(origin).normalize();
    this.lastFiredAt = now;
    this.ctx.onBotShoot(this, origin, dir);
  }

  // ----------------------------------------------------------
  // 巡逻: 沿路点前进
  // ----------------------------------------------------------
  private followPath(dt: number, now: number): void {
    if (this.pathIdx >= this.path.length || now > this.repathAt) {
      this.repath();
    }
    if (this.pathIdx >= this.path.length) return;
    const wp = WAYPOINT_MAP.get(this.path[this.pathIdx])!;
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) {
      this.pathIdx++;
      return;
    }
    const v = this.body.linvel();
    this.body.setLinvel({ x: (dx / d) * BOT_SPEED, y: v.y, z: (dz / d) * BOT_SPEED }, true);
    // 面向移动方向
    const desiredYaw = Math.atan2(dx, dz);
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, desiredYaw, Math.min(1, dt * 6));
  }

  private repath(): void {
    const now = this.ctx.now;
    this.repathAt = now + 6 + Math.random() * 4;
    // 找最近路点作为起点
    const myPos = this.pos;
    let nearest = WAYPOINTS[0];
    let nd = Infinity;
    for (const w of WAYPOINTS) {
      const d = Math.hypot(w.x - myPos.x, w.z - myPos.z);
      if (d < nd) { nd = d; nearest = w; }
    }
    // 目标: 偏向进攻敌方半场 / 关键区域
    const target = PATROL_TARGETS[Math.floor(Math.random() * PATROL_TARGETS.length)];
    this.path = findPath(nearest.id, target);
    this.pathIdx = 0;
  }

  // ----------------------------------------------------------
  // 受伤 / 死亡
  // ----------------------------------------------------------
  damage(dmg: number, attacker: Bot | 'player'): void {
    if (!this.alive) return;
    this.hp -= dmg;
    // 被打后立刻警觉: 朝向攻击者
    if (attacker === 'player') {
      this.lastSeenPos.copy(this.ctx.playerPos);
    } else {
      this.lastSeenPos.copy(attacker.pos);
    }
    this.lastSeenTime = this.ctx.now;
    this.reactionAt = this.ctx.now + 0.15;
    if (this.hp <= 0) {
      this.die(attacker);
    } else if (!this.target) {
      // 受击未发现敌人 → 朝受击方向搜索
      this.repath();
    }
  }

  private die(attacker: Bot | 'player'): void {
    this.alive = false;
    this.hp = 0;
    this.respawnAt = this.ctx.now + 4;
    this.mesh.rotation.x = 0;
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setEnabled(false);
    this.ctx.onKill(attacker, this);
  }

  /** 重生 */
  respawn(x: number, z: number): void {
    this.alive = true;
    this.hp = BOT_HP;
    this.body.setEnabled(true);
    this.body.setTranslation({ x, y: 1.2, z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.mesh.rotation.x = 0;
    this.mesh.position.set(x, 0, z);
    this.path = [];
    this.pathIdx = 0;
    this.target = null;
    this.sensedTarget = null;
    this.repathAt = 0;
    this.repath();
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export { BOT_HP };
