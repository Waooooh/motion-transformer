#!/usr/bin/env node
// Render individual frames to PNG for review.
//   node tools/stills.mjs --times 0.5,12,36.2 [--w 1280] [--out out/stills] [--no-build]
//   node tools/stills.mjs --from 0 --to 36 --every 1.5
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs, buildApp, serveDir, launchBrowser, openFilm, dataUrlToBuffer } from './lib.mjs';

const args = parseArgs();
const width = +(args.w || 1280);
const outDir = path.resolve(ROOT, args.out || 'out/stills');
fs.mkdirSync(outDir, { recursive: true });
let times = [];
if (args.times) times = String(args.times).split(',').map(Number);
else {
  const from = +(args.from || 0);
  const to = +(args.to || 6);
  const every = +(args.every || 1);
  for (let t = from; t <= to + 1e-6; t += every) times.push(+t.toFixed(3));
}

const dist = args['no-build'] ? path.join(ROOT, 'dist') : await buildApp();
const srv = await serveDir(dist);
const browser = await launchBrowser();
const { page } = await openFilm(browser, srv.url, { width });
for (const t of times) {
  const t0 = Date.now();
  const res = await page.evaluate((tt) => window.__mt.frame(tt, 'image/png'), t);
  const file = path.join(outDir, `t${t.toFixed(2).padStart(7, '0')}.png`);
  fs.writeFileSync(file, dataUrlToBuffer(res.url));
  console.log(`${file}  [${res.active.join(', ')}]  ${Date.now() - t0} ms`);
}
await browser.close();
srv.close();
