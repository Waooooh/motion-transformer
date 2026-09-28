#!/usr/bin/env node
// Analyse a recording of the song (any format ffmpeg reads) and write the
// feature file the renderer uses.
//   node tools/analyze.mjs audio/hong-kong-story.mp3 [--out out/analysis.json]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, parseArgs, findFfmpeg } from './lib.mjs';
import { analyzePCM } from '../src/core/analyze.js';

export function decodeAudio(file, sampleRate = 44100) {
  const ff = findFfmpeg();
  const r = spawnSync(ff, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed to decode ${file}: ${r.stderr}`);
  const buf = r.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

export function analyzeFile(file) {
  const pcm = decodeAudio(file);
  return analyzePCM(pcm, 44100);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const file = process.argv[2];
  if (!file || file.startsWith('--')) {
    console.error('usage: node tools/analyze.mjs <audio file> [--out out/analysis.json]');
    process.exit(1);
  }
  const t0 = Date.now();
  const a = analyzeFile(file);
  const out = path.resolve(ROOT, args.out || 'out/analysis.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(a));
  console.log(
    `${path.basename(file)}: ${a.duration.toFixed(2)} s, ${a.bpm.toFixed(2)} BPM (rate ${a.rate.toFixed(4)}), ` +
      `offset ${a.offset.toFixed(3)} s, match ${(a.alignment.score * 100).toFixed(0)}% ` +
      `(coarse ${a.alignment.coarse.toFixed(2)} s), onsets kick ${a.onsets.kick} snare ${a.onsets.snare} hat ${a.onsets.hat} ` +
      `— ${Date.now() - t0} ms → ${path.relative(ROOT, out)}`,
  );
}
