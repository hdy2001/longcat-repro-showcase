/* ===== Furious Birds — 2D rigid body physics =====
   Oriented boxes (SAT) + circles, sequential impulse solver with
   rotation, friction, restitution, positional correction and sleep. */

const PHYS_GRAVITY = 1700;          // px / s^2
const PHYS_MAX_SPEED = 1700;        // safety clamp
const PHYS_SOLVER_ITER = 3;

function physClamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

/* ---------- Body ---------- */
class Body {
  constructor(o) {
    this.kind = o.kind || 'block';          // 'block' | 'pig' | 'bird'
    this.x = o.x; this.y = o.y;
    this.angle = o.angle || 0;
    this.w = o.w || 0; this.h = o.h || 0;
    this.radius = o.radius || 0;
    this.mat = o.mat || 'wood';             // wood | stone | glass | none
    this.btype = o.btype || null;           // bird type: red|yellow|blue|black

    const density = this.mat === 'stone' ? 2.4 : (this.mat === 'glass' ? 0.7 : 1.0);
    const area = this.kind === 'circle'
      ? Math.PI * this.radius * this.radius
      : this.w * this.h;
    const m = (o.mass !== undefined) ? o.mass : Math.max(0.25, density * area / 900);
    this.mass = m;
    this.invMass = 1 / m;
    const I = this.kind === 'circle'
      ? 0.5 * m * this.radius * this.radius
      : m * (this.w * this.w + this.h * this.h) / 12;
    this.inertia = I;
    this.invI = 1 / I;

    this.vx = 0; this.vy = 0; this.av = 0;

    // gameplay
    this.hp = (o.hp !== undefined) ? o.hp
      : this.mat === 'stone' ? 110 : (this.mat === 'glass' ? 14 : 45);
    this.maxHp = this.hp;
    this.restitution = (o.restitution !== undefined) ? o.restitution : 0.12;
    this.friction = (o.friction !== undefined) ? o.friction : 0.5;
    this.king = !!o.king;
    this.dead = false;
    this.sleeping = false;
    this.sleepTime = 0;
    this.onGround = false;
  }
}

/* ---------- geometry helpers ---------- */
function bodyCorners(b) {
  const c = Math.cos(b.angle), s = Math.sin(b.angle);
  const hw = b.w / 2, hh = b.h / 2;
  const lx = [-hw, hw, hw, -hw], ly = [-hh, -hh, hh, hh];
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push({ x: b.x + lx[i] * c - ly[i] * s, y: b.y + lx[i] * s + ly[i] * c });
  }
  return out;
}

function projectCorners(corners, ax, ay) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < corners.length; i++) {
    const d = corners[i].x * ax + corners[i].y * ay;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

function pointInBox(px, py, b) {
  const c = Math.cos(-b.angle), s = Math.sin(-b.angle);
  const dx = px - b.x, dy = py - b.y;
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) <= b.w / 2 + 1.5 && Math.abs(ly) <= b.h / 2 + 1.5;
}

/* ---------- collision detection ---------- */
// box vs box → {nx,ny,depth,px,py} or null. Normal points from a to b.
function collideBoxBox(a, b) {
  const ca = bodyCorners(a), cb = bodyCorners(b);
  const axes = [];
  for (let i = 0; i < 2; i++) {
    const p1 = ca[i], p2 = ca[i + 1];
    let ex = p2.x - p1.x, ey = p2.y - p1.y;
    const len = Math.hypot(ex, ey) || 1;
    axes.push({ x: -ey / len, y: ex / len });
  }
  for (let i = 0; i < 2; i++) {
    const p1 = cb[i], p2 = cb[i + 1];
    let ex = p2.x - p1.x, ey = p2.y - p1.y;
    const len = Math.hypot(ex, ey) || 1;
    axes.push({ x: -ey / len, y: ex / len });
  }
  let minOverlap = Infinity, bnx = 0, bny = 0;
  for (let i = 0; i < 4; i++) {
    const ax = axes[i];
    const pa = projectCorners(ca, ax.x, ax.y);
    const pb = projectCorners(cb, ax.x, ax.y);
    const overlap = Math.min(pa[1], pb[1]) - Math.max(pa[0], pb[0]);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) { minOverlap = overlap; bnx = ax.x; bny = ax.y; }
  }
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * bnx + dy * bny < 0) { bnx = -bnx; bny = -bny; }
  // contact point: average of corners of each box inside the other
  let px = 0, py = 0, n = 0;
  for (let i = 0; i < 4; i++) {
    if (pointInBox(cb[i].x, cb[i].y, a)) { px += cb[i].x; py += cb[i].y; n++; }
    if (pointInBox(ca[i].x, ca[i].y, b)) { px += ca[i].x; py += ca[i].y; n++; }
  }
  if (n > 0) { px /= n; py /= n; }
  else { px = (a.x + b.x) / 2; py = (a.y + b.y) / 2; }
  return { nx: bnx, ny: bny, depth: minOverlap, px, py };
}

