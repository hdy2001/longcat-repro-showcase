// ===== 机器人：网格 + AI =====
import * as THREE from 'three';
import { BOT, TEAM_ALPHA, PLAYER_TEAM } from './config';
import { Character, createCharacter, moveCharacter, raycastWorld } from './physics';
import { WAYPOINTS, WAYPOINT_EDGES, BOT_OBJECTIVES } from './map/mapData';
import { nearestWaypoint, findPath } from './waypoints';

export type BotState = 'patrol' | 'engage' | 'hunt' | 'dead';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = new THREE.Vector3();

// 队伍配色
const TEAM_VEST = [0xb08d4f, 0x5d7a4a];   // ALPHA 沙黄 / BRAVO 橄榄绿
const TEAM_HELMET = [0x8a6f3e, 0x49603a];

export class Bot {
  id: number;
  team: number;
  name: string;
  char: Character;
  state: BotState = 'patrol';
  hp = BOT.hp;
  alive = true;
  mesh: THREE.Group;
  private head: THREE.Mesh;
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private gunMesh: THREE.Group;
  private nameSprite: THREE.Sprite;
  private muzzle: THREE.Object3D;

  // AI
  private path: number[] = [];
  private pathIdx = 0;
  private repathTimer = 0;
  private thinkTimer = 0;
  private stuckTimer = 0;
  private lastPos = new THREE.Vector3();
  private targetBot: Bot | null = null;
  private targetPlayerFlag = false;
  playerAliveRef = true;
  private targetLastKnown = new THREE.Vector3();
  private reactTimer = 0;
  private burstLeft = 0;
  private shotCooldown = 0;
  private loseSightTimer = 0;
  private aimYaw = 0;
  private aimPitch = 0;
  private walkCycle = 0;
  private stepTimer = 0;
  spawnProtecT = 0;
  lastAttacker: Bot | 'player' | null = null;
  muzzleFlashT = 0;
  lastShotTime = 0;

  // 事件回调（由 main 注入）
  onShoot: ((bot: Bot, origin: THREE.Vector3, dir: THREE.Vector3) => void) | null = null;
  onFootstep: ((pos: THREE.Vector3, sprint: boolean) => void) | null = null;
  onDeath: ((bot: Bot) => void) | null = null;

