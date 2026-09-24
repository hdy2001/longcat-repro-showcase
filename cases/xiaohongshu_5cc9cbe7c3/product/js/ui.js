// ============ UI：章节 / 对话 / 导演模式 / 音频 ============

// 导演模式参数（与编辑器面板双向绑定）
const params = {
  followCam: true,        // 编辑跟随飞行镜头
  followEdit: true,       // 跟随角色编辑
  camPos: [0, 0, 0],
  camRot: [0, 0],
  followDist: 10.9,
  waveSize: 2.25,         // 水面波浪大小
  fogDepth: 1.02,         // 水下雾深
  farFog: 0.011,          // 远景雾强度
  caustics: 1.0,          // 文物与海床焦散
  focusAlice: true,       // 昼深始终聚焦 Alice
  dayDepth: 0.0002,       // 昼深强度
  maxFogBlur: 0.0015,     // 最大雾化虚
  grime: 0.15             // 表面脏灰
};

// 章节数据
const CHAPTERS = [
  {
    num: '01', title: '太阳神鸟', sub: '向金色的光坠落', t: 0.16,
    artifact: '青铜神树', era: '商代晚期 · 古蜀',
    whisper: '向下望。那枚金色神鸟正在海底等你。',
    lines: [
      '向下望。那枚金色神鸟正在海底等你。',
      '三千年前，古蜀人相信它通天的枝桠能够触碰太阳。',
      '如今枝桠沉入沙下，唯有年轮还记得祭祀的烟火。',
      '别怕黑暗。跟着光，一直向下。'
    ]
  },
  {
    num: '02', title: '沙下之眼', sub: '神树与面具仍在凝望', t: 0.42,
    artifact: '纵目面具', era: '商代晚期 · 古蜀',
    whisper: '它在沙下睁着眼睛，看了三千年。',
    lines: [
      '我在沙下睁着眼睛，看了三千年。',
      '纵目不是凝视深渊，而是替先王望向远方。',
      '洪水漫过神庙时，是我最后一个闭上眼睛。',
      '现在，换你来看了。'
    ]
  },
  {
    num: '03', title: '金色鱼群', sub: '跟随它们游向更深处', t: 0.60,
    artifact: '青铜面具', era: '商代晚期 · 古蜀',
    whisper: '它们认得回家的路，跟着光游。',
    lines: [
      '我与无数青铜器一同进入祭祀坑。那场仪式为何结束，三千年后仍无人能够回答。',
      '黄金覆面的时候，我听见鼓声从地底传来。',
      '他们说，沉入水底的东西，就不会再被时间惊扰。',
      '可你来了。水波一晃，我又想起人间。'
    ]
  },
  {
    num: '04', title: '青铜之足', sub: '山崖并不是悬崖', t: 0.80,
    artifact: '金杖', era: '商代晚期 · 古蜀',
    whisper: '杖上的鱼与鸟，都还认得水。',
    lines: [
      '木心早已归土，只留下包裹它的黄金。',
      '杖上刻着鱼、鸟与箭——那是先王最后的出征。',
      '黄金不腐，所以记忆也不腐。',
      '握紧我。我带你去看水面上的光。'
    ]
  },
  {
    num: '05', title: '水上神影', sub: '仰望未被淹没的巨人', t: 0.97,
    artifact: null,
    narrative: '水面就在上方。你可以在任何区域继续上浮，也可以随时重新下潜。'
  }
];

const $ = id => document.getElementById(id);
const UI = {};

