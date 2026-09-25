'use strict';
/* ============================================================
   ANGRY BIRDS — a tiny canvas physics tribute
   slingshot launcher · destructible blocks · pigs · 3 levels
   ============================================================ */

// ---------------- utils ----------------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// ---------------- config ----------------
const W = 1280, H = 720;
const GROUND_Y = 640;
const GRAVITY = 1500;
const ANCHOR = { x: 150, y: GROUND_Y - 205 };          // slingshot fork center
const FORK_L = { x: ANCHOR.x - 26, y: ANCHOR.y + 4 };
const FORK_R = { x: ANCHOR.x + 26, y: ANCHOR.y + 4 };
const MAX_DRAG = 135;
const POWER = 11;                                      // pull distance -> launch speed
const MAX_SPEED = 1700;
const STEP = 1 / 120;                                  // physics timestep

const MAT = {
  wood:  { hp: 2, val: 600,  fill: '#a5672e', edge: '#7c4a1e' },
  stone: { hp: 3, val: 1000, fill: '#9aa1a8', edge: '#6f767d' },
  glass: { hp: 1, val: 300,  fill: 'rgba(178,222,250,0.82)', edge: '#a8d8f0' },
};
const BIRD_DEF = {
  red:    { r: 17, body: '#e8402a', belly: '#f7e7c8' },
  yellow: { r: 16, body: '#ffd23e', belly: '#fff3c2' },
  blue:   { r: 14, body: '#35a7ff', belly: '#cfeaff' },
  black:  { r: 20, body: '#33333a', belly: '#8a8a95' },
};
const BIRD_BONUS = 10000;                              // score per unused bird
const PIG_VAL = 4000, HELMET_VAL = 1500;

// ---------------- levels ----------------
// blocks: {x, bottom, w, h, mat}   pigs: {x, bottom, helmet}
const LEVELS = [
  {
    name: 'First Flight',
    birds: ['red', 'red', 'red'],
    blocks: [
      { x: 955,  bottom: 640, w: 24,  h: 70, mat: 'wood'  },
      { x: 1045, bottom: 640, w: 24,  h: 70, mat: 'wood'  },
      { x: 1000, bottom: 570, w: 170, h: 20, mat: 'wood'  },
      { x: 950,  bottom: 550, w: 20,  h: 22, mat: 'glass' },
      { x: 1050, bottom: 550, w: 20,  h: 22, mat: 'glass' },
    ],
    pigs: [
      { x: 1000, bottom: 550 },
      { x: 1110, bottom: 640 },
    ],
  },
  {
    name: 'Timber!',
    birds: ['red', 'yellow', 'red'],
    blocks: [
      { x: 980,  bottom: 640, w: 240, h: 22, mat: 'wood'  },
      { x: 910,  bottom: 618, w: 26,  h: 84, mat: 'stone' },
      { x: 1050, bottom: 618, w: 26,  h: 84, mat: 'stone' },
      { x: 980,  bottom: 534, w: 220, h: 20, mat: 'wood'  },
      { x: 940,  bottom: 514, w: 20,  h: 40, mat: 'wood'  },
      { x: 1020, bottom: 514, w: 20,  h: 40, mat: 'wood'  },
      { x: 980,  bottom: 474, w: 140, h: 16, mat: 'wood'  },
      { x: 880,  bottom: 618, w: 22,  h: 40, mat: 'glass' },
      { x: 1110, bottom: 618, w: 22,  h: 40, mat: 'glass' },
    ],
    pigs: [
      { x: 980,  bottom: 618 },
      { x: 980,  bottom: 514 },
      { x: 1160, bottom: 640, helmet: true },
    ],
  },
  {
    name: 'Stone Fortress',
    birds: ['red', 'yellow', 'blue', 'black', 'red'],
    blocks: [
      { x: 1000, bottom: 640, w: 300, h: 24, mat: 'stone' },
      { x: 900,  bottom: 616, w: 28,  h: 100, mat: 'stone' },
      { x: 1100, bottom: 616, w: 28,  h: 100, mat: 'stone' },
      { x: 1000, bottom: 516, w: 240, h: 22, mat: 'wood'  },
      { x: 940,  bottom: 494, w: 22,  h: 44,  mat: 'wood'  },
      { x: 1060, bottom: 494, w: 22,  h: 44,  mat: 'wood'  },
      { x: 1000, bottom: 450, w: 160, h: 20, mat: 'stone' },
      { x: 960,  bottom: 430, w: 20,  h: 30,  mat: 'glass' },
      { x: 1040, bottom: 430, w: 20,  h: 30,  mat: 'glass' },
      { x: 1000, bottom: 400, w: 120, h: 18, mat: 'wood'  },
    ],
    pigs: [
      { x: 1000, bottom: 616 },
      { x: 1000, bottom: 494 },
      { x: 1000, bottom: 450, helmet: true },
      { x: 1180, bottom: 640, helmet: true },
    ],
  },
];

