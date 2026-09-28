// Audio analysis shared by the browser player and the Node renderer (no DOM).
//
// Given a recording of the song it produces, at 100 frames per second:
//   energy (loudness), bass / mid / high band levels, and kick / snare / hat
//   envelopes built from detected onsets;
// plus the tempo and the time offset that aligns the recording to the film's
// timeline (so a file with leading silence, a radio edit start, or even a
// sped-up / slowed version still lands on the beat).
//
// Alignment = cross-correlating the recording's loudness contour with the
// reference contour of the track, then refining on the beat grid.

import { REFERENCE_ENVELOPE, REFERENCE_DURATION } from '../data/reference-envelope.js';

const FPS = 100;
const NOMINAL_BEAT = 0.75; // 80 BPM

// ------------------------------------------------------------------- FFT
function makeFFT(n) {
  const levels = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b);
    rev[i] = r;
  }
  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = -Math.sin((2 * Math.PI * i) / n);
  }
  return function fft(re, im) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j;
          const b = a + half;
          const tr = re[b] * cos[k] - im[b] * sin[k];
          const ti = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  };
}

// --------------------------------------------------------------- helpers
function percentile(arr, p) {
  const a = Float32Array.from(arr).sort();
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
}

function smooth(arr, radius) {
  const n = arr.length;
  const out = new Float32Array(n);
  let acc = 0;
  const w = radius * 2 + 1;
  for (let i = -radius; i < n + radius; i++) {
    const add = arr[Math.min(n - 1, Math.max(0, i + radius))];
    acc += add;
    if (i - radius - 1 >= -radius) acc -= arr[Math.min(n - 1, Math.max(0, i - radius - 1))];
    if (i >= 0 && i < n) out[i] = acc / w;
  }
  return out;
}

function normalise(arr, lo = 0.05, hi = 0.98) {
  const a = percentile(arr, lo);
  const b = percentile(arr, hi);
  const out = new Float32Array(arr.length);
  const d = Math.max(1e-6, b - a);
  for (let i = 0; i < arr.length; i++) out[i] = Math.min(1, Math.max(0, (arr[i] - a) / d));
  return out;
}

function sampleAt(arr, rate, t) {
  const x = t * rate;
  const i = Math.floor(x);
  if (i < 0 || i >= arr.length - 1) return 0;
  const f = x - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}

/** Peak-picked onsets → decaying envelope in 0..1. */
function onsetEnvelope(flux, { minGap = 0.16, decay = 0.18, k = 1.1, win = 1.5 }) {
  const n = flux.length;
  const mean = smooth(flux, Math.round(win * FPS));
  const sq = new Float32Array(n);
  for (let i = 0; i < n; i++) sq[i] = (flux[i] - mean[i]) ** 2;
  const sd = smooth(sq, Math.round(win * FPS)).map(Math.sqrt);
  const peaks = [];
  let last = -1e9;
  for (let i = 2; i < n - 2; i++) {
    const v = flux[i];
    if (v < mean[i] + k * sd[i] || v <= 0) continue;
    if (v < flux[i - 1] || v < flux[i + 1] || v < flux[i - 2] || v < flux[i + 2]) continue;
    if (i - last < minGap * FPS) {
      if (peaks.length && v > peaks[peaks.length - 1].v) peaks[peaks.length - 1] = { i, v };
      continue;
    }
    peaks.push({ i, v });
    last = i;
  }
  const env = new Float32Array(n);
  if (!peaks.length) return { env, peaks };
  const ref = percentile(
    peaks.map((p) => p.v),
    0.9,
  );
  const dk = decay * FPS;
  for (const p of peaks) {
    const s = Math.min(1, p.v / ref);
    const end = Math.min(n, p.i + Math.ceil(dk * 6));
    for (let j = p.i; j < end; j++) {
      const e = s * Math.exp(-(j - p.i) / dk);
      if (e > env[j]) env[j] = e;
    }
  }
  return { env, peaks };
}

// ------------------------------------------------------------------ main
export function analyzeBuffer(buffer) {
  const ch = buffer.numberOfChannels;
  const n = buffer.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / ch;
  }
  return analyzePCM(mono, buffer.sampleRate);
}

