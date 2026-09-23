// ===== 沙漠行动 DUNE STRIKE — 主控制器 =====
import * as THREE from 'three';
import { initPhysics, addStaticColliders, world, raycastWorld, rayVsCharacter } from './physics';
import { buildMapMeshes, buildStaticColliders, buildStaticColliders as buildColliders } from './map/mapBuilder';
import { buildWorld } from './world';
import { buildGraph, debugGraph } from './waypoints';
import { AudioEngine } from './audio';
import { Effects } from './effects';
import { Weapon } from './weapon';
import { Player } from './player';
import { Bot } from './bot';
import { HUD } from './hud';
import {
  TEAM_ALPHA, TEAM_BRAVO, PLAYER_TEAM, WEAPON, MATCH, BOT,
  BOT_NAMES,
} from './config';
import { SPAWNS } from './map/mapData';

type GameState = 'menu' | 'countdown' | 'playing' | 'paused' | 'end';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

class Game {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  player!: Player;
  bots: Bot[] = [];
  weapon!: Weapon;
  hud = new HUD();
  audio = new AudioEngine();
  effects!: Effects;

  state: GameState = 'menu';
  scores = [0, 0];
  timeLeft = MATCH.roundTime;
  countdownT = 0;
  respawnT = 0;
  endWin = false;

  private canvas!: HTMLCanvasElement;
  private clock = new THREE.Clock();
  private acc = 0;
  private flyMode = false;
  private flyVel = new THREE.Vector3();
  private minimapTimer = 0;

  async init() {
    // 渲染器
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 900);

    // 物理
    await initPhysics();
    addStaticColliders(buildColliders());

    // 地图 + 世界
    this.scene.add(buildMapMeshes());
    buildWorld(this.scene);

    // 路点图
    const { removedEdges } = buildGraph();
    console.log(`[NavGraph] ${debugGraph()}, removedEdges=${removedEdges}`);

    // 特效
    this.effects = new Effects(this.scene);

    // 玩家
    const spawn = SPAWNS[TEAM_ALPHA][0];
    this.player = new Player(this.camera, spawn[0], spawn[1], -Math.PI / 2);
    this.player.bind(this.canvas);
    this.player.onFootstep = (s) => this.audio.footstep(s);
    this.player.onJump = () => {};
    this.player.onLand = () => this.audio.land();
    this.player.onDeath = () => this.onPlayerDeath();
    this.player.onLockChange = (locked) => {
      if (!locked && this.state === 'playing' && !DEBUG) this.pause();
    };

    // 武器
    this.weapon = new Weapon();
    this.camera.add(this.weapon.group);
    this.scene.add(this.camera);
    this.weapon.onShot = (o, d) => this.playerShoot(o, d);
    this.weapon.onDryFire = () => this.audio.dryFire();
    this.weapon.onReloadStart = () => this.audio.reload();
    this.weapon.onAmmoChanged = () => {
      this.hud.setAmmo(this.weapon.mag, this.weapon.reserve);
    };

    // 机器人
    this.spawnBots();

    // UI 事件
    document.getElementById('btn-start')!.addEventListener('click', () => this.startMatch());
    document.getElementById('btn-resume')!.addEventListener('click', () => this.resume());
    document.getElementById('btn-restart-pause')!.addEventListener('click', () => this.restart());
    document.getElementById('btn-restart-end')!.addEventListener('click', () => this.restart());

