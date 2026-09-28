// Shared helpers for the offline tools: build the app, serve it, drive it in
// headless Chromium, and find ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export async function buildApp() {
  const { build } = await import('vite');
  await build({ root: ROOT, logLevel: 'warn', configFile: path.join(ROOT, 'vite.config.js') });
  return path.join(ROOT, 'dist');
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export function serveDir(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(dir, u === '/' ? 'index.html' : u);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() });
    });
  });
}

export async function launchBrowser({ angle = process.env.MT_ANGLE || 'swiftshader' } = {}) {
  const { chromium } = await import('playwright');
  const args = ['--ignore-gpu-blocklist', '--enable-webgl', '--disable-background-timer-throttling'];
  if (angle === 'swiftshader') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  else if (angle !== 'default') args.push(`--use-angle=${angle}`, '--enable-gpu');
  const opts = { args };
  if (process.env.MT_CHROMIUM) opts.executablePath = process.env.MT_CHROMIUM;
  return chromium.launch(opts);
}

export async function openFilm(browser, url, { width = 1920, analysis = null, look = null } = {}) {
  const height = Math.round((width * 9) / 16);
  const page = await browser.newPage({ viewport: { width: Math.min(width, 1920), height: Math.min(height, 1080) } });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  await page.goto(`${url}?mode=render${look ? `&look=${encodeURIComponent(look)}` : ''}`);
  await page.waitForFunction(() => window.__mt && window.__mt.ready, null, { timeout: 60000 });
  const info = await page.evaluate((o) => window.__mt.init(o), { w: width, analysis });
  return { page, info };
}

export function findFfmpeg() {
  const candidates = [process.env.FFMPEG_PATH];
  try {
    candidates.push(spawnSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).stdout?.toString().trim());
  } catch {}
  candidates.push('ffmpeg');
  for (const c of candidates) {
    if (!c) continue;
    const r = spawnSync(c, ['-version']);
    if (r.status === 0) return c;
  }
  throw new Error('ffmpeg not found — install ffmpeg or set FFMPEG_PATH');
}

export function dataUrlToBuffer(url) {
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}
