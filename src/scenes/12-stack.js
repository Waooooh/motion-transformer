// 1:24–1:36 · Stack them. The groove section: every beat adds layers until
// the tower is 96 blocks tall (GPT-3 depth), with the residual stream as a
// beam of light running through all of them.
import * as THREE from 'three';
import { textMesh, DynamicText, FAMILY } from '../core/text.js';
import { GlowLines, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { linePts, V } from '../core/shapes.js';
import { Caption } from '../core/hud.js';
import { CAPTIONS } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit } from '../core/math.js';

const COUNTS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 96];
const MAX = 96;
const GAP = 0.22;
const W = 7;
const Dp = 4.2;
const Hs = 0.12;

export default function stackScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 3000);
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 28 });
  scene.add(env.group);

  const tower = new THREE.Group();
  tower.position.set(0, 2.2, -4);
  scene.add(tower);

  // slab fills (instanced)
  const fillGeo = new THREE.BoxGeometry(W, Hs, Dp);
  const fillMat = new THREE.MeshBasicMaterial({ color: '#ff4fd8', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const fills = new THREE.InstancedMesh(fillGeo, fillMat, MAX);
  fills.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fills.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  tower.add(fills);

  // slab edges as glow lines (top rectangle + vertical corners)
  const polys = [];
  const hw = W / 2;
  const hd = Dp / 2;
  for (let i = 0; i < MAX; i++) {
    const y = i * GAP;
    const c = new THREE.Color().lerpColors(PALETTE.pink, PALETTE.cyan, i / MAX);
    polys.push({ points: [V(-hw, y, -hd), V(hw, y, -hd), V(hw, y, hd), V(-hw, y, hd), V(-hw, y, -hd)], color: c, width: 1.4 });
  }
  // residual stream beam
  polys.push({ points: linePts(V(0, -3, 0), V(0, MAX * GAP + 3, 0), 200), color: PALETTE.white, width: 5 });
  const lines = new GlowLines(polys, { width: 2, core: 0.9, pulseWidth: 0.03 });
  tower.add(lines.object);

  const counter = new DynamicText({ width: 900, height: 260, size: 200, family: FAMILY.display, weight: 900, color: '#ffffff', glow: 24, glowColor: HEX.pink, pxPerUnit: 1, align: 'right' });
  counter.mesh.position.set(470, 120, 0);
  counter.mesh.material.depthTest = false;
  hud.add(counter.mesh);
  const unit = textMesh({ text: 'LAYERS · 层', family: FAMILY.mono, size: 36 * 2, letterSpacing: 8, color: '#cbbcff', pxPerUnit: 2, anchor: 'right', depthTest: false });
  unit.position.set(910, 0, 0);
  hud.add(unit);
  const gpt = textMesh({ text: 'GPT-3 · 96 layers', family: FAMILY.mono, size: 34 * 2, letterSpacing: 6, color: '#ffe9a8', glow: 8, glowColor: HEX.amber, pxPerUnit: 2, anchor: 'right', depthTest: false });
  gpt.position.set(910, -60, 0);
  hud.add(gpt);

  const cap = new Caption(CAPTIONS.stack);
  hud.add(cap.group);
  const m4 = new THREE.Matrix4();

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      env.update({ t: lt + 84, scroll: 1000 + lt * 14, sunY: 30, sunScale: 1.3, sunIntensity: 1.6, glow: 0.7, pulse: f.kick * 1.1, mountain: 9, gridIntensity: 1.0 });
      env.setCamera(camera, height);

      const beat = Math.floor(lt / 0.75);
      const bp = lt / 0.75 - beat;
      const target = COUNTS[Math.min(COUNTS.length - 1, beat)];
      const prev = beat > 0 ? COUNTS[Math.min(COUNTS.length - 1, beat - 1)] : 0;
      const grow = ease.outCubic(clamp(bp / 0.35));
      const shown = lerp(prev, target, grow);
      const topY = Math.max(1, shown) * GAP;

      // camera cranes up with the tower and orbits
      const k = ease.inOutCubic(clamp(lt / 12));
      const g = ease.inOutQuad(clamp(lt / 11));
      const ang = lerp(-0.7, 0.45, k);
      const r = lerp(10, 27, g);
      const cy = lerp(5.5, 1.2, g);
      camera.position.set(Math.sin(ang) * r, cy + f.kick * 0.05, -4 + Math.cos(ang) * r);
      camera.lookAt(0, 2.2 + topY * lerp(0.3, 0.62, g), -4);

      for (let i = 0; i < MAX; i++) {
        const on = i < shown ? 1 : clamp(shown - i + 1) * 0;
        const born = i < prev ? 1 : i < target ? grow : 0;
        const pop = i >= prev && i < target ? hit(lt, beat * 0.75, 0.35) : 0;
        const y = i * GAP * (i < target ? 1 : 1);
        m4.makeTranslation(0, y, 0);
        m4.scale(new THREE.Vector3(born > 0 ? 1 : 0.0001, 1, born > 0 ? 1 : 0.0001));
        fills.setMatrixAt(i, m4);
        const c = new THREE.Color().lerpColors(PALETTE.pink, PALETTE.cyan, i / MAX).multiplyScalar(0.8 + pop * 3 + f.kick * 0.4);
        fills.setColorAt(i, c);
        // a wave travels up the stack on every kick
        const wave = Math.exp(-Math.pow((i / Math.max(1, target) - bp * 1.4) * 5, 2)) * f.drums;
        lines.set(i, 0, born, (born > 0 ? 0.9 + pop * 2.5 + wave * 1.2 : 0) * (on || born), -1);
      }
      fills.count = MAX;
      fills.instanceMatrix.needsUpdate = true;
      fills.instanceColor.needsUpdate = true;
      const beamTop = (topY + 3) / (MAX * GAP + 6);
      lines.set(MAX, 0, beamTop, 1.2 + f.kick * 1.5, (bp * 1.3) % 1 * beamTop);
      lines.commit();

      counter.set(`×${Math.round(shown)}`);
      counter.mesh.scale.setScalar(1 + hit(lt, beat * 0.75, 0.25) * 0.12);
      counter.mesh.material.opacity = smoothstep(0.1, 0.4, lt);
      unit.material.opacity = smoothstep(0.3, 0.6, lt) * 0.9;
      gpt.material.opacity = smoothstep(10.6, 11.0, lt);

      fx.aberration += hit(lt, beat * 0.75, 0.2) * 0.35;
      cap.update(lt, 1.2, 11.8);
    },
  };
}
