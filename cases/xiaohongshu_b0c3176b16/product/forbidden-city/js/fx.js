// ============================================================
// fx.js — 火树银花灯串、光晕、Bloom 合成、夜间环境音
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeRedGlowTexture, makeGlowTexture } from './materials.js';

// ---------------- 火树银花（树冠灯串 + 灯泡实例） ----------------
export function decorateTrees(scene, M, trees) {
  const g = new THREE.Group();
  if (!trees || !trees.length) return g;
  const bulbGeo = new THREE.SphereGeometry(0.075, 6, 5);
  const mats = [M.bulbWarm, M.bulbWarm, M.bulbWarm, M.bulbCool];
  // 全部灯泡进一个 InstancedMesh（暖光为主）
  const perTree = 46;
  const total = trees.length * perTree;
  const bulbs = new THREE.InstancedMesh(bulbGeo, M.bulbWarm, total);
  const wirePts = [];
  const m4 = new THREE.Matrix4();
  let bi = 0;
  const redTex = makeRedGlowTexture();
  const sprites = [];
  trees.forEach((t, ti) => {
    const { x, z, canopyY, canopyR } = t;
    // 2-3 圈螺旋灯串
    const strands = 2 + (ti % 2);
    for (let s = 0; s < strands; s++) {
      const y0 = canopyY * (0.55 + 0.3 * s) + 0.4;
      const r0 = canopyR * (1.05 - 0.18 * s);
      const pts = [];
      const N = perTree / strands;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 * (1.6 + 0.35 * s) + s * 1.3;
        const rr = r0 * (1 + 0.16 * Math.sin(a * 3 + ti));
        const px = x + Math.cos(a) * rr;
        const pz = z + Math.sin(a) * rr;
        const py = y0 + Math.sin(a * 2.2 + s) * 0.35;
        pts.push([px, py, pz]);
        m4.identity(); m4.setPosition(px, py, pz);
        const sc = 0.7 + Math.random() * 0.7;
        m4.scale(new THREE.Vector3(sc, sc, sc));
        if (bi < total) bulbs.setMatrixAt(bi++, m4);
      }
      // 电线（细管）
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      wirePts.push(curve);
    }
    // 每 3 棵树加一个光晕 sprite
    if (ti % 3 === 0) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: redTex, transparent: true, opacity: 0.34,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sp.position.set(x, canopyY * 0.8, z);
      sp.scale.setScalar(canopyR * 5.2);
      sprites.push(sp);
      g.add(sp);
    }
  });
  bulbs.count = bi;
  bulbs.instanceMatrix.needsUpdate = true;
  g.add(bulbs);
  // 电线合并
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });
  wirePts.forEach((c) => {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.02, 3), wireMat);
    g.add(tube);
  });
  scene.add(g);
  return g;
}

// ---------------- 英雄光晕（殿前红灯笼光池） ----------------
export function addGlowSprites(scene, anchors) {
  const g = new THREE.Group();
  const redTex = makeRedGlowTexture();
  const warmTex = makeGlowTexture('rgba(255,200,120,1)');
  anchors.forEach((a) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: a.color === 'red' ? redTex : warmTex,
      transparent: true, opacity: a.color === 'red' ? 0.5 : 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.position.copy(a.pos);
    sp.scale.setScalar(a.scale);
    g.add(sp);
  });
  scene.add(g);
  return g;
}

// ---------------- Bloom 合成器 ----------------
export function createComposer(renderer, scene, camera, strength = 0.8) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), strength, 0.55, 0.52);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom };
}

// ---------------- 夜间环境音（风 + 远钟，可接入录制） ----------------
export function createAmbience() {
  let ctx = null, dest = null, master = null, timer = null;
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    dest = ctx.createMediaStreamDestination();
    master = ctx.createGain(); master.gain.value = 0.5;
    master.connect(dest);
    // 风：滤波噪声 + 慢 LFO
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { // 棕噪声
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.4;
    const windGain = ctx.createGain(); windGain.gain.value = 0.16;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.07;
    lfo.connect(lfoGain); lfoGain.connect(windGain.gain);
    src.connect(lp); lp.connect(windGain); windGain.connect(master);
    src.start(); lfo.start();
    // 远钟
    function bell() {
      if (!ctx) return;
      const t0 = ctx.currentTime;
      [523.25 * 0.5, 523.25 * 0.5 * 2.76, 523.25 * 0.5 * 5.4].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * 0.5;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0, t0);
        gn.gain.linearRampToValueAtTime(0.10 / (i + 1), t0 + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 5 + i);
        o.connect(gn); gn.connect(master);
        o.start(t0); o.stop(t0 + 6 + i);
      });
      timer = setTimeout(bell, 11000 + Math.random() * 9000);
    }
    timer = setTimeout(bell, 2500);
  }
  return {
    stream: null,
    start() { if (!ctx) build(); this.stream = dest.stream; if (ctx.state === 'suspended') ctx.resume(); },
    getStream() { return this.stream || (this.start(), this.stream); },
  };
}
