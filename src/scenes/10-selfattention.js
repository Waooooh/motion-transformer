// 1:00–1:12 · Self-attention.
// Each token vector splits into Query / Key / Value; "it" compares its query
// with every key, softmax turns the scores into weights (61% "animal"), the
// full attention matrix fills row by row, and the values flow into "it".
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, GlowPoints, HeatmapPanel, softPanel, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { linePts, V } from '../core/shapes.js';
import { Caption } from '../core/hud.js';
import { CAPTIONS, SENTENCE } from '../copy.js';
import { tokenX, embeddingValues } from './09-tokens.js';
import { clamp, ease, lerp, smoothstep, hit, Rng } from '../core/math.js';
import { chromeText } from './07-title.js';

const N = SENTENCE.length;
const IT = 8;
const TY = -2.55;
const IT_P = [0.03, 0.61, 0.02, 0.02, 0.03, 0.02, 0.09, 0.03, 0.06, 0.03, 0.02, 0.04];

export function attentionMatrix() {
  const links = { '8,1': 3.2, '11,1': 2.4, '9,8': 1.6, '4,6': 1.3, '2,1': 1.1, '3,2': 2.1, '7,4': 0.9, '10,11': 1.3, '6,4': 1.2, '5,6': 1.4, '0,1': 0.8, '1,0': 0.7 };
  const m = [];
  for (let i = 0; i < N; i++) {
    const s = [];
    for (let j = 0; j < N; j++) {
      let v = i === j ? 1.1 : j === i - 1 ? 0.7 : j === i + 1 ? 0.3 : 0;
      v += links[`${i},${j}`] || 0;
      s.push(v * 1.6);
    }
    const mx = Math.max(...s);
    const ex = s.map((v) => Math.exp(v - mx));
    const sum = ex.reduce((a, b) => a + b, 0);
    m.push(ex.map((v) => v / sum));
  }
  m[IT] = IT_P.slice();
  return m;
}

