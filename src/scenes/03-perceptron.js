// 0:12–0:18 · 1958, the perceptron.
// One neuron becomes a layer; its connections fold into a weight matrix W,
// and y = σ(Wx + b) is computed row by row.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, HeatmapPanel, glowSprite, HEX, PALETTE } from '../core/materials.js';
import { LabelAtlas, LabelField } from '../core/labels.js';
import { circlePts, bracketPts, linePts, V } from '../core/shapes.js';
import { Caption, YearBadge } from '../core/hud.js';
import { CAPTIONS, MILESTONES } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, fmt, Rng } from '../core/math.js';

const X = [0.42, -1.37, 0.08, 2.71, -0.66];
const ROWS = 6;
const COLS = 5;

export default function perceptronScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 500);
  const hud = new THREE.Scene();
  const rng = new Rng(303);

  const Wm = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) Wm.push(+(rng.float(-1, 1)).toFixed(1));
  const Y = [];
  for (let r = 0; r < ROWS; r++) {
    let s = 0.1;
    for (let c = 0; c < COLS; c++) s += Wm[r * COLS + c] * X[c];
    Y.push(1 / (1 + Math.exp(-s)));
  }

  const vx = -3.05;
  const vy = -0.25;
  const gap = 0.62;
  const slotY = (i) => vy + (2 - i) * gap;
  const ox = 4.1;
  const ogap = 0.56;
  const outY = (i) => vy + (2.5 - i) * ogap;
  const mx = 0.45;
  const mw = 2.7;
  const mh = 3.1;

  // input vector
  const entries = X.map((v, i) => {
    const m = textMesh({ text: fmt(v, 2), family: FAMILY.mono, size: 220, color: '#f2feff', glow: 22, glowColor: HEX.cyan, pxPerUnit: 200 });
    m.scale.setScalar(0.3);
    scene.add(m);
    return m;
  });

  // polylines: 0-29 bipartite connections, 30-35 output rings, 36-41 row→neuron links, 42-43 vector brackets, 44-45 matrix brackets
  const polys = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const w = Wm[r * COLS + c];
      polys.push({
        points: linePts(V(vx + 0.62, slotY(c), 0), V(ox - 0.3, outY(r), 0), 16),
        color: w >= 0 ? PALETTE.pink : PALETTE.cyan,
        width: 0.5 + Math.abs(w) * 1.6,
      });
    }
  }
  for (let r = 0; r < ROWS; r++) polys.push({ points: circlePts(ox, outY(r), 0.24, 48), color: PALETTE.pink, width: 1.8 });
  for (let r = 0; r < ROWS; r++) {
    const ry = vy + mh / 2 - (r + 0.5) * (mh / ROWS);
    polys.push({ points: linePts(V(mx + mw / 2 + 0.2, ry, 0), V(ox - 0.28, outY(r), 0), 16), color: PALETTE.amber, width: 1.6 });
  }
  polys.push({ points: bracketPts(vx - 0.62, vy, 5 * gap + 0.1, -1, 0.16), color: PALETTE.cyan, width: 1.6 });
  polys.push({ points: bracketPts(vx + 0.62, vy, 5 * gap + 0.1, 1, 0.16), color: PALETTE.cyan, width: 1.6 });
  polys.push({ points: bracketPts(mx - mw / 2 - 0.12, vy, mh + 0.2, -1, 0.18), color: PALETTE.violet, width: 1.8 });
  polys.push({ points: bracketPts(mx + mw / 2 + 0.12, vy, mh + 0.2, 1, 0.18), color: PALETTE.violet, width: 1.8 });
  const lines = new GlowLines(polys, { width: 2, core: 0.9, pulseWidth: 0.08 });
  scene.add(lines.object);

  // weight matrix
  const panel = new HeatmapPanel({ rows: ROWS, cols: COLS, width: mw, height: mh, map: 'div', gap: 0.12, radius: 0.1, intensity: 1.25 });
  panel.setValues(Wm.map((w) => (w + 1) / 2));
  panel.mesh.position.set(mx, vy, -0.02);
  scene.add(panel.mesh);
  const strings = [...new Set(Wm.map((w) => fmt(w, 1)))];
  const atlas = new LabelAtlas(strings, { family: FAMILY.mono, size: 56, color: '#ffffff' });
  const cellText = new LabelField(atlas, ROWS * COLS, { billboard: false });
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      cellText.setLabel(i, atlas.index.get(fmt(Wm[i], 1)));
    }
  }
  scene.add(cellText.object);

  const glows = [];
  for (let r = 0; r < ROWS; r++) {
    const g = glowSprite(PALETTE.magenta, 1.3, 0);
    g.position.set(ox, outY(r), -0.02);
    scene.add(g);
    glows.push(g);
  }
  const yLabels = Y.map((y, r) => {
    const m = textMesh({ text: y.toFixed(2), family: FAMILY.mono, size: 64, color: '#ffe9a8', glow: 8, glowColor: HEX.amber, pxPerUnit: 260, anchor: 'left' });
    m.position.set(ox + 0.42, outY(r), 0);
    scene.add(m);
    return m;
  });

  const wLabel = textMesh({ text: 'W', family: FAMILY.math, italic: true, weight: 600, size: 120, color: '#e9dcff', glow: 10, glowColor: HEX.violet, pxPerUnit: 300 });
  wLabel.position.set(mx, vy + mh / 2 + 0.38, 0);
  scene.add(wLabel);
  const formula = textMesh({ text: 'y = σ(Wx + b)', family: FAMILY.math, italic: true, size: 96, color: '#ffffff', glow: 12, glowColor: HEX.pink, pxPerUnit: 300 });
  formula.position.set(2.75, vy + mh / 2 + 0.42, 0);
  scene.add(formula);

  const badge = new YearBadge(MILESTONES.perceptron);
  hud.add(badge.group);
  const cap = new Caption(CAPTIONS.perceptron);
  hud.add(cap.group);

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      const e = f.energy;
      const kc = ease.inOutCubic(clamp(lt / 6));
      camera.position.set(lerp(0.55, 1.5, kc), lerp(-0.25, 0.15, kc), lerp(10.45, 10.1, kc));
      camera.lookAt(lerp(0.55, 0.7, kc), -0.3, 0);

      // input vector slides left from the neuron scene's position
      const kv = ease.inOutCubic(clamp(lt / 0.9));
      entries.forEach((m, i) => {
        m.position.set(lerp(-1.75, vx, kv), slotY(i), 0);
        const pulse = [0, 1, 2, 3, 4, 5].reduce((a, r) => a + hit(lt, 2.3 + r * 0.5, 0.25), 0);
        m.material.color.setScalar(1.15 + pulse * 0.5);
      });
      lines.set(42, 0, 1, 1, -1);
      lines.set(43, 0, 1, 1, -1);

      // bipartite connections grow, then fold into the matrix
      const grow = ease.outCubic(clamp((lt - 0.2) / 0.9));
      const fold = smoothstep(1.3, 2.1, lt);
      for (let i = 0; i < 30; i++) lines.set(i, 0, grow, (0.45 + 0.3 * e) * (1 - fold), -1);
      const reveal = ease.inOutCubic(clamp((lt - 1.2) / 1.0));
      panel.uniforms.uReveal.value = reveal;
      lines.set(44, 0, ease.outCubic(clamp((lt - 1.2) / 0.5)), 1, -1);
      lines.set(45, 0, ease.outCubic(clamp((lt - 1.2) / 0.5)), 1, -1);

      // rows of W · x light the output neurons one by one
      let row = -10;
      for (let r = 0; r < ROWS; r++) {
        const t0 = 2.3 + r * 0.5;
        const on = smoothstep(0.1, 0.5, lt - (0.4 + r * 0.06));
        lines.set(30 + r, 0, ease.outCubic(on), 1 + hit(lt, t0 + 0.3, 0.3) * 2, -1);
        const pp = clamp((lt - t0) / 0.3);
        lines.set(36 + r, 0, lt > t0 ? 1 : 0, lt > t0 ? 0.6 + hit(lt, t0 + 0.3, 0.4) * 1.5 : 0, pp > 0 && pp < 1 ? pp : -1);
        if (lt >= t0 && lt < t0 + 0.5) row = r;
        glows[r].material.opacity = lt > t0 + 0.3 ? 0.35 + hit(lt, t0 + 0.3, 0.35) * 1.2 : 0;
        yLabels[r].material.opacity = smoothstep(t0 + 0.25, t0 + 0.45, lt);
      }
      panel.uniforms.uHighlightRow.value = row;

      // learning: weights shimmer as they update
      const learn = smoothstep(4.9, 5.4, lt);
      if (learn > 0) {
        const step = Math.floor(lt * 8);
        const vals = Wm.map((w, i) => {
          const j = Math.sin(step * 12.9898 + i * 78.233) * 43758.5453;
          const d = (j - Math.floor(j) - 0.5) * 0.25 * learn;
          return (Math.max(-1, Math.min(1, w + d)) + 1) / 2;
        });
        panel.setValues(vals);
      }
      lines.commit();

      // numbers inside the matrix cells
      const ch = mh / ROWS;
      const cw = mw / COLS;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          const vis = clamp(reveal * ROWS * COLS - i);
          const hl = r === row ? 1.6 : 1;
          cellText.set(i, mx - mw / 2 + (c + 0.5) * cw, vy + mh / 2 - (r + 0.5) * ch, 0.01, 0.2, vis, 1.3 * hl, 1.3 * hl, 1.3 * hl);
        }
      }
      cellText.commit();

      wLabel.material.opacity = smoothstep(1.4, 1.9, lt);
      formula.material.opacity = smoothstep(1.9, 2.4, lt);
      fx.aberration += hit(lt, 1.25, 0.3) * 0.5;
      badge.update(lt, 0.2, 5.85);
      cap.update(lt, 2.0, 5.85);
    },
  };
}
