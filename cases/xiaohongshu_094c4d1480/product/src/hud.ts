// ============================================================
// HUD —— 小地图 / 血量 / 弹药 / 比分 / 击杀播报 / 准星
// ============================================================
import { BOXES, ZONES, T_SPAWNS } from './mapdata';
import type { TeamId } from './types';
import { TEAM_COLOR } from './types';

export interface MinimapBlip {
  x: number; z: number; team: TeamId; isPlayer?: boolean;
  yaw?: number; // 玩家朝向
  revealUntil?: number; // 敌人开火暴露的截止时间 (秒, now 时间)
  dead?: boolean;
}

export class HUD {
  private root: HTMLElement;
  private mapCanvas: HTMLCanvasElement;
  private mapCtx: CanvasRenderingContext2D;
  private hpBar: HTMLElement;
  private hpNum: HTMLElement;
  private ammoNum: HTMLElement;
  private ammoReserve: HTMLElement;
  private scoreT: HTMLElement;
  private scoreCT: HTMLElement;
  private timer: HTMLElement;
  killfeed: HTMLElement;
  private hitmark: HTMLElement;
  private vignette: HTMLElement;
  private lowhp: HTMLElement;
  private hint: HTMLElement;
  private crosshair: HTMLElement;
  private respawnOverlay: HTMLElement;
  private respawnTimer: HTMLElement;
  private mapSize = 240;
  private mapScale = 1.78; // 像素/米
  private mapOffX = 0;
  private mapOffZ = 0;

  constructor() {
    this.root = document.getElementById('hud')!;
    this.mapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
    this.mapCtx = this.mapCanvas.getContext('2d')!;
    this.mapCanvas.width = this.mapSize;
    this.mapCanvas.height = this.mapSize;
    this.hpBar = document.getElementById('hp-bar')!;
    this.hpNum = document.getElementById('hp-num')!;
    this.ammoNum = document.getElementById('ammo-num')!;
    this.ammoReserve = document.getElementById('ammo-reserve')!;
    this.scoreT = document.getElementById('score-t')!;
    this.scoreCT = document.getElementById('score-ct')!;
    this.timer = document.getElementById('match-timer')!;
    this.killfeed = document.getElementById('killfeed')!;
    this.hitmark = document.getElementById('hitmarker')!;
    this.vignette = document.getElementById('dmg-vignette')!;
    this.lowhp = document.getElementById('lowhp')!;
    this.hint = document.getElementById('hint')!;
    this.crosshair = document.getElementById('crosshair')!;
    this.respawnOverlay = document.getElementById('respawn')!;
    this.respawnTimer = document.getElementById('respawn-timer')!;
    // 地图居中: 世界 x∈[-62,62], z∈[-54,54]
    this.mapOffX = 62; this.mapOffZ = 54;
  }

  show(): void { this.root.classList.add('visible'); }
  hide(): void { this.root.classList.remove('visible'); }

  // ----------------------------------------------------------
  private w2m(x: number, z: number): [number, number] {
    return [
      (x + this.mapOffX) * this.mapScale,
      (z + this.mapOffZ) * this.mapScale,
    ];
  }

