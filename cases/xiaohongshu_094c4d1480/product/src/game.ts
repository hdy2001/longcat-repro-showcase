// ============================================================
// 沙漠行动 DESERT OPS —— 3D 团队竞技 FPS (TDM)
// 主逻辑: 场景 / 物理 / 射击 / 机器人调度 / 比赛状态 / 输入
// ============================================================
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { BOXES, PROPS, T_SPAWNS, CT_SPAWNS } from './mapdata';
import { sandTexture, stoneWallTexture, crateTexture, sandbagTexture, roofTexture, barrelTexture, rockTexture } from './textures';
import { AudioSys } from './audio';
import { Effects } from './effects';
import { Player } from './player';
import { Bot, type BotWorld } from './bots';
import { HUD } from './hud';
import type { TeamId } from './types';
import { TEAM_NAME } from './types';

// ------------------------------------------------------------
// 常量
// ------------------------------------------------------------
const WIN_SCORE = 25;
const MATCH_TIME = 300;
const PLAYER_NAME = '幽灵';
const T_BOT_NAMES = ['猎鹰', '沙狐', '秃鹫'];
const CT_BOT_NAMES = ['蝰蛇', '毒蝎', '沙暴', '毒蜂'];
const PLAYER_DMG = 34;
const BOT_DMG_MIN = 9, BOT_DMG_MAX = 13;
const REVEAL_TIME = 3.5; // 开火暴露时长(秒)

type GameState = 'menu' | 'playing' | 'paused' | 'over';

// ------------------------------------------------------------
// 全局
// ------------------------------------------------------------
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let world: RAPIER.World;
let player: Player;
let bots: Bot[] = [];
let effects: Effects;
let audio: AudioSys;
let hud: HUD;
let state: GameState = 'menu';
let scores: Record<TeamId, number> = { T: 0, CT: 0 };
let timeLeft = MATCH_TIME;
let playerRespawnAt = 0;
let gameTime = 0;
let topView = false;
let sunLight: THREE.DirectionalLight;
let charControllerEnabled = true;
const rayScratch = { hit: null as RAPIER.RayColliderIntersection | null };
/** collider.handle → 拥有者 (用于弹道命中判定) */
const colliderOwners = new Map<number, Bot | 'player'>();

const $ = (id: string) => document.getElementById(id)!;

// ------------------------------------------------------------
// 地图网格 + 碰撞体
// ------------------------------------------------------------
function buildMap(): void {
  const wallTex = stoneWallTexture();
  const crateTex = crateTexture();
  const sandbagTex = sandbagTexture();
  const roofTex = roofTexture();
  const barrelTex = barrelTexture();

  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const crateMat = new THREE.MeshLambertMaterial({ map: crateTex });
  const sandbagMat = new THREE.MeshLambertMaterial({ map: sandbagTex });
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTex });
  const barrelMat = new THREE.MeshLambertMaterial({ map: barrelTex });

  const addBox = (b: typeof BOXES[number], mat: THREE.Material, collider: boolean): void => {
    let mesh: THREE.Mesh;
    if (b.kind === 'barrel') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 10), mat);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    }
    const y = (b.y0 ?? 0) + b.h / 2;
    mesh.position.set(b.x, y, b.z);
    mesh.castShadow = b.kind === 'wall' || b.kind === 'crate' || b.kind === 'platform';
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collider) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(b.x, y, b.z).setFriction(0.7),
      );
    }
  };

  for (const b of BOXES) {
    if (b.kind === 'wall' || b.kind === 'step' || b.kind === 'platform') addBox(b, wallMat, true);
    else if (b.kind === 'roof') addBox(b, roofMat, true);
  }
  for (const b of PROPS) {
    if (b.kind === 'crate') addBox(b, crateMat, true);
    else if (b.kind === 'sandbag') addBox(b, sandbagMat, true);
    else if (b.kind === 'barrel') addBox(b, barrelMat, true);
  }

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ map: sandTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  world.createCollider(RAPIER.ColliderDesc.cuboid(700, 0.5, 700).setTranslation(0, -0.5, 0));

  // 基地外岩石装饰
  const rockMat = new THREE.MeshLambertMaterial({ map: rockTexture() });
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rnd = (() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  for (let i = 0; i < 40; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = 85 + rnd() * 220;
    const rock = new THREE.Mesh(rockGeo, rockMat);
    const sc = 1 + rnd() * 4.5;
    rock.scale.set(sc, sc * (0.5 + rnd() * 0.6), sc);
    rock.position.set(Math.cos(ang) * dist, sc * 0.2, Math.sin(ang) * dist);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.castShadow = true;
    scene.add(rock);
  }
}