  constructor(id: number, team: number, name: string, x: number, z: number) {
    this.id = id;
    this.team = team;
    this.name = name;
    this.char = createCharacter(x, 0, z, BOT.height / 2 - BOT.radius, BOT.radius);
    this.mesh = new THREE.Group();
    this.buildMesh();
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0.14, 1.32, -0.5);
    this.mesh.add(this.muzzle);
    this.head = this.mesh.getObjectByName('head') as THREE.Mesh;
    this.legL = this.mesh.getObjectByName('legL') as THREE.Mesh;
    this.legR = this.mesh.getObjectByName('legR') as THREE.Mesh;
    this.gunMesh = this.mesh.getObjectByName('gun') as THREE.Group;
    this.nameSprite = this.mesh.getObjectByName('name') as THREE.Sprite;
    this.spawnProtecT = BOT.spawnProtectTime;
    this.aimYaw = Math.atan2(-x, -z) + Math.PI;
  }

  get pos() { return this.char.pos; }
  get eyePos(): THREE.Vector3 {
    return _v1.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
  }

  private buildMesh() {
    const g = this.mesh;
    const vest = new THREE.MeshStandardMaterial({ color: TEAM_VEST[this.team], roughness: 0.9 });
    const helmet = new THREE.MeshStandardMaterial({ color: TEAM_HELMET[this.team], roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc9a184, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.6, metalness: 0.4 });

    // 躯干
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), vest);
    body.position.y = 1.08;
    body.castShadow = true;
    g.add(body);
    // 头
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skin);
    head.position.y = 1.62;
    head.castShadow = true;
    head.name = 'head';
    g.add(head);
    // 头盔
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), helmet);
    helm.position.y = 1.66;
    helm.castShadow = true;
    g.add(helm);
    // 腿
    const legGeo = new THREE.BoxGeometry(0.17, 0.78, 0.2);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.95 });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.14, 0.39, 0);
    legL.castShadow = true;
    legL.name = 'legL';
    g.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.14, 0.39, 0);
    legR.castShadow = true;
    legR.name = 'legR';
    g.add(legR);
    // 手臂
    const armGeo = new THREE.BoxGeometry(0.12, 0.5, 0.14);
    const arm = new THREE.Mesh(armGeo, vest);
    arm.position.set(0.3, 1.1, -0.1);
    arm.rotation.x = -1.1;
    g.add(arm);
    // 枪
    const gun = new THREE.Group();
    gun.name = 'gun';
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.62), dark);
    gunBody.position.set(0, 0, -0.28);
    gun.add(gunBody);
    const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), dark);
    gunMag.position.set(0, -0.1, -0.1);
    gun.add(gunMag);
    gun.position.set(0.14, 1.32, -0.42);
    g.add(gun);
    // 名牌
    const nameMat = new THREE.SpriteMaterial({
      map: makeNameTexture(this.name, this.team),
      transparent: true,
      depthWrite: false,
    });
    const name = new THREE.Sprite(nameMat);
    name.scale.set(1.6, 0.4, 1);
    name.position.y = 2.05;
    name.name = 'name';
    g.add(name);
  }

  // 每帧更新
  update(dt: number, playerChar: Character, playerAlive: boolean, bots: Bot[]) {
    if (!this.alive) return;
    this.playerAliveRef = playerAlive;
    this.spawnProtecT = Math.max(0, this.spawnProtecT - dt);
    this.thinkTimer -= dt;
    this.shotCooldown -= dt;
    this.repathTimer -= dt;
    this.muzzleFlashT = Math.max(0, this.muzzleFlashT - dt);

    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.16 + Math.random() * 0.08;
      this.think(playerChar, playerAlive, bots);
    }

    // 移动
    let moveX = 0, moveZ = 0;
    const engaging = this.state === 'engage' && this.hasTarget();
    const speed = engaging ? BOT.engageSpeed : BOT.runSpeed;

    if (engaging) {
      const t = this.getCurrentTargetPos();
      if (t) {
        const dx = t.x - this.pos.x;
        const dz = t.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        const desiredYaw = Math.atan2(dx, dz);
        this.aimYaw = lerpAngle(this.aimYaw, desiredYaw, dt * 8);
        const dy = (t.y + 1.2) - (this.pos.y + 1.55);
        this.aimPitch = Math.atan2(dy, Math.max(0.1, dist));
        const toward = dist > 22 ? 1 : dist < 8 ? -0.7 : 0;
        const strafe = Math.sin(performance.now() / 900 + this.id * 2.1) > 0 ? 1 : -1;
        moveX = (dx / (dist || 1)) * toward + (-dz / (dist || 1)) * strafe * 0.6;
        moveZ = (dz / (dist || 1)) * toward + (dx / (dist || 1)) * strafe * 0.6;
        const len = Math.hypot(moveX, moveZ) || 1;
        moveX = (moveX / len) * speed;
        moveZ = (moveZ / len) * speed;
      }
    } else if (this.pathIdx < this.path.length) {
      const node = WAYPOINTS[this.path[this.pathIdx]];
      const dx = node.x - this.pos.x;
      const dz = node.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.0) {
        this.pathIdx++;
      } else {
        const targetYaw = Math.atan2(dx, dz);
        this.aimYaw = lerpAngle(this.aimYaw, targetYaw, dt * 6);
        this.aimPitch = lerpAngle(this.aimPitch, 0, dt * 6);
        moveX = (dx / dist) * speed;
        moveZ = (dz / dist) * speed;
      }
    } else if (this.state === 'hunt') {
      const dx = this.targetLastKnown.x - this.pos.x;
      const dz = this.targetLastKnown.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        this.state = 'patrol';
        this.repathTimer = 0;
      } else {
        const yaw = Math.atan2(dx, dz);
        this.aimYaw = lerpAngle(this.aimYaw, yaw, dt * 6);
        moveX = (dx / dist) * speed;
        moveZ = (dz / dist) * speed;
      }
    }

    // 机器人间分离
    for (const b of bots) {
      if (b === this || !b.alive) continue;
      const dx = this.pos.x - b.pos.x;
      const dz = this.pos.z - b.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < BOT.separation * BOT.separation && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (BOT.separation - d) / BOT.separation;
        moveX += (dx / d) * push * 3;
        moveZ += (dz / d) * push * 3;
      }
    }

    // 卡死检测
    this.stuckTimer += dt;
    if (this.stuckTimer > 1.0) {
      const moved = this.pos.distanceTo(this.lastPos);
      const tryingToMove = Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1;
      if (tryingToMove && moved < 0.35) {
        this.unstick();
      }
      this.stuckTimer = 0;
      this.lastPos.copy(this.pos);
    }

    // 应用移动（重力积分）
    const vy = this.char.vel.y - 18 * dt;
    this.char.vel.y = Math.max(vy, -22);
    const hasMove = moveX !== 0 || moveZ !== 0;
    moveCharacter(this.char, moveX, this.char.vel.y * dt, moveZ, dt);
    if (this.char.grounded) this.char.vel.y = Math.max(this.char.vel.y, -0.5);

    // 动画 + 脚步
    if (hasMove) {
      const spd = Math.hypot(moveX, moveZ);
      this.walkCycle += dt * spd * 2.2;
      this.stepTimer -= dt * spd;
      if (this.stepTimer <= 0 && this.char.grounded) {
        this.stepTimer = 2.4;
        this.onFootstep?.(this.pos, spd > 3.5);
      }
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, this.aimYaw + Math.PI, 0);
    const swing = Math.sin(this.walkCycle) * 0.5;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.gunMesh.rotation.x = -this.aimPitch * 0.8;

    // 开火
    if (engaging) {
      const t = this.getCurrentTargetPos();
      if (t && this.reactTimer > 0) {
        this.reactTimer -= dt;
      } else if (t && this.reactTimer <= 0) {
        if (this.burstLeft <= 0 && this.shotCooldown <= 0) {
          this.burstLeft = randInt(BOT.burstLen[0], BOT.burstLen[1]);
        }
        if (this.burstLeft > 0 && this.shotCooldown <= 0) {
          this.burstLeft--;
          this.shotCooldown = this.burstLeft > 0 ? 60 / BOT.rpm : randRange(0.35, 0.8);
          this.shootAt(t);
        }
      }
    } else {
      this.burstLeft = 0;
    }
  }

  private hasTarget(): boolean {
    if (this.targetBot) return this.targetBot.alive;
    if (this.targetPlayerFlag) return this.playerAliveRef;
    return false;
  }

  private getCurrentTargetPos(): THREE.Vector3 | null {
    if (this.targetBot && this.targetBot.alive) {
      const p = this.targetBot.pos;
      return _v2.set(p.x, p.y + 1.2, p.z);
    }
    if (this.targetPlayerFlag && this.playerAliveRef) {
      const p = this.playerPosRef;
      return _v2.set(p.x, p.y + 1.2, p.z);
    }
    return null;
  }

  private playerPosRef = new THREE.Vector3();

  private think(playerChar: Character, playerAlive: boolean, bots: Bot[]) {
    this.playerPosRef.copy(playerChar.pos);
    const eye = this.eyePos.clone();
    const enemyTeam = this.team === TEAM_ALPHA ? 1 - TEAM_ALPHA : TEAM_ALPHA;

    let seenBot: Bot | null = null;
    let seenPlayer = false;
    let bestDist = Infinity;

    // 检查玩家（敌对时）
    if (playerAlive && enemyTeam === PLAYER_TEAM) {
      const dist = Math.hypot(playerChar.pos.x - this.pos.x, playerChar.pos.z - this.pos.z);
      if (dist < BOT.sightRange && this.hasLineOfSight(eye, playerChar.pos, dist)) {
        if (dist < bestDist) { bestDist = dist; seenPlayer = true; seenBot = null; }
      }
    }
    // 检查对方 bots
    for (const b of bots) {
      if (!b.alive || b.team !== enemyTeam) continue;
      const dist = Math.hypot(b.pos.x - this.pos.x, b.pos.z - this.pos.z);
      if (dist > BOT.sightRange || dist >= bestDist) continue;
      if (this.state === 'patrol' || this.state === 'hunt') {
        const yawTo = Math.atan2(b.pos.x - this.pos.x, b.pos.z - this.pos.z);
        if (Math.abs(angDiff(yawTo, this.aimYaw)) > (BOT.fovDeg / 2) * (Math.PI / 180)) continue;
      }
      if (!this.hasLineOfSight(eye, b.pos, dist)) continue;
      bestDist = dist;
      seenBot = b;
      seenPlayer = false;
    }

    if (seenBot || seenPlayer) {
      const src = seenBot ? seenBot.pos : playerChar.pos;
      this.targetLastKnown.set(src.x, src.y, src.z);
      const isNew = seenBot ? this.targetBot !== seenBot : !this.targetPlayerFlag;
      if (isNew) {
        this.reactTimer = randRange(BOT.reactTime[0], BOT.reactTime[1]);
      }
      this.targetBot = seenBot;
      this.targetPlayerFlag = seenPlayer;
      this.state = 'engage';
      this.loseSightTimer = BOT.loseSightTime;
      this.path = [];
      this.pathIdx = 0;
    } else if (this.state === 'engage') {
      this.loseSightTimer -= 0.2;
      if (this.loseSightTimer <= 0) {
        this.state = 'hunt';
        this.targetBot = null;
        this.targetPlayerFlag = false;
        this.path = [];
        this.pathIdx = 0;
        this.repathTimer = 0;
      }
    }

    // 巡逻 / 追击选路
    if (this.state === 'patrol' || this.state === 'hunt') {
      if (this.repathTimer <= 0 || this.pathIdx >= this.path.length) {
        this.repathTimer = randRange(6, 10);
        let targetNode: number;
        if (this.state === 'hunt') {
          targetNode = nearestWaypoint(this.targetLastKnown.x, this.targetLastKnown.z, this.targetLastKnown.y);
        } else {
          const objectives = BOT_OBJECTIVES[this.team];
          targetNode = objectives[randInt(0, objectives.length - 1)];
        }
        const from = nearestWaypoint(this.pos.x, this.pos.z, this.pos.y);
        this.path = findPath(from, targetNode);
        this.pathIdx = 0;
      }
    }
  }

  private hasLineOfSight(eye: THREE.Vector3, targetFeet: THREE.Vector3, dist: number): boolean {
    const targetEye = _v1.set(targetFeet.x, targetFeet.y + 1.4, targetFeet.z);
    _dir.copy(targetEye).sub(eye);
    const d = _dir.length();
    if (d < 0.001) return true;
    _dir.normalize();
    const wall = raycastWorld(eye, _dir, d, this.char.collider);
    return !(wall && wall.dist < d - 0.5);
  }

  private shootAt(targetPos: THREE.Vector3) {
    const origin = new THREE.Vector3();
    this.muzzle.getWorldPosition(origin);
    const err = (BOT.aimErrorDeg * Math.PI) / 180;
    const dir = _dir.copy(targetPos).sub(origin).normalize();
    dir.x += (Math.random() - 0.5) * err * 2;
    dir.y += (Math.random() - 0.5) * err * 1.4;
    dir.z += (Math.random() - 0.5) * err * 2;
    dir.normalize();
    this.muzzleFlashT = 0.06;
    this.onShoot?.(this, origin, dir);
  }

  private unstick() {
    const from = nearestWaypoint(this.pos.x, this.pos.z, this.pos.y);
    const neighbors: number[] = [];
    for (const [i, j] of WAYPOINT_EDGES) {
      if (i === from) neighbors.push(j);
      else if (j === from) neighbors.push(i);
    }
    if (neighbors.length) {
      const t = neighbors[randInt(0, neighbors.length - 1)];
      this.path = findPath(from, t);
      this.pathIdx = 0;
      this.state = 'patrol';
      this.repathTimer = 4;
    }
    this.char.vel.y = 5;
  }

  takeDamage(dmg: number, attacker: Bot | 'player' | null, attackerPos?: THREE.Vector3): boolean {
    if (!this.alive || this.spawnProtecT > 0) return false;
    this.hp -= dmg;
    this.lastAttacker = attacker;
    if (attacker && attacker !== 'player') {
      this.targetLastKnown.copy(attacker.pos);
      this.state = 'hunt';
      this.repathTimer = 0;
      this.targetPlayerFlag = false;
      this.targetBot = null;
    } else if (attacker === 'player') {
      // 被玩家打：警觉并追向玩家方位
      if (attackerPos) this.targetLastKnown.copy(attackerPos);
      this.targetPlayerFlag = true;
      this.reactTimer = Math.min(this.reactTimer, 0.3);
      this.state = 'hunt';
      this.repathTimer = 0;
      this.targetBot = null;
    }
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die() {
    this.alive = false;
    this.state = 'dead';
    this.mesh.visible = false;
    this.onDeath?.(this);
  }

  respawn(x: number, z: number) {
    this.alive = true;
    this.hp = BOT.hp;
    this.state = 'patrol';
    this.path = [];
    this.pathIdx = 0;
    this.repathTimer = 0;
    this.targetBot = null;
    this.targetPlayerFlag = false;
    this.spawnProtecT = BOT.spawnProtectTime;
    this.char.pos.set(x, 0, z);
    this.char.vel.set(0, 0, 0);
    this.char.body.setNextKinematicTranslation({ x, y: 0, z });
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
  }
}

function randInt(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }
function randRange(a: number, b: number) { return a + Math.random() * (b - a); }
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}
function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function makeNameTexture(name: string, team: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 5;
  ctx.fillStyle = team === TEAM_ALPHA ? '#ffc46b' : '#7de08a';
  ctx.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