    // 调试热键
    document.addEventListener('keydown', (e) => {
      if (!DEBUG) return;
      if (e.code === 'KeyF') {
        this.flyMode = !this.flyMode;
        if (this.flyMode) {
          this.flyVel.set(0, 0, 0);
          document.exitPointerLock?.();
        }
      }
      if (e.code === 'KeyP') this.debugTopDown();
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 调试接口
    if (DEBUG) {
      (window as any).__game = this;
      this.startMatch();
    }

    this.clock.start();
    this.loop();
  }

  private spawnBots() {
    for (const b of this.bots) this.scene.remove(b.mesh);
    this.bots = [];
    let id = 0;
    // ALPHA 队友
    for (let i = 0; i < BOT.count[TEAM_ALPHA]; i++) {
      const sp = SPAWNS[TEAM_ALPHA][(i + 1) % SPAWNS[TEAM_ALPHA].length];
      this.addBot(id++, TEAM_ALPHA, BOT_NAMES[TEAM_ALPHA][i], sp[0], sp[1]);
    }
    // BRAVO 敌人
    for (let i = 0; i < BOT.count[TEAM_BRAVO]; i++) {
      const sp = SPAWNS[TEAM_BRAVO][i % SPAWNS[TEAM_BRAVO].length];
      this.addBot(id++, TEAM_BRAVO, BOT_NAMES[TEAM_BRAVO][i], sp[0], sp[1]);
    }
  }

  private addBot(id: number, team: number, name: string, x: number, z: number) {
    const bot = new Bot(id, team, name, x, z);
    bot.onShoot = (b, o, d) => this.botShoot(b, o, d);
    bot.onFootstep = (pos, sprint) => this.playBotFootstep(pos, sprint);
    bot.onDeath = (b) => this.onBotDeath(b);
    this.bots.push(bot);
    this.scene.add(bot.mesh);
  }

  private playBotFootstep(pos: THREE.Vector3, sprint: boolean) {
    // 简单处理：bot 脚步声直接播放（无位置声像，音量低）
    this.audio.footstep(sprint);
  }

  // ---------- 比赛流程 ----------
  private startMatch() {
    this.audio.init();
    this.audio.resume();
    this.state = 'countdown';
    this.countdownT = MATCH.countdown;
    this.scores = [0, 0];
    this.timeLeft = MATCH.roundTime;
    this.hud.setScores(0, 0);
    this.hud.setTimer(this.timeLeft);
    document.getElementById('menu-overlay')!.classList.add('hidden');
    document.getElementById('end-overlay')!.classList.add('hidden');
    document.getElementById('pause-overlay')!.classList.add('hidden');
    this.hud.show();
    this.hud.flashHint();
    this.resetPositions();
    if (!DEBUG) this.player.requestLock(this.canvas);
  }

  private resetPositions() {
    const sp = SPAWNS[TEAM_ALPHA][0];
    this.player.respawn(sp[0], sp[1], -Math.PI / 2);
    this.weapon.reset();
    this.hud.setAmmo(this.weapon.mag, this.weapon.reserve);
    this.hud.setHealth(this.player.hp);
    let ai = 0, bi = 0;
    for (const b of this.bots) {
      const spawns = SPAWNS[b.team];
      const s = spawns[(b.team === TEAM_ALPHA ? ai++ : bi++) % spawns.length];
      b.respawn(s[0], s[1]);
    }
  }

  private pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.getElementById('pause-overlay')!.classList.remove('hidden');
  }

