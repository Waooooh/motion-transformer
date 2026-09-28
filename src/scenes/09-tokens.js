// 0:48–1:00 · Tokens, embeddings, positional encoding.
// The sentence splits into GPT-2 tokens (with their real ids), each token
// raises its embedding vector, then sine waves of position are added in.
import * as THREE from 'three';
import { textMesh, DynamicText, measureText, fontString, FAMILY } from '../core/text.js';
import { GlowLines, HeatmapPanel, softPanel, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { roundRectPts, V } from '../core/shapes.js';
import { Caption } from '../core/hud.js';
import { CAPTIONS, SENTENCE } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, hash1, Rng } from '../core/math.js';

const N = SENTENCE.length;
const D = 16;
const SP = 1.42;
const TY = -2.55;
const COLH = 3.9;
const COLW = 0.62;

export const tokenX = (i) => (i - (N - 1) / 2) * SP;

export function embeddingValues(seed = 9) {
  const rng = new Rng(seed);
  const emb = [];
  for (let i = 0; i < N; i++) {
    const col = [];
    for (let d = 0; d < D; d++) col.push(rng.gauss() * 0.9);
    emb.push(col);
  }
  return emb;
}
export function peValue(pos, d) {
  const k = Math.floor(d / 2);
  const a = pos / Math.pow(10000, (2 * k) / D);
  return d % 2 === 0 ? Math.sin(a) : Math.cos(a);
}
const squash = (v) => 1 / (1 + Math.exp(-v * 1.3));