// ------------------------------------------------------------
// 天空 / 光照
// ------------------------------------------------------------
function buildSky(): void {
  const sky = new Sky();
  sky.scale.setScalar(1200);
  scene.add(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = 5;
  u.rayleigh.value = 1.8;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.85;

  const phi = THREE.MathUtils.degToRad(90 - 38); // 太阳仰角 38°
  const theta = THREE.MathUtils.degToRad(135);
  const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sunPos);

  sunLight = new THREE.DirectionalLight(0xfff1d6, 2.8);
  sunLight.position.copy(sunPos).multiplyScalar(160);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -80;
  sunLight.shadow.camera.right = 80;
  sunLight.shadow.camera.top = 80;
  sunLight.shadow.camera.bottom = -80;
  sunLight.shadow.camera.near = 20;
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x9a7b52, 0.6);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xe8d5ae, 160, 520);
}

// ------------------------------------------------------------
// 机器人调度
// ------------------------------------------------------------
const botCtx: BotWorld = {
  get world() { return world; },
  get playerPos() { return player.pos; },
  get playerAlive() { return player.alive; },
  playerTeam: 'T',
  get bots() { return bots; },
  get now() { return gameTime; },
  onBotShoot: (bot, origin, dir) => resolveShot(bot, origin, dir),
  onBotDamaged: (bot, dmg, attacker) => {
    bot.damage(dmg, attacker);
  },
  onPlayerDamaged: (dmg, attacker) => {
    if (!player.alive || state !== 'playing') return;
    player.hp -= dmg;
    audio.hurt();
    hud.flashDamage();
    hud.setHealth(player.hp);
    if (player.hp <= 0) {
      player.die();
      scores[attacker.team]++;
      hud.setScore(scores.T, scores.CT);
      hud.killfeedAdd(attacker.name, attacker.team, PLAYER_NAME, 'T');
      playerRespawnAt = gameTime + 4;
      hud.showRespawn(4);
      audio.death();
      checkWin();
    }
  },
  onKill: (killer, victim) => {
    const kTeam: TeamId = killer === 'player' ? 'T' : killer.team;
    const kName = killer === 'player' ? PLAYER_NAME : killer.name;
    scores[kTeam]++;
    hud.setScore(scores.T, scores.CT);
    hud.killfeedAdd(kName, kTeam, victim.name, victim.team);
    if (killer === 'player') audio.kill();
    checkWin();
  },
  audioDist: (pos) => pos.distanceTo(player.pos),
};

function spawnBot(team: TeamId, name: string, x: number, z: number): Bot {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 1.2, z).lockRotations().setLinearDamping(0.05),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.62, 0.38).setFriction(0.3),
    body,
  );
  const bot = new Bot(botCtx, scene, team, name, x, z, body, collider);
  colliderOwners.set(collider.handle, bot);
  bots.push(bot);
  return bot;
}

function spawnAllBots(): void {
  bots = [];
  T_BOT_NAMES.forEach((n, i) => spawnBot('T', n, T_SPAWNS[i].x, T_SPAWNS[i].z));
  CT_BOT_NAMES.forEach((n, i) => spawnBot('CT', n, CT_SPAWNS[i].x, CT_SPAWNS[i].z));
  for (const b of bots) b.respawn(b.pos.x, b.pos.z);
}

