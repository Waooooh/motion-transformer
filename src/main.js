import './fonts.css';
import * as THREE from 'three';
import { Director } from './core/director.js';
import { loadFonts } from './core/text.js';
import { createSyntheticFeatures, createAnalysedFeatures } from './core/features.js';
import { SCHEDULE } from './scenes/index.js';
import { SONG, BAR, BEAT, SECTIONS } from './core/song.js';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'render' ? 'render' : 'play';
const canvas = document.getElementById('view');
document.body.classList.toggle('render', MODE === 'render');

let renderer = null;
let director = null;
let features = createSyntheticFeatures();
let width = 1280;
let height = 720;

function buildPipeline(w) {
  width = w;
  height = Math.round((w * 9) / 16);
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: MODE === 'render',
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1);
    renderer.autoClear = false;
    renderer.localClippingEnabled = true;
  }
  renderer.setSize(width, height, false);
  if (director) director.release(Infinity, -Infinity);
  director = new Director({ renderer, width, height, features, schedule: SCHEDULE, msaa: 4 });
}

// ------------------------------------------------------------ render mode
// Driven by tools/render.mjs through Playwright: every frame is a pure
// function of song time, so frames can be rendered in any order / in parallel.
if (MODE === 'render') {
  window.__mt = {
    ready: false,
    duration: SONG.duration,
    async init({ w = 1920, analysis = null } = {}) {
      await loadFonts();
      if (analysis) features = createAnalysedFeatures(analysis);
      buildPipeline(w);
      return { width, height, offset: features.offset, duration: features.duration };
    },
    frame(t, type = 'image/jpeg', quality = 0.93) {
      const res = director.renderAt(t, t);
      director.release(t);
      const url = canvas.toDataURL(type, quality);
      return { url, active: res.active };
    },
    active(t) {
      return director.activeAt(t).map((e) => e.id);
    },
    get director() {
      return director;
    },
  };
  window.__THREE_RT = (w, h) => new THREE.WebGLRenderTarget(w, h);
  window.__mt.ready = true;
} else {
  startPlayer();
}

