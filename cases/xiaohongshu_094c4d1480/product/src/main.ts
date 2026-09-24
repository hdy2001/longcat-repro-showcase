// 沙尘行动 —— 3D 团队竞技 FPS（主控制器）
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CFG, TEAM, type TeamId } from './config';
import { buildMap } from './map';
import { buildNavGraph } from './map';
import { BLUE_SPAWNS, RED_SPAWNS } from './mapdata';
import { Player } from './player';
import { Bot } from './bot';
import { Effects } from './effects';
import { GameAudio } from './audio';
import { HUD } from './hud';
import { makeSkyTexture } from './textures';

type GameState = 'menu' | 'playing' | 'paused' | 'ended';

class Game {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private world!: RAPIER.World;
  private map!: ReturnType<typeof buildMap>;
  private player!: Player;
  private bots: Bot[] = [];
  private effects!: Effects;
  private audio = new GameAudio();
  private hud = new HUD();
  private nav = buildNavGraph();

  private state: GameState = 'menu';
  private clock = new THREE.Clock();
  private gameT = 0;
  private matchT = CFG.matchTime;
  private score = [0, 0];
  private stats: Array<{ name: string; team: TeamId; kills: number; deaths: number; isPlayer: boolean }> = [];
  private respawnT = 0;
  private botRespawnQueue: Array<{ bot: Bot; t: number }> = [];
  private botColliderMap = new Map<number, Bot>();
  private canvas!: HTMLCanvasElement;