export default function selfAttentionScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 2000);
  const hud = new THREE.Scene();
  const overlay = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 20 });
  scene.add(env.group);
  const stage = new THREE.Group();
  stage.position.set(0, 5.4, 0);
  scene.add(stage);
  const back = softPanel(26, 16, { opacity: 0.9, feather: 0.35 });
  back.position.set(0, 1.2, -1.2);
  stage.add(back);
  const rng = new Rng(10);

  const tokens = SENTENCE.map(([t], i) => {
    const m = textMesh({ text: t.trim() || t, family: FAMILY.body, weight: 600, size: 110, color: '#ffffff', glow: 10, glowColor: HEX.cyan, pxPerUnit: 250 });
    m.position.set(tokenX(i), TY, 0);
    stage.add(m);
    return m;
  });

  // Q / K / V columns per token
  const emb = embeddingValues();
  const QKV = [
    { name: 'Q', tint: [1.25, 0.35, 1.05], dx: -0.34, color: PALETTE.pink },
    { name: 'K', tint: [0.35, 1.15, 1.35], dx: 0, color: PALETTE.cyan },
    { name: 'V', tint: [1.35, 0.95, 0.3], dx: 0.34, color: PALETTE.amber },
  ];
  const colH = 2.0;
  const cols = QKV.map((q, qi) =>
    SENTENCE.map((_, i) => {
      const p = new HeatmapPanel({ rows: 8, cols: 1, width: 0.28, height: colH, map: 'synth', gap: 0.18, radius: 0.2, intensity: 1.4 });
      p.setValues(Array.from({ length: 8 }, (_, d) => 1 / (1 + Math.exp(-(emb[i][d * 2] + emb[i][(d * 2 + 1) % 16] * (qi - 1)) * 1.2))));
      p.uniforms.uTint.value.set(...q.tint);
      p.mesh.geometry.translate(0, colH / 2, 0);
      p.mesh.position.set(tokenX(i) + q.dx, TY + 0.55, 0);
      stage.add(p.mesh);
      return p;
    }),
  );
  const qkvLabels = QKV.map((q, qi) => {
    const m = textMesh({
      text: ['Q  query', 'K  key', 'V  value'][qi],
      family: FAMILY.mono,
      size: 60,
      color: ['#ffc4f1', '#bff6ff', '#ffe3a3'][qi],
      glow: 8,
      glowColor: [HEX.pink, HEX.cyan, HEX.amber][qi],
      pxPerUnit: 300,
      anchor: 'right',
    });
    m.position.set(tokenX(0) - 0.75, TY + 0.55 + colH - 0.35 - qi * 0.55, 0);
    stage.add(m);
    return m;
  });

  // beams from it's query to every key, score bars, softmax
  const beamPolys = SENTENCE.map((_, j) => {
    const a = V(tokenX(IT) - 0.34, TY + 0.55 + colH + 0.08, 0.05);
    const b = V(tokenX(j), TY + 0.55 + colH + 0.08, 0.05);
    const pts = [];
    for (let s = 0; s <= 40; s++) {
      const t = s / 40;
      const p = a.clone().lerp(b, t);
      p.y += Math.sin(Math.PI * t) * (0.5 + Math.abs(j - IT) * 0.16);
      pts.push(p);
    }
    return { points: pts, color: j === 1 ? PALETTE.amber : PALETTE.pink, width: 1.2 + IT_P[j] * 8 };
  });
  const lines = new GlowLines(beamPolys, { width: 2, core: 0.9, pulseWidth: 0.06 });
  stage.add(lines.object);

  const barMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const bars = SENTENCE.map((_, j) => {
    const g = new THREE.PlaneGeometry(0.5, 1);
    g.translate(0, 0.5, 0);
    const m = new THREE.Mesh(g, barMat(j === 1 ? PALETTE.amber : PALETTE.pink));
    m.position.set(tokenX(j), TY - 1.25, 0.1);
    m.scale.y = 0.001;
    stage.add(m);
    return m;
  });
  const scores = IT_P.map((p) => Math.log(p) + 4.2);
  const pctLabels = SENTENCE.map((_, j) => {
    const m = textMesh({ text: `${Math.round(IT_P[j] * 100)}%`, family: FAMILY.mono, size: j === 1 ? 90 : 56, color: j === 1 ? '#ffe9a8' : '#ffd0f4', glow: 8, glowColor: j === 1 ? HEX.amber : HEX.pink, pxPerUnit: 300 });
    stage.add(m);
    return m;
  });

  // attention matrix (12×12)
  const A = attentionMatrix();
  const mat = new HeatmapPanel({ rows: N, cols: N, width: 6.2, height: 6.2, map: 'synth', gap: 0.1, radius: 0.12, intensity: 1.5 });
  mat.setValues(A.flat().map((v) => Math.pow(v, 0.45)));
  mat.mesh.position.set(0.4, 3.3, -0.6);
  stage.add(mat.mesh);
  const rowLabels = SENTENCE.map(([t], i) => {
    const m = textMesh({ text: t.trim(), family: FAMILY.mono, size: 44, color: '#d8cbff', pxPerUnit: 300, anchor: 'right' });
    m.position.set(0.4 - 3.1 - 0.12, 3.3 + 3.1 - (i + 0.5) * (6.2 / N), -0.6);
    stage.add(m);
    return m;
  });
  const colLabels = SENTENCE.map(([t], j) => {
    const m = textMesh({ text: t.trim(), family: FAMILY.mono, size: 44, color: '#d8cbff', pxPerUnit: 300, anchor: 'left' });
    m.rotation.z = Math.PI / 2.6;
    m.position.set(0.4 - 3.1 + (j + 0.5) * (6.2 / N), 3.3 + 3.1 + 0.12, -0.6);
    stage.add(m);
    return m;
  });

  // values flowing into "it"
  const flow = new GlowPoints(N * 14, { core: 1.2, minSize: 2 });
  stage.add(flow.object);
  const flowSeeds = Array.from({ length: N * 14 }, () => rng.float(0, 1));
  const outCol = new HeatmapPanel({ rows: 8, cols: 1, width: 0.5, height: colH, map: 'synth', gap: 0.18, radius: 0.2, intensity: 1.6 });
  outCol.setValues(Array.from({ length: 8 }, (_, d) => 0.25 + 0.7 * Math.abs(Math.sin(d * 1.7 + 1))));
  outCol.uniforms.uTint.value.set(1.35, 0.95, 0.35);
  outCol.mesh.geometry.translate(0, colH / 2, 0);
  outCol.mesh.position.set(tokenX(IT), TY + 0.55 + colH + 1.2, 0.2);
  stage.add(outCol.mesh);

  const formula = chromeText('softmax( QKᵀ / √dₖ ) V', 92, { family: FAMILY.math, weight: 600, italic: true, letterSpacing: 4 });
  formula.position.y = 385;
  overlay.add(formula);
  const note = textMesh({ text: '“it”  →  “animal”   ·   “它” 指的是 “动物”', family: FAMILY.zh, weight: 500, size: 34 * 2, letterSpacing: 6 * 2, color: '#ffe9a8', glow: 10, glowColor: HEX.amber, pxPerUnit: 2, depthTest: false });
  note.position.y = 300;
  hud.add(note);

  const cap = new Caption(CAPTIONS.selfattention);
  hud.add(cap.group);

  const TB = 3.0; // beams
  const TS = 4.6; // softmax
  const TM = 6.0; // matrix
  const TV = 9.0; // values + formula

  return {
    scene,
    camera,
    hud,
    overlay,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      env.update({ t: lt + 60, scroll: 540 + lt * 18, sunY: 20, sunIntensity: 1.3, glow: 0.5, pulse: f.kick * 0.8, mountain: 16, fade: 0.55 });
      env.setCamera(camera, height);
      flow.setCamera(camera, height);

      // camera: token row → up to the matrix → back down to "it"
      const up = ease.inOutCubic(clamp((lt - (TM - 0.6)) / 1.2));
      const down = ease.inOutCubic(clamp((lt - (TV - 0.4)) / 1.0));
      const lookY = lerp(lerp(3.6, 8.2, up), 4.4, down);
      camera.position.set(lerp(0, 0.4, up) + Math.sin(lt * 0.5) * 0.3, lerp(lerp(4.4, 8.4, up), 5.0, down) + f.kick * 0.03, lerp(lerp(14.5, 15.8, up), 14.8, down));
      camera.lookAt(lerp(0, 0.4, up) + lerp(0, tokenX(IT) * 0.25, down), lookY, 0);

      // Q/K/V split out of each token's vector (0–3 s)
      cols.forEach((arr, qi) =>
        arr.forEach((p, i) => {
          const t0 = 0.2 + i * 0.12;
          const k = ease.outBack(clamp((lt - t0) / 0.5), 1.4);
          p.mesh.position.x = tokenX(i) + QKV[qi].dx * k;
          p.mesh.scale.y = Math.max(0.001, k);
          const isIt = i === IT;
          const beam = qi === 0 && isIt ? hit(lt, TB, 0.6) + smoothstep(TB, TB + 0.3, lt) * 0.6 * (1 - up) : 0;
          const keyHit = qi === 1 ? hit(lt, TB + 0.3 + Math.abs(i - IT) * 0.05, 0.4) : 0;
          const vflow = qi === 2 ? smoothstep(TV, TV + 0.4, lt) * IT_P[i] * 4 : 0;
          p.uniforms.uIntensity.value = 1.3 + beam * 2 + keyHit * 2 + vflow + f.kick * 0.25;
          p.uniforms.uOpacity.value = clamp((lt - t0) * 4) * (1 - up * 0.85 * (1 - down));
        }),
      );
      qkvLabels.forEach((m, qi) => (m.material.opacity = smoothstep(0.6 + qi * 0.25, 1.0 + qi * 0.25, lt) * (1 - up * (1 - down))));

      // beams, scores → softmax
      for (let j = 0; j < N; j++) {
        const t0 = TB + 0.1 + Math.abs(j - IT) * 0.05;
        const r = ease.outCubic(clamp((lt - t0) / 0.45));
        const soft = ease.inOutCubic(clamp((lt - TS) / 0.6));
        const w = lerp(0.5, 0.25 + IT_P[j] * 5, soft);
        lines.set(j, 0, r, w * (1 - up * 0.85) * (1 + (j === 1 ? hit(lt, TS + 0.6, 0.6) * 2 : 0)), r < 1 ? r : -1);
        const hScore = scores[j] * 0.28;
        const hProb = IT_P[j] * 3.2;
        const h = lerp(hScore, hProb, soft) * ease.outCubic(clamp((lt - t0 - 0.2) / 0.4));
        bars[j].scale.y = Math.max(0.001, h);
        bars[j].material.opacity = 0.75 * (1 - up) * (1 - smoothstep(TV + 1.5, TV + 2.2, lt));
        pctLabels[j].position.set(tokenX(j), TY - 1.35 + h + 0.22, 0.1);
        pctLabels[j].material.opacity = smoothstep(TS + 0.5, TS + 0.8, lt) * (1 - up) * (j === 1 || IT_P[j] >= 0.06 ? 1 : 0.55);
      }
      lines.commit();

      // matrix fills row by row
      mat.uniforms.uReveal.value = clamp((lt - (TM + 0.3)) / (N * 0.1875));
      mat.uniforms.uHighlightRow.value = lt > TM + 0.3 + (IT + 1) * 0.1875 ? IT : -10;
      mat.uniforms.uHighlightCol.value = lt > TM + 2.8 ? 1 : -10;
      mat.uniforms.uOpacity.value = smoothstep(TM - 0.3, TM + 0.2, lt) * (1 - down);
      mat.uniforms.uIntensity.value = 1.5 + f.kick * 0.4;
      rowLabels.forEach((m, i) => (m.material.opacity = smoothstep(TM + 0.3 + i * 0.1875, TM + 0.5 + i * 0.1875, lt) * (1 - down) * (i === IT ? 1.4 : 0.8)));
      colLabels.forEach((m, j) => (m.material.opacity = smoothstep(TM, TM + 0.5, lt) * (1 - down) * (j === 1 ? 1.4 : 0.8)));

      // values stream into the new "it"
      const fl = smoothstep(TV, TV + 0.3, lt) * (1 - smoothstep(11.6, 12, lt));
      for (let j = 0; j < N; j++) {
        for (let s = 0; s < 14; s++) {
          const idx = j * 14 + s;
          const ph = (lt * 0.9 + flowSeeds[idx]) % 1;
          const a = new THREE.Vector3(tokenX(j) + 0.34, TY + 0.55 + colH, 0.1);
          const b = new THREE.Vector3(tokenX(IT), TY + 0.55 + colH + 1.2, 0.2);
          const p = a.clone().lerp(b, ph);
          p.y += Math.sin(ph * Math.PI) * (0.6 + Math.abs(j - IT) * 0.12);
          const c = j === 1 ? PALETTE.amber : PALETTE.orange;
          flow.setPoint(idx, p.x, p.y, p.z, c.r * 1.5, c.g * 1.5, c.b * 1.5, 0.1 + IT_P[j] * 0.35, fl * Math.min(1, IT_P[j] * 12));
        }
      }
      flow.commit();
      const oc = ease.outBack(clamp((lt - TV - 0.4) / 0.6), 1.4);
      outCol.mesh.scale.y = Math.max(0.001, oc);
      outCol.uniforms.uOpacity.value = clamp((lt - TV - 0.4) * 3);
      outCol.uniforms.uIntensity.value = 1.6 + hit(lt, TV + 1.0, 0.5) * 2;

      tokens.forEach((m, i) => m.material.color.setScalar(1 + (i === IT ? smoothstep(TB - 0.2, TB, lt) * 0.8 : 0) + (i === 1 ? hit(lt, TS + 0.6, 0.6) * 2 : 0)));

      const fIn = ease.outExpo(clamp((lt - TV) / 0.4));
      formula.scale.setScalar(lerp(1.4, 1, fIn) * (1 + f.kick * 0.02));
      formula.material.opacity = (lt > TV ? 1 : 0) * (1 - smoothstep(11.5, 11.95, lt));
      note.material.opacity = smoothstep(TV + 0.8, TV + 1.2, lt) * (1 - smoothstep(11.5, 11.95, lt));

      fx.flash += hit(lt, TV, 0.25) * 0.35;
      fx.aberration += hit(lt, TV, 0.35) * 1.2 + hit(lt, TS + 0.6, 0.3) * 0.6;
      cap.update(lt, 1.0, 5.9);
    },
  };
}
