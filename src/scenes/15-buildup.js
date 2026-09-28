// 2:00–2:12 · Build-up. A hyperspace tunnel lined with attention maps; one
// emergent ability flashes per beat, the last bar stutters on 16ths and the
// whole thing burns to white for drop 2.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, synthColor, PALETTE } from '../core/materials.js';
import { circlePts } from '../core/shapes.js';
import { setOpacity } from '../core/hud.js';
import { ABILITIES } from '../copy.js';
import { chromeText } from './07-title.js';
import { clamp, ease, lerp, smoothstep, hit, hash1, Rng } from '../core/math.js';

const SEG = 7;
const RINGS = 40;
const R = 6.5;

export default function buildupScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
  const hud = new THREE.Scene();
  const overlay = new THREE.Scene();
  const rng = new Rng(40);

  const tunnel = new THREE.Group();
  scene.add(tunnel);
  const ringPolys = [];
  for (let i = 0; i < RINGS; i++) {
    ringPolys.push({ points: circlePts(0, 0, R, 96, -i * SEG), color: [PALETTE.pink, PALETTE.cyan, PALETTE.violet][i % 3], width: 2.2 });
  }
  // longitudinal rails
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ringPolys.push({
      points: [new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0), new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, -RINGS * SEG)],
      color: PALETTE.violet,
      width: 1.2,
    });
  }
  const rings = new GlowLines(ringPolys, { width: 2, core: 0.9, perspective: false });
  tunnel.add(rings.object);

  // attention-map tiles on the walls (one repeating segment pattern)
  const perSeg = 26;
  const tileGeo = new THREE.PlaneGeometry(1.5, 0.9);
  const tileMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const TN = perSeg * RINGS;
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, TN);
  tiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TN * 3), 3);
  const base = [];
  const pattern = Array.from({ length: perSeg }, () => ({ a: rng.float(0, Math.PI * 2), dz: rng.float(0, SEG), v: rng.next(), ph: rng.float(0, 6) }));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let s = 0; s < RINGS; s++) {
    pattern.forEach((p, j) => {
      const i = s * perSeg + j;
      const pos = new THREE.Vector3(Math.cos(p.a) * (R - 0.15), Math.sin(p.a) * (R - 0.15), -s * SEG - p.dz);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().setZ(0).normalize().negate());
      m4.compose(pos, q, new THREE.Vector3(1, 1, 1));
      tiles.setMatrixAt(i, m4);
      base.push({ v: p.v, ph: p.ph + s });
    });
  }
  tunnel.add(tiles);

  const words = ABILITIES.map(([en, zh]) => {
    const g = new THREE.Group();
    const e = chromeText(en, 150);
    const z = textMesh({ text: zh, family: FAMILY.zh, weight: 900, size: 84 * 2, letterSpacing: 30, color: '#ffffff', glow: 20, glowColor: '#ff2a9d', pxPerUnit: 2, depthTest: false });
    z.position.y = -150;
    g.add(e, z);
    g.visible = false;
    overlay.add(g);
    return g;
  });

  const tmpC = new THREE.Color();

  return {
    scene,
    camera,
    hud,
    overlay,
    update({ lt, f, fx, width, height }) {
      rings.setResolution(width, height);
      // speed ramps 9 → 70 u/s (quadratically); travel is its integral
      const travel = 9 * lt + (61 / (3 * 144)) * lt * lt * lt;
      tunnel.position.z = travel % SEG;
      camera.position.set(Math.sin(lt * 0.7) * 0.6, Math.cos(lt * 0.5) * 0.4, 6);
      camera.lookAt(Math.sin(lt * 0.7 + 0.5) * 0.3, 0, -50);
      camera.rotation.z = lt * lt * 0.012 + Math.sin(lt) * 0.05;

      const beat = Math.floor(lt / 0.75);
      const bp = lt / 0.75 - beat;
      const intensity = 0.7 + lt * 0.12;
      for (let i = 0; i < RINGS; i++) {
        const flash = Math.exp(-Math.pow(((i + beat * 3) % RINGS) - bp * 3, 2)) * 0.8;
        rings.set(i, 0, 1, (intensity + f.kick * 1.2 + flash) * (i < 30 ? 1 : (RINGS - i) / 10), -1);
      }
      for (let k = RINGS; k < RINGS + 12; k++) rings.set(k, 0, 1, 0.5 + lt * 0.05 + f.snare * 0.5, -1);
      rings.commit();
      for (let i = 0; i < TN; i++) {
        const b = base[i];
        const flick = 0.35 + 0.65 * Math.max(0, Math.sin(lt * 5 + b.ph));
        synthColor(b.v * 0.8 + 0.2, tmpC).multiplyScalar(flick * (0.8 + f.kick * 0.8 + lt * 0.06));
        tiles.setColorAt(i, tmpC);
      }
      tiles.instanceColor.needsUpdate = true;

      // one ability per beat; the last bar stutters on 16ths
      let idx = -1;
      let pop = 0;
      if (beat < 12) {
        idx = beat;
        pop = hit(lt, beat * 0.75, 0.3);
      } else if (beat < 14) {
        idx = beat;
        pop = hit(lt, beat * 0.75, 0.3);
      } else {
        const sixteenth = Math.floor(lt / 0.1875);
        idx = Math.floor(hash1(sixteenth) * ABILITIES.length);
        pop = hit(lt, sixteenth * 0.1875, 0.1);
      }
      words.forEach((g, i) => {
        g.visible = i === idx;
        if (i === idx) {
          const fade = beat < 14 ? 1 - smoothstep(0.55, 0.75, bp) : 1;
          setOpacity(g, fade);
          g.scale.setScalar(lerp(1.0, 1.25, pop) * (1 + lt * 0.01));
          g.position.set(0, 40, 0);
        }
      });

      const riser = smoothstep(10.5, 12, lt);
      fx.bloom += 0.3 + lt * 0.04 + riser * 1.5;
      fx.aberration += pop * 1.2 + riser * 2;
      fx.glitch += beat >= 14 ? 0.25 + pop * 0.6 : pop * 0.25;
      fx.flash += Math.pow(riser, 2.4) * 1.2 + hit(lt, 0, 0.3) * 0.3;
      fx.zoom = 1 + riser * 0.1;
    },
  };
}
