// 2:48–3:00 · The peak. A sphere woven from attention arcs spins over the
// racing grid; the title is slammed out one word per bar —
// ATTENTION / IS ALL / YOU / NEED — and everything collapses into a point.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, GlowPoints, glowSprite, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { setOpacity } from '../core/hud.js';
import { PEAK_WORDS } from '../copy.js';
import { chromeText } from './07-title.js';
import { clamp, ease, lerp, smoothstep, hit, Rng } from '../core/math.js';

const NODES = 520;
const ARCS = 1100;
const RAYS = 90;
const RS = 6.2;

export default function peakScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 3000);
  const overlay = new THREE.Scene();
  const hud = new THREE.Scene();
  const rng = new Rng(56);
  const env = new SynthwaveEnv({ seed: 56 });
  scene.add(env.group);

  const orb = new THREE.Group();
  orb.position.set(0, 8.5, -8);
  scene.add(orb);
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODES; i++) {
    const y = 1 - (i / (NODES - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    nodes.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(RS));
  }
  const pts = new GlowPoints(NODES, { core: 1.4, minSize: 2 });
  orb.add(pts.object);

  const palette = [PALETTE.pink, PALETTE.cyan, PALETTE.violet, PALETTE.amber];
  const polys = [];
  const meta = [];
  for (let a = 0; a < ARCS; a++) {
    const i = rng.int(0, NODES - 1);
    const j = rng.int(0, NODES - 1);
    if (i === j) continue;
    const A = nodes[i];
    const B = nodes[j];
    const through = rng.next() < 0.25;
    const pts2 = [];
    for (let s = 0; s <= 20; s++) {
      const t = s / 20;
      const p = A.clone().lerp(B, t);
      if (!through) p.setLength(RS * (1 + Math.sin(Math.PI * t) * 0.25 * (A.distanceTo(B) / (2 * RS))));
      pts2.push(p);
    }
    const lat = (A.y + B.y) / 2 / RS;
    polys.push({ points: pts2, color: palette[a % 4], width: through ? 0.03 : 0.05 });
    meta.push({ lat, g: rng.int(0, 7) });
  }
  const arcs = new GlowLines(polys, { width: 1, perspective: true, core: 0.8, pulseWidth: 0.07 });
  orb.add(arcs.object);
  const core = glowSprite(new THREE.Color(1, 0.7, 0.95), 9, 0.8);
  orb.add(core);

  // radial light rays burst on every kick
  const rayPolys = [];
  for (let i = 0; i < RAYS; i++) {
    const d = new THREE.Vector3(rng.gauss(), rng.gauss(), rng.gauss()).normalize();
    rayPolys.push({ points: [d.clone().multiplyScalar(RS * 1.05), d.clone().multiplyScalar(RS * rng.float(2.2, 4.5))], color: palette[i % 4], width: rng.float(0.04, 0.12) });
  }
  const rays = new GlowLines(rayPolys, { width: 1, perspective: true, core: 1 });
  orb.add(rays.object);

  const words = PEAK_WORDS.map((w) => {
    const g = new THREE.Group();
    const en = chromeText(w.en, 230, { letterSpacing: 24 });
    const zh = textMesh({ text: w.zh, family: FAMILY.zh, weight: 900, size: 76 * 2, letterSpacing: 40, color: '#ffffff', stroke: 10, strokeColor: '#2a0038', glow: 24, glowColor: '#ff2a9d', pxPerUnit: 2, depthTest: false });
    zh.position.y = -300;
    g.add(en, zh);
    overlay.add(g);
    return g;
  });

  return {
    scene,
    camera,
    overlay,
    hud,
    update({ lt, f, fx, width, height }) {
      arcs.setResolution(width, height);
      rays.setResolution(width, height);
      const collapse = ease.inExpo(clamp((lt - 10.6) / 1.4));
      env.update({ t: lt + 168, scroll: 2200 + lt * 55, sunY: 36, sunScale: 1.35, sunIntensity: 2.0 + f.kick * 0.6, sunHalo: 1.3, glow: 1.0, pulse: f.kick * 1.4, mountain: 18, gridIntensity: 1.5 });
      env.setCamera(camera, height);
      pts.setCamera(camera, height);

      const shake = f.kick * 0.12;
      camera.position.set(Math.sin(lt * 0.6) * 2.5 + shake * Math.sin(lt * 90), 3.0 + shake * Math.cos(lt * 77), 13 - collapse * 2);
      camera.lookAt(0, 7.2, -8);
      camera.rotation.z = Math.sin(lt * 0.8) * 0.05;

      orb.rotation.y = lt * 0.5 + f.kick * 0.05;
      orb.rotation.x = Math.sin(lt * 0.3) * 0.3;
      const s = (1 + f.kick * 0.06) * (1 - collapse);
      orb.scale.setScalar(Math.max(0.001, s));

      const beat = Math.floor(lt / 0.75);
      const bp = lt / 0.75 - beat;
      for (let i = 0; i < NODES; i++) {
        const n = nodes[i];
        const band = Math.exp(-Math.pow((n.y / RS - (1 - bp * 2)) * 3, 2));
        const c = palette[i % 4];
        const b = 1.2 + band * 2 + f.kick;
        pts.setPoint(i, n.x, n.y, n.z, c.r * b, c.g * b, c.b * b, 0.14 + band * 0.12, 1);
      }
      pts.commit();
      for (let a = 0; a < meta.length; a++) {
        const m = meta[a];
        const band = Math.exp(-Math.pow((m.lat - (1 - bp * 2)) * 2.5, 2));
        const fire = m.g === beat % 8 ? Math.exp(-bp * 2) : 0;
        arcs.set(a, 0, 1, 0.25 + band * 1.2 + fire * 1.5 + f.kick * 0.4, fire > 0.2 ? bp : -1);
      }
      arcs.commit();
      for (let i = 0; i < RAYS; i++) {
        const r = ease.outExpo(clamp(bp / 0.4));
        rays.set(i, 0, r, f.kick * 1.8 * (1 - bp), -1);
      }
      rays.commit();
      core.material.opacity = 0.7 + f.kick * 0.5 + collapse * 2;
      core.scale.setScalar((9 + f.kick * 4) * (1 - collapse * 0.7));

      // one word per bar, pumping on every beat
      const bar = Math.floor(lt / 3);
      words.forEach((g, i) => {
        const on = i === bar;
        g.visible = on;
        if (!on) return;
        const tl = lt - i * 3;
        const slam = ease.outExpo(clamp(tl / 0.25));
        const pump = 1 + hit(tl % 0.75, 0, 0.18) * 0.05;
        g.scale.setScalar(lerp(1.7, 1, slam) * pump * (i === 3 ? 1 + collapse * 1.8 : 1));
        setOpacity(g, clamp(tl / 0.05) * (i === 3 ? 1 - collapse : 1));
        g.position.y = 40;
      });

      fx.flash += hit(lt % 3, 0, 0.16) * 0.5 + Math.pow(collapse, 2) * 1.1;
      fx.aberration += hit(lt % 3, 0, 0.35) * 2.5 + f.snare * 0.6 + collapse * 2;
      fx.bloom += 0.15 + f.kick * 0.25;
      fx.zoom = 1 + hit(lt % 3, 0, 0.35) * 0.05 + f.kick * 0.012;
      fx.glitch += hit(lt % 3, 0, 0.15) * 0.4;
    },
  };
}
