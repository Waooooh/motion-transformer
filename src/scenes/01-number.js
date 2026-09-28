// 0:00–0:06 · "It begins with a number."
// A single number ignites in the dark; a faint field of other numbers
// drifts in around it as the intro swells.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { LabelAtlas, LabelField } from '../core/labels.js';
import { GlowPoints, HEX } from '../core/materials.js';
import { Caption } from '../core/hud.js';
import { CAPTIONS } from '../copy.js';
import { Rng, smoothstep, ease, clamp, hit, fmt, hash1, lerp } from '../core/math.js';

export default function numberScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 500);
  const hud = new THREE.Scene();
  const rng = new Rng(101);

  const num = textMesh({
    text: '0.42',
    family: FAMILY.mono,
    size: 220,
    color: '#f2feff',
    glow: 22,
    glowColor: HEX.cyan,
    pxPerUnit: 200,
  });
  scene.add(num);
  const halo = textMesh({ text: '0.42', family: FAMILY.mono, size: 220, color: HEX.cyan, glow: 60, glowColor: HEX.cyan, pxPerUnit: 200, additive: true });
  halo.position.z = -0.01;
  scene.add(halo);

  // a sea of other numbers at many depths
  const strings = [];
  for (let i = 0; i < 64; i++) strings.push(fmt(rng.gauss() * 1.3, rng.next() < 0.3 ? 3 : 2));
  const atlas = new LabelAtlas(strings, { family: FAMILY.mono, size: 64, color: '#ffffff' });
  const N = 320;
  const field = new LabelField(atlas, N);
  const items = [];
  for (let i = 0; i < N; i++) {
    let x = rng.float(-18, 18);
    let y = rng.float(-10, 10);
    const z = rng.float(-46, 3);
    if (Math.abs(x) < 2.2 && Math.abs(y) < 1.2 && z > -8) x += 5 * Math.sign(x || 1);
    const it = { li: i % strings.length, x, y, z, h: rng.float(0.22, 0.42), a: rng.float(0.18, 0.6), t0: rng.float(0.8, 5.2), c: rng.next() };
    items.push(it);
    field.setLabel(i, it.li);
  }
  scene.add(field.object);

  const dust = new GlowPoints(700, { core: 0.4, minSize: 1 });
  const dustItems = [];
  for (let i = 0; i < 700; i++) {
    dustItems.push({ x: rng.float(-20, 20), y: rng.float(-12, 12), z: rng.float(-40, 5), s: rng.float(0.02, 0.07), ph: rng.float(0, 6.28) });
  }
  scene.add(dust.object);

  const cap = new Caption(CAPTIONS.number);
  hud.add(cap.group);

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, height }) {
      // neon-tube ignition: flicker, then settle
      const flick = lt < 0.55 ? (hash1(Math.floor(lt * 28) + 3) > 0.45 ? 1 : 0.15) : 1;
      const boom = hit(lt, 0.02, 0.4);
      const breathe = 0.9 + 0.1 * Math.sin(lt * 2.1);
      num.material.opacity = flick;
      num.material.color.setScalar((1.25 + boom * 2.5) * breathe);
      halo.material.opacity = flick * (0.35 + boom * 0.8) * breathe;
      fx.flash = 0.28 * hit(lt, 0.0, 0.18);
      fx.aberration += boom * 0.8;

      const k = ease.inOutCubic(clamp(lt / 6));
      camera.position.set(Math.sin(lt * 0.35) * 0.25, Math.cos(lt * 0.27) * 0.12, lerp(9.5, 6.2, k));
      camera.lookAt(0, 0, 0);
      camera.rotation.z = Math.sin(lt * 0.2) * 0.015;

      const e = f.energy;
      for (let i = 0; i < N; i++) {
        const it = items[i];
        const a = it.a * smoothstep(it.t0, it.t0 + 1.4, lt) * (0.7 + e * 0.6);
        const z = it.z + lt * 0.9;
        const tw = 0.75 + 0.25 * Math.sin(lt * 3 + i);
        const cr = it.c < 0.5 ? 0.55 : 1.0;
        const cg = it.c < 0.5 ? 0.85 : 0.45;
        field.set(i, it.x, it.y, z, it.h, a * tw, cr, cg, 1.0);
      }
      field.commit();

      dust.setCamera(camera, height);
      for (let i = 0; i < dustItems.length; i++) {
        const d = dustItems[i];
        dust.setPoint(i, d.x + Math.sin(lt * 0.3 + d.ph) * 0.3, d.y + lt * 0.08, d.z + lt * 0.6, 0.6, 0.7, 1.0, d.s, 0.35 * smoothstep(0, 2, lt));
      }
      dust.commit();

      cap.update(lt, 1.3, 5.8);
    },
  };
}