// ------------------------------------------------------------
// 射击结算
// ------------------------------------------------------------
function resolveShot(shooter: Bot | 'player', origin: THREE.Vector3, dir: THREE.Vector3): void {
  const ray = new RAPIER.Ray(
    { x: origin.x, y: origin.y, z: origin.z },
    { x: dir.x, y: dir.y, z: dir.z },
  );
  const shooterCollider = shooter === 'player' ? player.collider : shooter.collider;
  rayScratch.hit = world.castRayAndGetNormal(
    ray, 120, true, undefined, undefined, shooterCollider, undefined, undefined,
  );
  const hit = rayScratch.hit;
  if (!hit) {
    effects.tracer(origin, origin.clone().addScaledVector(dir, 120));
    return;
  }
  const point = origin.clone().addScaledVector(dir, hit.timeOfImpact);
  const normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
  const owner = colliderOwners.get(hit.collider.handle);
  if (owner && owner !== 'player') {
    const victim = owner;
    if (shooter === 'player') {
      victim.damage(PLAYER_DMG, 'player');
      hud.flashHitmarker();
      audio.hitmark();
    } else if (victim.team !== shooter.team) {
      victim.damage(BOT_DMG_MIN + Math.random() * (BOT_DMG_MAX - BOT_DMG_MIN), shooter);
    }
    effects.impact(point, normal, true);
  } else if (owner === 'player') {
    if (shooter !== 'player' && shooter.alive) {
      botCtx.onPlayerDamaged(
        BOT_DMG_MIN + Math.random() * (BOT_DMG_MAX - BOT_DMG_MIN),
        shooter,
      );
    }
    effects.impact(point, normal, true);
  } else {
    effects.impact(point, normal, false);
  }
  effects.tracer(origin, point);
  if (shooter === 'player') {
    effects.muzzleFlash(origin, true);
    audio.gunshot(0, true);
  } else {
    effects.muzzleFlash(origin, false);
    audio.gunshot(botCtx.audioDist(origin), false);
  }
}

// ------------------------------------------------------------
// 比赛流程
// ------------------------------------------------------------
function checkWin(): void {
  if (scores.T >= WIN_SCORE || scores.CT >= WIN_SCORE) endMatch();
}

function endMatch(): void {
  if (state === 'over') return;
  state = 'over';
  document.exitPointerLock?.();
  const win = scores.T > scores.CT;
  const draw = scores.T === scores.CT;
  $('end-title').textContent = draw ? '平局' : win ? '胜 利' : '败 北';
  $('end-title').style.color = draw ? '#e8c86a' : win ? '#7fd48a' : '#e84a3a';
  $('end-score').textContent = `${TEAM_NAME.T} ${scores.T} : ${scores.CT} ${TEAM_NAME.CT}`;
  $('end-overlay').classList.add('visible');
  audio.jingle(win);
}

function resetMatch(): void {
  scores = { T: 0, CT: 0 };
  timeLeft = MATCH_TIME;
  gameTime = 0;
  hud.setScore(0, 0);
  hud.setTimer(timeLeft);
  hud.setHealth(100);
  hud.setAmmo(30, 120, false);
  hud.killfeed.innerHTML = '';
  spawnAllBots();
  player.spawn(T_SPAWNS[0].x, T_SPAWNS[0].z);
  player.yaw = 0;
  player.pitch = 0;
  hud.hideRespawn();
}

function startPlaying(): void {
  audio.init();
  $('menu').classList.remove('visible');
  $('pause').classList.remove('visible');
  $('end-overlay').classList.remove('visible');
  hud.show();
  state = 'playing';
  lockPointer();
}

function lockPointer(): void {
  try {
    const p = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === 'function') p.catch(() => { /* headless 环境忽略 */ });
  } catch { /* ignore */ }
}