// circle (c: {x,y,radius}) vs box → normal points from box to circle
function collideCircleBox(c, b) {
  const cos = Math.cos(-b.angle), sin = Math.sin(-b.angle);
  const dx = c.x - b.x, dy = c.y - b.y;
  const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
  const hw = b.w / 2, hh = b.h / 2;
  const qx = physClamp(lx, -hw, hw), qy = physClamp(ly, -hh, hh);
  let nx, ny, depth, px, py;
  if (qx === lx && qy === ly) {
    // circle center inside box → push out along smallest penetration axis
    const pxd = hw - Math.abs(lx), pyd = hh - Math.abs(ly);
    if (pxd < pyd) { nx = lx < 0 ? -1 : 1; ny = 0; depth = pxd + c.radius; }
    else { nx = 0; ny = ly < 0 ? -1 : 1; depth = pyd + c.radius; }
    px = c.x + nx * c.radius; py = c.y + ny * c.radius;
  } else {
    const ddx = lx - qx, ddy = ly - qy;
    const dist = Math.hypot(ddx, ddy);
    if (dist >= c.radius) return null;
    const inv = 1 / (dist || 1);
    nx = ddx * inv; ny = ddy * inv;          // box-local normal
    depth = c.radius - dist;
    // closest point in world space
    const wc = Math.cos(b.angle), ws = Math.sin(b.angle);
    px = b.x + qx * wc - qy * ws;
    py = b.y + qx * ws + qy * wc;
  }
  // rotate normal back to world
  const wc = Math.cos(b.angle), ws = Math.sin(b.angle);
  return {
    nx: nx * wc - ny * ws,
    ny: nx * ws + ny * wc,
    depth, px, py
  };
}

// circle vs circle → normal points from a to b
function collideCircleCircle(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const rr = a.radius + b.radius;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2) || 1;
  const nx = dx / d, ny = dy / d;
  return { nx, ny, depth: rr - d, px: a.x + nx * a.radius, py: a.y + ny * a.radius };
}

/* ---------- impulse resolution ---------- */
// Apply velocity impulse at contact point. Returns normal impulse magnitude (0 if separating).
function applyImpulse(b, jx, jy, px, py) {
  const rx = px - b.x, ry = py - b.y;
  b.vx += jx * b.invMass;
  b.vy += jy * b.invMass;
  b.av += (rx * jy - ry * jx) * b.invI;
}

function contactVel(b, px, py) {
  const rx = px - b.x, ry = py - b.y;
  return { x: b.vx - b.av * ry, y: b.vy + b.av * rx };
}

// Resolve one box-box manifold. Returns pre-solve approach speed (positive = closing).
function solveBoxBox(a, b, m) {
  let rax = m.px - a.x, ray = m.py - a.y;
  let rbx = m.px - b.x, rby = m.py - b.y;
  const va = contactVel(a, m.px, m.py), vb = contactVel(b, m.px, m.py);
  let rvx = vb.x - va.x, rvy = vb.y - va.y;
  const vn0 = rvx * m.nx + rvy * m.ny;

  const raxn = rax * m.ny - ray * m.nx;
  const rbxn = rbx * m.ny - rby * m.nx;
  const kn = a.invMass + b.invMass + raxn * raxn * a.invI + rbxn * rbxn * b.invI;
  if (kn <= 0) return 0;

  const e = vn0 < -90 ? Math.min(a.restitution, b.restitution) : 0;
  const j = -(1 + e) * vn0 / kn;
  applyImpulse(a, -m.nx * j, -m.ny * j, m.px, m.py);
  applyImpulse(b, m.nx * j, m.ny * j, m.px, m.py);

  // friction
  const tx = -m.ny, ty = m.nx;
  const va2 = contactVel(a, m.px, m.py), vb2 = contactVel(b, m.px, m.py);
  const vt = (vb2.x - va2.x) * tx + (vb2.y - va2.y) * ty;
  const raxt = rax * ty - ray * tx;
  const rbxt = rbx * ty - rby * tx;
  const kt = a.invMass + b.invMass + raxt * raxt * a.invI + rbxt * rbxt * b.invI;
  if (kt > 0) {
    const mu = Math.sqrt(a.friction * b.friction);
    let jt = -vt / kt;
    const maxF = j * mu;
    jt = physClamp(jt, -maxF, maxF);
    applyImpulse(a, -tx * jt, -ty * jt, m.px, m.py);
    applyImpulse(b, tx * jt, ty * jt, m.px, m.py);
  }
  return -vn0;
}

