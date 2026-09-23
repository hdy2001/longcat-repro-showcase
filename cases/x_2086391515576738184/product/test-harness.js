'use strict';
/* Automated smoke test for index.html — stubs browser APIs, drives the game
   loop with synthetic input, and asserts core gameplay behaviors. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('FAIL: no <script> block found'); process.exit(1); }
const code = m[1];

// ------------------------------------------------------------- browser stubs
const ANY = new Proxy(function () {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive) return () => 0;
    return ANY;
  },
  apply: () => ANY,
  set: () => true,
});

function makeCtx() {
  const grad = { addColorStop() {} };
  const target = {
    canvas: null,
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => ({}),
    getImageData: () => ({ data: [] }),
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

const elements = {};
function makeEl(id) {
  const handlers = {};
  return {
    id,
    style: {},
    width: 0, height: 0,
    textContent: '',
    getContext: () => makeCtx(),
    addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
    _fire(type, ev) { (handlers[type] || []).forEach(fn => fn(ev)); },
  };
}

let rafCb = null;
const winHandlers = {};

const windowStub = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  AudioContext: function () {
    const audioParam = () => ({
      value: 0,
      setValueAtTime() {}, linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {}, cancelScheduledValues() {},
      setTargetAtTime() {},
    });
    const node = {
      connect: x => x,
      start() {}, stop() {},
    };
    return {
      currentTime: 0, sampleRate: 44100, state: 'running', destination: {},
      resume() {},
      createGain: () => ({ ...node, gain: audioParam() }),
      createOscillator: () => ({ ...node, type: '', frequency: audioParam(), detune: audioParam() }),
      createBiquadFilter: () => ({ ...node, type: '', frequency: audioParam(), Q: audioParam() }),
      createBuffer: (ch, n) => ({ getChannelData: () => new Float32Array(n) }),
      createBufferSource: () => ({ ...node, buffer: null, loop: false }),
    };
  },
  addEventListener: (type, fn) => { (winHandlers[type] = winHandlers[type] || []).push(fn); },
};

const sandbox = {
  document: {
    getElementById: id => (elements[id] = elements[id] || makeEl(id)),
    createElement: tag => makeEl(tag),
    addEventListener: () => {},
    body: makeEl('body'),
  },
  window: windowStub,
  localStorage: { getItem: () => null, setItem: () => {} },
  performance: { now: () => simTime },
  requestAnimationFrame: cb => { rafCb = cb; },
  console,
};
windowStub.AudioContext = sandbox.window.AudioContext;

let simTime = 0;
const runCode = new Function(
  'document', 'window', 'localStorage', 'performance', 'requestAnimationFrame', 'console',
  code
);
runCode(sandbox.document, sandbox.window, sandbox.localStorage, sandbox.performance, sandbox.requestAnimationFrame, sandbox.console);

const api = windowStub.__hcr;
if (!api) { console.error('FAIL: __hcr debug hook missing'); process.exit(1); }

// ------------------------------------------------------------- frame driver
function frames(n, stepMs = 1000 / 60) {
  for (let i = 0; i < n; i++) {
    simTime += stepMs;
    const cb = rafCb; rafCb = null;
    if (cb) cb(simTime);
  }
}

let failures = 0;
function check(name, cond, detail) {
  const ok = !!cond;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail != null ? '  [' + detail + ']' : ''));
  if (!ok) failures++;
}
function fireKey(code) {
  (winHandlers['keydown'] || []).forEach(fn => fn({ code, preventDefault() {} }));
}
const clampN = (v, a, b) => v < a ? a : (v > b ? b : v);
// player-like pitch control. Note the ground/air inversion:
//  on ground, throttle creates wheelie torque (nose UP); in air, throttle pitches nose DOWN.
function makeAutopilot() {
  return {
    frame(car) {
      const a = car.a;
      const grounded = car.wheels.some(w => w.contact) || car.bodyTouch;
      if (grounded) {
        api.keys.gas = a > -0.25;    // lift off when wheelie'ing; gravity drops the nose
        api.keys.brake = false;
      } else {
        api.keys.gas = a < -0.10;    // nose up -> throttle pitches nose down
        api.keys.brake = a > 0.10;   // nose down -> brake pitches nose up
      }
    },
  };
}

// ============================================================== TESTS
console.log('--- boot ---');
frames(5);
check('boots to menu', api.S.mode === 'menu');
check('car exists at spawn', !!api.S.car && isFinite(api.S.car.x));

console.log('--- start via button click ---');
const btn = api.S.btnStart;
check('start button rect exists', !!btn);
elements.game._fire('pointerdown', { clientX: btn.x + 5, clientY: btn.y + 5, pointerId: 1, preventDefault() {} });
frames(2);
check('click starts game', api.S.mode === 'play');

console.log('--- settle on suspension (5s) ---');
frames(300);
const c0 = api.S.car;
check('no NaN after settle', [c0.x, c0.y, c0.vx, c0.vy, c0.a, c0.w].every(isFinite));
const groundAtCar = api.terrainY(c0.x);
check('rests near ground', Math.abs(c0.y - (groundAtCar - 27)) < 10,
  'y=' + c0.y.toFixed(1) + ' expected≈' + (groundAtCar - 27).toFixed(1));
check('belly clear of ground', c0.y + 15 < groundAtCar - 2, 'bellyY=' + (c0.y + 15).toFixed(1) + ' ground=' + groundAtCar.toFixed(1));
check('suspension compressed', c0.wheels.some(w => w.compression > 1));

console.log('--- drive forward with autopilot (40s) ---');
api.start();
frames(5);
const distStart = api.S.maxX;
let maxSpeed = 0, nanSeen = false;
const pilot = makeAutopilot();
for (let f = 0; f < 40 * 60 && api.S.mode === 'play'; f++) {
  pilot.frame(api.S.car);
  frames(1);
  const c = api.S.car;
  if (![c.x, c.y, c.vx, c.vy, c.a, c.w].every(isFinite)) { nanSeen = true; break; }
  maxSpeed = Math.max(maxSpeed, Math.hypot(c.vx, c.vy));
}
api.keys.gas = false; api.keys.brake = false;
const distGain = (api.S.maxX - distStart) / 50;
check('no NaN during drive', !nanSeen);
check('made forward progress', distGain > 120, 'gained ' + distGain.toFixed(0) + ' m');
check('reached driving speed', maxSpeed > 500, 'maxSpeed=' + maxSpeed.toFixed(0) + ' px/s');
check('camera follows', Math.abs((api.S.cam.x) - (api.S.car.x - 1280 * 0.35)) < 500);

console.log('--- pickups exist ahead ---');
check('coins generated', api.S.coins.length > 0, api.S.coins.length + ' coins in world');
check('fuel cans generated', api.S.fuels.length > 0, api.S.fuels.length + ' cans');

console.log('--- coin collection ---');
api.start(); frames(5);
const coin = api.S.coins.find(k => !k.taken);
check('found a coin to collect', !!coin);
if (coin) {
  const before = api.S.runCoins;
  api.S.car.x = coin.x; api.S.car.y = coin.y; api.S.car.vx = 0; api.S.car.vy = 0;
  frames(10);
  check('coin collected on contact', api.S.runCoins > before, 'coins=' + api.S.runCoins);
}

console.log('--- fuel can collection ---');
api.start(); frames(5);
const can = api.S.fuels.find(f => !f.taken);
check('found a fuel can', !!can);
if (can) {
  api.S.fuel = 30;
  api.S.car.x = can.x; api.S.car.y = can.y; api.S.car.vx = 0; api.S.car.vy = 0;
  frames(10);
  check('fuel refilled', api.S.fuel > 50, 'fuel=' + api.S.fuel.toFixed(0));
}

console.log('--- out of fuel death ---');
api.start(); frames(5);
{
  const c = api.S.car;
  c.x = 200; c.y = api.terrainY(200) - 33; c.vx = 0; c.vy = 0; c.a = 0; c.w = 0;
  api.S.fuel = 0.4;
  api.keys.gas = false;
  frames(60 * 20);
  check('died of fuel on flat ground', api.S.mode === 'dead' && api.S.deathReason === 'fuel',
    'mode=' + api.S.mode + ' reason=' + api.S.deathReason);
}

console.log('--- crash death (head strike) ---');
api.start(); frames(5);
{
  const c = api.S.car;
  c.a = Math.PI; // upside down
  c.y = api.terrainY(c.x) - 120;
  frames(60 * 5);
  check('died from head strike', api.S.mode === 'dead' && api.S.deathReason === 'crash',
    'mode=' + api.S.mode + ' reason=' + api.S.deathReason);
}

console.log('--- restart ---');
fireKey('KeyR');
frames(10);
check('restart works', api.S.mode === 'play' && api.S.fuel > api.CFG.fuelMax - 1 && api.S.maxX < 400,
  'mode=' + api.S.mode + ' fuel=' + api.S.fuel.toFixed(1) + ' maxX=' + api.S.maxX.toFixed(0));

console.log('--- long stability soak (autopilot, 90s) ---');
{
  let nan = false;
  let peak = 0;
  const pilot2 = makeAutopilot();
  for (let f = 0; f < 90 * 60; f++) {
    pilot2.frame(api.S.car);
    frames(1);
    peak = Math.max(peak, api.S.maxX);
    const c = api.S.car;
    if (![c.x, c.y, c.vx, c.vy, c.a, c.w].every(isFinite)) { nan = true; break; }
    if (api.S.mode === 'dead') { fireKey('KeyR'); frames(5); }
  }
  api.keys.gas = false; api.keys.brake = false;
  check('no NaN over soak', !nan);
  check('soak reached good distance', peak / 50 > 200, 'peak=' + (peak / 50).toFixed(0) + ' m');
}

console.log('--- flip detection (airRot injection) ---');
{
  api.start(); frames(5);
  // simulate a completed flip just before touchdown
  api.S.airRot = 6.6; api.S.airTime = 1.0;
  const c = api.S.car;
  c.x = 300; c.y = api.terrainY(300) - 24; c.vx = 120; c.vy = 0; c.a = 0; c.w = 0;
  const coinsBefore = api.S.runCoins;
  frames(60);
  check('flip awards coins on landing', api.S.runCoins >= coinsBefore + 2,
    'runCoins=' + api.S.runCoins + ' (was ' + coinsBefore + ')');
  check('flip toast shown', api.S.toasts.some(t => /FLIP/.test(t.text)));
}

console.log('');
if (failures > 0) {
  console.error(failures + ' test(s) FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
