/* ===== Furious Birds — factories + cartoon rendering ===== */

/* ---------- world layout constants ---------- */
const WORLD_W = 1280;
const WORLD_H = 720;
const GROUND_Y = 668;                       // grass surface
const SLING = {
  x: 205, ground: GROUND_Y,
  tipL: { x: 186, y: 570 },
  tipR: { x: 224, y: 570 },
  anchor: { x: 205, y: 578 },               // resting bird position
  maxDrag: 115
};
const MAT_INFO = {
  wood:  { hp: 45,  score: 50,  dmg: 0.16, fill: '#cf8a45', line: '#7a4a16' },
  stone: { hp: 110, score: 100, dmg: 0.075, fill: '#b9c0c8', line: '#6e757e' },
  glass: { hp: 14,  score: 40,  dmg: 0.7,  fill: 'rgba(170,225,255,0.55)', line: 'rgba(110,170,215,0.95)' }
};
const BIRD_INFO = {
  red:    { radius: 17, mass: 3.4, score: 1000 },
  yellow: { radius: 16, mass: 2.9, score: 1000 },
  blue:   { radius: 13, mass: 1.7, score: 1000 },
  black:  { radius: 19, mass: 3.8, score: 1000 }
};

/* ---------- factories ---------- */
function makeBlock(x, yBottom, w, h, mat, angle) {
  return new Body({
    kind: 'block', x, y: yBottom - h / 2, w, h, mat,
    angle: angle || 0,
    restitution: 0.1, friction: 0.55
  });
}

function makePig(x, yBottom, radius, king) {
  const r = radius || 15;
  const b = new Body({
    kind: 'pig', x, y: yBottom - r, radius: r,
    hp: king ? 120 : 1,
    restitution: 0.15, friction: 0.5,
    king: !!king
  });
  b.mat = 'none';
  return b;
}

function makeBirdBody(btype, x, y) {
  const info = BIRD_INFO[btype];
  return new Body({
    kind: 'bird', btype, x, y, radius: info.radius,
    mass: info.mass, restitution: 0.32, friction: 0.65, mat: 'none'
  });
}