// circle vs box — normal from box to circle (col.nx points at circle)
function solveCircleBox(c, b, col) {
  // treat impulse at contact: circle side
  const rx = col.px - c.x, ry = col.py - c.y;
  const vcx = c.vx - c.av * ry, vcy = c.vy + c.av * rx;
  const vbx = b.vx - b.av * (col.py - b.y), vby = b.vy + b.av * (col.px - b.x);
  const rvx = vcx - vbx, rvy = vcy - vby;
  const vn0 = rvx * col.nx + rvy * col.ny;
  const rcn = rx * col.ny - ry * col.nx;
  const rbn = (col.px - b.x) * col.ny - (col.py - b.y) * col.nx;
  const kn = c.invMass + b.invMass + rcn * rcn * c.invI + rbn * rbn * b.invI;
  if (kn <= 0) return 0;
  const e = vn0 < -90 ? Math.min(c.restitution, b.restitution) : 0;
  const j = -(1 + e) * vn0 / kn;
  applyImpulse(c, col.nx * j, col.ny * j, col.px, col.py);
  applyImpulse(b, -col.nx * j, -col.ny * j, col.px, col.py);
  // friction
  const tx = -col.ny, ty = col.nx;
  const vt = rvx * tx + rvy * ty;
  const rct = rx * ty - ry * tx;
  const rbt = (col.px - b.x) * ty - (col.py - b.y) * tx;
  const kt = c.invMass + b.invMass + rct * rct * c.invI + rbt * rbt * b.invI;
  if (kt > 0) {
    const mu = Math.sqrt(c.friction * b.friction);
    let jt = physClamp(-vt / kt, -j * mu, j * mu);
    applyImpulse(c, tx * jt, ty * jt, col.px, col.py);
    applyImpulse(b, -tx * jt, -ty * jt, col.px, col.py);
  }
  return -vn0;
}

// circle vs circle — normal points from a to b
function solveCircleCircle(a, b, m) {
  const rx = m.px - a.x, ry = m.py - a.y;
  const vax = a.vx - a.av * ry, vay = a.vy + a.av * rx;
  const rbx = m.px - b.x, rby = m.py - b.y;
  const vbx = b.vx - b.av * rby, vby = b.vy + b.av * rbx;
  const rvx = vax - vbx, rvy = vay - vby;
  const vn0 = rvx * m.nx + rvy * m.ny;
  const rcn = rx * m.ny - ry * m.nx;
  const rbn = rbx * m.ny - rby * m.nx;
  const kn = a.invMass + b.invMass + rcn * rcn * a.invI + rbn * rbn * b.invI;
  if (kn <= 0) return 0;
  const e = vn0 < -90 ? Math.min(a.restitution, b.restitution) : 0;
  const j = -(1 + e) * vn0 / kn;
  applyImpulse(a, m.nx * j, m.ny * j, m.px, m.py);
  applyImpulse(b, -m.nx * j, -m.ny * j, m.px, m.py);
  const tx = -m.ny, ty = m.nx;
  const vt = rvx * tx + rvy * ty;
  const rct = rx * ty - ry * tx;
  const rbt = rbx * ty - rby * tx;
  const kt = a.invMass + b.invMass + rct * rct * a.invI + rbt * rbt * b.invI;
  if (kt > 0) {
    const mu = Math.sqrt(a.friction * b.friction);
    const jt = physClamp(-vt / kt, -j * mu, j * mu);
    applyImpulse(a, tx * jt, ty * jt, m.px, m.py);
    applyImpulse(b, -tx * jt, -ty * jt, m.px, m.py);
  }
  return -vn0;
}

// circle vs flat ground (n = up). Returns impact speed.
function solveCircleGround(b, groundY) {
  const gy = groundY - b.radius;
  if (b.y <= gy) return 0;
  b.y = gy;
  b.onGround = true;
  // rolling: angular velocity converges to roll speed, horizontal speed decays
  b.av += (b.vx / b.radius - b.av) * 0.12;
  b.vx *= Math.pow(0.55, 1 / 240);
  if (b.vy > 0) {
    const impact = b.vy;
    const e = impact > 90 ? b.restitution : 0;
    b.vy = -b.vy * e;
    return impact;
  }
  return 0;
}

function positionalCorrect(a, b, nx, ny, depth) {
  const slop = 0.4, percent = 0.4;
  const corr = Math.max(depth - slop, 0) / (a.invMass + b.invMass) * percent;
  if (corr <= 0) return;
  a.x -= nx * corr * a.invMass;
  a.y -= ny * corr * a.invMass;
  b.x += nx * corr * b.invMass;
  b.y += ny * corr * b.invMass;
}