  async init(): Promise<void> {
    // ---- 渲染器 ----
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // 硬阴影
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // ---- 场景 / 天空 / 雾 ----
    this.scene = new THREE.Scene();
    this.scene.background = makeSkyTexture();
    this.scene.fog = new THREE.Fog(0xdcc9a0, 70, 260);

    // ---- 相机 ----
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 600);
    this.camera.position.set(-38, 30, 38);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera);

    // ---- 光照：强烈日照 ----
    const hemi = new THREE.HemisphereLight(0x9cc0e8, 0xc8a870, 0.75);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
    sun.position.set(45, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -58;
    sun.shadow.camera.right = 58;
    sun.shadow.camera.top = 58;
    sun.shadow.camera.bottom = -58;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun, sun.target);

    // 太阳盘
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSunSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sunSprite.position.set(140, 190, 90);
    sunSprite.scale.set(60, 60, 1);
    this.scene.add(sunSprite);

    // ---- 物理 ----
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: CFG.worldGravity, z: 0 });

    // ---- 地图 ----
    this.map = buildMap(this.world, this.scene);
    this.nav = this.map.nav;

    // ---- 特效 ----
    this.effects = new Effects(this.scene);

    // ---- 玩家 ----
    const spawn = BLUE_SPAWNS[0];
    this.player = new Player(this.world, this.camera, spawn);
    this.player.onShot = () => this.playerShoot();
    this.player.onReload = () => this.audio.reload();
    this.player.onStep = (s) => this.audio.step(s);
    this.player.onAmmoChanged = () => this.hud.setAmmo(this.player.mag, this.player.reserve, this.player.reloading);

    // ---- 统计行 ----
    this.stats.push({ name: '你', team: TEAM.BLUE, kills: 0, deaths: 0, isPlayer: true });

    // ---- 机器人（5v5，玩家蓝方；BOT_NAMES 中 0-4 红方，5-8 蓝方） ----
    const totalBots = 9;
    for (let i = 0; i < totalBots; i++) {
      const bot = new Bot(this.world, i);
      this.scene.add(bot.mesh);
      this.bots.push(bot);
      this.botColliderMap.set(bot.collider.handle, bot);
      this.stats.push({ name: bot.name, team: bot.team, kills: 0, deaths: 0, isPlayer: false });
    }

    // ---- 输入 ----
    this.bindInput();

    // ---- HUD ----
    this.hud.onStart = () => { this.audio.init(); this.audio.ui(); this.startMatch(); };
    this.hud.onResume = () => { this.audio.ui(); this.lockPointer(); };
    this.hud.onRestart = () => location.reload();
    this.hud.setHP(100);
    this.hud.setAmmo(CFG.magSize, CFG.reserve, false);
    this.hud.setScore(0, 0);
    this.hud.setTimer(this.matchT);

    // 错误捕获（便于自动化验证）
    const errors: string[] = [];
    window.addEventListener('error', (e) => errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
    window.__errors = errors;

    window.__game = {
      getState: () => ({
        state: this.state,
        hp: this.player.hp,
        playerPos: { x: +this.player.pos.x.toFixed(2), y: +this.player.pos.y.toFixed(2), z: +this.player.pos.z.toFixed(2) },
        bots: this.bots.map(b => ({
          name: b.name, team: b.team, alive: b.alive, hp: b.hp, state: b.state,
          pos: { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2) },
        })),
        score: [...this.score],
        timeLeft: Math.round(this.matchT),
      }),
      start: () => { this.audio.init(); this.startMatch(); },
      look: (yaw: number, pitch: number) => { this.player.yaw = yaw; this.player.pitch = pitch; },
      key: (code: string, down: boolean) => {
        if (down) this.player.keys.add(code); else this.player.keys.delete(code);
      },
      setTrigger: (v: boolean) => { this.player.triggerHeld = v; },
      teleport: (x: number, z: number) => this.player.teleport(x, z),
      pos: () => ({ x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z }),
    };

    this.clock.start();
    this.loop();
  }

  // ================= 输入 =================
  private bindInput(): void {
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && this.state === 'playing') {
        this.state = 'paused';
        this.player.keys.clear();
        this.player.triggerHeld = false;
        this.hud.showPause(true);
      }
    });

    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && document.pointerLockElement !== this.canvas) this.lockPointer();
    });

    addEventListener('keydown', (e) => {
      if (e.code === 'Tab') { e.preventDefault(); this.hud.showScoreboard(this.scoreRows()); return; }
      if (this.state !== 'playing') return;
      this.player.keys.add(e.code);
      if (e.code === 'KeyR') this.player.startReload();
    });
    addEventListener('keyup', (e) => {
      if (e.code === 'Tab') { e.preventDefault(); this.hud.hideScoreboard(); return; }
      this.player.keys.delete(e.code);
    });

    addEventListener('mousemove', (e) => {
      if (this.state === 'playing' && document.pointerLockElement === this.canvas) {
        this.player.lookDelta(e.movementX, e.movementY);
      }
    });
    addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || document.pointerLockElement !== this.canvas) return;
      if (e.button === 0) this.player.triggerHeld = true;
      if (e.button === 2) this.player.adsHeld = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.player.triggerHeld = false;
      if (e.button === 2) this.player.adsHeld = false;
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private lockPointer(): void {
    this.canvas.requestPointerLock();
    // pointerlockchange 成功后由状态机恢复；这里直接恢复（失败时鼠标仍可操作）
    if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.showPause(false);
    }
  }

  // ================= 比赛流程 =================
  private startMatch(): void {
    this.state = 'playing';
    this.hud.showMenu(false);
    this.hud.showHUD(true);
    this.hud.centerMsg('消灭敌方小队！率先获得 35 杀获胜', 3.5);
    this.lockPointer();
  }

  private scoreRows() {
    return this.stats;
  }

  private endMatch(): void {
    this.state = 'ended';
    document.exitPointerLock?.();
    const victory = this.score[TEAM.BLUE] >= this.score[TEAM.RED];
    this.hud.showEnd(victory, this.score[TEAM.BLUE], this.score[TEAM.RED], this.stats);
  }

  // ================= 射击裁决 =================
  private playerShoot(): void {
    const origin = this.player.eyePos;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const s = this.player.currentSpread();
    dir.x += (Math.random() - 0.5) * 2 * s;
    dir.y += (Math.random() - 0.5) * 2 * s;
    dir.z += (Math.random() - 0.5) * 2 * s;
    dir.normalize();

    const muzzle = origin.clone().add(dir.clone().multiplyScalar(0.7));
    muzzle.y -= 0.12;

    const hit = this.castWorld(origin, dir, CFG.range, this.player.collider);
    const end = hit ? hit.point : origin.clone().add(dir.clone().multiplyScalar(CFG.range));
    this.effects.tracer(muzzle, end);
    this.effects.muzzleFlash(muzzle);
    this.audio.shot(0, true);

    if (hit) {
      const bot = this.botColliderMap.get(hit.colliderHandle);
      if (bot && bot.alive && bot.team !== TEAM.BLUE) {
        const head = hit.point.y > bot.pos.y + CFG.playerHeadY;
        this.effects.impact(hit.point, 0xb03030, 12, 3);
        this.damageBot(bot, CFG.playerDamage * (head ? CFG.playerHeadMul : 1), '你', TEAM.BLUE, head);
      } else {
        const matColor = hit.isWall ? 0xc8a870 : 0x8a6a45;
        this.effects.impact(hit.point, matColor, 8, 2);
      }
    }
  }

  private botShoot = (bot: Bot, from: THREE.Vector3, to: THREE.Vector3): void => {
    const dir = to.clone().sub(from).normalize();
    const distToPlayer = this.player.alive ? from.distanceTo(this.player.pos) : 999;
    this.audio.shot(distToPlayer, false);
    this.effects.muzzleFlash(bot.muzzlePos);

    const hit = this.castWorld(from, dir, CFG.range, bot.collider);
    const end = hit ? hit.point : to;
    this.effects.tracer(bot.muzzlePos, end);

    if (!hit) return;
    const botHit = this.botColliderMap.get(hit.colliderHandle);
    if (botHit && botHit.alive) {
      if (botHit.team === bot.team) return; // 队友挡枪
      const head = hit.point.y > botHit.pos.y + CFG.botHeadY;
      this.effects.impact(hit.point, 0xb03030, 10, 2.5);
      this.damageBot(botHit, CFG.botDamage * 2, bot.name, bot.team, head);
    } else if (hit.isPlayer) {
      const head = hit.point.y > this.player.pos.y + CFG.botHeadY;
      this.effects.impact(hit.point, 0xb03030, 10, 2.5);
      this.damagePlayer(CFG.botDamage * (head ? 1.8 : 1), bot);
    } else {
      this.effects.impact(hit.point, hit.isWall ? 0xc8a870 : 0x8a6a45, 6, 1.8);
    }
  };

  private castWorld(
    origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, exclude: RAPIER.Collider,
  ): { point: THREE.Vector3; colliderHandle: number; isWall: boolean; isPlayer: boolean } | null {
    const ray = new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, undefined, exclude, undefined);
    if (!hit) return null;
    const toi = hit.toi;
    const point = origin.clone().add(dir.clone().multiplyScalar(toi));
    const handle = hit.collider.handle;
    return {
      point,
      colliderHandle: handle,
      isWall: !this.botColliderMap.has(handle) && handle !== this.player.collider.handle,
      isPlayer: handle === this.player.collider.handle,
    };
  }

  // ================= 伤害与击杀 =================
  private damageBot(bot: Bot, dmg: number, killerName: string, killerTeam: TeamId, head: boolean): void {
    if (!bot.alive) return;
    bot.hp -= dmg;
    if (killerName === '你') {
      this.hud.showHitmarker(head);
      this.audio.hit(head);
    }
    if (bot.hp <= 0) {
      bot.die();
      this.score[killerTeam]++;
      this.hud.setScore(this.score[0], this.score[1]);
      this.hud.killFeedAdd({ killer: killerName, killerTeam, victim: bot.name, victimTeam: bot.team, headshot: head, weapon: '步枪', t: 0 });
      const st = this.stats.find(s => s.name === bot.name);
      if (st) st.deaths++;
      if (killerName === '你') {
        const stMe = this.stats.find(s => s.isPlayer);
        if (stMe) stMe.kills++;
        this.audio.kill();
        this.hud.centerMsg(head ? '爆头击杀！' : `击杀 ${bot.name}`, 1.2);
      }
      this.botRespawnQueue.push({ bot, t: CFG.botRespawn });
      this.checkMatchEnd();
    }
  }

  private damagePlayer(dmg: number, killer: Bot): void {
    if (!this.player.alive || this.state !== 'playing') return;
    this.player.hp -= dmg;
    this.hud.setHP(this.player.hp);
    this.hud.flashDamage();
    this.audio.hurt();
    if (this.player.hp <= 0) {
      this.player.die();
      this.score[killer.team]++;
      this.hud.setScore(this.score[0], this.score[1]);
      this.hud.killFeedAdd({ killer: killer.name, killerTeam: killer.team, victim: '你', victimTeam: TEAM.BLUE, headshot: false, weapon: '步枪', t: 0 });
      const st = this.stats.find(s => s.name === killer.name);
      if (st) st.kills++;
      const stMe = this.stats.find(s => s.isPlayer);
      if (stMe) stMe.deaths++;
      this.hud.showDeath(killer.name, killer.team);
      this.respawnT = CFG.respawnTime;
      this.checkMatchEnd();
    }
  }

  private checkMatchEnd(): void {
    if (this.state !== 'playing') return;
    if (this.score[0] >= CFG.killTarget || this.score[1] >= CFG.killTarget) this.endMatch();
  }

  // ================= 主循环 =================
  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.gameT += dt;

    if (this.state === 'menu') {
      // 菜单背景：环绕镜头
      const t = this.gameT * 0.08;
      this.camera.position.set(Math.cos(t) * 46, 32, Math.sin(t) * 46);
      this.camera.lookAt(0, -2, 0);
    }

    if (this.state === 'playing' || this.state === 'ended') {
      // 玩家
      if (this.state === 'playing') this.player.update(dt, this.gameT);

      // 机器人间简单分离
      const alive = this.bots.filter(b => b.alive);
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          const a = alive[i], b = alive[j];
          const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.9 && d > 1e-4) {
            const push = (0.9 - d) / 2;
            const nx = dx / d, nz = dz / d;
            a.body.setTranslation({ x: a.pos.x - nx * push, y: a.pos.y, z: a.pos.z - nz * push }, false);
            b.body.setTranslation({ x: b.pos.x + nx * push, y: b.pos.y, z: b.pos.z + nz * push }, false);
          }
        }
      }

      // 机器人 AI
      for (const bot of this.bots) {
        if (!bot.alive) { bot.update(dt, this.gameT, this.nav, this.world, [], this.botShoot); continue; }
        const enemies: Array<{ pos: THREE.Vector3; alive: boolean; isPlayer: boolean; ref: unknown }> = this.bots
          .filter(o => o.team !== bot.team && o.alive)
          .map(o => ({ pos: o.pos, alive: o.alive, isPlayer: false, ref: o }));
        if (bot.team === TEAM.RED && this.player.alive) {
          enemies.push({ pos: this.player.pos, alive: true, isPlayer: true, ref: this.player });
        }
        bot.update(dt, this.gameT, this.nav, this.world, enemies, this.botShoot);
      }

      this.world.step();

      // 玩家重生
      if (!this.player.alive && this.state === 'playing') {
        this.respawnT -= dt;
        this.hud.setRespawnT(Math.max(this.respawnT, 0));
        if (this.respawnT <= 0) {
          const sp = BLUE_SPAWNS[Math.floor(Math.random() * BLUE_SPAWNS.length)];
          this.player.teleport(sp[0], sp[1]);
          this.player.revive();
          this.hud.setHP(100);
          this.hud.setAmmo(CFG.magSize, CFG.reserve, false);
          this.hud.hideDeath();
        }
      }

      // 机器人重生
      for (let i = this.botRespawnQueue.length - 1; i >= 0; i--) {
        const q = this.botRespawnQueue[i];
        q.t -= dt;
        if (q.t <= 0) {
          q.bot.revive();
          this.botRespawnQueue.splice(i, 1);
        }
      }

      // 计时
      if (this.state === 'playing') {
        this.matchT -= dt;
        this.hud.setTimer(Math.max(this.matchT, 0));
        if (this.matchT <= 0) this.endMatch();
      }
    }

    this.effects.update(dt);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
  };
}

// ---------- 全局声明 ----------
declare global {
  interface Window {
    __errors: string[];
    __game: unknown;
  }
}

function makeSunSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,252,240,1)');
  grad.addColorStop(0.25, 'rgba(255,240,200,0.95)');
  grad.addColorStop(1, 'rgba(255,230,170,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// 启动
const game = new Game();
game.init();
