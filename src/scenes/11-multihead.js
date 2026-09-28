// 1:12–1:24 · Multi-head attention → feed-forward → one Transformer block.
// Eight heads light up one per beat, each seeing the sentence differently
// (BertViz-style links on the left). Then the heads merge, the vector runs
// through the feed-forward net, the residual stream wraps around, and it all
// compresses into a single glowing block.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, GlowPoints, HeatmapPanel, softPanel, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { linePts, roundRectPts, V } from '../core/shapes.js';
import { Caption } from '../core/hud.js';
import { CAPTIONS, SENTENCE, HEAD_NAMES } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, Rng } from '../core/math.js';

const N = SENTENCE.length;
const H = 8;
export const HEAD_COLORS = ['#ff4fd8', '#1ee3ff', '#ffb627', '#9d5cff', '#00ffd0', '#ff7a2f', '#4d7cff', '#ffe66d'].map((c) => new THREE.Color(c));

export function headPattern(h) {
  const links = {
    2: { '8,1': 4, '11,1': 3.2, '9,1': 1.5, '1,1': 1 },
    5: { '1,4': 2.5, '1,2': 2, '4,1': 2.2, '2,1': 2, '8,9': 2.2, '9,8': 2.4, '9,11': 2, '11,9': 1.6 },
    7: { '4,6': 3, '6,4': 3, '5,6': 2, '10,11': 2.5, '11,10': 1.5 },
  }[h] || {};
  const m = [];
  for (let i = 0; i < N; i++) {
    const s = [];
    for (let j = 0; j < N; j++) {
      let v = 0;
      if (h === 0) v = j === i - 1 ? 4 : j === i ? 1 : 0;
      else if (h === 1) v = j === i ? 4 : 0;
      else if (h === 3) v = j === 0 ? 3.5 : j === i ? 0.8 : 0;
      else if (h === 4) v = j === i + 1 ? 4 : j === i ? 1 : 0;
      else if (h === 6) v = j <= i ? 1.2 : 0.2;
      else v = j === i ? 1 : 0;
      v += links[`${i},${j}`] || 0;
      s.push(v);
    }
    const mx = Math.max(...s);
    const ex = s.map((v) => Math.exp((v - mx) * 1.3));
    const sum = ex.reduce((a, b) => a + b, 0);
    m.push(ex.map((v) => v / sum));
  }
  return m;
}