// ---------------- audio (synthesized) ----------------
const AudioSys = {
  ctx: null, enabled: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol = 0.25, freq = 1200, q = 0.8, slideTo = 0, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t0);
  },
  launch()  { this.noise(0.28, 0.3, 900, 1, 2600); },
  hit(s)    { this.noise(0.12, clamp(0.1 + s * 0.0004, 0.1, 0.4), 700, 1, 150); this.tone(120, 0.1, 'triangle', 0.15, 60); },
  wood()    { this.noise(0.14, 0.3, 1400, 1, 300); this.tone(180, 0.09, 'triangle', 0.16, 90); },
  stone()   { this.noise(0.16, 0.32, 500, 1, 120); this.tone(90, 0.12, 'triangle', 0.2, 45); },
  glass()   { this.noise(0.2, 0.28, 5200, 2, 2500); this.tone(2400, 0.12, 'sine', 0.1, 1400); },
  pig()     { this.tone(660, 0.09, 'square', 0.14, 990); this.tone(990, 0.14, 'square', 0.12, 440, 0.08); },
  boom()    { this.noise(0.7, 0.55, 3000, 0.6, 60); this.tone(160, 0.55, 'sine', 0.4, 30); },
  dash()    { this.noise(0.2, 0.25, 600, 1, 3200); this.tone(300, 0.18, 'sawtooth', 0.12, 900); },
  split()   { this.tone(880, 0.08, 'square', 0.12, 1320); this.tone(1320, 0.1, 'square', 0.1, 1760, 0.07); },
  click()   { this.tone(700, 0.06, 'square', 0.08, 500); },
  win()     { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'square', 0.14, 0, i * 0.12)); },
  lose()    { [392, 330, 262].forEach((f, i) => this.tone(f, 0.28, 'sawtooth', 0.1, f * 0.8, i * 0.16)); },
};

// ---------------- game state ----------------
const game = {
  scene: 'menu',            // menu | play | win | lose
  level: 0,
  score: 0,
  queue: [],                // upcoming bird types
  bird: null,               // active bird
  extras: [],               // split-off birds
  pigs: [], blocks: [], particles: [], texts: [],
  state: 'ready',           // ready | dragging | flying | settling
  settleTimer: 0, winTimer: -1, loseTimer: -1, introTimer: 0,
  shake: 0, flash: 0, time: 0,
  hint: true,
};

let best = {};
try { best = JSON.parse(localStorage.getItem('ab_best_v1') || '{}'); } catch (e) { best = {}; }
function saveBest() { try { localStorage.setItem('ab_best_v1', JSON.stringify(best)); } catch (e) {} }

function levelTotalPossible(lv) {
  let t = BIRD_BONUS * lv.birds.length;
  for (const b of lv.blocks) t += MAT[b.mat].val;
  for (const p of lv.pigs) t += PIG_VAL + (p.helmet ? HELMET_VAL : 0);
  return t;
}

// ---------------- entity factories ----------------
function makeBird(type, x, y, noAbility = false) {
  const d = BIRD_DEF[type];
  return {
    kind: 'bird', type, x, y, vx: 0, vy: 0, r: d.r,
    mass: d.r * d.r, ability: !noAbility && type !== 'red',
    abilityUsed: false, fuse: -1, restTime: 0, flyTime: 0,
    fade: 1, dead: false, trail: [], angle: 0, spawnT: 0,
  };
}
function makePig(x, bottomY, helmet) {
  const r = helmet ? 18 : 16;
  return { kind: 'pig', x, y: bottomY - r, vx: 0, vy: 0, r, hp: helmet ? 2 : 1,
           helmet: !!helmet, mass: r * r, hitFlash: 0, dead: false, angle: 0 };
}
function makeBlock(x, bottomY, w, h, mat) {
  const m = MAT[mat];
  return { kind: 'block', x, y: bottomY - h / 2, w, h, mat, hp: m.hp, maxHp: m.hp,
           mass: w * h, hitFlash: 0, angle: 0 };
}

// ---------------- particles & score popups ----------------
function burst(x, y, color, n, spd = 260, size = 4, grav = 900) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.3,
      life: rand(0.35, 0.8), maxLife: 0.8, color, size: rand(size * 0.5, size * 1.4), grav });
  }
}
function popText(x, y, text, color = '#ffd94d') {
  game.texts.push({ x, y, text, life: 1.1, color });
}
function addScore(v, x, y) {
  game.score += v;
  if (x !== undefined) popText(x, y, '+' + v);
}

// ---------------- damage ----------------
function damageBody(t, dmg) {
  if (t.dead || dmg <= 0) return;
  if (t.kind === 'pig') {
    if (t.helmet && dmg < 1) {
      // helmet absorbs small hits first
    }
    if (t.helmet) { t.helmet = false; addScore(HELMET_VAL, t.x, t.y - 30); AudioSys.pig(); burst(t.x, t.y - 10, '#c8ccd2', 10, 220, 4); }
    t.hp -= dmg;
    t.hitFlash = 0.15;
    if (t.hp <= 0 && !t.dead) {
      t.dead = true;
      addScore(PIG_VAL, t.x, t.y - 24);
      burst(t.x, t.y, '#8fd35f', 18, 300, 5);
      burst(t.x, t.y, '#5da336', 10, 200, 4);
      AudioSys.pig();
      game.shake = Math.max(game.shake, 5);
    }
  } else if (t.kind === 'block') {
    t.hp -= dmg;
    t.hitFlash = 0.15;
    if (t.hp <= 0) {
      const m = MAT[t.mat];
      addScore(m.val, t.x, t.y);
      if (t.mat === 'glass') { AudioSys.glass(); burst(t.x, t.y, '#cfeaff', 14, 320, 4, 500); }
      else if (t.mat === 'wood') { AudioSys.wood(); burst(t.x, t.y, '#c98d4e', 12, 260, 5); }
      else { AudioSys.stone(); burst(t.x, t.y, '#b9bec4', 12, 240, 5); }
      t.dead = true;
    } else {
      AudioSys.hit(200);
    }
  }
}

// impact damage from collision (vn = closing speed)
function impactDamage(a, b, vn) {
  if (vn < 90) return;
  const dmg = (vn - 90) / 150;
  damageBody(a, dmg);
  damageBody(b, dmg * 0.8);
}