// ------------------------------------------------------------
// 输入
// ------------------------------------------------------------
function setupInput(): void {
  const canvas = renderer.domElement;

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    player.keys.add(e.code);
    if (e.code === 'KeyR' && state === 'playing') {
      player.reload(gameTime);
      audio.reload();
    }
  });
  document.addEventListener('keyup', (e) => player.keys.delete(e.code));

  document.addEventListener('mousemove', (e) => {
    if (state !== 'playing' || topView) return;
    if (document.pointerLockElement === canvas) {
      player.look(e.movementX, e.movementY);
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (state !== 'playing') return;
    if (document.pointerLockElement !== canvas) {
      lockPointer();
      return;
    }
    if (e.button === 0) player.startFire();
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) player.stopFire();
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && state === 'playing') {
      state = 'paused';
      $('pause').classList.add('visible');
      player.stopFire();
    }
  });

  $('start-btn').addEventListener('click', startPlaying);
  $('resume-btn').addEventListener('click', () => {
    $('pause').classList.remove('visible');
    state = 'playing';
    lockPointer();
  });
  $('restart-btn').addEventListener('click', () => {
    $('end-overlay').classList.remove('visible');
    resetMatch();
    state = 'playing';
    lockPointer();
  });
  $('pause-restart-btn').addEventListener('click', () => {
    $('pause').classList.remove('visible');
    resetMatch();
    state = 'playing';
    lockPointer();
  });
}

// ------------------------------------------------------------
// HUD 帧更新
// ------------------------------------------------------------
function updateHUD(): void {
  // 小地图 blips
  const blips: import('./hud').MinimapBlip[] = [];
  for (const b of bots) {
    const p = b.pos;
    if (b.team === 'T') {
      blips.push({ x: p.x, z: p.z, team: 'T', dead: !b.alive });
    } else {
      blips.push({
        x: p.x, z: p.z, team: 'CT', dead: !b.alive,
        revealUntil: b.alive && gameTime - b.lastFiredAt < REVEAL_TIME ? b.lastFiredAt + REVEAL_TIME : undefined,
      });
    }
  }
  if (player.alive) {
    blips.push({ x: player.pos.x, z: player.pos.z, team: 'T', isPlayer: true, yaw: player.yaw });
  }
  hud.drawMinimap(blips, gameTime);
  hud.setCrosshairSpread(6 + player.weapon.bloom * 10, player.alive && state === 'playing');
}

// ------------------------------------------------------------
// 主循环 (固定时间步长物理 + 真实时间游戏逻辑)
// ------------------------------------------------------------
let lastT = performance.now();
let acc = 0;
const FIXED = 1 / 60;

function stepGame(fixedDt: number): void {
  player.update(fixedDt, gameTime, false);

  // 机器人
  for (const b of bots) {
    if (!b.alive) {
      if (gameTime >= b.respawnAt) {
        const spawns = b.team === 'T' ? T_SPAWNS : CT_SPAWNS;
        const s = spawns[Math.floor(Math.random() * spawns.length)];
        b.respawn(s.x, s.z);
      }
      continue;
    }
    b.update(fixedDt);
  }
  world.step();
}

function tick(dt: number): void {
  if (state === 'playing') {
    gameTime += dt;
    timeLeft -= dt;
    hud.setTimer(Math.max(0, timeLeft));
    if (timeLeft <= 0) endMatch();

    // 固定步长物理推进
    acc += dt;
    let steps = 0;
    while (acc >= FIXED && steps < 12) {
      stepGame(FIXED);
      acc -= FIXED;
      steps++;
    }
    if (steps === 12) acc = 0; // 防止螺旋死亡

    // 玩家重生
    if (!player.alive) {
      const remain = playerRespawnAt - gameTime;
      if (remain <= 0) {
        player.spawn(T_SPAWNS[0].x, T_SPAWNS[0].z);
        player.yaw = 0; player.pitch = 0;
        hud.hideRespawn();
        hud.setHealth(100);
        hud.setAmmo(30, 9999, false);
      } else {
        hud.showRespawn(remain);
      }
    }

    hud.setAmmo(player.weapon.ammo, player.weapon.reserve, player.weapon.reloading);
  }

  effects.update(dt);

  if (topView) {
    camera.position.set(0, 150, 0);
    camera.lookAt(0, 0, 0);
  } else if (player.alive) {
    player.applyCamera(camera);
  } else {
    // 死亡视角: 尸体上方俯视
    const p = player.pos;
    camera.position.set(p.x, p.y + 8, p.z + 6);
    camera.lookAt(p.x, p.y, p.z);
  }

  updateHUD();
  renderer.render(scene, camera);
}

