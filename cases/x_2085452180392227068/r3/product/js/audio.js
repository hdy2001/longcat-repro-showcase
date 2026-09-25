/* ===== Furious Birds — procedural WebAudio sound effects (no assets) ===== */
window.AudioFX = (function () {
  let ctx = null;
  let master = null;
  let muted = false;
  let lastThud = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(o) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.end) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.end), t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }

  function noise(o) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.2;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = o.ftype || 'lowpass';
    filt.frequency.setValueAtTime(o.freq || 800, t0);
    if (o.endFreq) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.endFreq), t0 + dur);
    filt.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  const lib = {
    click()    { tone({ freq: 640, end: 420, dur: 0.07, type: 'square', vol: 0.12 }); },
    launch()   { noise({ dur: 0.22, freq: 1600, endFreq: 240, vol: 0.35 });
                 tone({ freq: 260, end: 90, dur: 0.16, type: 'sawtooth', vol: 0.22 }); },
    thud(v) {
      const now = performance.now();
      if (now - lastThud < 70) return;
      lastThud = now;
      const vol = Math.min(0.4, 0.08 + (v || 0.2));
      noise({ dur: 0.07, freq: 420, vol: vol });
    },
    crack()    { noise({ dur: 0.13, freq: 2400, ftype: 'bandpass', q: 2, vol: 0.3 });
                 noise({ dur: 0.08, freq: 500, vol: 0.2, delay: 0.02 }); },
    pop()      { tone({ freq: 520, end: 130, dur: 0.14, type: 'square', vol: 0.3 });
                 noise({ dur: 0.1, freq: 1200, ftype: 'bandpass', vol: 0.18 }); },
    boost()    { tone({ freq: 190, end: 950, dur: 0.2, type: 'sawtooth', vol: 0.3 });
                 noise({ dur: 0.18, freq: 2000, endFreq: 4000, vol: 0.12 }); },
    split()    { tone({ freq: 700, end: 900, dur: 0.08, type: 'square', vol: 0.2 });
                 tone({ freq: 950, end: 1200, dur: 0.09, type: 'square', vol: 0.18, delay: 0.07 }); },
    fuse()     { noise({ dur: 0.1, freq: 5000, ftype: 'highpass', vol: 0.08 }); },
    explosion(){ noise({ dur: 0.75, freq: 1000, endFreq: 80, vol: 0.85 });
                 tone({ freq: 130, end: 28, dur: 0.55, type: 'sine', vol: 0.6 }); },
    win()      { const n = [523, 659, 784, 1047];
                 n.forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.28, delay: i * 0.12 }));
                 tone({ freq: 1319, dur: 0.35, type: 'triangle', vol: 0.25, delay: 0.5 }); },
    lose()     { const n = [392, 330, 262, 196];
                 n.forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.26, delay: i * 0.16 })); },
    star(i)    { tone({ freq: 900 + i * 350, dur: 0.12, type: 'sine', vol: 0.3 });
                 tone({ freq: 1800 + i * 700, dur: 0.18, type: 'sine', vol: 0.12, delay: 0.05 }); }
  };

  return {
    play(name, opt) { if (lib[name]) { try { lib[name](opt); } catch (e) { /* ignore */ } } },
    unlock() { try { ensure(); } catch (e) { /* ignore */ } },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; }
  };
})();
