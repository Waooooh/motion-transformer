// 2:12–2:24 · DROP 2. An attention galaxy: thousands of token-stars in a
// spiral, with waves of attention arcs firing across it on every beat while
// the camera dives through the disk.
import * as THREE from 'three';
import { FAMILY } from '../core/text.js';
import { GlowLines, GlowPoints, glowSprite, PALETTE } from '../core/materials.js';
import { LabelAtlas, LabelField } from '../core/labels.js';
import { SynthwaveEnv } from '../core/env.js';
import { Caption } from '../core/hud.js';
import { CAPTIONS } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, hash1, Rng } from '../core/math.js';

const STARS = 3200;
const ARCS = 1400;
const RADIUS = 30;

const WORDS = (
  'attention is all you need the dominant sequence transduction models are based on complex recurrent or convolutional ' +
  'neural networks that include an encoder and a decoder we propose a new simple network architecture the transformer ' +
  'based solely on attention mechanisms dispensing with recurrence and convolutions entirely query key value softmax ' +
  'token vector matrix layer head embedding position learn predict next word every other it animal street tired ' +
  'light dream music night city neon ocean star time memory language code image sound meaning'
).split(' ');

export default function galaxyScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 3000);
  const hud = new THREE.Scene();
  const rng = new Rng(44);
  const env = new SynthwaveEnv({ seed: 44 });
  env.terrain.visible = false;
  env.ridge.visible = false;
  env.sun.visible = false;
  env.sky.visible = false;
  scene.add(env.group);

  const galaxy = new THREE.Group();
  scene.add(galaxy);

  // stars on three spiral arms + a bulge
  const stars = [];
  const palette = [PALETTE.pink, PALETTE.cyan, PALETTE.violet, PALETTE.amber, PALETTE.teal];
  for (let i = 0; i < STARS; i++) {
    const bulge = rng.next() < 0.18;
    let r;
    let th;
    if (bulge) {
      r = Math.abs(rng.gauss()) * 3.2;
      th = rng.float(0, Math.PI * 2);
    } else {
      r = 2 + Math.pow(rng.next(), 0.8) * RADIUS;
      const arm = rng.int(0, 2);
      th = (arm / 3) * Math.PI * 2 + r * 0.19 + rng.gauss() * 0.28;
    }
    const y = rng.gauss() * (bulge ? 1.2 : 0.45) * (1 - r / (RADIUS + 4));
    const c = bulge ? new THREE.Color(1, 0.85, 0.7) : palette[rng.int(0, palette.length - 1)].clone();
    stars.push({ p: new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r), c, s: rng.float(0.14, 0.4) * (bulge ? 1.3 : 1), ph: rng.float(0, 6.28), r });
  }
  const pts = new GlowPoints(STARS, { core: 1.2, minSize: 1.5 });
  galaxy.add(pts.object);

  // attention arcs between stars (mostly local, some long-range)
  const polys = [];
  const arcMeta = [];
  for (let a = 0; a < ARCS; a++) {
    const i = rng.int(0, STARS - 1);
    let j = rng.int(0, STARS - 1);
    if (rng.next() < 0.85) {
      // pick a nearby star
      let best = j;
      let bd = Infinity;
      for (let k = 0; k < 24; k++) {
        const cand = rng.int(0, STARS - 1);
        const d = stars[cand].p.distanceToSquared(stars[i].p);
        if (d < bd && cand !== i) {
          bd = d;
          best = cand;
        }
      }
      j = best;
    }
    const A = stars[i].p;
    const B = stars[j].p;
    const d = A.distanceTo(B);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    mid.y += Math.min(d * 0.12, 2.6) + 0.2;
    const curve = new THREE.QuadraticBezierCurve3(A.clone(), mid, B.clone());
    const col = stars[i].c.clone().lerp(stars[j].c, 0.5).multiplyScalar(1.1);
    polys.push({ points: curve.getPoints(18), color: col, width: 0.05 + Math.min(0.12, d * 0.004) });
    arcMeta.push({ group: rng.int(0, 15), delay: rng.float(0, 0.35), len: d });
  }
  const arcs = new GlowLines(polys, { width: 1, perspective: true, core: 0.7, pulseWidth: 0.08, maxWidth: 16 });
  galaxy.add(arcs.object);

  const core = glowSprite(new THREE.Color(1, 0.75, 0.9), 14, 1);
  const core2 = glowSprite(PALETTE.white, 4, 1);
  galaxy.add(core, core2);

  // floating words on a subset of stars
  const atlas = new LabelAtlas([...new Set(WORDS)], { family: FAMILY.body, weight: 600, size: 64, color: '#ffffff' });
  const LN = 420;
  const labels = new LabelField(atlas, LN);
  const labelStars = [];
  for (let k = 0; k < LN; k++) {
    const si = rng.int(0, STARS - 1);
    labelStars.push(si);
    labels.setLabel(k, atlas.index.get(WORDS[k % WORDS.length]));
  }
  galaxy.add(labels.object);

  const cap = new Caption(CAPTIONS.galaxy);
  hud.add(cap.group);
  const tmp = new THREE.Vector3();

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      arcs.setResolution(width, height);
      env.update({ t: lt + 132, starAlpha: 1, glow: 0.2, fade: 0.2 });
      env.setCamera(camera, height);
      pts.setCamera(camera, height);

      galaxy.rotation.y = lt * 0.06;
      // camera: overhead → dive into the disk → skim past the core
      const k1 = ease.inOutCubic(clamp(lt / 7));
      const k2 = ease.inOutCubic(clamp((lt - 6) / 6));
      const ang = lerp(0.3, 2.2, k1 * 0.6 + k2 * 0.4);
      const dist = lerp(lerp(30, 26, k1), 14, k2);
      const hgt = lerp(lerp(52, 7, k1), 2.2, k2);
      camera.position.set(Math.cos(ang) * dist, hgt + f.kick * 0.15, Math.sin(ang) * dist);
      camera.lookAt(lerp(0, 4, k2), lerp(0, 0.5, k2), 0);
      camera.rotation.z += lerp(0, 0.18, k2) * Math.sin(lt * 0.5);

      const beat = Math.floor(lt / 0.75);
      const bp = lt / 0.75 - beat;
      for (let i = 0; i < STARS; i++) {
        const s = stars[i];
        const tw = 0.7 + 0.3 * Math.sin(lt * 3 + s.ph);
        const b = (1.1 + f.kick * 0.8 * Math.exp(-s.r / 10)) * tw;
        pts.setPoint(i, s.p.x, s.p.y, s.p.z, s.c.r * b, s.c.g * b, s.c.b * b, s.s * (1 + f.kick * 0.3), 1);
      }
      pts.commit();

      // arcs: the group matching this beat fires, older ones fade
      for (let a = 0; a < ARCS; a++) {
        const m = arcMeta[a];
        let best = 0;
        let pulse = -1;
        let reveal = 0;
        for (let back = 0; back < 3; back++) {
          const b = beat - back;
          if (b < 0 || ((b % 16) + 16) % 16 !== m.group && (b * 7 + m.group) % 5 !== 0) continue;
          const age = lt - b * 0.75 - m.delay * 0.4;
          if (age < 0) continue;
          const r = ease.outCubic(clamp(age / 0.35));
          const inten = Math.exp(-age / 0.9);
          if (inten > best) {
            best = inten;
            reveal = r;
            pulse = age < 0.6 ? age / 0.6 : -1;
          }
        }
        const ambient = 0.12 * smoothstep(0, 1, lt);
        arcs.set(a, 0, Math.max(reveal, ambient > 0 ? 1 : 0), ambient + best * 1.6, pulse);
      }
      arcs.commit();

      const flare = f.kick;
      core.scale.setScalar(14 + flare * 5);
      core.material.opacity = 0.55 + flare * 0.4;
      core2.scale.setScalar(4 + flare * 2);

      galaxy.updateMatrixWorld();
      for (let k = 0; k < LN; k++) {
        const s = stars[labelStars[k]];
        tmp.copy(s.p).applyMatrix4(galaxy.matrixWorld);
        const d = tmp.distanceTo(camera.position);
        const a = smoothstep(26, 8, d) * smoothstep(0.5, 1.5, lt);
        labels.set(k, s.p.x, s.p.y + 0.25, s.p.z, 0.32, a, s.c.r * 1.3 + 0.3, s.c.g * 1.3 + 0.3, s.c.b * 1.3 + 0.3);
      }
      labels.commit();

      fx.flash += hit(lt, 0, 0.28) * 1.1;
      fx.aberration += hit(lt, 0, 0.6) * 3 + f.snare * 0.3;
      fx.bloom += 0.35;
      fx.zoom = 1 + hit(lt, 0, 0.6) * 0.06 + f.kick * 0.008;
      void bp;
      cap.update(lt, 6.2, 11.8);
    },
  };
}