export function analyzePCM(input, sampleRate) {
  // 1. decimate to ~22 kHz
  let x = input;
  let sr = sampleRate;
  while (sr > 32000) {
    const y = new Float32Array(Math.floor(x.length / 2));
    for (let i = 0; i < y.length; i++) y[i] = 0.5 * (x[2 * i] + x[2 * i + 1]);
    x = y;
    sr /= 2;
  }
  const duration = x.length / sr;
  const frames = Math.floor(duration * FPS);
  const N = 1024;
  const fft = makeFFT(N);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const binHz = sr / N;
  const bands = [
    [30, 110],
    [110, 250],
    [250, 2000],
    [2000, 6000],
    [6000, 10500],
  ];
  const B = bands.map(([a, b]) => [Math.max(1, Math.round(a / binHz)), Math.min(N / 2 - 1, Math.round(b / binHz))]);
  const L = bands.map(() => new Float32Array(frames));
  const rms = new Float32Array(frames);
  const peak = new Float32Array(frames);

  for (let f = 0; f < frames; f++) {
    const start = Math.round((f * sr) / FPS) - N / 2;
    let s2 = 0;
    let pk = 0;
    for (let i = 0; i < N; i++) {
      const j = start + i;
      const v = j >= 0 && j < x.length ? x[j] : 0;
      re[i] = v * win[i];
      im[i] = 0;
      s2 += v * v;
      const av = Math.abs(v);
      if (av > pk) pk = av;
    }
    rms[f] = Math.sqrt(s2 / N);
    peak[f] = pk;
    fft(re, im);
    for (let b = 0; b < B.length; b++) {
      let e = 0;
      for (let k = B[b][0]; k <= B[b][1]; k++) e += re[k] * re[k] + im[k] * im[k];
      L[b][f] = Math.log1p((e / (B[b][1] - B[b][0] + 1)) * 50);
    }
  }

  // 2. onset strength per band
  const flux = L.map((l) => {
    const o = new Float32Array(frames);
    for (let i = 2; i < frames; i++) o[i] = Math.max(0, l[i] - Math.max(l[i - 1], l[i - 2] * 0.9));
    return o;
  });
  const kickFlux = new Float32Array(frames);
  const snareFlux = new Float32Array(frames);
  const hatFlux = new Float32Array(frames);
  const allFlux = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    kickFlux[i] = flux[0][i] * 1.2 + flux[1][i] * 0.5;
    snareFlux[i] = flux[3][i] + flux[2][i] * 0.5;
    hatFlux[i] = flux[4][i];
    allFlux[i] = flux[0][i] + flux[1][i] + flux[2][i] + flux[3][i] + flux[4][i];
  }
  const kick = onsetEnvelope(kickFlux, { minGap: 0.2, decay: 0.16, k: 1.2 });
  const snare = onsetEnvelope(snareFlux, { minGap: 0.2, decay: 0.2, k: 1.2 });
  const hat = onsetEnvelope(hatFlux, { minGap: 0.09, decay: 0.06, k: 1.0 });

  // 3. levels
  const db = rms.map((v) => 20 * Math.log10(v + 1e-6));
  const energy = smooth(normalise(db, 0.08, 0.995), 12);
  const bass = smooth(normalise(L[0], 0.05, 0.99), 6);
  const mid = smooth(normalise(L[2], 0.05, 0.99), 6);
  const high = smooth(normalise(L[4], 0.05, 0.99), 4);

  // 4. tempo: coarse period from the onset autocorrelation, refined 32 beats out
  const o = smooth(allFlux, 1);
  let m = 0;
  for (let i = 0; i < frames; i++) m += o[i];
  m /= frames;
  const oc = o.map((v) => v - m);
  const acf = (lag) => {
    let s = 0;
    for (let i = 0; i + lag < frames; i += 1) s += oc[i] * oc[i + lag];
    return s / (frames - lag);
  };
  let best = { lag: 75, v: -Infinity };
  for (let lag = 55; lag <= 110; lag++) {
    const v = acf(lag);
    if (v > best.v) best = { lag, v };
  }
  let period = best.lag / FPS;
  {
    const center = Math.round(32 * best.lag);
    let b2 = { lag: center, v: -Infinity };
    for (let lag = center - Math.round(best.lag / 2); lag <= center + Math.round(best.lag / 2); lag++) {
      if (lag >= frames - 10) break;
      const v = acf(lag);
      if (v > b2.v) b2 = { lag, v };
    }
    if (b2.v > -Infinity && b2.lag < frames - 10) {
      const a = acf(b2.lag - 1);
      const c = acf(b2.lag + 1);
      const d = a - 2 * b2.v + c;
      const off = d !== 0 ? (0.5 * (a - c)) / d : 0;
      period = (b2.lag + Math.max(-0.5, Math.min(0.5, off))) / FPS / 32;
    }
  }
  let rate = NOMINAL_BEAT / period;
  if (Math.abs(rate - 1) < 0.006) rate = 1; // original recording: trust the nominal tempo

  // 5. align loudness contour with the reference (song time s ↦ file time s/rate + offset)
  const envF = smooth(peak, 6);
  const refN = REFERENCE_ENVELOPE.length;
  const refRate = refN / REFERENCE_DURATION;
  const ref = new Float32Array(refN);
  let rm = 0;
  for (let i = 0; i < refN; i++) rm += REFERENCE_ENVELOPE[i];
  rm /= refN;
  for (let i = 0; i < refN; i++) ref[i] = REFERENCE_ENVELOPE[i] - rm;
  let bestAlign = { offset: 0, score: -1 };
  const maxShift = Math.min(90, duration);
  for (let off = -REFERENCE_DURATION + 20; off <= maxShift; off += 0.05) {
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    let sx = 0;
    let cnt = 0;
    const vals = [];
    for (let i = 0; i < refN; i += 2) {
      const tf = (i + 0.5) / refRate / rate + off;
      if (tf < 0 || tf >= duration) continue;
      vals.push([sampleAt(envF, FPS, tf), ref[i]]);
    }
    if (vals.length < 100) continue; // need ≥ ~26 s of overlap
    for (const [a] of vals) sx += a;
    const mx = sx / vals.length;
    for (const [a, b] of vals) {
      sxy += (a - mx) * b;
      sxx += (a - mx) ** 2;
      syy += b * b;
      cnt++;
    }
    const r = sxy / Math.sqrt(sxx * syy + 1e-12);
    // prefer longer overlaps slightly
    const score = r * Math.min(1, cnt / 500);
    if (score > bestAlign.score) bestAlign = { offset: off, score, r };
  }

  // 6. refine on the beat grid (±0.25 s, 5 ms steps) inside the drum sections
  let offset = bestAlign.score > 0.35 ? bestAlign.offset : 0;
  const beatScore = (off) => {
    let s = 0;
    for (let beat = 48; beat < 240; beat++) {
      const tf = (beat * NOMINAL_BEAT) / rate + off;
      if (tf < 0 || tf >= duration) continue;
      s += sampleAt(o, FPS, tf) * (beat % 2 === 0 ? 1.2 : 1);
    }
    return s;
  };
  let bestFine = { off: offset, s: -Infinity };
  for (let d = -0.3; d <= 0.3; d += 0.005) {
    const s = beatScore(offset + d);
    if (s > bestFine.s) bestFine = { off: offset + d, s };
  }
  offset = bestFine.off;

  const q = (a) => Array.from(a, (v) => Math.round(v * 1000) / 1000);
  return {
    version: 1,
    fps: FPS,
    duration,
    offset,
    rate,
    bpm: 80 * rate,
    alignment: { score: Math.max(0, bestAlign.score), coarse: bestAlign.offset },
    onsets: { kick: kick.peaks.length, snare: snare.peaks.length, hat: hat.peaks.length },
    energy: q(energy),
    bass: q(bass),
    mid: q(mid),
    high: q(high),
    kick: q(kick.env),
    snare: q(snare.env),
    hat: q(hat.env),
  };
}
