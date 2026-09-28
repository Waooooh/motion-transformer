#!/usr/bin/env node
// Render the film to MP4, frame by frame, in headless Chromium.
//
//   node tools/render.mjs --audio audio/hong-kong-story.mp3            # 1080p30 with music
//   node tools/render.mjs --w 1280 --fps 30 --workers 2                # silent 720p preview
//   node tools/render.mjs --from 36 --to 48 --out out/drop.mp4         # a section (song seconds)
//
// Options
//   --audio <file>   recording of the song; it is analysed, aligned and muxed in
//   --w <px>         width (height = 9/16), default 1920
//   --fps <n>        default 30
//   --workers <n>    parallel browser processes, default 2
//   --from/--to      time range in seconds of the *output* (file time), default whole song
//   --crf <n>        x264 quality (lower = better), default 18
//   --angle <name>   Chromium ANGLE backend: swiftshader (CPU, default) | default | vulkan | gl | metal
//   --look <name>    deep (default) | neon — see src/core/theme.js
//   --no-build       reuse dist/ as is
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, parseArgs, buildApp, serveDir, launchBrowser, openFilm, findFfmpeg, dataUrlToBuffer } from './lib.mjs';
import { analyzeFile } from './analyze.mjs';
import { SONG } from '../src/core/song.js';

const args = parseArgs();
const width = +(args.w || 1920);
const fps = +(args.fps || 30);
const workers = Math.max(1, +(args.workers || 2));
const crf = +(args.crf || 20);
const out = path.resolve(ROOT, args.out || (args.audio ? 'out/attention.mp4' : 'out/attention-silent.mp4'));
const tmp = path.resolve(ROOT, 'out/segments');
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
const ffmpeg = findFfmpeg();

let analysis = null;
let fileDuration = SONG.duration;
if (args.audio) {
  console.log(`analysing ${args.audio} …`);
  analysis = analyzeFile(path.resolve(args.audio));
  fileDuration = analysis.duration;
  console.log(
    `  ${analysis.bpm.toFixed(2)} BPM, offset ${analysis.offset.toFixed(3)} s, rate ${analysis.rate.toFixed(4)}, ` +
      `match ${(analysis.alignment.score * 100).toFixed(0)}%`,
  );
}
const toSong = (tf) => (analysis ? (tf - analysis.offset) * (analysis.rate || 1) : tf);
const from = +(args.from || 0);
const to = Math.min(+(args.to || fileDuration), fileDuration);
const first = Math.round(from * fps);
const last = Math.round(to * fps); // exclusive
const total = last - first;
console.log(`${total} frames @ ${width}×${Math.round((width * 9) / 16)} ${fps} fps, ${workers} worker(s) → ${path.relative(ROOT, out)}`);

const built = args['no-build'] ? path.join(ROOT, 'dist') : await buildApp();
const dist = path.join(ROOT, 'out', 'render-dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(built, dist, { recursive: true });
const srv = await serveDir(dist);

let done = 0;
const t0 = Date.now();
const progress = () => {
  const el = (Date.now() - t0) / 1000;
  const rate = done / el;
  const eta = (total - done) / Math.max(rate, 1e-6);
  process.stdout.write(`\r  ${done}/${total} frames  ${rate.toFixed(2)} fps  ETA ${Math.floor(eta / 60)}m${String(Math.round(eta % 60)).padStart(2, '0')}s   `);
};

const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms))]);

async function worker(k, a, b) {
  const seg = path.join(tmp, `seg_${String(k).padStart(2, '0')}.mp4`);
  const enc = spawn(
    ffmpeg,
    ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-r', String(fps), seg],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  let encError = null;
  enc.stdin.on('error', (e) => (encError = e));
  // A long software-GL session can occasionally wedge; every frame has a
  // deadline and a stuck browser is replaced, then the frame is retried.
  let browser = null;
  let page = null;
  const open = async () => {
    if (browser) await browser.close().catch(() => {});
    browser = await launchBrowser({ angle: args.angle });
    ({ page } = await openFilm(browser, srv.url, { width, analysis, look: args.look }));
  };
  await open();
  for (let i = a; i < b; i++) {
    const tSong = toSong(i / fps);
    let res = null;
    for (let attempt = 0; !res; attempt++) {
      try {
        res = await withTimeout(page.evaluate(([t]) => window.__mt.frame(t, 'image/jpeg', 0.94), [tSong]), 90_000, `frame ${i}`);
      } catch (e) {
        if (attempt >= 3) throw e;
        process.stdout.write(`\n  worker ${k}: ${e.message.split('\n')[0]} — restarting browser\n`);
        await open();
      }
    }
    if (encError) throw encError;
    const buf = dataUrlToBuffer(res.url);
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
    done++;
    if (done % 10 === 0) progress();
  }
  enc.stdin.end();
  await new Promise((r) => enc.on('close', r));
  await browser.close();
  return seg;
}

const per = Math.ceil(total / workers);
const jobs = [];
for (let k = 0; k < workers; k++) {
  const a = first + k * per;
  const b = Math.min(last, a + per);
  if (a < b) jobs.push(worker(k, a, b));
}
const segs = await Promise.all(jobs);
progress();
process.stdout.write('\n');
srv.close();

// join segments, then add the music
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
const video = analysis ? path.join(tmp, 'video.mp4') : out;
let r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', video], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('concat failed');
if (analysis) {
  r = spawnSync(
    ffmpeg,
    ['-y', '-v', 'error', '-i', video, '-ss', String(from), '-t', String(to - from), '-i', path.resolve(args.audio), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error('mux failed');
}
console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min → ${path.relative(ROOT, out)}`);
