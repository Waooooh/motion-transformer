// 0:24–0:30 · 1997, LSTM. Words become vectors and are read one at a time
// by a recurrent chain; the memory of early words fades before "it" arrives.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, HeatmapPanel, glowSprite, softPanel, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { roundRectPts, linePts, V } from '../core/shapes.js';
import { Caption, YearBadge } from '../core/hud.js';
import { CAPTIONS, MILESTONES, LSTM_WORDS } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit } from '../core/math.js';

export const CHAIN = {
  y: 3.5,
  wordY: 2.05,
  x: (i) => (i - 3.5) * 2.05,
};
const STEP0 = 0.45;
const STEP = 0.62;

export default function lstmScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 2000);
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 5 });
  scene.add(env.group);
  const n = LSTM_WORDS.length;

  const polys = [];
  for (let i = 0; i < n; i++) polys.push({ points: roundRectPts(CHAIN.x(i), CHAIN.y, 1.35, 0.95, 0.2), color: PALETTE.violet, width: 1.8 });
  for (let i = 0; i < n - 1; i++) {
    polys.push({ points: linePts(V(CHAIN.x(i) + 0.7, CHAIN.y, 0), V(CHAIN.x(i + 1) - 0.7, CHAIN.y, 0), 12), color: PALETTE.pink, width: 2 });
  }
  for (let i = 0; i < n; i++) {
    polys.push({ points: linePts(V(CHAIN.x(i), CHAIN.wordY + 0.32, 0), V(CHAIN.x(i), CHAIN.y - 0.5, 0), 8), color: PALETTE.cyan, width: 1.4 });
  }
  // a dashed "reach" from "it" back toward "animal" that never arrives
  polys.push({ points: linePts(V(CHAIN.x(7), CHAIN.y + 0.62, 0), V(CHAIN.x(1), CHAIN.y + 0.62, 0), 60), color: PALETTE.amber, width: 1.4 });
  const lines = new GlowLines(polys, { width: 2.2, core: 0.9, pulseWidth: 0.1 });
  scene.add(lines.object);
  const backdrop = softPanel(21, 5.4, { opacity: 0.85, feather: 0.55 });
  backdrop.position.set(0, 3.55, -0.6);
  scene.add(backdrop);

  const words = LSTM_WORDS.map((w, i) => {
    const m = textMesh({ text: w, family: FAMILY.body, weight: 600, size: 96, color: '#ffffff', glow: 10, glowColor: HEX.cyan, pxPerUnit: 190 });
    m.position.set(CHAIN.x(i), CHAIN.wordY, 0);
    scene.add(m);
    return m;
  });
  const cellLbl = LSTM_WORDS.map((_, i) => {
    const m = textMesh({ text: 'LSTM', family: FAMILY.mono, size: 48, color: '#d9c9ff', pxPerUnit: 200 });
    m.position.set(CHAIN.x(i), CHAIN.y, 0.01);
    scene.add(m);
    return m;
  });

  // memory strip: how much of each word the hidden state still carries
  const mem = new HeatmapPanel({ rows: 1, cols: n, width: n * 0.5, height: 0.42, map: 'synth', gap: 0.16, radius: 0.12, intensity: 1.6 });
  mem.mesh.position.set(0, CHAIN.y + 1.45, 0);
  scene.add(mem.mesh);
  const memLbl = textMesh({ text: 'memory', family: FAMILY.mono, size: 48, color: '#bfb0ff', pxPerUnit: 200, anchor: 'right' });
  memLbl.position.set(-n * 0.25 - 0.18, CHAIN.y + 1.45, 0);
  scene.add(memLbl);

  const orb = glowSprite(PALETTE.amber, 1.4, 0);
  scene.add(orb);
  const orbCore = glowSprite(PALETTE.white, 0.5, 0);
  scene.add(orbCore);
  const q = textMesh({ text: '?', family: FAMILY.display, weight: 900, size: 160, color: '#ffe9a8', glow: 18, glowColor: HEX.amber, pxPerUnit: 260 });
  q.position.set(CHAIN.x(7), CHAIN.y + 1.05, 0);
  scene.add(q);

  const badge = new YearBadge(MILESTONES.lstm);
  hud.add(badge.group);
  const cap = new Caption(CAPTIONS.lstm);
  hud.add(cap.group);

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      const e = f.energy;
      env.update({ t: lt + 24, scroll: (lt + 6) * 7, sunY: lerp(22, 30, lt / 6), glow: 0.55, mountain: 14, gridIntensity: 1.25 });
      env.setCamera(camera, height);

      const step = (lt - STEP0) / STEP; // which word is being read
      const cur = Math.floor(step);
      const kc = ease.inOutCubic(clamp(lt / 6));
      const follow = lerp(CHAIN.x(0), CHAIN.x(7), ease.inOutQuad(clamp((lt - 0.2) / 5.2)));
      camera.position.set(follow * 0.72, lerp(4.5, 4.1, kc), lerp(10.2, 9.4, kc));
      camera.lookAt(follow * 0.8, 3.15, 0);

      for (let i = 0; i < n; i++) {
        const ti = STEP0 + i * STEP;
        const on = smoothstep(ti - 0.3, ti, lt);
        lines.set(i, 0, ease.outCubic(clamp((lt - (i * 0.08)) / 0.5)), 1.2 + hit(lt, ti, 0.35) * 2.5, -1);
        const pin = clamp((lt - ti + 0.25) / 0.25);
        lines.set(2 * n - 1 + i, 0, on, 0.7 + hit(lt, ti, 0.3) * 1.5, pin > 0 && pin < 1 ? pin : -1);
        if (i < n - 1) {
          const pp = clamp((lt - ti - 0.05) / (STEP - 0.1));
          lines.set(n + i, 0, lt > ti ? 1 : 0, 0.6, pp > 0 && pp < 1 ? pp : -1);
        }
        words[i].material.opacity = smoothstep(i * 0.08, i * 0.08 + 0.4, lt);
        words[i].material.color.setScalar(i <= cur ? 1.1 + hit(lt, ti, 0.4) * 1.5 : 0.55);
        cellLbl[i].material.opacity = 0.7;
      }
      // the reach from "it" toward "animal" fades out before arriving
      const tIt = STEP0 + 7 * STEP;
      const reach = ease.outCubic(clamp((lt - tIt - 0.1) / 0.9)) * 0.62;
      lines.set(3 * n - 1, 0, reach, 0.9 * (1 - smoothstep(tIt + 0.7, tIt + 1.4, lt)), -1);
      lines.commit();

      // memory: each word enters at full strength, then decays per step
      const vals = [];
      for (let i = 0; i < n; i++) {
        const ti = STEP0 + i * STEP;
        if (lt < ti) vals.push(0);
        else vals.push(Math.pow(0.52, Math.max(0, lt - ti) / STEP) * 0.95 + 0.04);
      }
      mem.setValues(vals);
      mem.mesh.position.x = camera.position.x / 0.72 * 0.8;
      memLbl.position.x = mem.mesh.position.x - n * 0.25 - 0.18;
      mem.uniforms.uHighlightCol.value = 1;
      mem.uniforms.uHighlightGain.value = 0.5 + 0.5 * Math.sin(lt * 6);
      mem.uniforms.uOpacity.value = smoothstep(0.3, 0.8, lt);
      memLbl.material.opacity = smoothstep(0.3, 0.8, lt) * 0.8;

      // the hidden state travels along the chain
      const s = clamp(step, 0, n - 1);
      const i0 = Math.floor(s);
      const fr = ease.inOutCubic(s - i0);
      const ox = lerp(CHAIN.x(i0), CHAIN.x(Math.min(n - 1, i0 + 1)), i0 >= n - 1 ? 0 : fr);
      orb.position.set(ox, CHAIN.y, 0.2);
      orb.material.opacity = smoothstep(STEP0 - 0.2, STEP0, lt) * (0.9 + 0.3 * e);
      orb.scale.setScalar(1.7 + hit(lt, STEP0 + i0 * STEP, 0.3) * 1.0);
      orbCore.position.copy(orb.position);
      orbCore.material.opacity = orb.material.opacity;
      orbCore.scale.setScalar(0.55 + hit(lt, STEP0 + i0 * STEP, 0.3) * 0.3);

      q.material.opacity = smoothstep(tIt + 0.5, tIt + 0.8, lt);
      q.scale.setScalar(1 + hit(lt, tIt + 0.5, 0.3) * 0.5);
      fx.aberration += hit(lt, tIt + 0.5, 0.3) * 0.5;

      badge.update(lt, 0.2, 5.85);
      cap.update(lt, 1.7, 5.85);
    },
  };
}