  private resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    document.getElementById('pause-overlay')!.classList.add('hidden');
    if (!DEBUG) this.player.requestLock(this.canvas);
  }

  private restart() {
    document.getElementById('pause-overlay')!.classList.add('hidden');
    document.getElementById('end-overlay')!.classList.add('hidden');
    this.startMatch();
  }

  private endMatch() {
    this.state = 'end';
    this.endWin = this.scores[TEAM_ALPHA] >= MATCH.killTarget || this.scores[TEAM_ALPHA] > this.scores[TEAM_BRAVO];
    const title = document.getElementById('end-title')!;
    const scoreEl = document.getElementById('end-score')!;
    if (this.scores[TEAM_ALPHA] === this.scores[TEAM_BRAVO]) {
      title.textContent = '平局';
      title.className = '';
    } else {
      title.textContent = this.endWin ? '胜利！' : '战败';
      title.className = this.endWin ? 'win' : 'lose';
    }
    scoreEl.textContent = `${this.scores[TEAM_ALPHA]} : ${this.scores[TEAM_BRAVO]} — ${this.endWin ? 'ALPHA 沙暴获胜' : 'BRAVO 毒蝎获胜'}`;
    document.getElementById('end-overlay')!.classList.remove('hidden');
    this.audio.roundEnd(this.endWin);
    if (!DEBUG) document.exitPointerLock?.();
  }

  // ---------- 击杀 ----------
  private onBotDeath(bot: Bot) {
    const killerTeam = bot.lastAttacker === 'player' ? TEAM_ALPHA : (bot.lastAttacker ? bot.lastAttacker.team : (bot.team === TEAM_ALPHA ? TEAM_BRAVO : TEAM_ALPHA));
    this.scores[killerTeam]++;
    this.hud.setScores(this.scores[TEAM_ALPHA], this.scores[TEAM_BRAVO]);
    const killerName = bot.lastAttacker === 'player' ? '你' : (bot.lastAttacker ? bot.lastAttacker.name : '???');
    this.hud.addKill({
      killer: killerName, killerTeam,
      victim: bot.name, victimTeam: bot.team,
      headshot: false, isMe: bot.lastAttacker === 'player',
    });
    if (bot.lastAttacker === 'player') {
      this.hud.showKillBanner(`✕ 击杀 ${bot.name}`);
    }
    // 重生
    setTimeout(() => {
      if (this.state === 'end') return;
      const spawns = SPAWNS[bot.team];
      const s = spawns[Math.floor(Math.random() * spawns.length)];
      bot.respawn(s[0], s[1]);
    }, BOT.respawnDelay * 1000);
    this.checkWin();
  }

  private onPlayerDeath() {
    this.scores[TEAM_BRAVO]++;
    this.hud.setScores(this.scores[TEAM_ALPHA], this.scores[TEAM_BRAVO]);
    this.respawnT = 3.0;
    this.audio.death();
    const killer = this.lastPlayerKiller;
    this.hud.addKill({
      killer: killer ? killer.name : 'BRAVO 毒蝎', killerTeam: TEAM_BRAVO,
      victim: '你', victimTeam: TEAM_ALPHA, headshot: false, isMe: false,
    });
    this.hud.showRespawn(killer ? `被 ${killer.name} 击杀` : '你被击毙', this.respawnT);
    this.checkWin();
  }

  private lastPlayerKiller: Bot | null = null;

  private checkWin() {
    if (this.scores[TEAM_ALPHA] >= MATCH.killTarget || this.scores[TEAM_BRAVO] >= MATCH.killTarget) {
      this.endMatch();
    }
  }

  // ---------- 射击 ----------
  private playerShoot(origin: THREE.Vector3, dir: THREE.Vector3) {
    // 散布
    const spread = this.weapon.currentSpread(this.player.moveFactor, this.player.airFactor);
    const shotDir = applySpread(dir, spread);
    const range = WEAPON.range;

    // 墙体
    const wall = raycastWorld(origin, shotDir, range, this.player.char.collider);
    const wallDist = wall ? wall.dist : range;

    // 机器人
    let bestBot: Bot | null = null;
    let bestDist = wallDist;
    let bestHead = false;
    for (const b of this.bots) {
      if (!b.alive || b.team === TEAM_ALPHA) continue;
      const hit = rayVsCharacter(origin, shotDir, bestDist, b.pos, BOT.radius, BOT.height);
      if (hit && hit.dist < bestDist) {
        bestDist = hit.dist;
        bestBot = b;
        bestHead = hit.headshot;
      }
    }

    // 曳光 + 枪口
    const muzzle = this.weapon.getMuzzleWorld(new THREE.Vector3());
    const end = bestBot
      ? new THREE.Vector3(bestBot.pos.x, bestBot.pos.y + (bestHead ? 1.6 : 1.0), bestBot.pos.z)
      : wall ? wall.point : origin.clone().addScaledVector(shotDir, range);
    this.effects.tracer(muzzle, end);
    this.effects.muzzleFlash(muzzle, true);
    this.audio.shot(null, this.camera, true);

    if (bestBot) {
      const falloff = damageFalloff(bestDist);
      const dmg = WEAPON.damage * (bestHead ? WEAPON.headshotMult : 1) * falloff;
      const died = bestBot.takeDamage(dmg, 'player', this.player.pos);
      this.hud.setHitmarker(bestHead);
      this.audio.hit(bestHead);
      const hitPoint = new THREE.Vector3(bestBot.pos.x, bestBot.pos.y + 1.2, bestBot.pos.z);
      this.effects.impact(hitPoint, new THREE.Vector3(0, 1, 0), 'flesh');
    } else if (wall) {
      this.effects.impact(wall.point, wall.normal, 'stone');
    }

    // 后坐力
    this.player.addRecoil(WEAPON.recoilPitchDeg, (Math.random() - 0.5) * 2 * WEAPON.recoilYawDeg);
  }

  private botShoot(bot: Bot, origin: THREE.Vector3, dir: THREE.Vector3) {
    const range = 90;
    const wall = raycastWorld(origin, dir, range, bot.char.collider);
    const wallDist = wall ? wall.dist : range;

    const muzzle = new THREE.Vector3();
    bot.muzzleFlashT = 0.06;

    // 命中玩家？
    let end: THREE.Vector3;
    const pHit = this.player.alive
      ? rayVsCharacter(origin, dir, wallDist, this.player.pos, 0.4, 1.8)
      : null;

    if (pHit && pHit.dist < wallDist) {
      end = origin.clone().addScaledVector(dir, pHit.dist);
      // 命中玩家
      const killed = this.player.takeDamage(BOT.damage, bot.pos);
      this.hud.damageFlash(0.9);
      const bearing = Math.atan2(bot.pos.x - this.player.pos.x, bot.pos.z - this.player.pos.z);
      const fwdBearing = Math.atan2(-Math.sin(this.player.yaw), -Math.cos(this.player.yaw));
      let rel = bearing - fwdBearing;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      this.hud.damageFrom(rel);
      this.audio.hurt();
      if (killed) this.lastPlayerKiller = bot;
      this.effects.impact(end, dir.clone().negate(), 'flesh');
    } else if (wall) {
      end = wall.point;
      this.effects.impact(wall.point, wall.normal, 'stone');
    } else {
      end = origin.clone().addScaledVector(dir, range);
    }

    this.effects.tracer(origin, end, 0xffc080);
    this.effects.muzzleFlash(origin, false);
    this.audio.shot(bot.pos, this.camera, false);
    bot.lastShotTime = performance.now() / 1000;
  }

  // ---------- 主循环 ----------
  private loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'countdown') {
      this.countdownT -= dt;
      const n = Math.ceil(this.countdownT);
      this.hud.showKillBanner(n > 0 ? String(n) : '开战！');
      if (this.countdownT <= 0) {
        this.state = 'playing';
        this.hud.showKillBanner('开战！');
        this.audio.roundStart();
      }
    }

    if (this.state === 'playing') {
      this.acc += dt;
      const FIXED = 1 / 60;
      let steps = 0;
      while (this.acc >= FIXED && steps < 4) {
        this.stepGame(FIXED);
        this.acc -= FIXED;
        steps++;
      }
      if (steps === 4) this.acc = 0;

      // 计时
      this.timeLeft -= dt;
      this.hud.setTimer(this.timeLeft);
      if (this.timeLeft <= 0) {
        this.hud.setTimer(0);
        this.endMatch();
      }
    }

    if (this.flyMode) this.updateFly(dt);

    this.effects.update(dt);

    // HUD 每帧
    if (this.state !== 'menu') {
      const spreadPx = 4 + this.weapon.currentSpread(this.player.moveFactor, this.player.airFactor) * 900 + this.weapon.bloom * 20;
      this.hud.setCrosshairSpread(spreadPx);
      this.hud.setSpawnProtect(this.player.spawnProtecT > 0 && this.player.alive);

      this.minimapTimer -= dt;
      if (this.minimapTimer <= 0) {
        this.minimapTimer = 0.12;
        const now = performance.now() / 1000;
        this.hud.drawMinimap(
          this.player.pos, this.player.yaw,
          this.bots.filter(b => b.team === TEAM_ALPHA).map(b => ({ x: b.pos.x, z: b.pos.z, team: 0, alive: b.alive })),
          this.bots.filter(b => b.team === TEAM_BRAVO).map(b => ({
            x: b.pos.x, z: b.pos.z, team: 1,
            alive: b.alive,
            visible: b.alive && (now - (b.lastShotTime || 0) < 2.5),
          })),
        );
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private stepGame(dt: number) {
    // 玩家
    const lookDir = this.player.getLookDir(new THREE.Vector3());
    this.player.update(dt);
    if (this.player.alive) {
      this.weapon.applyToCamera(this.camera);
      this.weapon.update(dt, this.player.firing, this.player.moveFactor, this.player.airFactor,
        this.player.eyePos, lookDir);
      if (this.player.keys.has('KeyR')) {
        this.player.keys.delete('KeyR');
        if (this.weapon.startReload()) this.audio.reload();
      }
      // 换弹键也可用 E
      if (this.player.keys.has('KeyE')) {
        this.player.keys.delete('KeyE');
        if (this.weapon.startReload()) this.audio.reload();
      }
    } else {
      // 重生倒计时
      this.respawnT -= dt;
      this.hud.updateRespawnTimer(this.respawnT);
      if (this.respawnT <= 0) {
        const spawns = SPAWNS[TEAM_ALPHA];
        const s = spawns[Math.floor(Math.random() * spawns.length)];
        this.player.respawn(s[0], s[1], -Math.PI / 2);
        this.hud.hideRespawn();
        this.hud.setHealth(this.player.hp);
      }
    }

    // 机器人
    for (const b of this.bots) {
      b.update(dt, this.player.char, this.player.alive, this.bots);
    }

    // 物理步进
    world?.step();
  }

  private updateFly(dt: number) {
    const speed = 30;
    const k = this.player.keys;
    const f = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const move = new THREE.Vector3();
    if (k.has('KeyW')) move.add(f);
    if (k.has('KeyS')) move.sub(f);
    if (k.has('KeyD')) move.add(r);
    if (k.has('KeyA')) move.sub(r);
    if (k.has('KeyE') || k.has('Space')) move.y += 1;
    if (k.has('KeyQ')) move.y -= 1;
    if (move.lengthSq() > 0) move.normalize();
    this.camera.position.addScaledVector(move, speed * dt);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
  }

  private debugTopDown() {
    this.camera.position.set(0, 130, 0.01);
    this.camera.rotation.set(-Math.PI / 2, 0, 0, 'YXZ');
    this.renderer.render(this.scene, this.camera);
    (window as any).__screenshotReady = true;
  }
}

// ---------- 工具 ----------
function applySpread(dir: THREE.Vector3, spreadRad: number): THREE.Vector3 {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * spreadRad;
  const up = Math.abs(dir.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();
  return dir.clone()
    .addScaledVector(right, Math.cos(a) * r)
    .addScaledVector(realUp, Math.sin(a) * r)
    .normalize();
}

function damageFalloff(dist: number): number {
  if (dist <= WEAPON.falloffStart) return 1;
  if (dist >= WEAPON.falloffEnd) return WEAPON.falloffMin;
  const t = (dist - WEAPON.falloffStart) / (WEAPON.falloffEnd - WEAPON.falloffStart);
  return 1 - t * (1 - WEAPON.falloffMin);
}

// ---------- 启动 ----------
const game = new Game();
game.init().catch((err) => {
  console.error('游戏初始化失败:', err);
  document.body.innerHTML = `<div style="color:#fff;padding:40px;font-family:sans-serif">
    <h2>初始化失败</h2><pre>${String(err)}</pre></div>`;
});