function loop(): void {
  requestAnimationFrame(loop);
  const now = performance.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.1);
  tick(dt);
}

// ------------------------------------------------------------
// 初始化
// ------------------------------------------------------------
async function init(): Promise<void> {
  await RAPIER.init();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.getElementById('app')!.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1600);

  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED;

  buildSky();
  buildMap();

  player = new Player(world, T_SPAWNS[0].x, T_SPAWNS[0].z);
  colliderOwners.set(player.collider.handle, 'player');
  player.onFire = (origin, dir) => resolveShot('player', origin, dir);
  player.spawn(T_SPAWNS[0].x, T_SPAWNS[0].z);
  player.yaw = 0;
  player.stepCb = () => audio.step();

  effects = new Effects(scene);
  audio = new AudioSys();
  hud = new HUD();

  spawnAllBots();
  setupInput();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  loop();
}

// ------------------------------------------------------------
// 调试 API (供自动化验证)
// ------------------------------------------------------------
function setupDebug(): void {
  const g = {
    errors: (window as unknown as { __errors?: string[] }).__errors ?? [],
    ready: false,
    start: (skipLock = false) => {
      $('menu').classList.remove('visible');
      $('pause').classList.remove('visible');
      $('end-overlay').classList.remove('visible');
      hud.show();
      state = 'playing';
      if (!skipLock) lockPointer();
    },
    key: (code: string, down: boolean) => {
      if (down) player.keys.add(code); else player.keys.delete(code);
    },
    look: (dx: number, dy: number) => player.look(dx, dy),
    fire: (down: boolean) => { if (down) player.startFire(); else player.stopFire(); },
    reload: () => { player.reload(gameTime); audio.reload(); },
    teleport: (x: number, z: number) => player.body.setTranslation({ x, y: 1.2, z }, true),
    state: () => ({
      state, scores: { ...scores }, timeLeft,
      player: {
        x: +player.pos.x.toFixed(1), y: +player.pos.y.toFixed(1), z: +player.pos.z.toFixed(1),
        hp: player.hp, alive: player.alive, ammo: player.weapon.ammo,
      },
      bots: bots.map(b => ({
        name: b.name, team: b.team, alive: b.alive, hp: Math.round(b.hp),
        x: +b.pos.x.toFixed(1), z: +b.pos.z.toFixed(1),
        moving: b.pathIdx < b.path.length,
      })),
    }),
    setTime: (s: number) => { timeLeft = s; },
    setScore: (t: number, ct: number) => { scores.T = t; scores.CT = ct; hud.setScore(t, ct); },
    topView: (on: boolean) => { topView = on; },
    playerPos: () => ({ x: player.pos.x, y: player.pos.y, z: player.pos.z }),
    // 手动推进一帧 (供无头/后台标签页验证, rAF 被节流时驱动游戏)
    step: (dt: number) => {
      (window as unknown as { __frames: number }).__frames =
        ((window as unknown as { __frames?: number }).__frames ?? 0) + 1;
      tick(dt);
    },
  };
  (window as unknown as { __game: typeof g }).__game = g;
}

// ------------------------------------------------------------
// 启动
// ------------------------------------------------------------
setupDebug();
init().then(() => {
  (window as unknown as { __game: { ready: boolean } }).__game.ready = true;
}).catch((err) => {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#a00;color:#fff;padding:12px;z-index:999;font:14px monospace;';
  el.textContent = '初始化失败: ' + String(err);
  document.body.appendChild(el);
  throw err;
});