// ---------------- physics ----------------
function integrate(b, dt) {
  b.vy += GRAVITY * dt;
  b.vx *= (1 - 0.06 * dt);                 // mild air drag
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

function collideGround(b) {
  const br = b.kind === 'block' ? b.h / 2 : b.r;
  if (b.y + br < GROUND_Y) return;
  const impactVy = b.vy;
  b.y = GROUND_Y - br;
  if (b.vy > 0) {
    if (impactVy > 240 && (b.kind === 'pig')) damageBody(b, (impactVy - 240) / 220);
    b.vy = -b.vy * (b.kind === 'bird' ? 0.35 : 0.15);
    if (Math.abs(b.vy) < 30) b.vy = 0;
    b.vx *= 0.82;                          // ground friction
    if (b.kind === 'bird' && impactVy > 300) { burst(b.x, GROUND_Y - 4, '#c9b18a', 6, 140, 3); AudioSys.hit(impactVy); }
  }
}

function resolveCircleRect(c, r) {
  const hw = r.w / 2, hh = r.h / 2;
  const cx = clamp(c.x, r.x - hw, r.x + hw);
  const cy = clamp(c.y, r.y - hh, r.y + hh);
  const dx = c.x - cx, dy = c.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return;
  let d = Math.sqrt(d2), nx, ny;
  if (d > 0.001) { nx = dx / d; ny = dy / d; }
  else {
    // circle center inside the rect: push out along the thin axis
    const px = hw - Math.abs(c.x - r.x), py = hh - Math.abs(c.y - r.y);
    if (px < py) { nx = Math.sign(c.x - r.x) || 1; ny = 0; d = -px; }
    else { nx = 0; ny = Math.sign(c.y - r.y) || 1; d = -py; }
  }
  const overlap = c.r - d;
  const tm = c.mass + r.mass;
  c.x += nx * overlap * (r.mass / tm);
  c.y += ny * overlap * (r.mass / tm);
  r.x -= nx * overlap * (c.mass / tm);
  r.y -= ny * overlap * (c.mass / tm);
  const rvx = c.vx - r.vx, rvy = c.vy - r.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const e = 0.25;
    const j = -(1 + e) * vn / (1 / c.mass + 1 / r.mass);
    c.vx += j * nx / c.mass; c.vy += j * ny / c.mass;
    r.vx -= j * nx / r.mass; r.vy -= j * ny / r.mass;
    impactDamage(c, r, -vn);
    if (-vn > 350 && c.kind === 'bird' && c.type === 'black' && c.fuse < 0) c.fuse = 0.05;
  }
}

function resolveRectRect(a, b) {
  const dx = b.x - a.x, px = (a.w + b.w) / 2 - Math.abs(dx);
  if (px <= 0) return;
  const dy = b.y - a.y, py = (a.h + b.h) / 2 - Math.abs(dy);
  if (py <= 0) return;
  const tm = a.mass + b.mass;
  if (px < py) {
    const s = Math.sign(dx) || 1;
    a.x -= s * px * (b.mass / tm); b.x += s * px * (a.mass / tm);
    const vn = (b.vx - a.vx) * s;
    if (vn < 0) {
      const j = -(1 + 0.15) * vn / (1 / a.mass + 1 / b.mass);
      a.vx -= s * j / a.mass; b.vx += s * j / b.mass;
      impactDamage(a, b, -vn);
    }
  } else {
    const s = Math.sign(dy) || 1;
    a.y -= s * py * (b.mass / tm); b.y += s * py * (a.mass / tm);
    const vn = (b.vy - a.vy) * s;
    if (vn < 0) {
      const j = -(1 + 0.15) * vn / (1 / a.mass + 1 / b.mass);
      a.vy -= s * j / a.mass; b.vy += s * j / b.mass;
      impactDamage(a, b, -vn);
    }
  }
}

function resolveCircleCircle(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy), min = a.r + b.r;
  if (d >= min || d < 0.001) return;
  const nx = dx / d, ny = dy / d, overlap = min - d;
  const tm = a.mass + b.mass;
  a.x -= nx * overlap * (b.mass / tm); a.y -= ny * overlap * (b.mass / tm);
  b.x += nx * overlap * (a.mass / tm); b.y += ny * overlap * (a.mass / tm);
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0) {
    const j = -(1 + 0.3) * vn / (1 / a.mass + 1 / b.mass);
    a.vx -= j * nx / a.mass; a.vy -= j * ny / a.mass;
    b.vx += j * nx / b.mass; b.vy += j * ny / b.mass;
    impactDamage(a, b, -vn);
  }
}

function explode(x, y) {
  const R = 175;
  game.shake = Math.max(game.shake, 15);
  game.flash = 0.38;
  AudioSys.boom();
  burst(x, y, '#ffb13d', 22, 520, 6, 500);
  burst(x, y, '#ff5a2a', 16, 380, 5, 400);
  burst(x, y, '#5a5a5a', 12, 240, 7, 300);
  const targets = [...game.pigs, ...game.blocks, ...game.extras];
  if (game.bird) targets.push(game.bird);
  for (const e of targets) {
    if (!e || e.dead) continue;
    const er = e.kind === 'block' ? Math.max(e.w, e.h) / 2 : e.r;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > R + er) continue;
    const t = 1 - d / (R + er);
    const nx = (e.x - x) / (d || 1), ny = (e.y - y) / (d || 1);
    const dv = 1500 * t * (900 / (900 + e.mass));
    e.vx += nx * dv; e.vy += ny * dv - 200 * t;
    damageBody(e, (e.kind === 'pig' ? 2.2 : 1.8) * t);
  }
}

