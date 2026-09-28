#!/usr/bin/env node
// Build ONE self-contained HTML file with a recording of the song embedded:
// the film, three.js, fonts, the audio and its pre-computed beat analysis.
// Open it in any modern desktop browser (double-click works) and press play.
//
//   node tools/build-bundle.mjs --audio audio/hong-kong-story.mp3 [--out out/attention.html]
//
// The output contains the music, so it is for your own use — it is written
// to out/ (git-ignored) and never committed.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib.mjs';
import { analyzeFile } from './analyze.mjs';

const args = parseArgs();
const audioArg = args.audio || process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!audioArg || audioArg === true) {
  console.error('usage: node tools/build-bundle.mjs --audio <file> [--out out/attention-hong-kong-story.html]');
  process.exit(1);
}
const audioPath = path.resolve(audioArg);
const out = path.resolve(ROOT, args.out || 'out/attention-hong-kong-story.html');
const MIME = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.webm': 'audio/webm' };
const mime = MIME[path.extname(audioPath).toLowerCase()] || 'audio/mpeg';

console.log(`analysing ${path.basename(audioPath)} …`);
const a = analyzeFile(audioPath);
console.log(`  ${a.bpm.toFixed(2)} BPM, offset ${a.offset.toFixed(3)} s, match ${(a.alignment.score * 100).toFixed(0)}%`);
const packed = {};
for (const k of ['energy', 'bass', 'mid', 'high', 'kick', 'snare', 'hat']) {
  const src = a[k];
  const u8 = Buffer.alloc(src.length);
  for (let i = 0; i < src.length; i++) u8[i] = Math.max(0, Math.min(255, Math.round(src[i] * 255)));
  packed[k] = u8.toString('base64');
}
const analysis = {
  version: a.version,
  fps: a.fps,
  duration: a.duration,
  offset: a.offset,
  rate: a.rate,
  bpm: a.bpm,
  alignment: a.alignment,
  onsets: a.onsets,
  packed,
};

console.log('building single-file player …');
const { build } = await import('vite');
await build({ root: ROOT, mode: 'single', logLevel: 'warn', configFile: path.join(ROOT, 'vite.config.js') });
let html = fs.readFileSync(path.join(ROOT, 'dist-single', 'index.html'), 'utf8');
const marker = '<script type="module"';
if (!html.includes(marker)) throw new Error('module script not found in dist-single/index.html');
const audio = fs.readFileSync(audioPath).toString('base64');
const inject =
  `<script>window.__MT_BUNDLE__=${JSON.stringify({ mime, analysis })};` +
  `window.__MT_BUNDLE__.audio="${audio}";</script>\n`;
html = html.replace(marker, () => inject + marker);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${path.relative(ROOT, out)}  ${(html.length / 1024 / 1024).toFixed(1)} MB`);
