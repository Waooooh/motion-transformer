// 0:06–0:12 · 1943, the artificial neuron.
// The number joins others to become a vector; weighted connections feed a
// neuron that sums them and fires.
import * as THREE from 'three';
import { textMesh, DynamicText, FAMILY } from '../core/text.js';
import { GlowLines, glowSprite, HEX, PALETTE } from '../core/materials.js';
import { circlePts, bracketPts, linePts, V } from '../core/shapes.js';
import { Caption, YearBadge } from '../core/hud.js';
import { CAPTIONS, MILESTONES } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, fmt, Rng } from '../core/math.js';

const X = [0.42, -1.37, 0.08, 2.71, -0.66];
const W = [0.9, -0.5, 1.2, 0.3, -0.8];
const ENTRY_SCALE = 0.3;

export default function neuronScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 500);
  const hud = new THREE.Scene();
  const rng = new Rng(202);

  const vx = -1.75;
  const vy = -0.25;
  const gap = 0.62;
  const slotY = (i) => vy + (2 - i) * gap;
  const nx = 2.95;
  const ny = vy;
  const nr = 0.62;

  // vector entries (same look as the opening number)
  const entries = X.map((v, i) => {
    const m = textMesh({ text: fmt(v, 2), family: FAMILY.mono, size: 220, color: '#f2feff', glow: 22, glowColor: HEX.cyan, pxPerUnit: 200 });
    scene.add(m);
    return { m, from: i === 0 ? V(0, 0, 0) : V(rng.float(-9, 9), rng.float(-5, 5), rng.float(-30, -14)), to: V(vx, slotY(i), 0) };
  });

  // lines: 0-4 weights, 5 ring, 6 output, 7-8 brackets, 9 step icon
  const polys = [];
  const wColor = (w) => (w >= 0 ? PALETTE.pink : PALETTE.cyan);
  X.forEach((_, i) => {
    const a = V(vx + 0.62, slotY(i), 0);
    const dir = a.clone().sub(V(nx, ny, 0)).normalize();
    const b = V(nx, ny, 0).addScaledVector(dir, nr + 0.04);
    polys.push({ points: linePts(a, b, 24), color: wColor(W[i]), width: 0.8 + Math.abs(W[i]) * 2.2 });
  });
  polys.push({ points: circlePts(nx, ny, nr, 72), color: PALETTE.pink, width: 2.2 });
  polys.push({ points: linePts(V(nx + nr + 0.05, ny, 0), V(nx + 2.1, ny, 0), 16), color: PALETTE.yellow, width: 2.4 });
  polys.push({ points: bracketPts(vx - 0.62, vy, 5 * gap + 0.1, -1, 0.16), color: PALETTE.cyan, width: 1.6 });
  polys.push({ points: bracketPts(vx + 0.62, vy, 5 * gap + 0.1, 1, 0.16), color: PALETTE.cyan, width: 1.6 });
  // step-function glyph inside the neuron's lower half
  polys.push({
    points: [V(nx - 0.3, ny - 0.36, 0), V(nx, ny - 0.36, 0), V(nx, ny - 0.14, 0), V(nx + 0.3, ny - 0.14, 0)],
    color: PALETTE.amber,
    width: 1.4,
  });
  const lines = new GlowLines(polys, { width: 2.2, core: 0.9, pulseWidth: 0.06 });
  scene.add(lines.object);

  const core = glowSprite(PALETTE.magenta, 2.4, 0);
  core.position.set(nx, ny, -0.05);
  scene.add(core);

  const sigma = textMesh({ text: 'Σ', family: FAMILY.math, size: 150, color: '#ffffff', glow: 14, glowColor: HEX.pink, pxPerUnit: 300 });
  sigma.position.set(nx, ny + 0.14, 0.01);
  scene.add(sigma);

  const wLabels = W.map((w, i) => {
    const m = textMesh({ text: `w${'₁₂₃₄₅'[i]} ${fmt(w, 1)}`, family: FAMILY.mono, size: 64, color: w >= 0 ? '#ffc4f1' : '#bff6ff', pxPerUnit: 320 });
    const a = V(vx + 0.62, slotY(i), 0);
    const b = V(nx, ny, 0);
    const p = a.clone().lerp(b, 0.34);
    m.position.set(p.x, p.y + 0.13, 0.01);
    scene.add(m);
    return m;
  });

  const sum = new DynamicText({ width: 900, height: 110, size: 64, family: FAMILY.mono, color: '#ffe9a8', glow: 10, glowColor: HEX.amber, pxPerUnit: 320 });
  sum.mesh.position.set(nx, ny - nr - 0.32, 0);
  scene.add(sum.mesh);
  const out = textMesh({ text: '1', family: FAMILY.mono, size: 220, color: '#fff6c9', glow: 22, glowColor: HEX.amber, pxPerUnit: 400 });
  out.position.set(nx + 2.45, ny, 0);
  scene.add(out);

  const badge = new YearBadge(MILESTONES.neuron);
  hud.add(badge.group);
  const cap = new Caption(CAPTIONS.neuron);
  hud.add(cap.group);

  const partial = (n) => X.slice(0, n).reduce((s, x, i) => s + x * W[i], 0);
  const total = partial(5);

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      const e = f.energy;
      // camera pulls back from the close-up on the number
      const kc = ease.inOutCubic(clamp(lt / 1.8));
      camera.position.set(lerp(0, 0.55, kc) + Math.sin(lt * 0.4) * 0.08, lerp(0, -0.25, kc), lerp(6.2, 10.5, kc) - lt * 0.05);
      camera.lookAt(lerp(0, 0.55, kc), lerp(0, -0.35, kc), 0);

      entries.forEach((en, i) => {
        const start = i === 0 ? 0 : 0.15 + i * 0.12;
        const k = ease.outCubic(clamp((lt - start) / 1.0));
        en.m.position.lerpVectors(en.from, en.to, k);
        const s = i === 0 ? lerp(1, ENTRY_SCALE, ease.inOutCubic(clamp(lt / 1.1))) : ENTRY_SCALE * (0.4 + 0.6 * k);
        en.m.scale.setScalar(s);
        en.m.material.opacity = i === 0 ? 1 : clamp((lt - start) * 3);
        // light up as its pulse leaves
        const fire = hit(lt, 2.2 + i * 0.2, 0.3) + hit(lt, 4.9 + i * 0.08, 0.2);
        en.m.material.color.setScalar(1.15 + fire * 1.5);
      });

      // weights draw in, then pulses run into the neuron
      for (let i = 0; i < 5; i++) {
        const r = ease.outCubic(clamp((lt - 1.25 - i * 0.08) / 0.7));
        const p1 = clamp((lt - 2.2 - i * 0.2) / 0.5);
        const p2 = clamp((lt - 4.9 - i * 0.08) / 0.35);
        const pulse = p1 > 0 && p1 < 1 ? p1 : p2 > 0 && p2 < 1 ? p2 : -1;
        lines.set(i, 0, r, 0.55 + 0.35 * e, pulse);
        wLabels[i].material.opacity = smoothstep(1.6 + i * 0.08, 2.1 + i * 0.08, lt) * 0.9;
      }
      const ringK = ease.inOutCubic(clamp((lt - 1.3) / 0.8));
      const fireA = hit(lt, 3.95, 0.35);
      const fireB = hit(lt, 5.35, 0.3);
      const fire = fireA + fireB;
      lines.set(5, 0, ringK, 1.0 + fire * 2.5, -1);
      lines.set(6, 0, ease.outCubic(clamp((lt - 3.95) / 0.35)), 1.2 + fire, clamp((lt - 5.35) / 0.3) < 1 ? clamp((lt - 5.35) / 0.3) : -1);
      lines.set(7, 0, ease.outCubic(clamp((lt - 0.6) / 0.6)), 1, -1);
      lines.set(8, 0, ease.outCubic(clamp((lt - 0.6) / 0.6)), 1, -1);
      lines.set(9, 0, ease.outCubic(clamp((lt - 1.8) / 0.5)), 1 + fire, -1);
      lines.commit();

      core.material.opacity = smoothstep(1.4, 2.0, lt) * 0.25 + fire * 1.2;
      core.scale.setScalar(2.2 + fire * 1.8);
      sigma.material.opacity = smoothstep(1.5, 2.0, lt);
      sigma.material.color.setScalar(1 + fire * 1.5);

      // running weighted sum
      let n = 0;
      for (let i = 0; i < 5; i++) if (lt > 2.7 + i * 0.2) n = i + 1;
      sum.set(n === 0 ? 'Σ wᵢxᵢ = 0.00' : `Σ wᵢxᵢ = ${fmt(partial(n), 2)}${n === 5 && lt > 3.95 ? '  > θ' : ''}`);
      sum.mesh.material.opacity = smoothstep(2.4, 2.8, lt);
      void total;

      out.material.opacity = smoothstep(4.1, 4.3, lt);
      out.material.color.setScalar(1.2 + fire * 2);
      out.scale.setScalar(1 + hit(lt, 4.1, 0.25) * 0.4 + fireB * 0.25);

      fx.flash += fireA * 0.08;
      badge.update(lt, 0.25, 5.85);
      cap.update(lt, 2.4, 5.85);
    },
  };
}