function initUI() {
  UI.banner = $('banner');
  UI.whisper = $('whisper');
  UI.narrative = $('narrative');
  UI.dialog = $('dialog');
  UI.editor = $('editor');
  UI.endcard = $('endcard');
  UI.start = $('start');
  UI.depth = $('depth');
  UI.chapterInd = $('chapter-ind');

  $('grime').style.backgroundImage = `url(${makeGrimeDataURL()})`;

  // 开始界面
  $('btn-start').addEventListener('click', () => {
    UI.start.classList.add('hidden');
    initAudio();
    G.started = true;
    showBanner(CHAPTERS[0]);
  });

  // 顶部按钮
  $('btn-music').addEventListener('click', toggleMusic);
  $('btn-quality').addEventListener('click', toggleQuality);
  $('btn-editor').addEventListener('click', toggleEditor);

  // 低语面板
  $('btn-listen').addEventListener('click', openDialog);

  // 对话面板
  $('btn-dlg-next').addEventListener('click', nextLine);
  $('btn-dlg-close').addEventListener('click', closeDialog);

  // 结束画面
  $('btn-roam').addEventListener('click', () => {
    UI.endcard.classList.add('hidden');
    G.paused = false;
    toggleEditor(true);
  });

  bindEditor();
}

// ---- 章节横幅 ----
function showBanner(ch) {
  $('banner-num').textContent = ch.num;
  $('banner-title').textContent = ch.title;
  $('banner-sub').textContent = ch.sub;
  UI.banner.classList.remove('hidden');
  UI.banner.classList.add('show');
  // 顶部常驻章节指示
  $('ci-num').textContent = ch.num;
  $('ci-title').textContent = ch.title;
  $('ci-sub').textContent = ch.sub;
  UI.chapterInd.classList.add('show');
  setTimeout(() => {
    UI.banner.classList.remove('show');
    setTimeout(() => UI.banner.classList.add('hidden'), 900);
  }, 3400);
}

// ---- 低语面板 ----
function showWhisper(ch) {
  $('whisper-text').textContent = `文物正在低语 · ${ch.artifact} —— ${ch.whisper}`;
  UI.whisper.classList.remove('hidden');
  UI.whisper.classList.add('show');
}
function hideWhisper() {
  UI.whisper.classList.remove('show');
  setTimeout(() => UI.whisper.classList.add('hidden'), 500);
}

// ---- 剧情对话 ----
let dlgChapter = null, dlgIndex = 0;
function openDialog(ch) {
  dlgChapter = ch;
  dlgIndex = 0;
  renderLine();
  UI.dialog.classList.remove('hidden');
  UI.dialog.classList.add('show');
  hideWhisper();
  G.paused = true;
}
function renderLine() {
  const ch = dlgChapter;
  $('dlg-name').textContent = ch.artifact;
  $('dlg-era').textContent = ch.era;
  $('dlg-quote').textContent = `“${ch.lines[dlgIndex]}”`;
  $('dlg-page').textContent = `${dlgIndex + 1} / ${ch.lines.length}`;
  $('btn-dlg-next').textContent = dlgIndex === ch.lines.length - 1 ? '继续下潜 →' : '继续聆听 · ①';
}
function nextLine() {
  if (dlgIndex < dlgChapter.lines.length - 1) {
    dlgIndex++;
    renderLine();
  } else {
    // 听完，继续旅程
    completeChapter(dlgChapter);
    closeDialog();
  }
}
function closeDialog() {
  UI.dialog.classList.remove('show');
  setTimeout(() => UI.dialog.classList.add('hidden'), 400);
  const ch = dlgChapter;
  if (ch && !G.chapterDone.has(ch)) {
    G.paused = false;
    // 章节未完成：稍后重新亮起低语面板
    setTimeout(() => {
      if (!G.chapterDone.has(ch) && UI.dialog.classList.contains('hidden')) showWhisper(ch);
    }, 900);
  }
}
function completeChapter(ch) {
  G.chapterDone.add(ch);
  G.paused = false;
}

// ---- 叙述条（第五章 / 结尾） ----
function showNarrative(text) {
  $('narrative-text').textContent = text;
  UI.narrative.classList.remove('hidden');
  UI.narrative.classList.add('show');
}
function hideNarrative() {
  UI.narrative.classList.remove('show');
  setTimeout(() => UI.narrative.classList.add('hidden'), 600);
}

