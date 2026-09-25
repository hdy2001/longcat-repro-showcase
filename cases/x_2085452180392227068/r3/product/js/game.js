/* ===== Furious Birds — main game ===== */
(function () {
'use strict';

window.addEventListener('error', function (e) {
  window.__errors = window.__errors || [];
  window.__errors.push(String(e.message || e));
});

const STEP = 1 / 240;               // physics substep
const LAUNCH_POWER = 11.5;
const LAUNCH_MAX = 1300;
const PIG_IMPACT_DEATH = 330;       // normal pig dies above this impact speed
const PIG_GROUND_DEATH = 470;       // ... when slamming the ground
const BLOCK_DAMAGE_START = 250;     // blocks start taking damage above this
const SAVE_KEY = 'furiousBirdsSaveV1';

/* ---------- save ---------- */
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.unlocked === 'number') return s;
  } catch (e) { /* ignore */ }
  return { unlocked: 1, stars: [0, 0, 0, 0, 0, 0] };
}
function storeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

/* ---------- game ---------- */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = WORLD_W * this.dpr;
    canvas.height = WORLD_H * this.dpr;

    this.save = loadSave();
    this.state = 'title';           // title | playing | paused | levelComplete | gameOver
    this.levelIndex = 0;
    this.score = 0;
    this.time = 0;

    this.bodies = [];               // blocks + pigs + flying birds
    this.birdQueue = [];
    this.birdReady = false;
    this.currentBtype = null;
    this.nextBirdTimer = 0;
    this.flying = [];
    this.pigsAlive = 0;

    this.dragging = false;
    this.dragPos = { x: SLING.anchor.x, y: SLING.anchor.y };
    this.abilityCd = 0;

    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.flash = 0;
    this.banner = null;
    this.winPending = -1;
    this.losePending = -1;
    this.levelScoreStart = 0;

    this.clouds = [];
    const rndC = mulberry32(42);
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: rndC() * (WORLD_W + 400) - 200,
        y: 40 + rndC() * 170,
        s: 0.7 + rndC() * 0.9,
        speed: 4 + rndC() * 8
      });
    }
    this.tufts = [];
    this.flowers = [];
    this.scenerySeed = 1;

    this.ui = {
      hud: document.getElementById('hud'),
      hudLevel: document.getElementById('hud-level'),
      scoreVal: document.getElementById('score-val'),
      overlays: {
        title: document.getElementById('overlay-title'),
        levels: document.getElementById('overlay-levels'),
        complete: document.getElementById('overlay-complete'),
        gameover: document.getElementById('overlay-gameover'),
        pause: document.getElementById('overlay-pause')
      }
    };

    this.bindInput();
    this.bindUI();
    this.showOverlay('title');

    this.last = performance.now();
    this.acc = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ================= UI wiring ================= */
  bindUI() {
    const $ = (id) => document.getElementById(id);
    $('btn-play').addEventListener('click', () => { AudioFX.play('click'); this.startLevel(Math.min(this.save.unlocked - 1, LEVELS.length - 1)); });
    $('btn-levels').addEventListener('click', () => { AudioFX.play('click'); this.buildLevelGrid(); this.showOverlay('levels'); });
    $('btn-levels-back').addEventListener('click', () => { AudioFX.play('click'); this.showOverlay('title'); });
    $('btn-restart').addEventListener('click', () => { AudioFX.play('click'); if (this.state === 'playing' || this.state === 'paused') this.startLevel(this.levelIndex); });
    $('btn-mute').addEventListener('click', () => {
      const m = AudioFX.toggleMute();
      $('btn-mute').classList.toggle('muted', m);
    });
    $('btn-pause').addEventListener('click', () => { AudioFX.play('click'); this.togglePause(); });
    $('btn-resume').addEventListener('click', () => { AudioFX.play('click'); this.togglePause(); });
    $('btn-pause-restart').addEventListener('click', () => { AudioFX.play('click'); this.startLevel(this.levelIndex); });
    $('btn-pause-menu').addEventListener('click', () => { AudioFX.play('click'); this.toMenu(); });
    $('btn-complete-next').addEventListener('click', () => {
      AudioFX.play('click');
      if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
      else this.toMenu();
    });
    $('btn-complete-replay').addEventListener('click', () => { AudioFX.play('click'); this.startLevel(this.levelIndex); });
    $('btn-complete-menu').addEventListener('click', () => { AudioFX.play('click'); this.toMenu(); });
    $('btn-gameover-retry').addEventListener('click', () => { AudioFX.play('click'); this.startLevel(this.levelIndex); });
    $('btn-gameover-menu').addEventListener('click', () => { AudioFX.play('click'); this.toMenu(); });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
      } else if (e.key === 'r' || e.key === 'R') {
        if (this.state === 'playing' || this.state === 'paused') this.startLevel(this.levelIndex);
      } else if (e.key === 'm' || e.key === 'M') {
        $('btn-mute').classList.toggle('muted', AudioFX.toggleMute());
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause();
    });
  }

  buildLevelGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (let i = 0; i < LEVELS.length; i++) {
      const locked = i >= this.save.unlocked;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'level-tile' + (locked ? ' locked' : '');
      tile.disabled = locked;
      const stars = this.save.stars[i] || 0;
      let starsHtml = '';
      for (let s = 0; s < 3; s++) {
        starsHtml += `<svg viewBox="0 0 24 24" class="${s < stars ? '' : 'empty'}"><path d="M12 2l2.9 6.3 6.6 1-4.8 4.6 1.2 6.6L12 17.8 6.1 20.5l1.2-6.6L2.5 9.3l6.6-1z"/></svg>`;
      }
      tile.innerHTML = locked
        ? `<div class="num">🔒</div>`
        : `<div class="num">${i + 1}</div><div class="mini-stars">${starsHtml}</div>`;
      if (!locked) {
        tile.addEventListener('click', () => { AudioFX.play('click'); this.startLevel(i); });
      }
      grid.appendChild(tile);
    }
  }

  showOverlay(name) {
    for (const k in this.ui.overlays) this.ui.overlays[k].classList.add('hidden');
    if (name) this.ui.overlays[name].classList.remove('hidden');
    this.ui.hud.classList.toggle('hidden', !(name === null || name === 'pause'));
  }

  toMenu() {
    this.state = 'title';
    this.buildLevelGrid();
    this.showOverlay('title');
  }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; this.showOverlay('pause'); }
    else if (this.state === 'paused') { this.state = 'playing'; this.showOverlay(null); }
    this.last = performance.now();
  }

  startLevel(idx) {
    this.levelIndex = idx;
    const def = LEVELS[idx];
    this.levelDef = def;
    const built = def.build();
    this.bodies = built.blocks.concat(built.pigs);
    this.birdQueue = def.birds.slice();
    this.flying = [];
    this.particles = [];
    this.popups = [];
    this.pigsAlive = built.pigs.length;
    this.score = 0;
    this.dragging = false;
    this.dragPos = { x: SLING.anchor.x, y: SLING.anchor.y };
    this.winPending = -1;
    this.losePending = -1;
    this.acc = 0;
    this.shake = 0;
    this.flash = 0;
    this.abilityCd = 0;

    // scenery per level
    const rnd = mulberry32(1000 + idx * 77);
    this.tufts = [];
    for (let x = 8; x < WORLD_W; x += 26 + rnd() * 22) {
      this.tufts.push({ x, s: 0.6 + rnd() * 0.8 });
    }
    this.flowers = [];
    for (let i = 0; i < 7; i++) {
      this.flowers.push({ x: 30 + rnd() * (WORLD_W - 60), dy: 14 + rnd() * 34 });
    }

    this.banner = { text: 'LEVEL ' + (idx + 1), sub: def.name, t: 2.0 };
    this.ui.hudLevel.textContent = 'LEVEL ' + (idx + 1);
    this.updateScore(0);

    this.state = 'playing';
    this.showOverlay(null);
    this.loadNextBird();
  }

  loadNextBird() {
    if (this.birdQueue.length === 0) { this.birdReady = false; this.currentBtype = null; return; }
    this.currentBtype = this.birdQueue.shift();
    this.birdReady = true;
    this.dragPos = { x: SLING.anchor.x, y: SLING.anchor.y };
  }

  updateScore(add) {
    this.score += add;
    this.ui.scoreVal.textContent = String(this.score);
  }

  /* ================= input ================= */
  bindInput() {
    const cv = this.canvas;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * WORLD_W / r.width,
        y: (e.clientY - r.top) * WORLD_H / r.height
      };
    };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      AudioFX.unlock();
      if (this.state !== 'playing') return;
      const p = pos(e);
      if (this.flying.length > 0) {
        this.triggerAbility();
        return;
      }
      const rp = this.readyBirdPos();
      if (this.birdReady && Math.hypot(p.x - rp.x, p.y - rp.y) < 75) {
        this.dragging = true;
        this.dragPos = this.clampDrag(p);
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.dragPos = this.clampDrag(pos(e));
    });
    const release = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      const d = Math.hypot(this.dragPos.x - SLING.anchor.x, this.dragPos.y - SLING.anchor.y);
      if (d > 18) this.launch();
    };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', () => { this.dragging = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  clampDrag(p) {
    let dx = p.x - SLING.anchor.x, dy = p.y - SLING.anchor.y;
    const len = Math.hypot(dx, dy);
    if (len > SLING.maxDrag) {
      dx = dx / len * SLING.maxDrag;
      dy = dy / len * SLING.maxDrag;
    }
    return { x: SLING.anchor.x + dx, y: SLING.anchor.y + dy };
  }

  readyBirdPos() {
    return this.dragging ? this.dragPos : SLING.anchor;
  }

  launch() {
    const bp = this.dragPos;
    const body = makeBirdBody(this.currentBtype, bp.x, bp.y);
    let vx = (SLING.anchor.x - bp.x) * LAUNCH_POWER;
    let vy = (SLING.anchor.y - bp.y) * LAUNCH_POWER;
    const sp = Math.hypot(vx, vy);
    if (sp > LAUNCH_MAX) { vx = vx / sp * LAUNCH_MAX; vy = vy / sp * LAUNCH_MAX; }
    body.vx = vx; body.vy = vy;
    this.bodies.push(body);
    this.flying.push({
      body, btype: this.currentBtype, age: 0, rest: 0,
      boosted: false, splitDone: false, exploded: false,
      trail: [], pendingBoom: -1
    });
    this.birdReady = false;
    this.currentBtype = null;
    AudioFX.play('launch');
  }

  /* ================= abilities ================= */
  triggerAbility() {
    if (this.abilityCd > 0) return;
    const list = this.flying;
    if (!list.length) return;
    let acted = false;
    for (const b of this.flying) {
      if (b.btype === 'yellow' && !b.boosted) {
        b.body.vx *= 2.3; b.body.vy *= 0.6;
        b.boosted = true;
        this.spawnStreaks(b.body);
        AudioFX.play('boost');
        acted = true;
        break;
      }
    }
    if (!acted) {
      for (const b of this.flying) {
        if (b.btype === 'blue' && !b.splitDone) {
          this.splitBird(b);
          acted = true;
        }
      }
      if (acted) AudioFX.play('split');
    }
    if (!acted) {
      for (const b of this.flying) {
        if (b.btype === 'black' && !b.exploded) {
          b.exploded = true;
          this.explode(b.body.x, b.body.y);
          this.retireBird(b);
          acted = true;
          break;
        }
      }
    }
    if (acted) this.abilityCd = 0.25;
  }

  splitBird(b) {
    const v = Math.hypot(b.body.vx, b.body.vy) || 1;
    const baseA = Math.atan2(b.body.vy, b.body.vx);
    for (const da of [-0.38, 0.38]) {
      const a = baseA + da;
      const sp = v * 0.92;
      const nb = makeBirdBody('blue', b.body.x, b.body.y);
      nb.vx = Math.cos(a) * sp;
      nb.vy = Math.sin(a) * sp;
      this.bodies.push(nb);
      this.flying.push({
        body: nb, btype: 'blue', age: b.age, rest: 0,
        boosted: false, splitDone: true, exploded: false,
        trail: [], pendingBoom: -1
      });
    }
    b.splitDone = true;
    b.body.vx *= 0.9; b.body.vy *= 0.9;
    this.spawnPuff(b.body.x, b.body.y, '#bbdefb');
  }

  explode(x, y) {
    const radius = 150;
    for (const b of this.bodies) {
      if (b.dead) continue;
      const br = b.kind === 'circle' ? b.radius : Math.max(b.w, b.h) / 2;
      const d = Math.hypot(b.x - x, b.y - y);
      const reach = radius + br;
      if (d >= reach) continue;
      const falloff = 1 - d / reach;
      const dx = d > 1 ? (b.x - x) / d : (Math.random() - 0.5);
      const dy = d > 1 ? (b.y - y) / d : -0.5;
      const dv = 1500 * falloff * Math.pow(b.invMass, 0.75);
      b.vx += dx * dv;
      b.vy += dy * dv;
      b.av += (Math.random() - 0.5) * 10;
      b.sleeping = false;
      if (b.kind === 'block') b.hp -= 115 * falloff;
      else if (b.kind === 'pig') {
        if (b.king) b.hp -= 115 * falloff;
        else if (falloff > 0.1) this.killPig(b);
      }
    }
    this.flash = 0.55;
    this.shake = 16;
    AudioFX.play('explosion');
    // ring + fire + smoke
    this.particles.push({ kind: 'ring', x, y, r: 12, vr: 950, life: 0.45, maxLife: 0.45, color: '#fff' });
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 450;
      this.particles.push({
        kind: 'circle', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        size: 3 + Math.random() * 6,
        color: ['#ff9d2e', '#ffd93b', '#ff5a2e', '#fff'][i % 4],
        life: 0.5 + Math.random() * 0.4, maxLife: 0.9, grav: 500
      });
    }
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        kind: 'smoke', x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 70,
        size: 10 + Math.random() * 14, color: 'rgba(90,90,95,0.5)',
        life: 0.9 + Math.random() * 0.5, maxLife: 1.4, grav: -60
      });
    }
  }

  /* ================= combat resolution ================= */
  damageFromImpact(b, approach) {
    if (b.dead || approach <= 0) return;
    if (b.kind === 'block') {
      if (approach > BLOCK_DAMAGE_START) {
        const info = MAT_INFO[b.mat] || MAT_INFO.wood;
        b.hp -= (approach - BLOCK_DAMAGE_START) * info.dmg;
      }
    } else if (b.kind === 'pig') {
      if (b.king) {
        if (approach > BLOCK_DAMAGE_START) b.hp -= (approach - BLOCK_DAMAGE_START) * 0.6;
      } else if (approach > PIG_IMPACT_DEATH) {
        this.killPig(b);
      }
    } else if (b.kind === 'bird' && b.btype === 'black') {
      // bomb bird detonates on very hard impact
      const bird = this.flying.find((fb) => fb.body === b);
      if (bird && !bird.exploded && approach > 520) bird.pendingBoom = 0.07;
    }
  }

  killPig(p) {
    if (p.dead) return;
    p.dead = true;
    const pts = p.king ? 5000 : 1000;
    this.updateScore(pts);
    this.popups.push({ x: p.x, y: p.y - 10, text: '+' + pts, color: '#7ed957', life: 1.1, maxLife: 1.1, size: p.king ? 30 : 22 });
    this.spawnPoof(p.x, p.y, p.radius);
    AudioFX.play('pop');
    this.pigsAlive--;
    this.wakeAll();
    if (p.king) this.shake = Math.max(this.shake, 8);
  }

  breakBlock(b) {
    if (b.dead) return;
    b.dead = true;
    const info = MAT_INFO[b.mat] || MAT_INFO.wood;
    this.updateScore(info.score);
    this.popups.push({
      x: b.x, y: b.y, text: '+' + info.score, color: '#fff',
      life: 0.8, maxLife: 0.8, size: 16
    });
    this.spawnDebris(b.x, b.y, b.mat, Math.max(3, Math.min(8, Math.round(b.w * b.h / 3000))));
    AudioFX.play('crack');
    this.wakeAll();
  }

  wakeAll() {
    for (const b of this.bodies) b.sleeping = false;
  }

  retireBird(bird) {
    bird.body.dead = true;
    const i = this.flying.indexOf(bird);
    if (i >= 0) this.flying.splice(i, 1);
    if (bird.btype === 'black' && !bird.exploded) {
      bird.exploded = true;
      this.explode(bird.body.x, bird.body.y);
    }
    if (!this.birdReady && this.birdQueue.length > 0) {
      this.nextBirdTimer = 0.7;
    }
  }

  /* ================= physics ================= */
  physicsStep(dt) {
    const bodies = this.bodies;
    // integrate
    const linDamp = Math.pow(0.999, dt * 60);
    const angDamp = Math.pow(0.99, dt * 60);
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.dead || b.sleeping) continue;
      b.vy += PHYS_GRAVITY * dt;
      b.vx *= linDamp; b.vy *= linDamp; b.av *= angDamp;
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > PHYS_MAX_SPEED * PHYS_MAX_SPEED) {
        const s = PHYS_MAX_SPEED / Math.sqrt(sp2);
        b.vx *= s; b.vy *= s;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.av * dt;
      b.onGround = false;
    }

    // narrow phase
    const manifolds = [];
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (a.dead) continue;
      const ra = a.kind === 'circle' ? a.radius : Math.max(a.w, a.h) / 2;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (b.dead) continue;
        if (a.sleeping && b.sleeping) continue;
        if (a.kind === 'bird' && b.kind === 'bird') continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rb = b.kind === 'circle' ? b.radius : Math.max(b.w, b.h) / 2;
        if (dx * dx + dy * dy > (ra + rb + 6) * (ra + rb + 6)) continue;

        let m = null, circle = null, box = null;
        if (a.kind !== 'circle' && b.kind !== 'circle') {
          m = collideBoxBox(a, b);
          m.type = 'boxbox'; m.a = a; m.b = b;
          if (m) {
            const va = contactVel(a, m.px, m.py), vb = contactVel(b, m.px, m.py);
            m.approach = -((vb.x - va.x) * m.nx + (vb.y - va.y) * m.ny);
          }
        } else {
          if (a.kind === 'circle' && b.kind === 'circle') {
            m = collideCircleCircle(a, b);
            m.type = 'circlecircle'; m.a = a; m.b = b;
            if (m) {
              const va = contactVel(a, m.px, m.py), vb = contactVel(b, m.px, m.py);
              m.approach = -((va.x - vb.x) * m.nx + (va.y - vb.y) * m.ny);
            }
          } else {
            circle = a.kind === 'circle' ? a : b;
            box = a.kind === 'circle' ? b : a;
            m = collideCircleBox(circle, box);
            m.type = 'circlebox'; m.circle = circle; m.box = box;
            if (m) {
              const vc = contactVel(circle, m.px, m.py), vb = contactVel(box, m.px, m.py);
              m.approach = -((vc.x - vb.x) * m.nx + (vc.y - vb.y) * m.ny);
            }
          }
        }
        if (m && m.depth > 0) {
          if (a.sleeping !== b.sleeping) {
            // wake the sleeper when something moving touches it
            if (!a.sleeping) b.sleeping = false; else a.sleeping = false;
          }
          manifolds.push(m);
        }
      }
    }

    // solve
    for (let iter = 0; iter < PHYS_SOLVER_ITER; iter++) {
      for (let k = 0; k < manifolds.length; k++) {
        const m = manifolds[k];
        if (m.depth <= 0) continue;
        if (m.type === 'boxbox') solveBoxBox(m.a, m.b, m);
        else if (m.type === 'circlebox') solveCircleBox(m.circle, m.box, m);
        else solveCircleCircle(m.a, m.b, m);
        if (iter === 0 && m.depth > 0.5) {
          if (m.type === 'circlebox') positionalCorrect(m.circle, m.box, m.nx, m.ny, m.depth);
          else positionalCorrect(m.a, m.b, m.nx, m.ny, m.depth);
        }
      }
    }

    // ground contacts
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.dead || b.sleeping) continue;
      if (b.kind === 'circle') {
        const impact = solveCircleGround(b, GROUND_Y);
        if (impact > 0) {
          b.onGround = true;
          if (impact > 260) AudioFX.play('thud', impact / 1400);
          if (b.kind === 'pig') {
            if (b.king) { if (impact > BLOCK_DAMAGE_START) b.hp -= (impact - BLOCK_DAMAGE_START) * 0.6; }
            else if (impact > PIG_GROUND_DEATH) this.killPig(b);
          } else if (b.kind === 'bird' && impact > 400) {
            this.spawnDust(b.x, GROUND_Y);
          }
        }
      } else {
        this.solveBoxGround(b, dt);
      }
    }

    // damage pass
    for (let k = 0; k < manifolds.length; k++) {
      const m = manifolds[k];
      if (!m || m.approach <= 0) continue;
      if (m.type === 'circlebox') {
        this.damageFromImpact(m.circle, m.approach);
        this.damageFromImpact(m.box, m.approach);
      } else {
        this.damageFromImpact(m.a, m.approach);
        this.damageFromImpact(m.b, m.approach);
      }
      if (m.approach > 300 && (m.a.kind === 'block' || m.b.kind === 'block')) {
        AudioFX.play('thud', m.approach / 1200);
      }
    }

    // deaths
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.dead) continue;
      if (b.hp <= 0) {
        if (b.kind === 'block') this.breakBlock(b);
        else if (b.kind === 'pig') this.killPig(b);
      } else if (b.x < -260 || b.x > WORLD_W + 260 || b.y > WORLD_H + 300) {
        b.dead = true;
        if (b.kind === 'pig') this.pigsAlive--;
      }
    }
    if (this.bodies.some((b) => b.dead)) this.bodies = this.bodies.filter((b) => !b.dead);

    // sleep
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.sleeping) continue;
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 < 676 && Math.abs(b.av) < 0.8) {
        b.sleepTime += dt;
        if (b.sleepTime > 0.7) {
          b.sleeping = true;
          b.vx = 0; b.vy = 0; b.av = 0;
        }
      } else b.sleepTime = 0;
    }
  }

  solveBoxGround(b, dt) {
    const corners = bodyCorners(b);
    let touched = false;
    for (let i = 0; i < 4; i++) {
      const p = corners[i];
      if (p.y <= GROUND_Y) continue;
      touched = true;
      const pen = p.y - GROUND_Y;
      const rx = p.x - b.x, ry = p.y - b.y;
      const v = contactVel(b, p.x, GROUND_Y);
      const vn = v.y; // approaching if > 0 (normal is up)
      const rn = rx * -1 - ry * 0; // cross(r, n=(0,-1)) = rx*(-1) - ry*0 = -rx
      const kn = b.invMass + rn * rn * b.invI;
      if (kn > 0 && vn > 0) {
        const e = vn > 90 ? b.restitution : 0;
        const jimp = (1 + e) * vn / kn;
        applyImpulse(b, 0, -jimp, p.x, GROUND_Y);
        // friction
        const vt = v.x;
        const rt = rx * 0 - ry * 1; // cross(r, t=(1,0)) = rx*0 - ry*1
        const kt = b.invMass + rt * rt * b.invI;
        if (kt > 0) {
          const jt = physClamp(-vt / kt, -jimp * 0.6, jimp * 0.6);
          applyImpulse(b, jt, 0, p.x, GROUND_Y);
        }
        if (vn > 320) AudioFX.play('thud', vn / 1300);
      }
      b.y -= pen * 0.5;
      b.av *= Math.pow(0.9, dt * 60);
    }
    if (touched) b.onGround = true;
  }

  /* ================= per-frame update ================= */
  update(dt) {
    this.time += dt;
    this.abilityCd = Math.max(0, this.abilityCd - dt);

    // clouds always drift
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > WORLD_W + 220) c.x = -220;
    }

    if (this.state !== 'playing') {
      this.updateFx(dt);
      return;
    }

    // physics substeps
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 10) {
      this.physicsStep(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 10) this.acc = 0;

    // next bird
    if (!this.birdReady && this.flying.length === 0 && this.birdQueue.length > 0) {
      if (this.nextBirdTimer > 0) {
        this.nextBirdTimer -= dt;
        if (this.nextBirdTimer <= 0) this.loadNextBird();
      }
    }

    // flying birds
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const bird = this.flying[i];
      const b = bird.body;
      bird.age += dt;
      // trail
      bird.trail.push({ x: b.x, y: b.y });
      if (bird.trail.length > 14) bird.trail.shift();
      // pending detonation
      if (bird.pendingBoom > 0) {
        bird.pendingBoom -= dt;
        if (bird.pendingBoom <= 0 && !bird.exploded) {
          bird.exploded = true;
          this.explode(b.x, b.y);
          this.retireBird(bird);
          continue;
        }
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < 85) bird.rest += dt; else bird.rest = 0;
      // bomb auto-detonates if it just sits there
      if (bird.btype === 'black' && !bird.exploded && bird.age > 3.5 && sp < 130) {
        bird.exploded = true;
        this.explode(b.x, b.y);
        this.retireBird(bird);
        continue;
      }
      if (bird.rest > 0.6 || bird.age > 9 ||
          b.y > WORLD_H + 60 || b.x < -140 || b.x > WORLD_W + 140) {
        this.retireBird(bird);
      }
    }

    // win / lose checks
    if (this.pigsAlive <= 0 && this.winPending < 0 && this.state === 'playing') {
      this.winPending = 1.2;
    }
    if (this.winPending > 0) {
      this.winPending -= dt;
      if (this.winPending <= 0) { this.doWin(); return; }
    }
    if (this.pigsAlive > 0 && this.losePending < 0 &&
        this.flying.length === 0 && !this.birdReady && this.birdQueue.length === 0) {
      this.losePending = 1.0;
    }
    if (this.losePending > 0) {
      this.losePending -= dt;
      if (this.losePending <= 0) { this.doLose(); return; }
    }

    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }

    this.updateFx(dt);
  }

  updateFx(dt) {
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      if (p.kind === 'ring') { p.r += p.vr * dt; continue; }
      if (p.vx !== undefined) {
        p.vy += (p.grav || 900) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.rot !== undefined) p.rot += p.av * dt;
      }
    }
    // popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y -= 42 * dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 34);
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }

  spawnDebris(x, y, mat, n) {
    const colMap = { wood: ['#cf8a45', '#a0652c', '#7a4a16'], stone: ['#b9c0c8', '#8d959e', '#6e757e'], glass: ['rgba(170,225,255,0.8)', 'rgba(140,205,245,0.8)', 'rgba(110,170,215,0.9)'] };
    const cols = colMap[mat] || colMap.wood;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 260;
      this.particles.push({
        kind: 'rect', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160,
        rot: Math.random() * Math.PI, av: (Math.random() - 0.5) * 14,
        size: 3 + Math.random() * 6,
        color: cols[i % cols.length],
        life: 0.7 + Math.random() * 0.5, maxLife: 1.2, grav: 1100
      });
    }
  }

  spawnPoof(x, y, r) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      this.particles.push({
        kind: 'circle', x, y,
        vx: Math.cos(a) * (60 + Math.random() * 90),
        vy: Math.sin(a) * (60 + Math.random() * 90) - 40,
        size: r * (0.35 + Math.random() * 0.3),
        color: i % 2 ? 'rgba(130,201,79,0.85)' : 'rgba(181,229,133,0.85)',
        life: 0.55 + Math.random() * 0.25, maxLife: 0.8, grav: -120
      });
    }
  }

  spawnPuff(x, y, color) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        kind: 'circle', x, y,
        vx: Math.cos(a) * 70, vy: Math.sin(a) * 70,
        size: 3 + Math.random() * 4, color,
        life: 0.35, maxLife: 0.35, grav: 0
      });
    }
  }

  spawnStreaks(b) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        kind: 'circle',
        x: b.x - b.vx * 0.02 + (Math.random() - 0.5) * 16,
        y: b.y - b.vy * 0.02 + (Math.random() - 0.5) * 16,
        vx: -b.vx * 0.08, vy: -b.vy * 0.08,
        size: 2.5 + Math.random() * 3.5,
        color: 'rgba(255,240,150,0.9)',
        life: 0.3 + Math.random() * 0.15, maxLife: 0.45, grav: 0
      });
    }
  }

  spawnDust(x, y) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        kind: 'smoke', x: x + (Math.random() - 0.5) * 20, y: y - 2,
        vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 50,
        size: 5 + Math.random() * 7, color: 'rgba(160,200,120,0.55)',
        life: 0.5, maxLife: 0.5, grav: -40
      });
    }
  }

  /* ================= win / lose ================= */
  doWin() {
    this.state = 'levelComplete';
    const left = this.birdQueue.length + (this.birdReady ? 1 : 0) + this.flying.length;
    const total = this.levelDef.birds.length;
    const ratio = total ? left / total : 0;
    const stars = ratio >= 0.45 ? 3 : ratio >= 0.2 ? 2 : 1;
    const bonus = left * 1000;
    this.updateScore(bonus);

    // persist
    if (this.levelIndex + 1 < LEVELS.length) {
      this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, this.levelIndex + 2));
    }
    this.save.stars[this.levelIndex] = Math.max(this.save.stars[this.levelIndex] || 0, stars);
    storeSave(this.save);

    // overlay content
    document.getElementById('complete-title').textContent =
      this.levelIndex + 1 === LEVELS.length ? 'YOU BEAT THE GAME!' : 'LEVEL COMPLETE!';
    document.getElementById('complete-score').textContent = String(this.score - bonus);
    document.getElementById('complete-bonus').textContent = '+' + bonus;
    document.getElementById('complete-total').textContent = String(this.score);
    document.getElementById('btn-complete-next').style.display =
      this.levelIndex + 1 === LEVELS.length ? 'none' : '';
    const starEls = [document.getElementById('star1'), document.getElementById('star2'), document.getElementById('star3')];
    starEls.forEach((el, i) => {
      el.classList.remove('earned');
      if (i < stars) {
        setTimeout(() => { el.classList.add('earned'); AudioFX.play('star', i); }, 350 + i * 300);
      }
    });
    this.showOverlay('complete');
    AudioFX.play('win');
  }

  doLose() {
    this.state = 'gameOver';
    this.showOverlay('gameover');
    AudioFX.play('lose');
  }

  /* ================= render ================= */
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.render();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    drawBackground(ctx, this.time, this.clouds, this.tufts, this.flowers);

    // slingshot (back) + ready bird + flying birds + front band
    const rp = this.readyBirdPos();
    drawSlingshot(ctx, rp, false, this.time);

    for (const b of this.bodies) {
      if (b.kind === 'block') drawBlock(ctx, b, this.time);
      else if (b.kind === 'pig') drawPig(ctx, b, this.time);
    }

    // trails
    for (const bird of this.flying) {
      const tr = bird.trail;
      for (let i = 0; i < tr.length; i++) {
        const a = i / tr.length * 0.35;
        ctx.beginPath();
        ctx.arc(tr[i].x, tr[i].y, BIRD_INFO[bird.btype].radius * (0.3 + 0.5 * i / tr.length), 0, Math.PI * 2);
        ctx.fillStyle = bird.btype === 'black' ? `rgba(255,200,80,${a})` : `rgba(255,255,255,${a})`;
        ctx.fill();
      }
    }

    for (const bird of this.flying) drawBird(ctx, bird.body, this.time);
    if (this.birdReady && this.currentBtype) {
      const ghost = { x: rp.x, y: rp.y, radius: BIRD_INFO[this.currentBtype].radius, btype: this.currentBtype, vx: 0, vy: 0 };
      const pulse = 1 + Math.sin(this.time * 5) * 0.03;
      ctx.save(); ctx.translate(rp.x, rp.y); ctx.scale(pulse, pulse); ctx.translate(-rp.x, -rp.y);
      drawBird(ctx, ghost, this.time);
      ctx.restore();
    }

    drawSlingshot(ctx, rp, this.birdReady && this.currentBtype, this.time);

    // trajectory preview
    if (this.dragging && this.birdReady && this.currentBtype) {
      const d = Math.hypot(this.dragPos.x - SLING.anchor.x, this.dragPos.y - SLING.anchor.y);
      if (d > 25) this.drawTrajectory(ctx);
    }

    // particles
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'ring') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 6 * a + 1;
        ctx.stroke();
      } else if (p.kind === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? (1.6 - a * 0.6) : a), 0, Math.PI * 2);
        ctx.globalAlpha = p.kind === 'smoke' ? a * 0.8 : a;
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // popups
    for (const p of this.popups) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `900 ${p.size}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#4a2f10';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    }

    // bird queue
    if (this.state === 'playing') {
      let qx = 30;
      for (const bt of this.birdQueue) {
        drawQueueIcon(ctx, bt, qx, WORLD_H - 22, 11);
        qx += 30;
      }
    }

    // level banner
    if (this.banner) {
      const a = Math.min(1, this.banner.t / 0.5, (2.0 - this.banner.t) / 0.3);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = "900 54px 'Trebuchet MS', sans-serif";
      ctx.textAlign = 'center';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#4a2f10';
      ctx.strokeText(this.banner.text, WORLD_W / 2, 200);
      ctx.fillStyle = '#ffd93b';
      ctx.fillText(this.banner.text, WORLD_W / 2, 200);
      ctx.font = "900 26px 'Trebuchet MS', sans-serif";
      ctx.lineWidth = 5;
      ctx.strokeText(this.banner.sub, WORLD_W / 2, 240);
      ctx.fillStyle = '#fff';
      ctx.fillText(this.banner.sub, WORLD_W / 2, 240);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // explosion flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,240,200,${this.flash})`;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
  }

  drawTrajectory(ctx) {
    let px = this.dragPos.x, py = this.dragPos.y;
    let vx = (SLING.anchor.x - this.dragPos.x) * LAUNCH_POWER;
    let vy = (SLING.anchor.y - this.dragPos.y) * LAUNCH_POWER;
    const sp = Math.hypot(vx, vy);
    if (sp > LAUNCH_MAX) { vx = vx / sp * LAUNCH_MAX; vy = vy / sp * LAUNCH_MAX; }
    const dtp = 1 / 24;
    for (let i = 0; i < 34; i++) {
      px += vx * dtp;
      py += vy * dtp;
      vy += PHYS_GRAVITY * dtp;
      if (i % 2 === 0) {
        const a = 0.85 * (1 - i / 34);
        ctx.beginPath();
        ctx.arc(px, py, 4.5 - i / 18, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(74,47,16,${a * 0.7})`;
        ctx.stroke();
      }
      if (py > GROUND_Y) break;
    }
  }

  /* ================= debug hooks (for automated testing) ================= */
  debugLaunch(angleDeg, power) {
    if (!this.birdReady) return false;
    const a = angleDeg * Math.PI / 180;
    const sp = power || 1000;
    this.dragPos = {
      x: SLING.anchor.x - Math.cos(a) * sp / LAUNCH_POWER,
      y: SLING.anchor.y - Math.sin(a) * sp / LAUNCH_POWER
    };
    const c = this.clampDrag(this.dragPos);
    this.dragPos = c;
    this.launch();
    return true;
  }
  debugExplodeAt(x, y) { this.explode(x, y); }
  debugKillPigs() { for (const b of this.bodies) if (b.kind === 'pig') this.killPig(b); }
}

/* ---------- boot ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  window.game = new Game(canvas);
});

})();