export default function multiheadScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 2000);
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 24 });
  scene.add(env.group);
  const stage = new THREE.Group();
  stage.position.set(0, 5.4, 0);
  scene.add(stage);
  const back = softPanel(24, 12.5, { opacity: 0.84, feather: 0.4 });
  back.position.set(0, 0.6, -1.5);
  stage.add(back);
  const rng = new Rng(11);

  // ---- BertViz-style token columns with links for every head
  const LX = -8.0;
  const RX = -4.6;
  const rowY = (i) => 3.3 - i * 0.52;
  const tokL = [];
  const tokR = [];
  SENTENCE.forEach(([t], i) => {
    for (const [arr, x, anchor] of [
      [tokL, LX, 'right'],
      [tokR, RX, 'left'],
    ]) {
      const m = textMesh({ text: t.trim(), family: FAMILY.body, weight: 600, size: 60, color: '#ffffff', pxPerUnit: 260, anchor });
      m.position.set(x + (anchor === 'right' ? -0.12 : 0.12), rowY(i), 0);
      stage.add(m);
      arr.push(m);
    }
  });
  const heads = Array.from({ length: H }, (_, h) => headPattern(h));
  const linkPolys = [];
  const linkMeta = [];
  for (let h = 0; h < H; h++) {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const w = heads[h][i][j];
        if (w < 0.12) continue;
        linkPolys.push({ points: linePts(V(LX, rowY(i), 0), V(RX, rowY(j), 0), 12), color: HEAD_COLORS[h], width: 0.6 + w * 3.2 });
        linkMeta.push({ h, w });
      }
    }
  }

  // ---- the eight heads as panels
  const panels = heads.map((m, h) => {
    const p = new HeatmapPanel({ rows: N, cols: N, width: 2.3, height: 2.3, map: 'mono', gap: 0.1, radius: 0.1, intensity: 1.6, additive: true });
    p.setValues(m.flat().map((v) => Math.pow(v, 0.5)));
    const c = HEAD_COLORS[h];
    p.uniforms.uTint.value.set(c.r, c.g, c.b);
    stage.add(p.mesh);
    return p;
  });
  const slot = (h) => new THREE.Vector3(-1.35 + (h % 4) * 2.75, h < 4 ? 2.15 : -1.15, 0);
  const headLabels = HEAD_NAMES.map((name, h) => {
    const m = textMesh({ text: `HEAD ${h + 1} · ${name}`, family: FAMILY.mono, size: 44, color: '#' + HEAD_COLORS[h].getHexString(), glow: 6, glowColor: '#' + HEAD_COLORS[h].getHexString(), pxPerUnit: 300 });
    stage.add(m);
    return m;
  });

  // ---- feed-forward: 12 → 36 → 12
  const layerX = [-3.2, 0, 3.2];
  const layerN = [12, 36, 12];
  const nodeY = (l, i) => (i - (layerN[l] - 1) / 2) * (l === 1 ? 0.17 : 0.42) + 1.0;
  const ffPolys = [];
  const ffLayer = [];
  for (let l = 0; l < 2; l++) {
    for (let a = 0; a < layerN[l]; a++) {
      for (let b = 0; b < layerN[l + 1]; b++) {
        if (rng.next() > 0.45) continue;
        ffPolys.push({ points: linePts(V(layerX[l], nodeY(l, a), 0), V(layerX[l + 1], nodeY(l + 1, b), 0), 6), color: l === 0 ? PALETTE.cyan : PALETTE.violet, width: 0.8 });
        ffLayer.push(l);
      }
    }
  }
  const ffNodes = new GlowPoints(60, { core: 1.3, minSize: 2 });
  stage.add(ffNodes.object);
  // residual stream around the block + block outline
  const resPoly = { points: [V(-5.2, -2.6, 0), V(-5.2, 3.9, 0), V(5.2, 3.9, 0), V(5.2, -2.6, 0)], color: PALETTE.white, width: 3.2 };
  const blockPoly = { points: roundRectPts(0, 0.8, 11.8, 7.2, 0.5), color: PALETTE.pink, width: 3 };
  const lines = new GlowLines([...linkPolys, ...ffPolys, resPoly, blockPoly], { width: 2, core: 0.9, pulseWidth: 0.06 });
  stage.add(lines.object);
  const L0 = 0;
  const F0 = linkPolys.length;
  const R0 = F0 + ffPolys.length;

  const ffLabel = textMesh({ text: 'FEED-FORWARD   512 → 2048 → 512', family: FAMILY.mono, size: 56, color: '#bff6ff', glow: 8, glowColor: HEX.cyan, pxPerUnit: 300 });
  ffLabel.position.set(0, 3.25, 0);
  const catLabel = textMesh({ text: 'CONCAT · W_O', family: FAMILY.mono, size: 64, color: '#ffffff', glow: 8, glowColor: HEX.pink, pxPerUnit: 300 });
  catLabel.position.set(0, 3.2, 0);
  const addLabel = textMesh({ text: 'ADD & NORM', family: FAMILY.mono, size: 64, color: '#fff3b0', glow: 10, glowColor: HEX.yellow, pxPerUnit: 300 });
  addLabel.position.set(0, 4.35, 0);
  const blockLabel = textMesh({ text: 'TRANSFORMER BLOCK', family: FAMILY.display, weight: 900, size: 110, letterSpacing: 10, color: '#ffffff', glow: 18, glowColor: HEX.pink, pxPerUnit: 180 });
  blockLabel.position.set(0, 0.8, 0.2);
  stage.add(ffLabel, catLabel, addLabel, blockLabel);

  const cap1 = new Caption(CAPTIONS.multihead);
  const cap2 = new Caption(CAPTIONS.block);
  hud.add(cap1.group, cap2.group);

  const TM = 6.0; // merge
  const TF = 6.75; // ffn
  const TR = 9.0; // residual
  const TB = 10.5; // block

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      env.update({ t: lt + 72, scroll: 760 + lt * 20, sunY: 20, sunIntensity: 1.35, glow: 0.55, pulse: f.kick * 0.9, mountain: 16, fade: 0.45 });
      env.setCamera(camera, height);

      const merge = ease.inOutCubic(clamp((lt - TM) / 0.7));
      const toBlock = ease.inOutCubic(clamp((lt - TB) / 1.0));
      const orbit = Math.sin(lt * 0.35) * 0.18;
      camera.position.set(lerp(1.5, 0, merge) + orbit * 4, 5.9 + f.kick * 0.03, lerp(15.5, 13.5, merge) + toBlock * 3);
      camera.lookAt(lerp(0.2, 0, merge), 5.9, 0);

      // heads appear one per beat
      const cur = Math.min(H - 1, Math.floor(lt / 0.75));
      panels.forEach((p, h) => {
        const t0 = h * 0.75;
        const a = ease.outBack(clamp((lt - t0) / 0.35), 1.5);
        const s = slot(h);
        const pos = s.clone().lerp(new THREE.Vector3(0, 1.0, -0.2 - h * 0.02), merge);
        p.mesh.position.copy(pos);
        p.mesh.rotation.y = (1 - a) * 1.2 + Math.sin(lt * 0.8 + h) * 0.06 * (1 - merge);
        p.mesh.scale.setScalar(Math.max(0.001, a) * lerp(1, 1.25, merge) * (1 - smoothstep(TF, TF + 0.3, lt)));
        p.uniforms.uIntensity.value = 1.3 + hit(lt, t0, 0.5) * 2.5 + (h === cur && lt < TM ? 0.6 : 0) + f.kick * 0.3;
        p.uniforms.uOpacity.value = clamp((lt - t0) * 4);
        headLabels[h].position.set(s.x, s.y - 1.42, 0);
        headLabels[h].material.opacity = smoothstep(t0 + 0.1, t0 + 0.4, lt) * (1 - merge) * (h === cur ? 1 : 0.6);
      });

      // links: current head bright, earlier heads dim
      linkMeta.forEach((m, i) => {
        const t0 = m.h * 0.75;
        const on = clamp((lt - t0) / 0.3);
        const bright = m.h === cur ? 1 : 0.28;
        lines.set(L0 + i, 0, ease.outCubic(on), m.w * 1.6 * bright * (1 - merge), -1);
      });
      tokL.concat(tokR).forEach((m) => (m.material.opacity = smoothstep(0, 0.4, lt) * (1 - merge)));

      // feed-forward pulses on the beat
      const ffOn = smoothstep(TF, TF + 0.3, lt) * (1 - smoothstep(TB, TB + 0.5, lt));
      for (let i = 0; i < ffPolys.length; i++) {
        const l = ffLayer[i];
        const beat = Math.floor((lt - TF) / 0.75);
        const ph = (lt - TF - beat * 0.75) / 0.75;
        const p = l === 0 ? ph * 2 : ph * 2 - 1;
        lines.set(F0 + i, 0, 1, (0.35 + f.kick * 0.2) * ffOn, p > 0 && p < 1 ? p : -1);
      }
      // residual stream and block outline
      const rr = ease.inOutCubic(clamp((lt - TR) / 0.8));
      lines.set(R0, 0, rr, (1.2 + hit(lt, TR + 0.8, 0.4) * 2) * (1 - toBlock * 0.3), rr >= 1 ? ((lt - TR) * 0.6) % 1 : rr);
      const bo = ease.outCubic(clamp((lt - TB) / 0.6));
      lines.set(R0 + 1, 0, bo, 1.4 + hit(lt, 11.25, 0.5) * 2.5 + f.kick * 0.4, -1);
      lines.commit();

      ffNodes.setCamera(camera, height);
      let ni = 0;
      for (let l = 0; l < 3; l++) {
        const arrive = TF + l * 0.375;
        for (let a = 0; a < layerN[l]; a++) {
          const beatHit = hit((lt - TF) % 0.75, l * 0.375, 0.2);
          const c = l === 1 ? PALETTE.violet : PALETTE.cyan;
          const b = 1.2 + beatHit * 1.5;
          ffNodes.setPoint(ni++, layerX[l], nodeY(l, a), 0, c.r * b, c.g * b, c.b * b, l === 1 ? 0.16 : 0.26, ffOn * smoothstep(arrive, arrive + 0.2, lt));
        }
      }
      ffNodes.commit();
      ffLabel.material.opacity = ffOn;
      catLabel.material.opacity = smoothstep(TM, TM + 0.3, lt) * (1 - smoothstep(TF + 0.2, TF + 0.6, lt));
      addLabel.material.opacity = smoothstep(TR + 0.5, TR + 0.9, lt) * (1 - toBlock);
      blockLabel.material.opacity = smoothstep(TB + 0.3, TB + 0.7, lt);
      blockLabel.scale.setScalar(1 + hit(lt, 11.25, 0.4) * 0.08);

      fx.flash += hit(lt, 0, 0.25) * 0.25 + hit(lt, 11.25, 0.35) * 0.35;
      fx.aberration += hit(lt, TM, 0.3) * 1 + hit(lt, 11.25, 0.3);
      cap1.update(lt, 0.8, 5.8);
      cap2.update(lt, 6.4, 11.8);
    },
  };
}