// ---- 结束画面 ----
function showEndcard() {
  UI.endcard.classList.remove('hidden');
  UI.endcard.classList.add('show');
  G.paused = true;
}

// ---- 导演模式编辑器 ----
function toggleEditor(force) {
  const open = force !== undefined ? force : UI.editor.classList.contains('hidden');
  UI.editor.classList.toggle('hidden', !open);
  G.editorOpen = open;
  $('btn-editor').textContent = open ? 'F2 · 关闭' : 'F2 · 编辑器';
  if (open && !params.followCam) {
    // 自由镜头：从当前相机初始化
    G.freePos.copy(W.camera.position);
    const d = W.camera.getWorldDirection(_tv1);
    G.freeYaw = Math.atan2(-d.x, -d.z);
    G.freePitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
  }
}

function bindEditor() {
  // 复选框
  bindCheck('ck-follow', v => { params.followCam = v; });
  bindCheck('ck-followedit', v => { params.followEdit = v; });
  bindCheck('ck-focusalice', v => { params.focusAlice = v; });

  // 滑条
  bindSlider('sl-wave', 'sv-wave', v => { params.waveSize = v; }, 2);
  bindSlider('sl-fog', 'sv-fog', v => { params.fogDepth = v; }, 2);
  bindSlider('sl-farfog', 'sv-farfog', v => { params.farFog = v; }, 3);
  bindSlider('sl-caustics', 'sv-caustics', v => { params.caustics = v; }, 2);
  bindSlider('sl-daydepth', 'sv-daydepth', v => { params.dayDepth = v; }, 5);
  bindSlider('sl-maxblur', 'sv-maxblur', v => { params.maxFogBlur = v; }, 4);
  bindSlider('sl-grime', 'sv-grime', v => { params.grime = v; }, 2);
  bindSlider('sl-dist', 'sv-dist', v => { params.followDist = v; }, 1);

  // 位置 / 转角输入
  for (let i = 0; i < 3; i++) bindNumber(`in-pos-${i}`, v => { params.camPos[i] = v; });
  for (let i = 0; i < 2; i++) bindNumber(`in-rot-${i}`, v => { params.camRot[i] = v; });

  // 导演校验点跳转
  const jumpSel = $('sel-jump');
  CHAPTERS.forEach((ch, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${ch.num} ${ch.title} · ${ch.sub}`;
    jumpSel.appendChild(opt);
  });
  $('btn-jump').addEventListener('click', () => {
    const ch = CHAPTERS[+jumpSel.value];
    G.diverT = ch.t;
    G.nextChapter = Math.max(G.nextChapter, +jumpSel.value);
    if (!G.chapterDone.has(ch)) {
      G.paused = true;
      showBanner(ch);
      if (ch.artifact) showWhisper(ch);
      else showNarrative(ch.narrative);
    }
  });

  // 场景物件
  const objSel = $('sel-object');
  [['太阳神鸟 · sunbird-main', W.sunbird.position],
   ['青铜神树 · tree-main', W.tree.position],
   ['纵目面具 · mask-main', W.bigMask.position],
   ['金杖 · staff-main', W.staff.position],
   ['金色鱼群 · fish-school', new THREE.Vector3(0, -18, -110)]
  ].forEach(([name]) => {
    const opt = document.createElement('option');
    opt.textContent = name;
    objSel.appendChild(opt);
  });
  objSel.addEventListener('change', () => {
    const targets = [W.sunbird.position, W.tree.position, W.bigMask.position, W.staff.position, _tv2.set(0, -18, -110)];
    const target = targets[+objSel.value];
    // 把 Alice 移到物件附近并注视
    let bestT = 0, bestD = 1e9;
    for (let i = 0; i <= 200; i++) {
      const tt = i / 200;
      W.path.getPointAt(tt, _tv1);
      const d = _tv1.distanceTo(target);
      if (d < bestD) { bestD = d; bestT = tt; }
    }
    G.diverT = bestT;
    G.lookTargetOverride.copy(target);
    G.lookOverrideTime = 3;
  });
}

function bindCheck(id, fn) {
  const el = $(id);
  el.checked = params[id === 'ck-follow' ? 'followCam' : id === 'ck-followedit' ? 'followEdit' : 'focusAlice'];
  el.addEventListener('change', () => fn(el.checked));
}
function bindSlider(id, vid, fn, decimals) {
  const el = $(id);
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    $(vid).textContent = v.toFixed(decimals);
    fn(v);
  });
}
function bindNumber(id, fn) {
  const el = $(id);
  el.addEventListener('change', () => fn(parseFloat(el.value) || 0));
}

// ---- 音乐 / 画质 ----
let audioCtx = null, masterGain = null, musicOn = true, audioDelay = null;
function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(audioCtx.destination);

  // 环境Pad
  const padGain = audioCtx.createGain();
  padGain.gain.value = 0.07;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  padGain.connect(filter);
  filter.connect(masterGain);
  [[55, 'sine', 1], [82.41, 'sine', 0.7], [110, 'triangle', 0.4], [164.81, 'sine', 0.22]].forEach(([f, type, g]) => {
    const o = audioCtx.createOscillator();
    o.type = type; o.frequency.value = f;
    const og = audioCtx.createGain();
    og.gain.value = g;
    o.connect(og); og.connect(padGain);
    o.start();
  });
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoG = audioCtx.createGain();
  lfoG.gain.value = 130;
  lfo.connect(lfoG); lfoG.connect(filter.frequency);
  lfo.start();

  // 延迟（水光闪烁音）
  audioDelay = audioCtx.createDelay(1);
  audioDelay.delayTime.value = 0.45;
  const fb = audioCtx.createGain();
  fb.gain.value = 0.32;
  audioDelay.connect(fb); fb.connect(audioDelay);
  audioDelay.connect(masterGain);

  schedulePlink(1200);
  scheduleBubble(600);
}

function schedulePlink(delay) {
  setTimeout(() => {
    if (audioCtx && musicOn) {
      const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      const f = notes[(Math.random() * notes.length) | 0];
      const o = audioCtx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = audioCtx.createGain();
      const t0 = audioCtx.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8);
      o.connect(g); g.connect(masterGain);
      if (audioDelay) g.connect(audioDelay);
      o.start(t0); o.stop(t0 + 3);
    }
    schedulePlink(2800 + Math.random() * 5200);
  }, delay);
}

function scheduleBubble(delay) {
  setTimeout(() => {
    if (audioCtx && musicOn && audioCtx.state === 'running') {
      const dur = 0.14;
      const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700 + Math.random() * 1400;
      bp.Q.value = 7;
      const g = audioCtx.createGain();
      g.gain.value = 0.028;
      src.connect(bp); bp.connect(g); g.connect(masterGain);
      src.start();
    }
    scheduleBubble(700 + Math.random() * 2600);
  }, delay);
}

function toggleMusic() {
  musicOn = !musicOn;
  $('btn-music').textContent = musicOn ? '音乐 · 开' : '音乐 · 关';
  if (masterGain) masterGain.gain.linearRampToValueAtTime(musicOn ? 0.5 : 0, audioCtx.currentTime + 0.4);
}

let qualityHigh = true;
function toggleQuality() {
  qualityHigh = !qualityHigh;
  $('btn-quality').textContent = qualityHigh ? '画质 · 高' : '画质 · 低';
  W.renderer.setPixelRatio(qualityHigh ? Math.min(devicePixelRatio, 2) : 1);
  A.vortex.count = qualityHigh ? 320 : 160;
  A.stream.count = qualityHigh ? 220 : 110;
  A.snow.geometry.setDrawRange(0, qualityHigh ? 1200 : 400);
  W.godrays.forEach(r => r.visible = qualityHigh);
}