  // ----------------------------------------------------------
  drawMinimap(blips: MinimapBlip[], now: number): void {
    const g = this.mapCtx;
    const S = this.mapSize;
    g.clearRect(0, 0, S, S);
    // 底
    g.fillStyle = 'rgba(24,20,14,0.88)';
    g.fillRect(0, 0, S, S);
    // 区域
    for (const z of ZONES) {
      const [x1, y1] = this.w2m(z.x1, z.z1);
      const [x2, y2] = this.w2m(z.x2, z.z2);
      g.fillStyle = z.id === 'A' || z.id === 'B' ? 'rgba(255,160,60,0.16)' : 'rgba(120,140,160,0.07)';
      g.fillRect(x1, y1, x2 - x1, y2 - y1);
      if (z.id === 'A' || z.id === 'B') {
        g.fillStyle = z.color;
        g.font = 'bold 17px monospace';
        g.textAlign = 'center';
        g.fillText(z.id, (x1 + x2) / 2, (y1 + y2) / 2 + 6);
        g.font = '9px monospace';
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fillText(z.label, (x1 + x2) / 2, (y1 + y2) / 2 + 20);
      }
    }
    // 墙体
    g.fillStyle = '#a8874f';
    for (const b of BOXES) {
      if (b.kind !== 'wall') continue;
      const [x1, y1] = this.w2m(b.x - b.w / 2, b.z - b.d / 2);
      const [x2, y2] = this.w2m(b.x + b.w / 2, b.z + b.d / 2);
      g.fillRect(x1, y1, Math.max(x2 - x1, 1.5), Math.max(y2 - y1, 1.5));
    }
    //  mask体
    g.fillStyle = 'rgba(150,120,80,0.55)';
    for (const b of BOXES) {
      if (b.kind === 'crate' || b.kind === 'sandbag') {
        const [x1, y1] = this.w2m(b.x - b.w / 2, b.z - b.d / 2);
        const [x2, y2] = this.w2m(b.x + b.w / 2, b.z + b.d / 2);
        g.fillRect(x1, y1, x2 - x1, y2 - y1);
      }
    }
    // 点
    for (const b of blips) {
      if (b.dead) continue;
      const [mx, my] = this.w2m(b.x, b.z);
      if (b.isPlayer) {
        // 玩家箭头
        g.save();
        g.translate(mx, my);
        g.rotate(Math.atan2(-Math.sin(b.yaw ?? 0), -Math.cos(b.yaw ?? 0)) * -1 + Math.PI);
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(0, -6); g.lineTo(4.4, 5); g.lineTo(0, 2.4); g.lineTo(-4.4, 5);
        g.closePath(); g.fill();
        g.restore();
      } else {
        const revealed = b.revealUntil !== undefined && now < b.revealUntil;
        if (!revealed) continue; // 敌人仅开火暴露时可见
        const age = b.revealUntil !== undefined ? 1 - (b.revealUntil - now) / 3.5 : 0;
        g.globalAlpha = Math.max(0.25, 1 - age);
        g.fillStyle = TEAM_COLOR[b.team];
        g.beginPath();
        g.arc(mx, my, 3.6, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 1;
        g.stroke();
      }
    }
    // 边框 + 指北
    g.strokeStyle = 'rgba(255,180,84,0.5)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, S - 2, S - 2);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = 'bold 10px monospace';
    g.textAlign = 'left';
    g.fillText('N ↑', 6, 12);
    g.fillText('战术地图', 6, S - 6);
  }

  // ----------------------------------------------------------
  setHealth(hp: number): void {
    const v = Math.max(0, Math.round(hp));
    this.hpNum.textContent = String(v);
    this.hpBar.style.width = `${v}%`;
    this.hpBar.style.background = v > 55 ? 'linear-gradient(90deg,#7fd48a,#a8e6a1)'
      : v > 25 ? 'linear-gradient(90deg,#e8b34a,#f2cd7a)'
        : 'linear-gradient(90deg,#e84a3a,#f27a6a)';
    this.lowhp.style.opacity = v <= 30 && v > 0 ? '1' : '0';
  }

  setAmmo(ammo: number, reserve: number, reloading: boolean): void {
    this.ammoNum.textContent = reloading ? '--' : String(ammo);
    this.ammoReserve.textContent = reserve > 900 ? '/ ∞' : `/ ${reserve}`;
  }

  setScore(t: number, ct: number): void {
    this.scoreT.textContent = String(t);
    this.scoreCT.textContent = String(ct);
  }

  setTimer(sec: number): void {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    this.timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  setCrosshairSpread(px: number, visible: boolean): void {
    this.crosshair.style.setProperty('--gap', `${px}px`);
    this.crosshair.style.opacity = visible ? '1' : '0';
  }

  flashHitmarker(): void {
    this.hitmark.classList.remove('show');
    void this.hitmark.offsetWidth;
    this.hitmark.classList.add('show');
  }

  flashDamage(): void {
    this.vignette.classList.remove('show');
    void this.vignette.offsetWidth;
    this.vignette.classList.add('show');
  }

  killfeedAdd(killer: string, killerTeam: TeamId, victim: string, victimTeam: TeamId): void {
    const div = document.createElement('div');
    div.className = 'kf-entry';
    div.innerHTML =
      `<span style="color:${TEAM_COLOR[killerTeam]}">${killer}</span>` +
      `<span class="kf-weapon">[步枪]</span>` +
      `<span style="color:${TEAM_COLOR[victimTeam]}">${victim}</span>`;
    this.killfeed.prepend(div);
    while (this.killfeed.children.length > 5) this.killfeed.lastChild!.remove();
    setTimeout(() => { div.classList.add('fade'); }, 3600);
    setTimeout(() => { div.remove(); }, 4400);
  }

  showRespawn(sec: number): void {
    this.respawnOverlay.classList.add('visible');
    this.respawnTimer.textContent = sec.toFixed(1);
  }
  hideRespawn(): void { this.respawnOverlay.classList.remove('visible'); }

  setHint(text: string): void {
    this.hint.textContent = text;
    this.hint.style.opacity = text ? '1' : '0';
  }
}

export { T_SPAWNS };
