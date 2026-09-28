// 0:18–0:24 · 1986, backpropagation. The intro steps up a level and the
// synthwave world rises for the first time: a deep network floats over the
// grid; a signal runs forward, the error flows back and the weights change.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, GlowPoints, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { linePts, V } from '../core/shapes.js';
import { Caption, YearBadge } from '../core/hud.js';
import { CAPTIONS, MILESTONES } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, Rng } from '../core/math.js';

const LAYERS = [4, 7, 7, 7, 3];

export default function deepnetScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 2000);
  const hud = new THREE.Scene();
  const rng = new Rng(404);
  const env = new SynthwaveEnv({ seed: 4 });
  scene.add(env.group);

  const net = new THREE.Group();
  net.position.set(0, 4.3, 2.5);
  scene.add(net);

  const nodes = [];
  LAYERS.forEach((n, l) => {
    const x = (l - (LAYERS.length - 1) / 2) * 2.7;
    for (let i = 0; i < n; i++) {
      const y = (i - (n - 1) / 2) * 0.78;
      const z = -Math.abs(y) * 0.35 + (l % 2 ? 0.3 : -0.3);
      nodes.push({ l, i, p: V(x, y, z) });
    }
  });
  const byLayer = LAYERS.map((_, l) => nodes.filter((n) => n.l === l));

  const fwdPolys = [];
  const edges = [];
  for (let l = 0; l < LAYERS.length - 1; l++) {
    for (const a of byLayer[l]) {
      for (const b of byLayer[l + 1]) {
        const w = rng.float(-1, 1);
        edges.push({ l, a, b, w });
        fwdPolys.push({ points: linePts(a.p, b.p, 10), color: w >= 0 ? PALETTE.pink : PALETTE.violet, width: 0.6 + Math.abs(w) * 1.4 });
      }
    }
  }
  const fwd = new GlowLines(fwdPolys, { width: 2.4, core: 0.7, pulseWidth: 0.12 });
  const bwd = new GlowLines(
    fwdPolys.map((p) => ({ ...p, color: PALETTE.cyan })),
    { width: 2.4, core: 0.7, pulseWidth: 0.12 },
  );
  net.add(fwd.object, bwd.object);

  const pts = new GlowPoints(nodes.length, { core: 1.4, minSize: 2 });
  net.add(pts.object);

  const lblF = textMesh({ text: 'forward  →', family: FAMILY.mono, size: 64, color: '#ffc4f1', glow: 10, glowColor: HEX.pink, pxPerUnit: 180 });
  lblF.position.set(0, 3.05, 0);
  net.add(lblF);
  const lblB = textMesh({ text: '←  ∂L/∂w', family: FAMILY.mono, size: 64, color: '#bff6ff', glow: 10, glowColor: HEX.cyan, pxPerUnit: 180 });
  lblB.position.set(4.2, -2.9, 0);
  net.add(lblB);
  const loss = textMesh({ text: 'loss 0.82', family: FAMILY.mono, size: 64, color: '#ffe0a3', glow: 12, glowColor: HEX.orange, pxPerUnit: 200, anchor: 'left' });
  loss.position.set(6.1, 0, 0);
  net.add(loss);

  const badge = new YearBadge(MILESTONES.deepnet);
  hud.add(badge.group);
  const cap = new Caption(CAPTIONS.deepnet);
  hud.add(cap.group);

  const layerColor = [PALETTE.cyan, PALETTE.violet, PALETTE.pink, PALETTE.violet, PALETTE.amber];
  const F0 = 0.55;
  const FD = 0.5; // forward: per-layer hop
  const B0 = 3.05;
  const BD = 0.42;

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      fwd.setResolution(width, height);
      bwd.setResolution(width, height);
      const e = f.energy;
      const reveal = smoothstep(0.0, 1.6, lt);
      env.update({
        t: lt + 18,
        scroll: lt * 7,
        fade: 1 - reveal,
        sunY: lerp(-38, 22, ease.outCubic(clamp(lt / 4.5))),
        sunIntensity: 1.5,
        glow: 0.25 + 0.3 * reveal,
        mountain: 11,
        starAlpha: reveal,
        gridIntensity: 0.85,
      });
      env.setCamera(camera, height);
      pts.setCamera(camera, height);

      const kc = ease.inOutCubic(clamp(lt / 6));
      camera.position.set(lerp(-1.2, 1.2, kc), lerp(5.6, 3.2, kc), lerp(15.5, 13.2, kc));
      camera.lookAt(lerp(-0.4, 0.4, kc), lerp(4.6, 3.9, kc), 0);
      net.rotation.y = lerp(-0.18, 0.14, kc);
      net.rotation.x = Math.sin(lt * 0.5) * 0.03;

      // forward wave (pink) then backward wave (cyan)
      edges.forEach((ed, i) => {
        const pf = (lt - (F0 + ed.l * FD)) / FD;
        const pb = (lt - (B0 + (LAYERS.length - 2 - ed.l) * BD)) / BD;
        const learned = smoothstep(B0 + (LAYERS.length - 2 - ed.l) * BD, B0 + (LAYERS.length - 1 - ed.l) * BD, lt);
        const base = (0.4 + 0.25 * e) * reveal;
        fwd.set(i, 0, 1, base * (1 - learned * 0.5) + (pf > 0 && pf < 1 ? 0.9 : 0), pf > 0 && pf < 1 ? pf : -1);
        bwd.set(i, 0, 1, learned * base * 0.9 + (pb > 0 && pb < 1 ? 0.9 : 0), pb > 0 && pb < 1 ? 1 - pb : -1);
      });
      fwd.commit();
      bwd.commit();

      nodes.forEach((n, i) => {
        const fa = hit(lt, F0 + n.l * FD, 0.35);
        const ba = hit(lt, B0 + (LAYERS.length - 1 - n.l) * BD, 0.35);
        const c = layerColor[n.l];
        const b = 0.9 + fa * 2.5;
        const r = lerp(c.r * b, 0.3, ba * 0.6) + ba * 0.2;
        const g = lerp(c.g * b, 1.2, ba * 0.6);
        const bl = lerp(c.b * b, 1.4, ba * 0.6);
        pts.setPoint(i, n.p.x, n.p.y, n.p.z, r * 1.3, g * 1.3, bl * 1.3, 0.6 + fa * 0.35 + ba * 0.25, reveal);
      });
      pts.commit();

      lblF.material.opacity = smoothstep(0.6, 1.0, lt) * (1 - smoothstep(2.9, 3.2, lt));
      lblB.material.opacity = smoothstep(3.0, 3.4, lt) * (1 - smoothstep(5.6, 6.0, lt));
      const err = hit(lt, F0 + (LAYERS.length - 1) * FD, 0.6);
      loss.material.opacity = smoothstep(2.4, 2.7, lt) * (1 - smoothstep(5.2, 5.6, lt));
      loss.material.color.setScalar(1 + err * 2);
      fx.aberration += err * 0.6;
      fx.flash += hit(lt, 0.0, 0.25) * 0.12;

      badge.update(lt, 0.2, 5.85);
      cap.update(lt, 1.8, 5.85);
    },
  };
}
