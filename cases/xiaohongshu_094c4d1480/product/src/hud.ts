// HUD / 菜单 / 记分板（纯 DOM 操作）
import { TEAM_INFO } from './config';

export interface KillEntry {
  killer: string; killerTeam: number; victim: string; victimTeam: number;
  headshot: boolean; weapon: string; t: number;
}

export interface ScoreRow {
  name: string; team: number; kills: number; deaths: number; isPlayer: boolean;
}

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`缺少元素 #${id}`);
  return e as T;
}

export class HUD {
  onStart: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onResume: (() => void) | null = null;

  private killFeedEl = el('killfeed');
  private hpBar = el('hp-fill');
  private hpText = el('hp-text');
  private ammoMag = el('ammo-mag');
  private ammoReserve = el('ammo-reserve');
  private scoreBlue = el('score-blue');
  private scoreRed = el('score-red');
  private timerEl = el('match-timer');
  private hitmarkerEl = el('hitmarker');
  private vignette = el('dmg-vignette');
  private deathOverlay = el('death-overlay');
  private deathInfo = el('death-info');
  private respawnT = el('respawn-t');
  private msgEl = el('center-msg');
  private scoreboardEl = el('scoreboard');
  private menuEl = el('menu');
  private hudEl = el('hud');
  private pauseEl = el('pause');
  private endEl = el('end-screen');
  private endTitle = el('end-title');
  private endStats = el('end-stats');
  private vignetteT = 0;
  private msgT = 0;
  private hmT = 0;

  constructor() {
    el<HTMLButtonElement>('btn-start').addEventListener('click', () => this.onStart?.());
    el<HTMLButtonElement>('btn-restart').addEventListener('click', () => this.onRestart?.());
    el<HTMLButtonElement>('btn-resume').addEventListener('click', () => this.onResume?.());
  }

  showMenu(show: boolean): void {
    this.menuEl.classList.toggle('hidden', !show);
  }

  showHUD(show: boolean): void {
    this.hudEl.classList.toggle('hidden', !show);
  }

  showPause(show: boolean): void {
    this.pauseEl.classList.toggle('hidden', !show);
  }

  showHitmarker(head: boolean): void {
    this.hmT = 0.18;
    this.hitmarkerEl.classList.toggle('head', head);
    this.hitmarkerEl.classList.remove('show');
    void this.hitmarkerEl.offsetWidth; // 重启动画
    this.hitmarkerEl.classList.add('show');
  }

  flashDamage(): void {
    this.vignetteT = 0.5;
  }

  killFeedAdd(e: KillEntry): void {
    const div = document.createElement('div');
    div.className = 'kf-row';
    const kc = TEAM_INFO[e.killerTeam].css;
    const vc = TEAM_INFO[e.victimTeam].css;
    div.innerHTML = `<span style="color:${kc}">${e.killer}</span>` +
      `<span class="kf-weapon">[${e.weapon}${e.headshot ? ' 爆头' : ''}]</span>` +
      `<span style="color:${vc}">${e.victim}</span>`;
    this.killFeedEl.prepend(div);
    while (this.killFeedEl.children.length > 5) this.killFeedEl.lastChild!.remove();
    setTimeout(() => { div.classList.add('fade'); }, 4200);
    setTimeout(() => { div.remove(); }, 5000);
  }

  setHP(hp: number): void {
    const k = Math.max(hp, 0) / 100;
    this.hpBar.style.width = `${k * 100}%`;
    this.hpBar.style.background = k > 0.5 ? '#7fd069' : k > 0.25 ? '#e8b93c' : '#e0483c';
    this.hpText.textContent = `${Math.max(Math.ceil(hp), 0)}`;
  }

  setAmmo(mag: number, reserve: number, reloading: boolean): void {
    this.ammoMag.textContent = reloading ? '--' : `${mag}`;
    this.ammoReserve.textContent = `${reserve}`;
  }

  setScore(blue: number, red: number): void {
    this.scoreBlue.textContent = `${blue}`;
    this.scoreRed.textContent = `${red}`;
  }

  setTimer(sec: number): void {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  centerMsg(text: string, dur = 2.2): void {
    this.msgEl.textContent = text;
    this.msgEl.classList.add('show');
    this.msgT = dur;
  }

  showDeath(killerName: string, team: number): void {
    this.deathInfo.innerHTML = `阵亡于 <span style="color:${TEAM_INFO[team].css}">${killerName}</span>`;
    this.deathOverlay.classList.remove('hidden');
  }

  setRespawnT(sec: number): void {
    this.respawnT.textContent = `${Math.ceil(sec)}`;
  }

  hideDeath(): void {
    this.deathOverlay.classList.add('hidden');
  }

  showScoreboard(rows: ScoreRow[]): void {
    const sorted = [...rows].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    let html = '<table><tr><th></th><th>玩家</th><th>击杀</th><th>阵亡</th></tr>';
    for (const r of sorted) {
      const c = TEAM_INFO[r.team].css;
      html += `<tr class="${r.isPlayer ? 'me' : ''}">` +
        `<td class="dot" style="background:${c}"></td>` +
        `<td>${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`;
    }
    html += '</table>';
    this.scoreboardEl.innerHTML = html;
    this.scoreboardEl.classList.remove('hidden');
  }

  hideScoreboard(): void {
    this.scoreboardEl.classList.add('hidden');
  }

  showEnd(victory: boolean, blue: number, red: number, rows: ScoreRow[]): void {
    this.endTitle.textContent = victory ? '胜 利' : '战 败';
    this.endTitle.className = victory ? 'win' : 'lose';
    const me = rows.find(r => r.isPlayer);
    const sorted = [...rows].sort((a, b) => b.kills - a.kills);
    let html = `<p>最终比分 <b>${blue} : ${red}</b></p><table><tr><th></th><th>玩家</th><th>击杀</th><th>阵亡</th></tr>`;
    for (const r of sorted) {
      const c = TEAM_INFO[r.team].css;
      html += `<tr class="${r.isPlayer ? 'me' : ''}">` +
        `<td class="dot" style="background:${c}"></td>` +
        `<td>${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`;
    }
    html += '</table>';
    this.endStats.innerHTML = html;
    void me;
    this.endEl.classList.remove('hidden');
  }

  update(dt: number): void {
    if (this.vignetteT > 0) {
      this.vignetteT -= dt;
      this.vignette.style.opacity = `${Math.max(this.vignetteT, 0) * 1.6}`;
    }
    if (this.msgT > 0) {
      this.msgT -= dt;
      if (this.msgT <= 0) this.msgEl.classList.remove('show');
    }
    if (this.hmT > 0) {
      this.hmT -= dt;
      if (this.hmT <= 0) this.hitmarkerEl.classList.remove('show');
    }
  }
}
