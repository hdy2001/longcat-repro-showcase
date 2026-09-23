// ===== Web Audio 程序化音效引擎 =====
import * as THREE from 'three';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private windNodes: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private started = false;

  // 必须在用户手势后调用
  init() {
    if (this.started) return;
    this.started = true;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 8;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // 白噪声缓冲
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.startWind();
  }

  resume() { this.ctx?.resume(); }

  private startWind() {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    // 风声起伏
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.028;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    const lfo2 = this.ctx.createOscillator();
    lfo2.frequency.value = 0.071;
    const lfo2Gain = this.ctx.createGain();
    lfo2Gain.gain.value = 120;
    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(filter.frequency);
    lfo.start();
    lfo2.start();
    this.windNodes = { src, gain, filter };
  }

  // 距离/声像参数
  private spatialize(pos: THREE.Vector3 | null, camera: THREE.Camera, baseGain: number): { gain: GainNode; pan: StereoPannerNode | null } | null {
    if (!this.ctx || !this.master) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = baseGain;
    let pan: StereoPannerNode | null = null;
    if (pos) {
      const camPos = new THREE.Vector3();
      camera.getWorldPosition(camPos);
      const dist = camPos.distanceTo(pos);
      const att = Math.max(0.04, 1 - dist / 70);
      gain.gain.value = baseGain * att;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const toPos = pos.clone().sub(camPos).normalize();
      const panVal = Math.max(-0.85, Math.min(0.85, right.dot(toPos)));
      pan = this.ctx.createStereoPanner();
      pan.pan.value = panVal;
    }
    if (pan) {
      gain.connect(pan);
      pan.connect(this.master);
    } else {
      gain.connect(this.master);
    }
    return { gain, pan };
  }

  // 枪声
  shot(pos: THREE.Vector3 | null, camera: THREE.Camera, isPlayer: boolean) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const out = this.spatialize(pos, camera, isPlayer ? 0.5 : 0.4);
    if (!out) return;
    // 噪声爆音
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = isPlayer ? 1600 : 900;
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(isPlayer ? 1.0 : 0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (isPlayer ? 0.14 : 0.2));
    src.connect(bp); bp.connect(g); g.connect(out.gain);
    src.start(t, Math.random() * 0.5, 0.25);
    // 低频冲击
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isPlayer ? 160 : 120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(isPlayer ? 0.8 : 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og); og.connect(out.gain);
    osc.start(t); osc.stop(t + 0.12);
  }

  // 换弹
  reload() {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const click = (at: number, freq: number, dur: number) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = this.noiseBuf!;
      const bp = this.ctx!.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.5, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      src.connect(bp); bp.connect(g); g.connect(this.master!);
      src.start(at, Math.random(), dur + 0.05);
    };
    click(t + 0.05, 2400, 0.08);          // 弹匣释放
    click(t + 0.75, 1500, 0.09);          // 拔出
    click(t + 1.45, 3000, 0.07);          // 插入
    click(t + 1.9, 2000, 0.1);            // 上膛
  }

  dryFire() {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t, Math.random(), 0.08);
  }

  // 命中反馈
  hit(headshot: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(headshot ? 1500 : 1050, t);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 900 : 700, t + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g); g.connect(this.master!);
    osc.start(t); osc.stop(t + 0.1);
  }

  // 受伤
  hurt() {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, Math.random(), 0.2);
  }

  // 脚步
  footstep(sprint: boolean) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380 + Math.random() * 160;
    const g = this.ctx.createGain();
    const v = sprint ? 0.16 : 0.1;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, Math.random(), 0.1);
  }

  // 跳跃落地
  land() {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 300;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t, Math.random(), 0.14);
  }

  // 回合开始
  roundStart() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [440, 660, 880].forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine'; osc.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.3);
      osc.connect(g); g.connect(this.master!);
      osc.start(t + i * 0.14); osc.stop(t + i * 0.14 + 0.32);
    });
  }

  // 回合结束
  roundEnd(win: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262];
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.28, t + i * 0.16 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.16 + 0.5);
      osc.connect(g); g.connect(this.master!);
      osc.start(t + i * 0.16); osc.stop(t + i * 0.16 + 0.55);
    });
  }

  // 死亡
  death() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.6);
  }
}