// ---------------- abilities ----------------
function triggerAbility() {
  const b = game.bird;
  if (!b || b.abilityUsed || b.dead) return;
  if (b.type === 'yellow') {
    const sp = Math.hypot(b.vx, b.vy);
    const ns = Math.min(sp * 1.85, MAX_SPEED);
    if (sp > 1) { b.vx *= ns / sp; b.vy *= ns / sp; }
    b.abilityUsed = true;
    AudioSys.dash();
    burst(b.x, b.y, '#ffd23e', 10, 260, 4, 100);
  } else if (b.type === 'blue') {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const base = Math.atan2(b.vy, b.vx);
    for (const da of [-0.42, 0.42]) {
      const nb = makeBird('blue', b.x + Math.cos(base + da) * 16, b.y + Math.sin(base + da) * 16, true);
      nb.vx = Math.cos(base + da) * sp; nb.vy = Math.sin(base + da) * sp;
      nb.flyTime = b.flyTime;
      game.extras.push(nb);
    }
    b.abilityUsed = true;
    AudioSys.split();
    burst(b.x, b.y, '#35a7ff', 10, 240, 4, 100);
  } else if (b.type === 'black') {
    b.fuse = 0.45;
    b.abilityUsed = true;
    AudioSys.click();
  }
}

// ---------------- flow ----------------
function startLevel(i) {
  const lv = LEVELS[i];
  game.level = i;
  game.score = 0;
  game.queue = [...lv.birds];
  game.bird = null; game.extras = [];
  game.pigs = lv.pigs.map(p => makePig(p.x, p.bottom, p.helmet));
  game.blocks = lv.blocks.map(b => makeBlock(b.x, b.bottom, b.w, b.h, b.mat));
  game.particles = []; game.texts = [];
  game.scene = 'play';
  game.winTimer = -1; game.loseTimer = -1;
  game.introTimer = 2.2; game.hint = true;
  game.shake = 0; game.flash = 0;
  showOverlay(null);
  loadBird();
}

function loadBird() {
  if (game.queue.length === 0) return;
  game.bird = makeBird(game.queue[0], ANCHOR.x, ANCHOR.y);
  game.state = 'ready';
}

function launchBird() {
  const b = game.bird;
  if (!b) return;
  let vx = (ANCHOR.x - b.x) * POWER;
  let vy = (ANCHOR.y - b.y) * POWER;
  const sp = Math.hypot(vx, vy);
  if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
  b.vx = vx; b.vy = vy;
  b.flyTime = 0; b.restTime = 0;
  game.queue.shift();
  game.state = 'flying';
  AudioSys.launch();
  burst(ANCHOR.x, ANCHOR.y, '#8a5a2b', 6, 160, 3);
}

function settleBird() {
  const b = game.bird;
  game.state = 'settling';
  game.settleTimer = 0.45;
  if (b && !b.dead && game.pigs.some(p => !p.dead)) {
    addScore(BIRD_BONUS, b.x, b.y - 30);
    popText(b.x + 34, b.y - 8, 'bird bonus!');
  }
}

function updateBird(dt) {
  const b = game.bird;
  if (!b) return;
  if (b.dead) { game.bird = null; settleBird(); return; }
  b.flyTime += dt;
  if (b.spawnT < 0.4) b.spawnT += dt;
  if (b.fuse > 0) {
    b.fuse -= dt;
    if (b.fuse <= 0) { explode(b.x, b.y); b.dead = true; game.bird = null; settleBird(); return; }
  }
  integrate(b, dt);
  collideGround(b);
  const speed = Math.hypot(b.vx, b.vy);
  b.angle = clamp(Math.atan2(b.vy, b.vx) * 0.25, -0.4, 0.4);
  // trail
  if (speed > 200) {
    b.trail.push({ x: b.x, y: b.y, life: 0.3 });
    if (b.trail.length > 24) b.trail.shift();
  }
  for (const t of b.trail) t.life -= dt;
  b.trail = b.trail.filter(t => t.life > 0);
  // settle conditions
  const offRight = b.x > W + 120, offLeft = b.x < -220, offBottom = b.y > H + 160;
  if (speed < 55) b.restTime += dt; else b.restTime = 0;
  if (b.restTime > 0.5 || b.flyTime > 6 || offRight || offLeft || offBottom) settleBird();
}

function updateExtras(dt) {
  for (const e of game.extras) {
    integrate(e, dt);
    collideGround(e);
    const speed = Math.hypot(e.vx, e.vy);
    if (speed < 55) e.restTime += dt; else e.restTime = 0;
    if (e.restTime > 0.5 || e.flyTime > 5 || e.x > W + 120 || e.x < -220) e.fade -= dt * 2.5;
  }
  game.extras = game.extras.filter(e => e.fade > 0);
}

