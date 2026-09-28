#!/usr/bin/env node
// Build the player as one self-contained HTML page for claude.ai Artifacts:
// everything inlined except three.js, which loads from jsDelivr through an
// import map; the document wrapper is stripped (the host adds its own).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const { build } = await import('vite');
await build({ root: ROOT, mode: 'artifact', logLevel: 'warn', configFile: path.join(ROOT, 'vite.config.js') });
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/three/package.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'dist-artifact/index.html'), 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] || '<title>ATTENTION</title>';
const styles = pick(/<style[\s\S]*?<\/style>/g).join('\n');
const scripts = pick(/<script type="module"[\s\S]*?<\/script>/g).join('\n');
const body = html.split(/<body[^>]*>/)[1].split('</body>')[0].replace(/<script type="module"[\s\S]*?<\/script>/g, '');
const importmap = `<script type="importmap">${JSON.stringify({ imports: { three: `https://cdn.jsdelivr.net/npm/three@${pkg.version}/build/three.module.min.js` } })}</script>`;
const out = [title, importmap, styles, body.trim(), scripts].join('\n');
const file = path.join(ROOT, 'dist-artifact/attention.html');
fs.writeFileSync(file, out);
console.log(`${path.relative(ROOT, file)}  ${(out.length / 1024).toFixed(0)} KB (three@${pkg.version} from jsDelivr)`);
