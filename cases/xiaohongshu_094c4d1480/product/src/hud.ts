// ===== HUD：DOM 更新 + 小地图 + 击杀播报 =====
import * as THREE from 'three';
import { TEAM_NAMES, TEAM_COLORS, MATCH } from './config';
import { WALLS, SITE_MARKERS, MAP } from './map/mapData';

export interface KillEvent {
  killer: string;
  killerTeam: number;
  victim: string;
  victimTeam: number;
  headshot: boolean;
  isMe: boolean;
}

export class HUD {
  private el = (id: string) => document.getElementById(id)!;
  private hud!: HTMLElement;
  private crosshair!: HTMLElement;
  private hitmarker!: HTMLElement;
  private killfeed!: HTMLElement;
  private minimap!: HTMLCanvasElement;
  private mmCtx: CanvasRenderingContext2D;
  private hpBar!: HTMLElement;
  private hpNum!: HTMLElement;
  private ammoMag!: HTMLElement;
  private ammoReserve!: HTMLElement;
  private scoreAlpha!: HTMLElement;
  private scoreBravo!: HTMLElement;
  private timer!: HTMLElement;
  private vignette!: HTMLElement;
  private lowhp!: HTMLElement;
  private dmgDir!: HTMLElement;
  private killBanner!: HTMLElement;
  private respawnOverlay!: HTMLElement;
  private respawnTimer!: HTMLElement;
  private deathCause!: HTMLElement;
  private spawnProtect!: HTMLElement;
  private hintBar!: HTMLElement;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.hud = this.el('hud');
    this.crosshair = this.el('crosshair');
    this.hitmarker = this.el('hitmarker');
    this.killfeed = this.el('killfeed');
    this.minimap = this.el('minimap') as HTMLCanvasElement;
    this.mmCtx = this.minimap.getContext('2d')!;
    this.hpBar = this.el('hp-bar');
    this.hpNum = this.el('hp-num');
    this.ammoMag = this.el('ammo-mag');
    this.ammoReserve = this.el('ammo-reserve');
    this.scoreAlpha = this.el('score-alpha');
    this.scoreBravo = this.el('score-bravo');
    this.timer = this.el('round-timer');
    this.vignette = this.el('damage-vignette');
    this.lowhp = this.el('lowhp-vignette');
    this.dmgDir = this.el('dmg-dir');
    this.killBanner = this.el('kill-banner');
    this.respawnOverlay = this.el('respawn-overlay');
    this.respawnTimer = this.el('respawn-timer');
    this.deathCause = this.el('death-cause');
    this.spawnProtect = this.el('spawn-protect');
    this.hintBar = this.el('hint-bar');
    this.drawMinimapBase();
  }

  show() { this.hud.classList.remove('hidden'); }
  hide() { this.hud.classList.add('hidden'); }

  setCrosshairSpread(px: number) {
    this.crosshair.style.setProperty('--sp', `${px.toFixed(1)}px`);
  }

  setHitmarker(headshot: boolean) {
    this.hitmarker.classList.toggle('headshot', headshot);
    this.hitmarker.classList.remove('show');
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('show');
  }

  addKill(e: KillEvent) {
    const row = document.createElement('div');
    row.className = 'kf-row' + (e.isMe ? ' me' : '');
    const hs = e.headshot ? ' ☠' : '';
    row.innerHTML =
      `<span class="kf-killer ${e.killerTeam === 0 ? 'alpha' : 'bravo'}">${e.killer}</span>` +
      `<span class="kf-weapon">[MK-4${hs}]</span>` +
      `<span class="kf-victim ${e.victimTeam === 0 ? 'alpha' : 'bravo'}">${e.victim}</span>`;
    this.killfeed.prepend(row);
    while (this.killfeed.children.length > 6) this.killfeed.lastChild!.remove();
    setTimeout(() => { row.style.opacity = '0'; row.style.transition = 'opacity 0.5s'; }, 4200);
    setTimeout(() => row.remove(), 4800);
  }

  setScores(a: number, b: number) {
    this.scoreAlpha.textContent = String(a);
    this.scoreBravo.textContent = String(b);
  }

  setTimer(seconds: number) {
    const m = Math.floor(Math.max(0, seconds) / 60);
    const s = Math.floor(Math.max(0, seconds) % 60);
    this.timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    this.timer.classList.toggle('urgent', seconds < 30);
  }

  setHealth(hp: number) {
    const pct = Math.max(0, hp);
    this.hpBar.style.width = `${pct}%`;
    this.hpNum.textContent = String(Math.ceil(pct));
    this.hpBar.className = pct > 55 ? '' : pct > 28 ? 'mid' : 'low';
    this.lowhp.classList.toggle('pulse', pct <= 30 && pct > 0);
  }

  setAmmo(mag: number, reserve: number) {
    this.ammoMag.textContent = String(mag);
    this.ammoReserve.textContent = String(reserve);
    this.ammoMag.classList.toggle('empty', mag === 0);
  }

  setSpawnProtect(on: boolean) {
    this.spawnProtect.classList.toggle('hidden', !on);
  }

  damageFlash(strength = 0.85) {
    this.vignette.style.opacity = String(strength);
    setTimeout(() => { this.vignette.style.opacity = '0'; }, 130);
  }

  damageFrom(angleRad: number) {
    const arc = document.createElement('div');
    arc.className = 'dmg-arc';
    arc.style.setProperty('--ang', `${angleRad}rad`);
    this.dmgDir.appendChild(arc);
    setTimeout(() => arc.remove(), 900);
  }

  showKillBanner(text: string) {
    this.killBanner.textContent = text;
    this.killBanner.classList.remove('hidden');
    // 重新触发动画
    this.killBanner.style.animation = 'none';
    void this.killBanner.offsetWidth;
    this.killBanner.style.animation = '';
  }

  showRespawn(cause: string, t: number) {
    this.deathCause.textContent = cause;
    this.respawnTimer.textContent = t.toFixed(1);
    this.respawnOverlay.classList.remove('hidden');
  }

  updateRespawnTimer(t: number) {
    this.respawnTimer.textContent = Math.max(0, t).toFixed(1);
  }

  hideRespawn() {
    this.respawnOverlay.classList.add('hidden');
  }

  flashHint() {
    this.hintBar.style.opacity = '1';
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => { this.hintBar.style.opacity = '0'; }, 6000);
  }

  // ---------- 小地图 ----------
  private mmScale = 1;
  private mmOffX = 0;
  private mmOffZ = 0;

  private drawMinimapBase() {
    const c = this.minimap;
    this.mmScale = Math.min(c.width / (MAP.maxX - MAP.minX), c.height / (MAP.maxZ - MAP.minZ));
    this.mmOffX = -(MAP.minX) * this.mmScale;
    this.mmOffZ = -(MAP.minZ) * this.mmScale;
    // 底
    this.mmCtx.fillStyle = 'rgba(14, 16, 10, 0.9)';
    this.mmCtx.fillRect(0, 0, c.width, c.height);
  }

  private mmX(x: number) { return x * this.mmScale + this.mmOffX; }
  private mmZ(z: number) { return z * this.mmScale + this.mmOffZ; }

  drawMinimap(
    playerPos: THREE.Vector3,
    playerYaw: number,
    teammates: { x: number; z: number; team: number; alive: boolean }[],
    enemies: { x: number; z: number; visible: boolean; alive: boolean }[],
  ) {
    const ctx = this.mmCtx;
    const c = this.minimap;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(20, 22, 14, 0.92)';
    ctx.fillRect(0, 0, c.width, c.height);

    // 墙体
    ctx.fillStyle = 'rgba(190, 160, 100, 0.85)';
    for (const w of WALLS) {
      const x = this.mmX(Math.min(w.x1, w.x2)) - 1;
      const z = this.mmZ(Math.min(w.z1, w.z2)) - 1;
      const sx = (Math.abs(w.x2 - w.x1) + 1) * this.mmScale + 2;
      const sz = (Math.abs(w.z2 - w.z1) + 1) * this.mmScale + 2;
      ctx.fillRect(x, z, Math.max(sx, 2), Math.max(sz, 2));
    }

    // 包点
    for (const s of SITE_MARKERS) {
      ctx.fillStyle = 'rgba(255, 200, 80, 0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.label, this.mmX(s.x), this.mmZ(s.z));
    }

    // 队友
    for (const t of teammates) {
      if (!t.alive) continue;
      ctx.fillStyle = '#6db3ff';
      ctx.beginPath();
      ctx.arc(this.mmX(t.x), this.mmZ(t.z), 3, 0, 7);
      ctx.fill();
    }
    // 敌人（可见时）
    for (const e of enemies) {
      if (!e.visible || !e.alive) continue;
      ctx.fillStyle = '#ff5140';
      ctx.beginPath();
      ctx.arc(this.mmX(e.x), this.mmZ(e.z), 3.2, 0, 7);
      ctx.fill();
    }

    // 玩家箭头
    const px = this.mmX(playerPos.x);
    const pz = this.mmZ(playerPos.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-playerYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  }
}
