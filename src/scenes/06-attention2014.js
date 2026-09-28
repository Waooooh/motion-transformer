// 0:30–0:36 · 2014, attention. Instead of passing memory down a chain,
// "it" looks straight back at every word — and finds "animal". Then every
// word looks at every word, the years tick to 2017 and the riser whites out
// into the drop.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, softPanel, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { roundRectPts, arcPts, linePts, V } from '../core/shapes.js';
import { Caption, YearBadge } from '../core/hud.js';
import { CAPTIONS, MILESTONES, LSTM_WORDS } from '../copy.js';
import { CHAIN } from './05-lstm.js';
import { clamp, ease, lerp, smoothstep, hit, hash1, Rng } from '../core/math.js';

const IT_WEIGHTS = [0.04, 0.58, 0.04, 0.07, 0.04, 0.15, 0.05, 0.03];

export default function attentionScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 2000);
  const hud = new THREE.Scene();
  const rng = new Rng(606);
  const env = new SynthwaveEnv({ seed: 5 });
  scene.add(env.group);
  const n = LSTM_WORDS.length;
  const baseY = CHAIN.wordY + 0.36;

  const polys = [];
  // 0..n-1: dissolving LSTM cells
  for (let i = 0; i < n; i++) polys.push({ points: roundRectPts(CHAIN.x(i), CHAIN.y, 1.35, 0.95, 0.2), color: PALETTE.violet, width: 1.8 });
  // n..2n-1: arcs from "it"
  for (let i = 0; i < n; i++) {
    const a = V(CHAIN.x(7), baseY, 0);
    const b = V(CHAIN.x(i), baseY, 0);
    const h = i === 7 ? 0.35 : 0.6 + Math.abs(CHAIN.x(7) - CHAIN.x(i)) * 0.26;
    polys.push({
      points: i === 7 ? arcPts(a.clone().add(V(-0.25, 0, 0)), b.clone().add(V(0.25, 0, 0)), h, 20) : arcPts(a, b, h, 64),
      color: i === 1 ? PALETTE.amber : PALETTE.pink,
      width: 0.8 + IT_WEIGHTS[i] * 12,
    });
  }
  // 2n..: all-to-all web
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const w = rng.float(0.1, 1);
      pairs.push({ i, j, w });
      const a = V(CHAIN.x(i), baseY, 0);
      const b = V(CHAIN.x(j), baseY, 0);
      const up = (i + j) % 2 === 0 ? 1 : -1;
      const h = (0.4 + (j - i) * 0.34) * up;
      polys.push({ points: arcPts(a, b, h, 48), color: [PALETTE.cyan, PALETTE.violet, PALETTE.pink][(i + j) % 3], width: 0.6 + w * 1.4 });
    }
  }
  const webStart = 2 * n;
  const lines = new GlowLines(polys, { width: 2, core: 0.9, pulseWidth: 0.05 });
  scene.add(lines.object);
  const backdrop = softPanel(21, 5.4, { opacity: 0.85, feather: 0.55 });
  backdrop.position.set(0, 3.55, -0.6);
  scene.add(backdrop);

  // warp streaks
  const streakPolys = [];
  for (let i = 0; i < 260; i++) {
    const a = rng.float(0, Math.PI * 2);
    const r = rng.float(2.5, 16);
    const z = rng.float(-260, -10);
    const len = rng.float(6, 22);
    const x = Math.cos(a) * r;
    const y = 4 + Math.sin(a) * r * 0.7;
    streakPolys.push({ points: linePts(V(x, y, z), V(x, y, z - len), 2), color: [PALETTE.pink, PALETTE.cyan, PALETTE.white, PALETTE.violet][i % 4], width: rng.float(0.6, 2) });
  }
  const streaks = new GlowLines(streakPolys, { width: 2, core: 1, perspective: false });
  scene.add(streaks.object);

  const words = LSTM_WORDS.map((w, i) => {
    const m = textMesh({ text: w, family: FAMILY.body, weight: 600, size: 96, color: '#ffffff', glow: 10, glowColor: HEX.cyan, pxPerUnit: 190 });
    m.position.set(CHAIN.x(i), CHAIN.wordY, 0);
    scene.add(m);
    return m;
  });
  const wLabels = IT_WEIGHTS.map((w, i) => {
    const m = textMesh({
      text: w.toFixed(2),
      family: FAMILY.mono,
      size: i === 1 ? 96 : 56,
      color: i === 1 ? '#ffe9a8' : '#ffd0f4',
      glow: i === 1 ? 16 : 6,
      glowColor: i === 1 ? HEX.amber : HEX.pink,
      pxPerUnit: 220,
    });
    const h = i === 7 ? 0.35 : 0.6 + Math.abs(CHAIN.x(7) - CHAIN.x(i)) * 0.26;
    m.position.set((CHAIN.x(7) + CHAIN.x(i)) / 2, baseY + h + 0.22, 0);
    scene.add(m);
    return m;
  });

  // year ticker (HUD)
  const years = ['2014', '2015', '2016', '2017'].map((y) => {
    const m = textMesh({
      text: y,
      family: FAMILY.display,
      weight: 900,
      size: 300,
      letterSpacing: 16,
      gradient: [
        [0, '#ffffff'],
        [0.5, '#ffd6f6'],
        [0.52, '#ff4fd8'],
        [1, '#7b2cff'],
      ],
      glow: 24,
      glowColor: HEX.pink,
      pxPerUnit: 1,
    });
    m.material.depthTest = false;
    hud.add(m);
    return m;
  });

  const badge = new YearBadge(MILESTONES.attention);
  hud.add(badge.group);
  const cap = new Caption(CAPTIONS.attention2014);
  hud.add(cap.group);
  const YT = [3.0, 3.75, 4.5, 5.25];

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      streaks.setResolution(width, height);
      const e = f.energy;
      const rush = ease.inQuart(clamp((lt - 3.0) / 3.0));
      env.update({
        t: lt + 30,
        scroll: (lt + 12) * 7 + rush * 90,
        sunY: lerp(30, 34, lt / 6),
        sunIntensity: 1.6 + rush * 2.5,
        glow: 0.55 + rush,
        mountain: 14,
        gridIntensity: 1.25 + rush * 1.5,
      });
      env.setCamera(camera, height);

      // camera: settle on the sentence, then rise and rush forward
      const k1 = ease.inOutCubic(clamp(lt / 1.2));
      backdrop.material.uniforms.uOpacity.value = 0.85 * (1 - smoothstep(2.6, 4.0, lt));
      const k2 = ease.inCubic(clamp((lt - 3) / 3));
      camera.position.set(lerp(lerp(CHAIN.x(7) * 0.72, 0.4, k1), 0, k2), lerp(lerp(4.1, 5.6, k1), 4.4, k2), lerp(lerp(9.4, 15.5, k1), -6, k2));
      camera.lookAt(lerp(lerp(CHAIN.x(7) * 0.8, 0.2, k1), 0, k2), lerp(3.15, 3.5, k1), lerp(0, -40, k2));
      camera.rotation.z += Math.sin(lt * 1.3) * 0.01 * k2;

      for (let i = 0; i < n; i++) lines.set(i, 0, 1, 0.7 * (1 - smoothstep(0.0, 0.6, lt)), -1);
      for (let i = 0; i < n; i++) {
        const t0 = 0.3 + (7 - i) * 0.07;
        const r = ease.outCubic(clamp((lt - t0) / 0.55));
        const w = IT_WEIGHTS[i];
        const glowUp = i === 1 ? 1 + 1.5 * hit(lt, 1.1, 0.5) + 0.6 * Math.sin(lt * 5) ** 2 : 1;
        lines.set(n + i, 0, r, (0.35 + w * 4) * glowUp * (1 - smoothstep(3.2, 4.2, lt) * 0.6), r < 1 ? r : -1);
        wLabels[i].material.opacity = smoothstep(t0 + 0.4, t0 + 0.7, lt) * (1 - smoothstep(2.6, 3.1, lt));
      }
      pairs.forEach((p, k) => {
        const t0 = 1.5 + hash1(k) * 1.2;
        const r = ease.outCubic(clamp((lt - t0) / 0.6));
        const pulse = (lt * 0.9 + hash1(k + 9)) % 1;
        lines.set(webStart + k, 0, r, (0.3 + p.w * 0.6) * (1 + rush * 2.5) * (0.7 + 0.3 * e), r >= 1 ? pulse : -1);
      });
      lines.commit();

      const streakOn = smoothstep(3.6, 4.6, lt);
      streaks.object.position.z = rush * 520;
      streaks.setAll(0, 1, streakOn * (0.6 + rush * 1.8), -1);
      streaks.commit();

      words.forEach((m, i) => {
        const lit = i === 1 ? hit(lt, 1.1, 0.6) : 0;
        m.material.color.setScalar(1.1 + lit * 2 + (i === 7 ? 0.5 : 0) + rush * 1.5);
      });

      // years
      years.forEach((m, i) => {
        const on = lt >= YT[i] && (i === 3 || lt < YT[i + 1]);
        const g = on ? 1 - clamp((lt - YT[i]) / 0.18) : 0;
        m.visible = on;
        m.material.opacity = on ? (hash1(Math.floor(lt * 40)) > g * 0.7 ? 1 : 0.2) : 0;
        m.position.set((hash1(Math.floor(lt * 50) + i) - 0.5) * 60 * g, 10, 0);
        const s = 0.62 + (lt - YT[i]) * 0.06 + (i === 3 ? rush * 0.3 : 0);
        m.scale.setScalar(s);
        if (on) fx.glitch += g * 0.8;
      });

      // riser → white-out into the drop
      const riser = smoothstep(4.6, 6.0, lt);
      fx.bloom += rush * 1.2;
      fx.exposure += rush * 0.5;
      fx.aberration += rush * 1.2;
      fx.flash += Math.pow(riser, 2.2) * 1.1;
      fx.zoom = 1 + rush * 0.08;

      badge.update(lt, 0.2, 2.9);
      cap.update(lt, 0.9, 3.3);
    },
  };
}
