// 0:42–0:48 · The Transformer (Vaswani et al., 2017), Figure 1 redrawn in
// neon. One block lights up per beat; then the camera dives into the input
// embedding.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, softPanel, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { roundRectPts, circlePts, linePts, V } from '../core/shapes.js';
import { YearBadge } from '../core/hud.js';
import { ARCH_LABELS as L, MILESTONES } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit } from '../core/math.js';

const EX = -2.35;
const DX = 2.35;
const BW = 3.3;
const BH = 0.62;

export default function architectureScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 2000);
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 14 });
  scene.add(env.group);

  const diagram = new THREE.Group();
  diagram.position.set(1.2, 5.2, 0);
  scene.add(diagram);
  const back = softPanel(13, 12.5, { opacity: 0.8, feather: 0.4 });
  back.position.set(0, 0.7, -0.4);
  diagram.add(back);

  const polys = [];
  const blocks = [];
  const labels = [];
  const beatOf = [];
  const add = (poly, beat) => {
    polys.push(poly);
    beatOf.push(beat);
    return polys.length - 1;
  };
  const label = (text, x, y, beat, opts = {}) => {
    const m = textMesh({ text, family: FAMILY.body, weight: 600, size: 64, color: '#ffffff', pxPerUnit: 270, ...opts });
    m.position.set(x, y, 0.02);
    diagram.add(m);
    labels.push({ m, beat });
    return m;
  };
  const block = (name, x, y, color, beat, w = BW) => {
    const i = add({ points: roundRectPts(x, y, w, BH, 0.16), color, width: 2.2 }, beat);
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.08, BH - 0.08),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    fill.position.set(x, y, -0.01);
    diagram.add(fill);
    blocks.push({ i, fill, beat, x, y });
    label(name, x, y, beat);
  };
  const arrow = (x, y0, y1, beat, color = PALETTE.white) => {
    add({ points: linePts(V(x, y0, 0), V(x, y1, 0), 8), color, width: 1.4 }, beat);
    add({ points: [V(x - 0.1, y1 - 0.14, 0), V(x, y1, 0), V(x + 0.1, y1 - 0.14, 0)], color, width: 1.4 }, beat);
  };

  const ATT = PALETTE.amber;
  const FF = PALETTE.cyan;
  const NORM = PALETTE.yellow;
  const EMB = PALETTE.pink;
  const OUT = PALETTE.violet;

  // encoder
  label(L.inputs, EX, -4.45, 0, { color: '#cbbcff' });
  arrow(EX, -4.2, -3.83, 0);
  block(L.inEmb, EX, -3.5, EMB, 0);
  arrow(EX, -3.18, -2.86, 1);
  add({ points: circlePts(EX, -2.65, 0.2, 40), color: PALETTE.white, width: 1.6 }, 1);
  add({ points: [V(EX - 0.13, -2.65, 0), V(EX + 0.13, -2.65, 0)], color: PALETTE.white, width: 1.6 }, 1);
  add({ points: [V(EX, -2.78, 0), V(EX, -2.52, 0)], color: PALETTE.white, width: 1.6 }, 1);
  const sine = (cx, cy) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(V(cx - 0.35 + (i / 40) * 0.7, cy + Math.sin((i / 40) * Math.PI * 2) * 0.16, 0));
    return pts;
  };
  add({ points: circlePts(EX - 1.3, -2.65, 0.3, 48), color: EMB, width: 1.6 }, 1);
  add({ points: sine(EX - 1.3, -2.65).map((p) => p.multiplyScalar(1).add(V(0, 0, 0))), color: EMB, width: 1.4 }, 1);
  add({ points: linePts(V(EX - 1.0, -2.65, 0), V(EX - 0.21, -2.65, 0), 6), color: PALETTE.white, width: 1.4 }, 1);
  label(L.pe, EX - 1.3, -3.12, 1, { size: 50, color: '#ffc4f1', anchor: 'center' });
  arrow(EX, -2.44, -1.63, 2);
  add({ points: linePts(V(EX - 0.9, -1.85, 0), V(EX - 0.9, -1.63, 0), 4), color: PALETTE.white, width: 1.2 }, 2);
  add({ points: linePts(V(EX + 0.9, -1.85, 0), V(EX + 0.9, -1.63, 0), 4), color: PALETTE.white, width: 1.2 }, 2);
  add({ points: [V(EX - 0.9, -1.85, 0), V(EX + 0.9, -1.85, 0)], color: PALETTE.white, width: 1.2 }, 2);
  block(L.mha, EX, -1.3, ATT, 2);
  arrow(EX, -0.98, -0.77, 3);
  block(L.addnorm, EX, -0.45, NORM, 3);
  arrow(EX, -0.13, 0.23, 3);
  block(L.ff, EX, 0.55, FF, 3);
  arrow(EX, 0.87, 1.08, 3);
  block(L.addnorm, EX, 1.4, NORM, 3);
  // residual paths
  add({ points: [V(EX, -2.1, 0), V(EX - BW / 2 - 0.25, -2.1, 0), V(EX - BW / 2 - 0.25, -0.45, 0), V(EX - BW / 2, -0.45, 0)], color: PALETTE.white, width: 1.2 }, 3);
  add({ points: [V(EX, 0.05, 0), V(EX - BW / 2 - 0.25, 0.05, 0), V(EX - BW / 2 - 0.25, 1.4, 0), V(EX - BW / 2, 1.4, 0)], color: PALETTE.white, width: 1.2 }, 3);
  add({ points: roundRectPts(EX, -0.05, BW + 0.9, 4.05, 0.3), color: PALETTE.violet, width: 1.6 }, 3);
  label(L.nx, EX - BW / 2 - 0.85, -0.05, 3, { size: 80, color: '#e3d6ff' });

  // decoder
  label(L.outputs, DX, -4.45, 0, { color: '#cbbcff' });
  arrow(DX, -4.2, -3.83, 0);
  block(L.outEmb, DX, -3.5, EMB, 0);
  arrow(DX, -3.18, -2.86, 1);
  add({ points: circlePts(DX, -2.65, 0.2, 40), color: PALETTE.white, width: 1.6 }, 1);
  add({ points: [V(DX - 0.13, -2.65, 0), V(DX + 0.13, -2.65, 0)], color: PALETTE.white, width: 1.6 }, 1);
  add({ points: [V(DX, -2.78, 0), V(DX, -2.52, 0)], color: PALETTE.white, width: 1.6 }, 1);
  add({ points: circlePts(DX + 1.3, -2.65, 0.3, 48), color: EMB, width: 1.6 }, 1);
  add({ points: sine(DX + 1.3, -2.65), color: EMB, width: 1.4 }, 1);
  add({ points: linePts(V(DX + 1.0, -2.65, 0), V(DX + 0.21, -2.65, 0), 6), color: PALETTE.white, width: 1.4 }, 1);
  label(L.pe, DX + 1.3, -3.12, 1, { size: 50, color: '#ffc4f1' });
  arrow(DX, -2.44, -1.63, 4);
  block(L.mmha, DX, -1.3, ATT, 4);
  arrow(DX, -0.98, -0.77, 4);
  block(L.addnorm, DX, -0.45, NORM, 4);
  arrow(DX, -0.13, 0.18, 5);
  block(L.mha, DX, 0.5, ATT, 5);
  // encoder output → cross-attention
  add({ points: [V(EX, 1.72, 0), V(EX, 2.35, 0), V(0, 2.35, 0), V(0, 0.2, 0), V(DX - BW / 2 + 0.3, 0.2, 0)], color: PALETTE.amber, width: 1.8 }, 5);
  arrow(DX, 0.82, 1.03, 5);
  block(L.addnorm, DX, 1.35, NORM, 5);
  arrow(DX, 1.67, 1.93, 6);
  block(L.ff, DX, 2.25, FF, 6);
  arrow(DX, 2.57, 2.78, 6);
  block(L.addnorm, DX, 3.1, NORM, 6);
  add({ points: roundRectPts(DX, 0.9, BW + 0.9, 5.3, 0.3), color: PALETTE.violet, width: 1.6 }, 6);
  label(L.nx, DX + BW / 2 + 0.85, 0.9, 6, { size: 80, color: '#e3d6ff' });
  arrow(DX, 3.42, 3.88, 7);
  block(L.linear, DX, 4.2, OUT, 7, 2.4);
  arrow(DX, 4.52, 4.68, 7);
  block(L.softmax, DX, 5.0, OUT, 7, 2.4);
  arrow(DX, 5.32, 5.58, 7);
  label(L.probs, DX, 5.85, 7, { color: '#ffe9a8' });

  const lines = new GlowLines(polys, { width: 2, core: 0.9, pulseWidth: 0.08 });
  diagram.add(lines.object);

  const badge = new YearBadge(MILESTONES.transformer);
  hud.add(badge.group);

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      env.update({
        t: lt + 42,
        scroll: 200 + lt * 18,
        sunY: 26,
        sunIntensity: 1.3,
        glow: 0.5,
        pulse: f.kick * 0.8,
        mountain: 16,
        gridIntensity: 1.0,
        fade: 0.35,
      });
      env.setCamera(camera, height);

      const dive = ease.inCubic(clamp((lt - 5.2) / 0.8));
      const k = ease.inOutCubic(clamp(lt / 5.2));
      const target = new THREE.Vector3(lerp(1.4, 1.0, k), lerp(5.6, 5.2, k), 0);
      const pos = new THREE.Vector3(lerp(-5.5, 3.5, k), lerp(4.2, 6.2, k), lerp(14.5, 13.0, k));
      const diveTarget = new THREE.Vector3(1.2 + EX, 5.2 - 3.5, 0);
      pos.lerp(new THREE.Vector3(diveTarget.x, diveTarget.y, 0.8), dive);
      target.lerp(diveTarget, dive);
      camera.position.copy(pos);
      camera.position.y += f.kick * 0.04;
      camera.lookAt(target);

      polys.forEach((_, i) => {
        const b = beatOf[i] * 0.75;
        const r = ease.outCubic(clamp((lt - b) / 0.45));
        const flash = hit(lt, b, 0.4);
        const sweep = hit(lt, 5.25, 0.5);
        lines.set(i, 0, r, 0.9 + flash * 1.6 + sweep * 1.2 + f.kick * 0.25, r < 1 ? r : -1);
      });
      lines.commit();
      for (const bl of blocks) {
        const b = bl.beat * 0.75;
        bl.fill.material.opacity = smoothstep(b + 0.2, b + 0.45, lt) * 0.12 + hit(lt, b + 0.4, 0.35) * 0.3 + hit(lt, 5.25, 0.5) * 0.2;
      }
      for (const l of labels) l.m.material.opacity = smoothstep(l.beat * 0.75 + 0.15, l.beat * 0.75 + 0.4, lt);

      fx.flash += Math.pow(dive, 3) * 0.9 + hit(lt, 0, 0.2) * 0.3;
      fx.aberration += dive * 1.5;
      badge.update(lt, 0.15, 5.4);
    },
  };
}
