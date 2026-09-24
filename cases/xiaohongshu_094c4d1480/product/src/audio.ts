// ============================================================
// Web Audio 程序化音效 —— 枪声/换弹/命中/脚步/环境风, 无外部音频
// ============================================================

export class AudioSys {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private windNodes: { src: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private lastStep = 0;

  /** 必须在用户手势后调用 */
  init(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    // 白噪声缓冲
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startWind();
  }

  private startWind(): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320;
    bp.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    src.connect(bp); bp.connect(gain); gain.connect(this.master);
    src.start(); lfo.start();
    this.windNodes = { src, gain, lfo };
  }

  /** 枪声: dist 米, isPlayer 是否自己 */
  gunshot(dist: number, isPlayer: boolean): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const vol = isPlayer ? 0.9 : Math.max(0.06, 0.5 - dist * 0.008);
    // 噪声爆音
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(isPlayer ? 5200 : Math.max(700, 3800 - dist * 40), t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5, 0.15);
    // 低频冲击
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isPlayer ? 160 : 120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(vol * 0.8, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og); og.connect(this.master);
    osc.start(t); osc.stop(t + 0.12);
  }

  /** 换弹 */
  reload(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    for (const [dt, f] of [[0, 900], [0.22, 620], [0.5, 1100]] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.12, t + dt + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.05);
      osc.connect(g); g.connect(this.master);
      osc.start(t + dt); osc.stop(t + dt + 0.06);
    }
  }

  /** 命中反馈 (自己打到人) */
  hitmark(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2100, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.08);
  }

  /** 自己受伤 */
  hurt(): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, Math.random(), 0.2);
  }

  /** 击杀确认 */
  kill(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine'; osc.frequency.value = f;
      const g = this.ctx!.createGain();
      const t0 = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      osc.connect(g); g.connect(this.master!);
      osc.start(t0); osc.stop(t0 + 0.18);
    });
  }

  /** 脚步 */
  step(): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    if (t - this.lastStep < 0.28) return;
    this.lastStep = t;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.5;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, Math.random(), 0.1);
  }

  /** 死亡 */
  death(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.6);
  }

  /** 胜利/失败 */
  jingle(win: boolean): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262, 196];
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = f;
      const g = this.ctx!.createGain();
      const t0 = t + i * 0.16;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i === notes.length - 1 ? 0.5 : 0.18));
      osc.connect(g); g.connect(this.master!);
      osc.start(t0); osc.stop(t0 + 0.55);
    });
  }
}