/* ---------- canvas helpers ---------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- background ---------- */
function drawBackground(ctx, time, clouds, tufts, flowers) {
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#5db9ef');
  sky.addColorStop(0.65, '#a5dcf7');
  sky.addColorStop(1, '#d8f1fd');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, GROUND_Y + 2);

  // sun
  const sunX = 1115, sunY = 108;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 110);
  glow.addColorStop(0, 'rgba(255,240,150,0.9)');
  glow.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 110, sunY - 110, 220, 220);
  ctx.save();
  ctx.translate(sunX, sunY);
  ctx.rotate(time * 0.06);
  ctx.fillStyle = '#ffd93b';
  ctx.strokeStyle = '#e8a91d';
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(9, -66);
    ctx.lineTo(-9, -66);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe45c';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#e8a91d';
  ctx.stroke();

  // clouds
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 46 * c.s, 24 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x - 34 * c.s, c.y + 8 * c.s, 30 * c.s, 17 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + 36 * c.s, c.y + 9 * c.s, 32 * c.s, 18 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + 4 * c.s, c.y - 14 * c.s, 28 * c.s, 17 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // distant hills
  ctx.fillStyle = '#8fd06a';
  ctx.beginPath();
  ctx.ellipse(260, GROUND_Y + 60, 520, 130, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7cc257';
  ctx.beginPath();
  ctx.ellipse(1020, GROUND_Y + 70, 580, 150, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // grass
  const gr = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
  gr.addColorStop(0, '#8fdd55');
  gr.addColorStop(0.35, '#6cbf3a');
  gr.addColorStop(1, '#4c9427');
  ctx.fillStyle = gr;
  ctx.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
  ctx.fillStyle = '#a8ec7c';
  ctx.fillRect(0, GROUND_Y, WORLD_W, 5);

  // grass tufts
  ctx.strokeStyle = '#3f7d1e';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < tufts.length; i++) {
    const t = tufts[i];
    ctx.beginPath();
    ctx.moveTo(t.x, GROUND_Y + 3);
    ctx.lineTo(t.x - 4, GROUND_Y - 8 * t.s);
    ctx.moveTo(t.x + 3, GROUND_Y + 3);
    ctx.lineTo(t.x + 3, GROUND_Y - 11 * t.s);
    ctx.moveTo(t.x + 6, GROUND_Y + 3);
    ctx.lineTo(t.x + 10, GROUND_Y - 7 * t.s);
    ctx.stroke();
  }

  // flowers
  const petalCols = ['#ff7bac', '#ffd93b', '#ffffff', '#c58cf2'];
  for (let i = 0; i < flowers.length; i++) {
    const f = flowers[i];
    ctx.fillStyle = petalCols[i % petalCols.length];
    for (let p = 0; p < 5; p++) {
      const a = p / 5 * Math.PI * 2 + i;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(a) * 4.4, GROUND_Y + f.dy + Math.sin(a) * 4.4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff9d2e';
    ctx.beginPath();
    ctx.arc(f.x, GROUND_Y + f.dy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- blocks ---------- */
function drawBlock(ctx, b, time) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  const w = b.w, h = b.h;
  const info = MAT_INFO[b.mat] || MAT_INFO.wood;
  const dmgFrac = 1 - b.hp / b.maxHp;

  if (b.mat === 'glass') {
    ctx.fillStyle = info.fill;
    rr(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = info.line;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, h / 2 - 6);
    ctx.lineTo(-w / 2 + w * 0.3, -h / 2 + 6);
    ctx.stroke();
  } else if (b.mat === 'stone') {
    ctx.fillStyle = info.fill;
    rr(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.fill();
    // top bevel
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    rr(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, Math.max(4, h * 0.22), 3);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = info.line;
    rr(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.stroke();
    // cracks
    ctx.strokeStyle = 'rgba(90,98,108,0.55)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, -h / 2 + 3); ctx.lineTo(w * 0.16, 0); ctx.lineTo(w * 0.08, h / 2 - 3);
    ctx.stroke();
  } else { // wood
    ctx.fillStyle = info.fill;
    rr(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.fill();
    // grain
    ctx.strokeStyle = 'rgba(122,74,22,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 5, -h * 0.18);
    ctx.quadraticCurveTo(0, -h * 0.3, w / 2 - 5, -h * 0.12);
    ctx.moveTo(-w / 2 + 5, h * 0.2);
    ctx.quadraticCurveTo(0, h * 0.12, w / 2 - 5, h * 0.24);
    ctx.stroke();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = info.line;
    rr(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.stroke();
  }

  // damage cracks
  if (dmgFrac > 0.35) {
    ctx.strokeStyle = 'rgba(30,20,10,0.65)';
    ctx.lineWidth = 2.2;
    const rnd = mulberry32(Math.floor(b.x * 7 + b.y * 13) + 11);
    const n = dmgFrac > 0.7 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      let cx = (rnd() - 0.5) * w * 0.7, cy = (rnd() - 0.5) * h * 0.7;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let sgm = 0; sgm < 3; sgm++) {
        cx += (rnd() - 0.5) * w * 0.4;
        cy += (rnd() - 0.5) * h * 0.5;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ---------- pigs ---------- */
function drawPig(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  const r = p.radius;
  const dmgFrac = p.king ? 1 - p.hp / p.maxHp : 0;
  const wob = p.sleeping ? 0 : Math.sin(time * 10 + p.x) * 0.04;

  // ears
  ctx.fillStyle = '#6db83c';
  ctx.strokeStyle = '#4e8f2a';
  ctx.lineWidth = 2.5;
  for (const sx of [-0.45, 0.45]) {
    ctx.beginPath();
    ctx.arc(r * sx, -r * 0.82, r * 0.3, 0.PI, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  // body
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#82c94f';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#4e8f2a';
  ctx.stroke();
  // belly shade
  ctx.beginPath();
  ctx.arc(0, r * 0.3, r * 0.62, 0, Math.PI);
  ctx.fillStyle = 'rgba(180,230,130,0.5)';
  ctx.fill();

  // snout
  const snX = 0, snY = r * 0.12;
  ctx.beginPath();
  ctx.ellipse(snX, snY, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#b5e585';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4e8f2a';
  ctx.stroke();
  ctx.fillStyle = '#4e8f2a';
  ctx.beginPath();
  ctx.ellipse(-r * 0.13, snY, r * 0.06, r * 0.09, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.13, snY, r * 0.06, r * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // eyes (dizzy-ish)
  const look = 0.14;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(r * 0.34 * sx, -r * 0.3, r * 0.21, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#4e8f2a';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.34 * sx + r * look * sx, -r * 0.3, r * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
  }
  // nostrils / stress wrinkles when hurt
  if (dmgFrac > 0.3) {
    ctx.strokeStyle = '#3c7020';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.62);
    ctx.lineTo(r * 0.2, -r * 0.5);
    ctx.stroke();
  }
  // crown for the king
  if (p.king) {
    const cw = r * 1.05, ch = r * 0.62, cy = -r * 0.95;
    ctx.beginPath();
    ctx.moveTo(-cw / 2, cy);
    ctx.lineTo(-cw / 2, cy - ch * 0.6);
    ctx.lineTo(-cw * 0.22, cy - ch * 0.25);
    ctx.lineTo(0, cy - ch);
    ctx.lineTo(cw * 0.22, cy - ch * 0.25);
    ctx.lineTo(cw / 2, cy - ch * 0.6);
    ctx.lineTo(cw / 2, cy);
    ctx.closePath();
    ctx.fillStyle = '#ffd93b';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#c79a10';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, cy - ch * 0.3, r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#e5322d';
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- birds ---------- */
function drawBirdFace(ctx, r, lookX) {
  // eyes
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(r * 0.32 * sx, -r * 0.22, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#222';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.32 * sx + (lookX || 0) * r * 0.5, -r * 0.2, r * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
  }
  // angry eyebrows
  ctx.strokeStyle = '#222';
  ctx.lineWidth = Math.max(2.4, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.62);
  ctx.lineTo(-r * 0.1, -r * 0.34);
  ctx.moveTo(r * 0.62, -r * 0.62);
  ctx.lineTo(r * 0.1, -r * 0.34);
  ctx.stroke();
  // beak
  ctx.fillStyle = '#ff9d2e';
  ctx.strokeStyle = '#d96a00';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(r * 0.42, -r * 0.02);
  ctx.lineTo(r * 1.05, r * 0.12);
  ctx.lineTo(r * 0.42, r * 0.3);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}

function drawBird(ctx, b, time) {
  const r = b.radius;
  const lookX = physClamp(b.vx / 900, -1, 1);
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.btype === 'yellow') {
    ctx.rotate(physClamp(Math.atan2(b.vy, b.vx) * 0.4, -0.5, 0.9) + Math.sin(time * 6) * 0.03);
  } else {
    ctx.rotate(physClamp(Math.atan2(b.vy, b.vx) * 0.22, -0.45, 0.6));
  }

  if (b.btype === 'yellow') {
    // triangular body
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, -r * 0.85);
    ctx.quadraticCurveTo(-r * 1.25, 0, -r * 0.9, r * 0.85);
    ctx.quadraticCurveTo(0, r * 1.05, r * 1.05, r * 0.1);
    ctx.quadraticCurveTo(r * 1.15, -r * 0.55, -r * 0.9, -r * 0.85);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c79a10';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(r * 0.1, r * 0.42, r * 0.5, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3b0';
    ctx.fill();
    drawBirdFace(ctx, r, lookX);
  } else if (b.btype === 'blue') {
    // tail tuft
    ctx.fillStyle = '#1565c0';
    for (const [dx, dy] of [[-r * 0.95, -r * 0.25], [-r * 1.05, 0], [-r * 0.9, r * 0.3]]) {
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - r * 0.7, dy - r * 0.25);
      ctx.lineTo(dx - r * 0.6, dy + r * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#42a5f5';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#1565c0';
    ctx.stroke();
    // head feathers
    ctx.strokeStyle = '#1565c0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const a of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * r * 0.5, -r * 0.85);
      ctx.lineTo(Math.sin(a) * r * 0.95, -r * 1.45);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.4, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#bbdefb';
    ctx.fill();
    drawBirdFace(ctx, r, lookX);
  } else if (b.btype === 'black') {
    // tail
    ctx.fillStyle = '#101014';
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.3);
    ctx.lineTo(-r * 1.5, -r * 0.6);
    ctx.lineTo(-r * 1.35, r * 0.05);
    ctx.lineTo(-r * 1.5, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a30';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    // highlight
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.4, r * 0.22, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    // fuse + spark
    ctx.strokeStyle = '#8d6e3f';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.2, -r * 1.35, r * 0.45, -r * 1.4);
    ctx.stroke();
    const sp = 2.2 + Math.sin(time * 30) * 1.2;
    ctx.beginPath();
    ctx.arc(r * 0.48, -r * 1.42, sp + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9d2e';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.48, -r * 1.42, sp * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe45c';
    ctx.fill();
    drawBirdFace(ctx, r, lookX);
  } else {
    // red
    ctx.fillStyle = '#8f1310';
    for (const a of [Math.PI * 0.75, Math.PI * 0.95, Math.PI * 1.15]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      ctx.lineTo(Math.cos(a) * r * 1.75, Math.sin(a) * r * 1.75);
      ctx.lineTo(Math.cos(a + 0.35) * r * 0.8, Math.sin(a + 0.35) * r * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e5322d';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#8f1310';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 0.55, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe9d6';
    ctx.fill();
    drawBirdFace(ctx, r, lookX);
  }
  ctx.restore();
}

/* ---------- slingshot ---------- */
function drawSlingshot(ctx, dragPos, birdDrawn, time) {
  const { x, ground, tipL, tipR } = SLING;
  const birdPos = dragPos || SLING.anchor;

  // trunk + fork
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7a4a21';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(x, ground + 6);
  ctx.lineTo(x, ground - 58);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, ground - 52);
  ctx.lineTo(tipL.x, tipL.y);
  ctx.moveTo(x, ground - 52);
  ctx.lineTo(tipR.x, tipR.y);
  ctx.stroke();
  ctx.strokeStyle = '#9c6530';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, ground + 2);
  ctx.lineTo(x, ground - 56);
  ctx.stroke();

  // back band (behind bird)
  ctx.strokeStyle = '#4a2f10';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(tipL.x, tipL.y);
  ctx.lineTo(birdPos.x, birdPos.y);
  ctx.stroke();
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tipL.x, tipL.y);
  ctx.lineTo(birdPos.x, birdPos.y);
  ctx.stroke();

  // grass mound at base
  ctx.fillStyle = '#3f7d1e';
  ctx.beginPath();
  ctx.ellipse(x, ground + 4, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // front band drawn over the bird — game renders it after the bird
  if (birdDrawn) {
    ctx.strokeStyle = '#4a2f10';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(tipR.x, tipR.y);
    ctx.lineTo(birdPos.x, birdPos.y);
    ctx.stroke();
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tipR.x, tipR.y);
    ctx.lineTo(birdPos.x, birdPos.y);
    ctx.stroke();
  }
}

/* ---------- bird queue icons ---------- */
const QUEUE_COLORS = { red: '#e5322d', yellow: '#ffd23f', blue: '#42a5f5', black: '#2a2a30' };
function drawQueueIcon(ctx, btype, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = QUEUE_COLORS[btype] || '#e5322d';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();
  ctx.fillStyle = '#ff9d2e';
  ctx.beginPath();
  ctx.moveTo(x + r * 0.4, y - r * 0.08);
  ctx.lineTo(x + r * 1.05, y + r * 0.12);
  ctx.lineTo(x + r * 0.4, y + r * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + r * 0.22, y - r * 0.25, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x + r * 0.28, y - r * 0.25, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
}