function step(dt) {
  game.time += dt;
  if (game.scene !== 'play') { updateFx(dt); return; }

  if (game.introTimer > 0) game.introTimer -= dt;
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 26);
  if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 1.4);

  if (game.state === 'ready' || game.state === 'dragging') {
    // bird sits on the sling; gentle idle bob
    const b = game.bird;
    if (b && game.state === 'ready') {
      b.y = ANCHOR.y + Math.sin(game.time * 2.2) * 2.5;
      b.x = ANCHOR.x;
    }
  }

  updateBird(dt);
  updateExtras(dt);

  // pigs & blocks
  for (const p of game.pigs) { if (!p.dead) { integrate(p, dt); collideGround(p); if (p.hitFlash > 0) p.hitFlash -= dt; } }
  for (const bl of game.blocks) { if (!bl.dead) { integrate(bl, dt); collideGround(bl); if (bl.hitFlash > 0) bl.hitFlash -= dt; } }

  // collisions
  const bodies = [...game.blocks.filter(b => !b.dead), ...game.pigs.filter(p => !p.dead)];
  for (const b of game.bird ? [game.bird] : []) {
    for (const o of bodies) {
      if (o.kind === 'block') resolveCircleRect(b, o);
      else resolveCircleCircle(b, o);
    }
  }
  for (const e of game.extras) {
    for (const o of bodies) {
      if (o.kind === 'block') resolveCircleRect(e, o);
      else resolveCircleCircle(e, o);
    }
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b2 = bodies[j];
      if (a.kind === 'block' && b2.kind === 'block') resolveRectRect(a, b2);
      else if (a.kind === 'block' && b2.kind === 'pig') resolveCircleRect(b2, a);
      else if (a.kind === 'pig' && b2.kind === 'block') resolveCircleRect(a, b2);
      else resolveCircleCircle(a, b2);
    }
  }

  // resting damping for blocks & pigs (kills jitter)
  for (const bl of game.blocks) {
    if (bl.dead) continue;
    const sp = Math.hypot(bl.vx, bl.vy);
    if (sp < 14) { bl.vx *= 0.5; bl.vy *= 0.5; }
    if (sp < 4) { bl.vx = 0; bl.vy = 0; }
  }
  for (const p of game.pigs) {
    if (p.dead) continue;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 12) { p.vx *= 0.5; p.vy *= 0.5; }
    if (sp < 4) { p.vx = 0; p.vy = 0; }
  }

  // cull dead
  if (game.pigs.some(p => p.dead)) game.pigs = game.pigs.filter(p => !p.dead);
  if (game.blocks.some(b => b.dead)) game.blocks = game.blocks.filter(b => !b.dead);

  // settle -> next turn
  if (game.state === 'settling') {
    game.settleTimer -= dt;
    if (game.settleTimer <= 0) {
      const pigsLeft = game.pigs.length;
      if (pigsLeft === 0) {
        game.winTimer = 0.7; game.state = 'ready';
      } else if (game.queue.length === 0) {
        game.loseTimer = 0.6; game.state = 'ready';
      } else {
        loadBird();
      }
    }
  }

  // win / lose resolution
  if (game.winTimer > 0) {
    game.winTimer -= dt;
    if (game.winTimer <= 0) finishWin();
  }
  if (game.loseTimer > 0) {
    game.loseTimer -= dt;
    if (game.loseTimer <= 0) {
      game.scene = 'lose';
      showOverlay('loseScreen');
      AudioSys.lose();
    }
  }

  updateFx(dt);
}

function finishWin() {
  const lv = LEVELS[game.level];
  // remaining bird bonuses
  let bonus = 0;
  while (game.queue.length) { game.queue.shift(); bonus += BIRD_BONUS; }
  if (bonus) game.score += bonus;
  const max = levelTotalPossible(lv);
  const frac = game.score / max;
  const stars = frac >= 0.8 ? 3 : frac >= 0.55 ? 2 : 1;
  const prev = best[game.level] || { stars: 0, score: 0 };
  best[game.level] = { stars: Math.max(prev.stars, stars), score: Math.max(prev.score, game.score) };
  saveBest();
  game.scene = 'win';
  const ws = document.getElementById('winStars');
  ws.innerHTML = [1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : 'off'}">★</span>`).join('');
  document.getElementById('winScore').innerHTML =
    `Score: ${game.score.toLocaleString()} &nbsp;·&nbsp; <span class="best">Best: ${best[game.level].score.toLocaleString()}</span>`;
  document.getElementById('btnWinNext').textContent =
    game.level + 1 < LEVELS.length ? 'Next ▶' : 'Menu';
  showOverlay('winScreen');
  AudioSys.win();
}

function updateFx(dt) {
  for (const pt of game.particles) {
    pt.life -= dt;
    pt.vy += pt.grav * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.y > GROUND_Y) { pt.y = GROUND_Y; pt.vy *= -0.4; pt.vx *= 0.7; }
  }
  game.particles = game.particles.filter(p => p.life > 0);
  for (const t of game.texts) { t.life -= dt; t.y -= 42 * dt; }
  game.texts = game.texts.filter(t => t.life > 0);
}