// ----------------------------------------------------------- player mode
async function startPlayer() {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const toastEl = $('toast');
  let toastTimer = 0;
  const toast = (msg, ms = 3200) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  };

  await loadFonts();
  const q = +params.get('q') || (window.innerWidth * devicePixelRatio >= 2400 ? 1920 : 1280);
  $('quality').value = q >= 1920 ? '1920' : '1280';
  buildPipeline(q >= 1920 ? 1920 : 1280);

  // Build and compile every scene up front so playback never hitches.
  const buttons = [$('load'), $('play-silent')];
  buttons.forEach((b) => (b.disabled = true));
  async function warmup() {
    const n = director.entries.length;
    for (let i = 0; i < n; i++) {
      const e = director.entries[i];
      statusEl.textContent = `准备场景 · preparing ${i + 1}/${n}`;
      await new Promise((r) => setTimeout(r, 0));
      director.renderAt(e.t0 + Math.min(1.5, (e.t1 - e.t0) / 2), 0);
    }
    statusEl.textContent = '';
    buttons.forEach((b) => (b.disabled = false));
  }
  await warmup();
  const IDLE_T = 39.4; // the title card sits behind the start screen

  const clock = { playing: false, t: +params.get('t') || 0, last: performance.now() };
  let audio = null;
  let audioCtx = null;
  let mediaSource = null;
  let recorder = null;

  const songTime = () => (audio ? features.toSong(audio.currentTime) : clock.t);
  const duration = () => (audio && isFinite(audio.duration) ? Math.min(features.toSong(audio.duration), SONG.duration + 2) : SONG.duration);

  // timeline with section colours
  const tl = $('timeline');
  const secColors = { intro: '#1d2550', drop1: '#4a3f86', groove: '#2a4274', drop2: '#6a4d7e', outro: '#23506e', tail: '#141c3c' };
  const secNames = { intro: '起源 ORIGINS', drop1: 'TRANSFORMER', groove: '深度 DEPTH', drop2: '高潮 CLIMAX', outro: '公式 EQUATION', tail: '' };
  for (const s of SECTIONS) {
    const el = document.createElement('div');
    el.className = 'sec';
    el.style.left = `${((s.from * BAR) / SONG.duration) * 100}%`;
    el.style.width = `${(((Math.min(s.to * BAR, SONG.duration) - s.from * BAR) / SONG.duration) * 100).toFixed(3)}%`;
    el.style.background = secColors[s.id];
    el.innerHTML = `<span>${secNames[s.id]}</span>`;
    tl.insertBefore(el, $('playhead'));
  }

  function seek(t) {
    t = Math.max(0, Math.min(duration() - 0.05, t));
    if (audio) audio.currentTime = Math.max(0, features.toFile(t));
    else clock.t = t;
  }
  function setPlaying(p) {
    clock.playing = p;
    clock.last = performance.now();
    if (audio) {
      if (p) audio.play().catch(() => toast('点击播放以启用声音 · Click play to enable audio'));
      else audio.pause();
    }
    $('pp').textContent = p ? '❚❚' : '▶';
  }
  const fmt = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
  };

  // controls auto-hide
  const controls = $('controls');
  let idleTimer = 0;
  const wake = () => {
    controls.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => clock.playing && controls.classList.add('idle'), 2200);
  };
  window.addEventListener('pointermove', wake);

  $('pp').onclick = () => setPlaying(!clock.playing);
  $('fs').onclick = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    Promise.resolve(p).catch(() => toast('此环境不支持全屏 · fullscreen is not available here'));
  };
  if (import.meta.env.MODE === 'artifact') $('rec').remove();
  $('quality').onchange = async (e) => {
    buildPipeline(+e.target.value);
    toast(`渲染分辨率 ${height}p`);
    await warmup();
  };
  const scrub = (e) => {
    const r = tl.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * SONG.duration);
  };
  tl.addEventListener('pointerdown', (e) => {
    scrub(e);
    const move = (ev) => scrub(ev);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      begin();
      setPlaying(!clock.playing);
    } else if (e.code === 'ArrowRight') seek(songTime() + (e.shiftKey ? BAR * 4 : BAR));
    else if (e.code === 'ArrowLeft') seek(songTime() - (e.shiftKey ? BAR * 4 : BAR));
    else if (e.code === 'KeyF') $('fs').click();
    wake();
  });

  // ------------------------------------------------ loading the music
  async function loadAudio(file) {
    statusEl.textContent = `读取 ${file.name} …`;
    const url = URL.createObjectURL(file);
    const el = new Audio();
    el.src = url;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    try {
      audioCtx = audioCtx || new AudioContext();
      const buf = await audioCtx.decodeAudioData(await file.arrayBuffer());
      statusEl.textContent = '分析节拍与段落 · analysing beats…';
      await new Promise((r) => setTimeout(r, 30));
      const { analyzeBuffer } = await import('./core/analyze.js');
      const analysis = analyzeBuffer(buf);
      features = createAnalysedFeatures(analysis);
      director.setFeatures(features);
      const conf = analysis.alignment;
      statusEl.textContent =
        `✓ 已对齐 · offset ${analysis.offset >= 0 ? '+' : ''}${analysis.offset.toFixed(2)} s · ` +
        `${analysis.bpm.toFixed(1)} BPM · match ${(conf.score * 100).toFixed(0)}%`;
      console.info('analysis', { offset: analysis.offset, rate: analysis.rate, alignment: conf, onsets: analysis.onsets });
      if (conf.score < 0.5) toast('这段音频与《Hong Kong Story》匹配度较低，画面按默认节奏播放。');
    } catch (err) {
      console.error(err);
      statusEl.textContent = '无法解码该音频，仍可播放 · could not decode, playing anyway';
    }
    if (audio) audio.pause();
    audio = el;
    mediaSource = null;
    audio.addEventListener('ended', () => {
      setPlaying(false);
      if (recorder) recorder.stop();
    });
    return audio;
  }

  const intro = $('intro');
  let begun = false;
  function begin() {
    if (begun) return;
    begun = true;
    intro.classList.add('hidden');
    if (!params.has('t')) seek(0);
    wake();
  }
  $('load').onclick = () => $('file').click();
  $('file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await loadAudio(f);
    begin();
    seek(0);
    setPlaying(true);
  };
  $('play-silent').onclick = () => {
    begin();
    setPlaying(true);
  };
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging');
  });
  window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('audio') || /\.(mp3|m4a|aac|wav|flac|ogg|opus|webm)$/i.test(x.name));
    if (!f) return;
    await loadAudio(f);
    begin();
    seek(0);
    setPlaying(true);
  });

  // ------------------------------------------------ recording
  // (left out of the Artifact build: artifact pages cannot hand out files)
  if (import.meta.env.MODE !== 'artifact') {
    const recBtn = $('rec');
    if (recBtn) recBtn.onclick = () => {
      if (recorder) {
        recorder.stop();
        return;
      }
      const tracks = [...canvas.captureStream(60).getVideoTracks()];
      if (audio) {
        audioCtx = audioCtx || new AudioContext();
        if (!mediaSource) {
          mediaSource = audioCtx.createMediaElementSource(audio);
          mediaSource.connect(audioCtx.destination);
        }
        const dest = audioCtx.createMediaStreamDestination();
        mediaSource.connect(dest);
        tracks.push(...dest.stream.getAudioTracks());
      } else {
        toast('未载入音乐：将录制无声视频 · recording without music');
      }
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
      const chunks = [];
      recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: height >= 1080 ? 24e6 : 12e6 });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `attention-transformer-${height}p.webm`;
        a.click();
        recorder = null;
        $('rec').classList.remove('on');
        $('rec').textContent = '● REC';
        toast('录制完成，已下载 · saved');
      };
      begin();
      seek(0);
      recorder.start(1000);
      setPlaying(true);
      $('rec').classList.add('on');
      $('rec').textContent = '■ STOP';
      toast('录制中：请保持此标签页在前台 · keep this tab visible while recording', 5000);
    };
  }

  // ------------------------------------------------ main loop
  const playhead = $('playhead');
  const timeEl = $('time');
  const bbEl = $('barbeat');
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - clock.last) / 1000);
    clock.last = now;
    if (!audio && clock.playing) {
      clock.t += dt;
      if (clock.t >= SONG.duration) {
        clock.t = SONG.duration;
        setPlaying(false);
        if (recorder) recorder.stop();
      }
    }
    const t = begun ? songTime() : IDLE_T;
    director.renderAt(Math.max(0, t), now / 1000, { clean: !begun });
    playhead.style.left = `${(Math.max(0, t) / SONG.duration) * 100}%`;
    timeEl.textContent = `${fmt(t)} / ${fmt(duration())}`;
    const beat = Math.floor(Math.max(0, t) / BEAT);
    bbEl.textContent = `${Math.floor(beat / 4) + 1}.${(beat % 4) + 1}`;
  }
  requestAnimationFrame(loop);
  if (params.has('t') || params.has('autoplay')) {
    begin();
    setPlaying(params.has('autoplay'));
  }
}
