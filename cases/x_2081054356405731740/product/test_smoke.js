// index.html 冒烟测试: 提取 <script>, 用 vm + DOM 桩跑完整游戏流程
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('FAIL: no <script> found'); process.exit(1); }
const code = m[1];

// ---- DOM 桩(普通对象, 避免 Proxy 开销) ----
function ctx2d() {
  const grad = { addColorStop() {} };
  return {
    fillStyle:'', strokeStyle:'', lineWidth:1, globalAlpha:1, font:'', textAlign:'',
    textBaseline:'', imageSmoothingEnabled:true,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    measureText: () => ({ width: 10 }),
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, clearRect() {},
    drawImage() {}, putImageData() {}, translate() {}, rotate() {}, scale() {},
    arc() {}, ellipse() {}, rect() {}, fillText() {}, setTransform() {},
  };
}
function makeEl(id) {
  return {
    id, style: {}, width: 0, height: 0, children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    getContext: () => ctx2d(),
    addEventListener() {}, appendChild() {}, removeChild() {}, prepend() {}, remove() {},
    setAttribute() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    requestPointerLock() {},
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ''; },
    set textContent(v) { this._txt = v; }, get textContent() { return this._txt || ''; },
  };
}
const els = {};
const documentStub = {
  getElementById: id => els[id] || (els[id] = makeEl(id)),
  createElement: tag => makeEl(tag),
  addEventListener() {}, removeEventListener() {},
  pointerLockElement: null, exitPointerLock() {},
};
const windowStub = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {} };
const sandbox = {
  document: documentStub, window: windowStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  setTimeout: () => 0, clearTimeout: () => {},
  console,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'game.js' });

const api = sandbox.window.__game;
if (!api) { console.error('FAIL: __game hook missing'); process.exit(1); }
const { G, P } = api;
let step = 0;
function run(frames) { for (let i = 0; i < frames; i++) { api.tick(16.7); step++; } }
const assert = (cond, msg) => { if (!cond) { console.error('FAIL @frame ' + step + ': ' + msg); process.exit(1); } };

// 1. 初始状态
assert(G.state === 'menu', 'initial state menu');

// 2. 开始游戏 → 第一波生成 (restT 1.4s + spawnT 0.8s ≈ 首个敌人在 ~2.2s)
G.state = 'playing';
run(300); // 5s
assert(G.wave >= 1, 'wave started, wave=' + G.wave);
assert(G.enemies.length > 0, 'enemies spawned: ' + G.enemies.length);
console.log('ok: wave ' + G.wave + ', enemies ' + G.enemies.length);

// 3. 射击 — 玩家站大街, 敌人在正北中路(无遮挡), 距离 5
P.hp = 100; P.armor = 100;
if (G.state === 'dead') G.state = 'playing'; // 站桩 5s 可能已被打死, 复活继续测试
assert(G.state === 'playing', 'player alive for shoot test');
P.x = 12.5; P.y = 11.5; P.yaw = -Math.PI/2; P.pitch = 0;
const e0 = G.enemies.find(e => e.hp > 0);
G.enemies.forEach(e => { if (e !== e0 && e.hp > 0) api.damageEnemy(e, 200, false); });
e0.x = P.x; e0.y = P.y - 5; e0.wx = e0.x; e0.wy = e0.y;
e0.state = 'patrol'; e0.reactT = 99; // 不干扰射击测试
const hpBefore = e0.hp, scoreBefore = G.score;
api.playerShoot();
assert(P.mag === 29, 'ammo consumed');
assert(e0.hp < hpBefore || e0.hp <= 0, 'enemy took damage');
console.log('ok: shooting works, enemy hp ' + hpBefore + ' -> ' + Math.max(0, e0.hp));

// 4. 爆头击杀 → 分数/播报/尸体
const killsBefore = G.kills;
api.damageEnemy(e0, 200, true);
assert(G.kills === killsBefore + 1, 'kill counted');
assert(G.score >= scoreBefore + 150, 'headshot score +150');
assert(G.corpses.length >= 1, 'corpse created: ' + G.corpses.length);
console.log('ok: headshot kill, score=' + G.score);

// 5. 敌人 AI: 贴脸 → 应发现玩家并开火
G.enemies.forEach(e => { if (e.hp > 0) { e.x = P.x + 3; e.y = P.y; e.wx = e.x; e.wy = e.y; e.state = 'attack'; e.reactT = 0; } });
P.hp = 100; P.armor = 100;
run(300); // 5s
assert(P.hp + P.armor < 200, 'enemies shot the player (hp=' + P.hp.toFixed(0) + ' armor=' + P.armor.toFixed(0) + ')');
console.log('ok: enemy AI attacks, player hp=' + P.hp.toFixed(0));

// 6. 玩家死亡 → 死亡界面
P.hp = 1; P.armor = 0;
run(600); // 10s
if (G.state !== 'dead') {
  for (let i = 0; i < 2000 && G.state === 'playing'; i++) {
    P.armor = 0;
    G.enemies.forEach(e => { if (e.hp > 0) { e.x = P.x + 1.5; e.y = P.y; e.state = 'attack'; e.reactT = 0; } });
    api.tick(16.7);
  }
}
assert(G.state === 'dead', 'death flow works, state=' + G.state);
console.log('ok: death flow, final score=' + G.score);

// 7. 重开 → 换弹 → 过波推进(确定性: 直接处决当前波敌人)
api.start();
assert(G.state === 'playing' && P.hp === 100 && P.mag === 30, 'restart resets');
P.mag = 5; // 先消耗几发(满弹匣时换弹应被拒绝)
api.startReload();
assert(P.reloading > 0, 'reloading started');
P.hp = 100; P.armor = 100;
run(150); // 2.5s: 换弹(1.9s)完成
assert(P.mag === 30, 'reload refilled mag, got ' + P.mag);
assert(G.wave >= 1 && G.waveActive, 'wave 1 active');
console.log('ok: reload + wave 1');

let guard = 0;
while (G.wave < 2 && guard++ < 40) {
  P.hp = 10000; P.armor = 10000; // 保证测试期间不死
  run(240); // 4s: 等本波剩余敌人刷出
  G.enemies.forEach(e => { if (e.hp > 0) api.damageEnemy(e, 200, false); }); // 最后击杀触发过波
}
assert(G.wave >= 2, 'wave 2 reached, wave=' + G.wave);
console.log('ok: wave progression, wave=' + G.wave);

// 8. 粒子有界
assert(G.parts.length <= 200, 'particle cap ok: ' + G.parts.length);
console.log('ok: particles bounded =', G.parts.length);

// 9. 第二波清波 → 奖励触发
guard = 0;
while (G.waveActive && guard++ < 60) {
  P.hp = 10000; P.armor = 10000;
  run(10); // 等刷怪
  G.enemies.forEach(e => { if (e.hp > 0) api.damageEnemy(e, 200, false); });
}
assert(G.waveActive === false && G.restT > 0, 'wave-clear bonus triggered, score=' + G.score);
console.log('ok: wave clear bonus, score=' + G.score);

console.log('\nALL SMOKE TESTS PASSED  (total frames: ' + step + ')');
