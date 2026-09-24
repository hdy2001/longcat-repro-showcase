// Web Audio API 合成音效：枪声 / 命中 / 换弹 / 脚步 / 环境风
import { CFG } from './config';

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private windSrc: AudioBufferSourceNode | null = null;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // 预生成噪声缓冲
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startWind();
  }

  private noise(dur: number): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuf) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.loopStart = Math.random() * 0.5;
    s.loopEnd = s.loopStart + dur;
    return s;
  }

  /** 枪声：dist 用于衰减 */
  shot(dist = 0, isPlayer = false): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const vol = isPlayer ? 0.55 : Math.max(0.04, 0.4 * (1 - dist / 70));
    // 噪声爆音
    const n = this.noise(0.14);
    if (n) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 3200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      n.connect(f).connect(g).connect(this.master);
      n.start(t); n.stop(t + 0.15);
    }
    // 低频冲击
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.12);
  }

  /** 命中反馈 */
  hit(head = false): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = head ? 1900 : 1100;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (head ? 0.1 : 0.06));
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.12);
  }

  kill(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    [660, 990].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.2, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.16);
      o.connect(g).connect(this.master!);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.18);
    });
  }

  hurt(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.22);
  }

  reload(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    [0, 0.28, 0.5, CFG.reloadTime - 0.18].forEach((d, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'square';
      o.frequency.value = i === 3 ? 700 : 420 + i * 60;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.12, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.05);
      o.connect(g).connect(this.master!);
      o.start(t + d); o.stop(t + d + 0.06);
    });
  }

  step(sprint: boolean): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const n = this.noise(0.06);
    if (!n) return;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 300 + Math.random() * 200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(sprint ? 0.1 : 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 0.07);
  }

  private startWind(): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.value = 0.045;
    // 缓慢起伏
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(f).connect(g).connect(this.master);
    src.start(); lfo.start();
    this.windSrc = src;
  }

  ui(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 520;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.09);
  }
}