// ---------------- rendering ----------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function draw() {
  ctx.save();
  if (game.shake > 0) ctx.translate(rand(-game.shake, game.shake) * 0.5, rand(-game.shake, game.shake) * 0.5);

  drawBackground();
  drawSlingshotBack();

  for (const b of game.blocks) if (!b.dead) drawBlock(b);
  for (const p of game.pigs) if (!p.dead) drawPig(p);
  for (const e of game.extras) drawBirdShape(e);
  if (game.bird) {
    drawTrajectory();
    drawBirdShape(game.bird);
  }
  drawSlingshotFront();

  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  for (const t of game.texts) {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.font = '900 26px "Trebuchet MS", sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  drawHUD();

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${game.flash})`;
    ctx.fillRect(-30, -30, W + 60, H + 60);
  }
  ctx.restore();
}

function drawBackground() {
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#6ec3f0');
  sky.addColorStop(0.7, '#a8dcf5');
  sky.addColorStop(1, '#d8f0fa');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // sun
  const sg = ctx.createRadialGradient(1090, 96, 12, 1090, 96, 90);
  sg.addColorStop(0, 'rgba(255,244,180,1)');
  sg.addColorStop(0.35, 'rgba(255,226,110,.85)');
  sg.addColorStop(1, 'rgba(255,226,110,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(980, -10, 220, 220);

  // clouds
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  for (const c of CLOUDS) {
    const cx = ((c.x + game.time * c.spd) % (W + 320)) - 160;
    ctx.beginPath();
    ctx.ellipse(cx, c.y, c.s, c.s * 0.42, 0, 0, TAU);
    ctx.ellipse(cx - c.s * 0.7, c.y + c.s * 0.12, c.s * 0.6, c.s * 0.3, 0, 0, TAU);
    ctx.ellipse(cx + c.s * 0.75, c.y + c.s * 0.1, c.s * 0.65, c.s * 0.32, 0, 0, TAU);
    ctx.fill();
  }

  // hills
  ctx.fillStyle = '#8fca6a';
  ctx.beginPath(); ctx.ellipse(260, GROUND_Y + 60, 420, 130, 0, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = '#7abd58';
  ctx.beginPath(); ctx.ellipse(980, GROUND_Y + 70, 520, 150, 0, Math.PI, TAU); ctx.fill();

  // ground
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#6f451f';
  for (let x = 20; x < W; x += 64) ctx.fillRect(x, GROUND_Y + 34 + (x % 3) * 8, 26, 6);
  // grass strip
  ctx.fillStyle = '#5fae3f';
  ctx.fillRect(0, GROUND_Y - 6, W, 12);
  ctx.fillStyle = '#4f9334';
  for (let x = 12; x < W; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y - 4);
    ctx.lineTo(x + 5, GROUND_Y - 14);
    ctx.lineTo(x + 10, GROUND_Y - 4);
    ctx.fill();
  }
}
const CLOUDS = [
  { x: 180, y: 90, s: 60, spd: 9 },
  { x: 640, y: 140, s: 44, spd: 13 },
  { x: 980, y: 70, s: 52, spd: 7 },
  { x: 420, y: 200, s: 34, spd: 16 },
];

function drawSlingshotBack() {
  // wooden fork (back half)
  ctx.strokeStyle = '#6f451f';
  ctx.lineCap = 'round';
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.moveTo(ANCHOR.x + 4, GROUND_Y - 4);
  ctx.quadraticCurveTo(ANCHOR.x + 8, GROUND_Y - 130, FORK_R.x + 6, FORK_R.y + 16);
  ctx.stroke();
  // back band (behind bird)
  const b = game.bird;
  if (b && (game.state === 'dragging' || game.state === 'ready')) {
    ctx.strokeStyle = '#4a2c12';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(FORK_L.x, FORK_L.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawSlingshotFront() {
  const b = game.bird;
  if (b && (game.state === 'dragging' || game.state === 'ready')) {
    ctx.strokeStyle = '#5d3817';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(FORK_R.x, FORK_R.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // front prong
  ctx.strokeStyle = '#7d4f24';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ANCHOR.x + 16, GROUND_Y - 6);
  ctx.quadraticCurveTo(ANCHOR.x + 20, GROUND_Y - 120, FORK_R.x + 10, FORK_R.y + 18);
  ctx.stroke();
}

function drawTrajectory() {
  if (game.state !== 'dragging') return;
  const b = game.bird;
  let vx = (ANCHOR.x - b.x) * POWER;
  let vy = (ANCHOR.y - b.y) * POWER;
  const sp = Math.hypot(vx, vy);
  if (sp > MAX_SPEED) { vx *= MAX_SPEED / sp; vy *= MAX_SPEED / sp; }
  let px = b.x, py = b.y;
  const dt = 0.075;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 22; i++) {
    vy += GRAVITY * dt;
    px += vx * dt;
    py += vy * dt;
    if (py > GROUND_Y - 4) break;
    if (i % 2 === 0) {
      ctx.globalAlpha = clamp(1 - i / 22, 0.15, 0.9);
      ctx.beginPath();
      ctx.arc(px, py, 4.5 - i * 0.12, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawBirdShape(b) {
  const d = BIRD_DEF[b.type];
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.globalAlpha = clamp(b.fade, 0, 1);

  // trail
  for (const t of b.trail) {
    ctx.globalAlpha = clamp(t.life / 0.3, 0, 1) * 0.35 * clamp(b.fade, 0, 1);
    ctx.fillStyle = d.body;
    ctx.beginPath();
    ctx.arc(t.x - b.x, t.y - b.y, b.r * 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = clamp(b.fade, 0, 1);
  ctx.rotate(b.angle);

  // tail feathers
  ctx.fillStyle = d.body;
  for (const off of [-0.5, 0, 0.5]) {
    ctx.save();
    ctx.rotate(off);
    ctx.beginPath();
    ctx.moveTo(-b.r + 2, 0);
    ctx.lineTo(-b.r - 9, -5);
    ctx.lineTo(-b.r - 9, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // body
  const g = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.4, b.r * 0.2, 0, 0, b.r);
  g.addColorStop(0, lighten(d.body));
  g.addColorStop(1, d.body);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(0,0,0,.3)';
  ctx.stroke();

  // belly
  ctx.fillStyle = d.belly;
  ctx.beginPath();
  ctx.ellipse(b.r * 0.1, b.r * 0.45, b.r * 0.6, b.r * 0.42, 0, 0, TAU);
  ctx.fill();

  // fuse spark (black bird)
  if (b.type === 'black') {
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -b.r);
    ctx.quadraticCurveTo(6, -b.r - 9, 10, -b.r - 10);
    ctx.stroke();
    const fl = 2.5 + Math.sin(game.time * 30) * 1.5;
    ctx.fillStyle = b.fuse > 0 ? '#ff5a2a' : '#ffd23e';
    ctx.beginPath();
    ctx.arc(10, -b.r - 10, fl, 0, TAU);
    ctx.fill();
  }

  // eyes (angry)
  const ex = b.r * 0.32, ey = -b.r * 0.3, er = b.r * 0.3;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + s * er * 0.9, ey, er, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(ex + s * er * 0.9 + er * 0.3, ey, er * 0.42, 0, TAU);
    ctx.fill();
  }
  // brows
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ex - er * 1.5, ey - er * 1.6); ctx.lineTo(ex + er * 0.2, ey - er * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex + er * 2.3, ey - er * 1.6); ctx.lineTo(ex + er * 0.6, ey - er * 0.6); ctx.stroke();

  // beak
  ctx.fillStyle = '#ff9f1c';
  ctx.beginPath();
  ctx.moveTo(b.r * 0.62, -b.r * 0.08);
  ctx.lineTo(b.r * 1.35, b.r * 0.08);
  ctx.lineTo(b.r * 0.62, b.r * 0.34);
  ctx.closePath();
  ctx.fill();

  // yellow tuft
  if (b.type === 'yellow') {
    ctx.strokeStyle = '#e8a800';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-2, -b.r + 2); ctx.lineTo(-6, -b.r - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -b.r + 2); ctx.lineTo(6, -b.r - 7); ctx.stroke();
  }
  ctx.restore();
}

function drawPig(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.hitFlash > 0) {
    ctx.translate(rand(-2, 2), rand(-2, 2));
  }
  // ears
  ctx.fillStyle = '#5da336';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * p.r * 0.55, -p.r * 0.82, p.r * 0.28, 0, TAU);
    ctx.fill();
  }
  // head
  const g = ctx.createRadialGradient(-p.r * 0.25, -p.r * 0.3, p.r * 0.2, 0, 0, p.r);
  g.addColorStop(0, '#a5e07f');
  g.addColorStop(1, '#7ec850');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#4d8f2f';
  ctx.stroke();

  // eyes
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s * p.r * 0.36, -p.r * 0.22, p.r * 0.24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(s * p.r * 0.36 + p.r * 0.06, -p.r * 0.22, p.r * 0.11, 0, TAU);
    ctx.fill();
  }

  // snout
  ctx.fillStyle = '#a5e07f';
  ctx.beginPath();
  ctx.ellipse(0, p.r * 0.22, p.r * 0.42, p.r * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#4d8f2f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#4d8f2f';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * p.r * 0.15, p.r * 0.22, p.r * 0.07, p.r * 0.11, 0, 0, TAU);
    ctx.fill();
  }

  // helmet
  if (p.helmet) {
    ctx.fillStyle = '#c8ccd2';
    ctx.beginPath();
    ctx.arc(0, -p.r * 0.28, p.r * 1.02, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a8f96';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#8a8f96';
    ctx.beginPath();
    ctx.arc(0, -p.r * 1.28, p.r * 0.16, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBlock(b) {
  const m = MAT[b.mat];
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.hitFlash > 0) {
    ctx.translate(rand(-1.6, 1.6), rand(-1.6, 1.6));
  }
  const x = -b.w / 2, y = -b.h / 2;
  ctx.fillStyle = m.fill;
  ctx.fillRect(x, y, b.w, b.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = m.edge;
  ctx.strokeRect(x + 1.5, y + 1.5, b.w - 3, b.h - 3);

  if (b.mat === 'wood') {
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 2;
    const rows = Math.max(1, Math.floor(b.h / 16));
    for (let i = 1; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 5, y + (b.h / (rows + 1)) * i);
      ctx.lineTo(x + b.w - 5, y + (b.h / (rows + 1)) * i);
      ctx.stroke();
    }
  } else if (b.mat === 'stone') {
    ctx.strokeStyle = 'rgba(0,0,0,.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + b.w * 0.3, y + 3);
    ctx.lineTo(x + b.w * 0.45, y + b.h * 0.5);
    ctx.lineTo(x + b.w * 0.35, y + b.h - 3);
    ctx.moveTo(x + b.w * 0.7, y + 4);
    ctx.lineTo(x + b.w * 0.6, y + b.h * 0.6);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + b.h - 6);
    ctx.lineTo(x + b.w * 0.4, y + 6);
    ctx.stroke();
  }

  // damage cracks
  const dmgRatio = 1 - b.hp / b.maxHp;
  if (dmgRatio > 0.01) {
    ctx.strokeStyle = `rgba(0,0,0,${0.25 + dmgRatio * 0.4})`;
    ctx.lineWidth = 2;
    const n = Math.ceil(dmgRatio * 3);
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(x + b.w * (0.2 + 0.3 * i), y + 3);
      ctx.lineTo(x + b.w * (0.35 + 0.2 * i), y + b.h * 0.55);
      ctx.lineTo(x + b.w * (0.25 + 0.25 * i), y + b.h - 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + 45), g = Math.min(255, ((n >> 8) & 255) + 45), b = Math.min(255, (n & 255) + 45);
  return `rgb(${r},${g},${b})`;
}

function drawHUD() {
  // score
  ctx.textAlign = 'left';
  ctx.font = '900 30px "Trebuchet MS", sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  const sTxt = 'SCORE  ' + game.score.toLocaleString();
  ctx.strokeText(sTxt, 22, 44);
  ctx.fillStyle = '#fff';
  ctx.fillText(sTxt, 22, 44);

  // level
  ctx.textAlign = 'center';
  const lv = LEVELS[game.level];
  const lTxt = `LEVEL ${game.level + 1} · ${lv.name}`;
  ctx.font = '900 21px "Trebuchet MS", sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeText(lTxt, W / 2, 36);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(lTxt, W / 2, 36);

  // birds queue
  ctx.textAlign = 'left';
  ctx.font = '700 15px "Trebuchet MS", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText('BIRDS', 24, H - 58);
  let bx = 26;
  for (const t of game.queue) {
    const d = BIRD_DEF[t];
    ctx.fillStyle = d.body;
    ctx.beginPath();
    ctx.arc(bx + 13, H - 30, 13, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.stroke();
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(bx + 21, H - 33);
    ctx.lineTo(bx + 30, H - 30);
    ctx.lineTo(bx + 21, H - 27);
    ctx.closePath();
    ctx.fill();
    bx += 34;
  }

  // intro banner
  if (game.introTimer > 0 && game.scene === 'play') {
    const a = clamp(game.introTimer > 1.9 ? (2.2 - game.introTimer) / 0.3 : game.introTimer / 1.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '900 54px "Trebuchet MS", sans-serif';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.strokeText(`LEVEL ${game.level + 1}`, W / 2, 300);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(`LEVEL ${game.level + 1}`, W / 2, 300);
    ctx.font = '900 30px "Trebuchet MS", sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeText(lv.name, W / 2, 348);
    ctx.fillStyle = '#fff';
    ctx.fillText(lv.name, W / 2, 348);
    ctx.globalAlpha = 1;
  }

  // hint
  if (game.scene === 'play' && game.hint && game.state === 'ready' && !game.bird?.abilityUsed) {
    const b = game.bird;
    ctx.textAlign = 'center';
    ctx.font = '700 19px "Trebuchet MS", sans-serif';
    const pulse = 0.75 + Math.sin(game.time * 4) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    const msg = b && b.ability ? 'Drag back, release — tap mid-flight for its power!' : 'Drag the bird back and release!';
    ctx.strokeText(msg, ANCHOR.x + 40, ANCHOR.y - 74);
    ctx.fillStyle = '#fff';
    ctx.fillText(msg, ANCHOR.x + 40, ANCHOR.y - 74);
    ctx.globalAlpha = 1;
  }
}

// ---------------- input ----------------
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  AudioSys.init();
  if (game.scene !== 'play') return;
  const p = canvasPos(e);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}

  if (game.state === 'flying') { triggerAbility(); return; }
  if (game.state !== 'ready') return;
  const b = game.bird;
  if (!b) return;
  if (Math.hypot(p.x - b.x, p.y - b.y) < 52) {
    game.state = 'dragging';
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (game.scene !== 'play' || game.state !== 'dragging') return;
  const b = game.bird;
  if (!b) return;
  const p = canvasPos(e);
  let dx = p.x - ANCHOR.x, dy = p.y - ANCHOR.y;
  const d = Math.hypot(dx, dy);
  if (d > MAX_DRAG) { dx *= MAX_DRAG / d; dy *= MAX_DRAG / d; }
  b.x = ANCHOR.x + dx;
  b.y = ANCHOR.y + dy;
});

function endDrag(e) {
  if (game.scene !== 'play') return;
  if (game.state === 'dragging') {
    const b = game.bird;
    const d = b ? Math.hypot(b.x - ANCHOR.x, b.y - ANCHOR.y) : 0;
    if (d > 14) launchBird();
    else { game.state = 'ready'; }   // tiny pull: snap back
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------------- UI wiring ----------------
const $ = (id) => document.getElementById(id);

function showOverlay(name) {
  for (const id of ['menu', 'winScreen', 'loseScreen']) $(id).classList.toggle('hidden', id !== name);
}

function buildLevelRow() {
  const row = $('levelRow');
  row.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    b.className = 'lvl-btn';
    const st = (best[i] || { stars: 0 }).stars;
    b.innerHTML = `${i + 1}<small>${[1, 2, 3].map(s => `<span class="${s <= st ? 'on' : 'off'}">★</span>`).join('')}</small>`;
    b.title = lv.name;
    b.addEventListener('click', () => { AudioSys.init(); AudioSys.click(); startLevel(i); });
    row.appendChild(b);
  });
}

function toMenu() {
  game.scene = 'menu';
  game.bird = null; game.extras = [];
  buildLevelRow();
  showOverlay('menu');
}

$('btnPlay').addEventListener('click', () => {
  AudioSys.init(); AudioSys.click();
  let first = LEVELS.findIndex((_, i) => ((best[i] || { stars: 0 }).stars) < 3);
  if (first < 0) first = 0;
  startLevel(first);
});
$('btnRestart').addEventListener('click', () => { AudioSys.init(); AudioSys.click(); if (game.scene !== 'menu') startLevel(game.level); });
$('btnMenu').addEventListener('click', () => { AudioSys.click(); toMenu(); });
$('btnWinReplay').addEventListener('click', () => { AudioSys.click(); startLevel(game.level); });
$('btnWinNext').addEventListener('click', () => {
  AudioSys.click();
  if (game.level + 1 < LEVELS.length) startLevel(game.level + 1); else toMenu();
});
$('btnWinMenu').addEventListener('click', () => { AudioSys.click(); toMenu(); });
$('btnLoseRetry').addEventListener('click', () => { AudioSys.click(); startLevel(game.level); });
$('btnLoseMenu').addEventListener('click', () => { AudioSys.click(); toMenu(); });
$('btnMute').addEventListener('click', () => {
  AudioSys.enabled = !AudioSys.enabled;
  $('btnMute').innerHTML = AudioSys.enabled ? '&#128266;' : '&#128263;';
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') { if (game.scene === 'play' || game.scene === 'win' || game.scene === 'lose') startLevel(game.level); }
  if (e.key === 'm' || e.key === 'M') $('btnMute').click();
});

// ---------------- resize ----------------
function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H) * 0.985;
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
window.addEventListener('resize', fit);
fit();

// ---------------- main loop ----------------
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= STEP * 1000) { step(STEP); acc -= STEP * 1000; }
  draw();
  requestAnimationFrame(frame);
}
buildLevelRow();
requestAnimationFrame(frame);

// debug / test hook
window.__AB = { game, startLevel, ANCHOR, launchBird, triggerAbility };