export default function tokensScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 2000);
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 16 });
  scene.add(env.group);
  const stage = new THREE.Group();
  stage.position.set(0, 5.4, 0);
  scene.add(stage);
  const back = softPanel(22, 11.5, { opacity: 0.82, feather: 0.4 });
  back.position.set(0, 0.2, -0.5);
  stage.add(back);

  // the whole sentence, then its tokens
  const sentenceText = SENTENCE.map(([t]) => t).join('');
  const tokOpts = { family: FAMILY.body, weight: 600, size: 110, color: '#ffffff', glow: 10, glowColor: HEX.cyan, pxPerUnit: 250 };
  const whole = textMesh({ text: sentenceText, ...tokOpts });
  whole.position.set(0, TY, 0);
  stage.add(whole);
  const font = fontString(tokOpts);
  const fullW = measureText(sentenceText, font) / 250;
  let acc = 0;
  const tokens = SENTENCE.map(([t, id], i) => {
    const w = measureText(t, font) / 250;
    const x0 = -fullW / 2 + acc + w / 2;
    acc += w;
    const m = textMesh({ text: t.trim() || t, ...tokOpts });
    stage.add(m);
    const idText = new DynamicText({ width: 360, height: 110, size: 76, family: FAMILY.mono, color: '#ffe9a8', glow: 8, glowColor: HEX.amber, pxPerUnit: 300 });
    idText.mesh.position.set(tokenX(i), TY - 0.72, 0);
    stage.add(idText.mesh);
    return { m, x0, id, idText, t };
  });

  const boxPolys = SENTENCE.map((_, i) => ({ points: roundRectPts(tokenX(i), TY, SP - 0.16, 0.66, 0.16), color: PALETTE.cyan, width: 1.6 }));
  // positional waves across the embedding band
  const waves = [];
  for (let k = 0; k < 6; k++) {
    const pts = [];
    const y = -1.55 + k * 0.72;
    const freq = 1.7 / Math.pow(1.85, k);
    for (let s = 0; s <= 240; s++) {
      const pos = -0.8 + (s / 240) * (N - 1 + 1.6);
      pts.push(V(tokenX(0) + pos * SP, y + Math.sin(pos * freq + k) * 0.3, 0.05));
    }
    waves.push({ points: pts, color: k % 2 ? PALETTE.cyan : PALETTE.teal, width: 2 });
  }
  const lines = new GlowLines([...boxPolys, ...waves], { width: 2, core: 0.9, pulseWidth: 0.05 });
  stage.add(lines.object);

  const emb = embeddingValues();
  const cols = [];
  const peCols = [];
  for (let i = 0; i < N; i++) {
    const p = new HeatmapPanel({ rows: D, cols: 1, width: COLW, height: COLH, map: 'synth', gap: 0.16, radius: 0.18, intensity: 1.45 });
    p.setValues(emb[i].map(squash));
    p.mesh.geometry.translate(0, COLH / 2, 0);
    p.mesh.position.set(tokenX(i), TY + 0.55, 0);
    stage.add(p.mesh);
    cols.push(p);
    const q = new HeatmapPanel({ rows: D, cols: 1, width: COLW, height: COLH, map: 'ice', gap: 0.16, radius: 0.18, intensity: 1.5 });
    q.setValues(Array.from({ length: D }, (_, d) => (peValue(i, d) + 1) / 2));
    q.mesh.geometry.translate(0, COLH / 2, 0);
    q.mesh.position.set(tokenX(i), TY + 0.55, 0.08);
    stage.add(q.mesh);
    peCols.push(q);
  }

  const lblTok = textMesh({ text: 'tokens', family: FAMILY.mono, size: 64, color: '#9fefff', pxPerUnit: 300, anchor: 'right' });
  lblTok.position.set(tokenX(0) - 0.85, TY, 0);
  const lblEmb = textMesh({ text: 'embedding\nvectors', family: FAMILY.mono, size: 64, color: '#ffc4f1', pxPerUnit: 300, anchor: 'right', align: 'right' });
  lblEmb.position.set(tokenX(0) - 0.6, TY + 0.55 + COLH / 2, 0);
  const lblPe = textMesh({ text: '+ position', family: FAMILY.mono, size: 64, color: '#9fefff', pxPerUnit: 300, anchor: 'left' });
  lblPe.position.set(tokenX(N - 1) + 0.5, TY + 0.55 + COLH / 2, 0);
  const formula = textMesh({ text: 'PE(pos, 2i) = sin( pos / 10000^(2i/d) )', family: FAMILY.math, italic: true, size: 96, color: '#ffffff', glow: 12, glowColor: HEX.cyan, pxPerUnit: 330 });
  formula.position.set(0, TY + 0.55 + COLH + 0.62, 0);
  stage.add(lblTok, lblEmb, lblPe, formula);

  const cap1 = new Caption(CAPTIONS.tokens);
  const cap2 = new Caption(CAPTIONS.position);
  hud.add(cap1.group, cap2.group);

  const TSPLIT = 0.75;
  const TEMB = 2.9;
  const TWAVE = 6.0;
  const TADD = 8.25;

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      env.update({ t: lt + 48, scroll: 320 + lt * 18, sunY: 20, sunIntensity: 1.3, glow: 0.5, pulse: f.kick * 0.8, mountain: 16, fade: 0.5 });
      env.setCamera(camera, height);

      const k = ease.inOutCubic(clamp(lt / 12));
      camera.position.set(lerp(-1.4, 1.4, k), 5.9 + f.kick * 0.03, lerp(17.2, 16.2, k));
      camera.lookAt(lerp(-0.3, 0.3, k), 5.0, 0);

      // sentence → tokens
      const split = ease.inOutCubic(clamp((lt - TSPLIT) / 0.6));
      whole.material.opacity = lt < TSPLIT ? clamp(lt / 0.2) : 0;
      tokens.forEach((tk, i) => {
        tk.m.material.opacity = lt >= TSPLIT ? 1 : 0;
        tk.m.position.set(lerp(tk.x0, tokenX(i), split), TY, 0);
        tk.m.material.color.setScalar(1 + hit(lt, TEMB + i * 0.1875, 0.3) * 1.5);
        const settle = TSPLIT + 0.5 + i * 0.09;
        const rolling = lt > TSPLIT + 0.25 && lt < settle;
        const shown = lt > TSPLIT + 0.25;
        if (!shown) tk.idText.set('');
        else if (rolling) tk.idText.set(String(Math.floor(hash1(Math.floor(lt * 30) + i * 7) * 50257)));
        else tk.idText.set(String(tk.id));
        tk.idText.mesh.material.opacity = shown ? 1 : 0;
        tk.idText.mesh.material.color.setScalar(1 + hit(lt, settle, 0.3) * 1.5);
        lines.set(i, 0, ease.outCubic(clamp((lt - TSPLIT - 0.2 - i * 0.03) / 0.4)), 0.9 + hit(lt, TEMB + i * 0.1875, 0.3) * 2, -1);
      });

      // embedding columns rise one per 16th note
      const added = smoothstep(TADD, TADD + 0.3, lt);
      cols.forEach((c, i) => {
        const t0 = TEMB + i * 0.1875;
        const r = ease.outBack(clamp((lt - t0) / 0.4), 1.3);
        c.mesh.scale.set(1, Math.max(0.001, r), 1);
        c.uniforms.uOpacity.value = clamp((lt - t0) * 4);
        c.uniforms.uIntensity.value = 1.45 + hit(lt, t0, 0.3) * 1.5 + hit(lt, TADD, 0.4) * 1.5 + f.kick * 0.3;
        if (added > 0 && !c.userData) {
          c.userData = true;
          c.setValues(emb[i].map((v, d) => squash(v + peValue(i, d) * 1.2)));
        }
        // PE columns slide down onto the embeddings
        const pe = peCols[i];
        const pin = ease.outCubic(clamp((lt - (TWAVE + 0.9 + i * 0.07)) / 0.5));
        const drop = ease.inCubic(clamp((lt - (TADD - 0.45)) / 0.45));
        pe.mesh.position.set(tokenX(i) + lerp(0.36, 0, drop), TY + 0.55 + (1 - pin) * 2, 0.08);
        pe.uniforms.uOpacity.value = pin * (1 - smoothstep(TADD, TADD + 0.35, lt)) * 0.9;
      });
      if (lt < TADD) cols.forEach((c) => (c.userData = null));

      // sine waves sweep across
      for (let w = 0; w < waves.length; w++) {
        const t0 = TWAVE + w * 0.12;
        const r = ease.inOutCubic(clamp((lt - t0) / 0.9));
        const fade = 1 - smoothstep(TADD + 0.2, TADD + 1.2, lt);
        lines.set(N + w, 0, r, (1.1 + f.kick * 0.4) * fade, r >= 1 ? ((lt - t0) * 0.35) % 1 : r);
      }
      lines.commit();

      lblTok.material.opacity = smoothstep(TSPLIT + 0.3, TSPLIT + 0.7, lt) * 0.9;
      lblEmb.material.opacity = smoothstep(TEMB + 0.5, TEMB + 1.0, lt) * 0.9;
      lblPe.material.opacity = smoothstep(TWAVE + 0.8, TWAVE + 1.3, lt) * 0.9;
      formula.material.opacity = smoothstep(TWAVE + 0.2, TWAVE + 0.8, lt);

      fx.flash += hit(lt, 0, 0.3) * 0.6 + hit(lt, TADD, 0.25) * 0.25;
      fx.aberration += hit(lt, TSPLIT, 0.3) * 0.8 + hit(lt, TADD, 0.3) * 0.8;
      cap1.update(lt, 0.9, 5.7);
      cap2.update(lt, 6.3, 11.8);
    },
  };
}
