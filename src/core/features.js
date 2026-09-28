// Audio features that drive the visuals. Two sources share one interface:
//
//  • synthetic — built from the song map (80 BPM grid, drum sections) and the
//    reference loudness contour. Used when no music file is loaded, so the
//    film already "breathes" with the track's structure.
//  • analysed  — built by analyze.js from the real recording (kick / snare /
//    hat onsets, band energies, loudness), aligned to the song timeline.
//
// sample(t) takes *song time* (seconds from bar 0) and returns:
//   energy 0..1, kick/snare/hat 0..1 decaying envelopes, bass/mid/high 0..1,
//   beat/bar indices + phases, drums 0..1 (how present the groove is).

import { BEAT, BAR, SONG, TAIL_HITS } from './song.js';
import { REFERENCE_ENVELOPE, REFERENCE_DURATION, REFERENCE_MAX } from '../data/reference-envelope.js';
import { clamp, lerp } from './math.js';

const REF_RATE = REFERENCE_ENVELOPE.length / REFERENCE_DURATION; // samples per second

// Lightly smoothed, normalised copy of the reference contour.
const REF_SMOOTH = (() => {
  const n = REFERENCE_ENVELOPE.length;
  const out = new Float32Array(n);
  const r = 3;
  for (let i = 0; i < n; i++) {
    let s = 0;
    let w = 0;
    for (let j = -r; j <= r; j++) {
      const k = Math.min(n - 1, Math.max(0, i + j));
      const wt = r + 1 - Math.abs(j);
      s += REFERENCE_ENVELOPE[k] * wt;
      w += wt;
    }
    out[i] = s / w / (REFERENCE_MAX * 0.92);
  }
  return out;
})();

function sampleArray(arr, rate, t) {
  const x = t * rate;
  const i = Math.floor(x);
  if (i < 0) return arr[0];
  if (i >= arr.length - 1) return arr[arr.length - 1];
  return lerp(arr[i], arr[i + 1], x - i);
}

/** How present the drum groove is at song time t (from the arrangement). */
export function drumPresence(t) {
  const b = t / BAR;
  if (b < 12) return 0;
  if (b < 60) return 1;
  if (b < 69) return lerp(1, 0.4, (b - 60) / 9);
  return 0;
}

function grid(t) {
  const beatF = t / BEAT;
  const barF = t / BAR;
  const beat = Math.floor(beatF);
  const bar = Math.floor(barF);
  return {
    beat,
    beatPhase: beatF - beat,
    bar,
    barPhase: barF - bar,
    beatInBar: ((beat % 4) + 4) % 4,
  };
}

export function createSyntheticFeatures() {
  const tail = TAIL_HITS;
  return {
    kind: 'synthetic',
    offset: 0,
    rate: 1,
    duration: SONG.duration,
    toSong: (tf) => tf,
    toFile: (t) => t,
    sample(t) {
      const g = grid(t);
      const drums = drumPresence(t);
      const energy = clamp(sampleArray(REF_SMOOTH, REF_RATE, t));
      const since = g.beatPhase * BEAT; // time since the last beat
      const isKick = g.beatInBar === 0 || g.beatInBar === 2;
      let kick = isKick ? Math.exp(-since / 0.16) * drums : 0;
      let snare = !isKick ? Math.exp(-since / 0.2) * drums : 0;
      const eighth = (t / (BEAT / 2)) % 1;
      const hat = Math.exp(-(eighth * BEAT) / 2 / 0.05) * drums * 0.6;
      for (const h of tail) {
        if (t >= h && t < h + 1.2) kick = Math.max(kick, Math.exp(-(t - h) / 0.3) * 0.8);
      }
      // the song opens with a single soft hit
      if (t < 1) kick = Math.max(kick, Math.exp(-t / 0.35) * 0.6);
      const bass = clamp(energy * (0.55 + 0.45 * kick));
      return {
        t,
        energy,
        kick,
        snare,
        hat,
        bass,
        mid: energy,
        high: clamp(energy * (0.5 + 0.5 * hat)),
        drums,
        ...g,
      };
    },
  };
}

/**
 * Wrap an analysis produced by analyze.js. `analysis.offset` is the time (in
 * the audio file) where bar 0 of the song lands.
 */
export function createAnalysedFeatures(analysis) {
  const { fps, offset } = analysis;
  const rate = analysis.rate || 1;
  const get = (name, tf) => sampleArray(analysis[name], fps, tf);
  return {
    kind: 'analysed',
    offset,
    rate,
    duration: (analysis.duration - offset) * rate,
    /** file time (s) → song time (s) */
    toSong: (tf) => (tf - offset) * rate,
    /** song time (s) → file time (s) */
    toFile: (t) => t / rate + offset,
    sample(t) {
      const tf = t / rate + offset;
      const g = grid(t);
      const drums = drumPresence(t);
      // Blend the measured values with the arrangement so that visual cues
      // stay musical even if a detector misses a hit.
      const kick = clamp(get('kick', tf));
      const snare = clamp(get('snare', tf));
      const hat = clamp(get('hat', tf));
      return {
        t,
        energy: clamp(get('energy', tf)),
        kick,
        snare,
        hat,
        bass: clamp(get('bass', tf)),
        mid: clamp(get('mid', tf)),
        high: clamp(get('high', tf)),
        drums,
        ...g,
      };
    },
  };
}

/**
 * Analyses embedded in a bundled page store each feature as 8-bit samples in
 * base64 (see tools/build-bundle.mjs); expand them back to Float32Arrays.
 */
export function unpackAnalysis(packed) {
  const out = { ...packed };
  delete out.packed;
  for (const [name, b64] of Object.entries(packed.packed || {})) {
    const bin = atob(b64);
    const arr = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i) / 255;
    out[name] = arr;
  }
  return out;
}
