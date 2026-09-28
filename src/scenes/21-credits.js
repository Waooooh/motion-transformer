// 3:27–3:56 · Credits. The paper and its eight authors land on the sparse
// hits of the tail, the chrome logo, the music credit — and at the very end
// the number we started with, one last flash, black.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { HEX } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { Caption, setOpacity } from '../core/hud.js';
import { CAPTIONS, CREDITS } from '../copy.js';
import { TAIL_HITS, bars } from '../core/song.js';
import { chromeText, neonScript } from './07-title.js';
import { clamp, ease, lerp, smoothstep, hit, hash1 } from '../core/math.js';

const T0 = bars(69); // 207 s
const H = TAIL_HITS.map((t) => t - T0); // local times of the hits

export default function creditsScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 3000);
  const overlay = new THREE.Scene();
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 69 });
  scene.add(env.group);

  const paper = textMesh({ text: CREDITS.paper, family: FAMILY.math, weight: 600, size: 84 * 2, color: '#ffffff', glow: 16, glowColor: 'rgba(255,79,216,0.8)', pxPerUnit: 2, depthTest: false });
  paper.position.y = 250;
  overlay.add(paper);
  const row = (names, y) => {
    const m = textMesh({ text: names.join('   ·   '), family: FAMILY.body, weight: 600, size: 40 * 2, letterSpacing: 6, color: '#efe6ff', glow: 8, glowColor: 'rgba(30,227,255,0.6)', pxPerUnit: 2, depthTest: false });
    m.position.y = y;
    hud.add(m);
    return m;
  };
  const row1 = row(CREDITS.authors.slice(0, 4), 110);
  const row2 = row(CREDITS.authors.slice(4), 40);
  const venue = textMesh({ text: CREDITS.venue, family: FAMILY.mono, size: 34 * 2, letterSpacing: 16, color: '#ffe9a8', glow: 8, glowColor: HEX.amber, pxPerUnit: 2, depthTest: false });
  venue.position.y = -40;
  hud.add(venue);

  const logo = new THREE.Group();
  const logoText = chromeText(CREDITS.logo, 170, { letterSpacing: 26 });
  const logoScript = neonScript('Attention', 150);
  logoScript.rotation.z = THREE.MathUtils.degToRad(-7);
  logoScript.position.set(260, -120, 0);
  const since = textMesh({ text: CREDITS.since, family: FAMILY.display, weight: 700, size: 40 * 2, letterSpacing: 24, color: '#ffffff', glow: 12, glowColor: HEX.cyan, pxPerUnit: 2, depthTest: false });
  since.position.y = -250;
  logo.add(logoText, logoScript, since);
  logo.position.y = 120;
  overlay.add(logo);
  const music = textMesh({ text: CREDITS.music, family: FAMILY.body, weight: 600, size: 30 * 2, letterSpacing: 8, color: '#cbbcff', pxPerUnit: 2, depthTest: false });
  music.position.y = -300;
  hud.add(music);

  const num = textMesh({ text: '0.42', family: FAMILY.mono, size: 200 * 2, color: '#f2feff', glow: 30, glowColor: HEX.cyan, pxPerUnit: 2, depthTest: false });
  num.position.y = 30;
  overlay.add(num);
  const cap = new Caption(CAPTIONS.ending);
  hud.add(cap.group);

  const END = 236.47 - T0;

  return {
    scene,
    camera,
    overlay,
    hud,
    update({ lt, f, fx, height }) {
      const set = smoothstep(0, 22, lt);
      env.update({
        t: lt + 207,
        scroll: 2950 + lt * 3,
        sunY: lerp(-8, -42, set),
        sunScale: 1.3,
        sunIntensity: 1.3,
        glow: lerp(0.5, 0.15, set),
        pulse: f.kick * 0.6,
        mountain: 14,
        gridIntensity: lerp(0.8, 0.35, set),
        fade: smoothstep(20, 27, lt) * 0.85,
        starAlpha: 1,
      });
      env.setCamera(camera, height);
      camera.position.set(0, lerp(3.6, 5.5, set), lerp(16, 20, set));
      camera.lookAt(0, lerp(10, 16, set), -100);

      // paper title + authors on the tail hits
      const namesOut = 1 - smoothstep(12.6, 13.6, lt);
      paper.material.opacity = smoothstep(0.4, 1.4, lt) * namesOut;
      row1.material.opacity = smoothstep(H[0], H[0] + 0.25, lt) * namesOut;
      row2.material.opacity = smoothstep(H[1], H[1] + 0.25, lt) * namesOut;
      venue.material.opacity = smoothstep(H[2], H[2] + 0.25, lt) * namesOut;
      row1.scale.setScalar(1 + hit(lt, H[0], 0.3) * 0.06);
      row2.scale.setScalar(1 + hit(lt, H[1], 0.3) * 0.06);

      // logo on the 222 s hit, music credit on 225.8 s
      const lin = smoothstep(H[3] - 0.05, H[3] + 0.1, lt) * (1 - smoothstep(19.5, 21, lt));
      setOpacity(logo, lin);
      logo.scale.setScalar(lerp(1.25, 1, ease.outExpo(clamp((lt - H[3]) / 0.5))) * (1 + (lt - H[3]) * 0.004));
      music.material.opacity = smoothstep(H[4], H[4] + 0.6, lt) * (1 - smoothstep(20, 21.2, lt));

      // back to the number we started with
      const nIn = smoothstep(21.6, 23.2, lt);
      const lastHit = hit(lt, H[5], 0.12);
      const off = lt > H[5] + 0.18 ? 0 : 1;
      const flick = lt > 21.6 && lt < 22.2 ? (hash1(Math.floor(lt * 26)) > 0.4 ? 1 : 0.2) : 1;
      num.material.opacity = nIn * off * flick;
      num.material.color.setScalar(1.2 + lastHit * 3);
      num.scale.setScalar(0.62 + lastHit * 0.15);
      cap.update(lt, 23.0, H[5] + 0.15, 0.6);

      fx.flash += hit(lt, H[0], 0.2) * 0.12 + hit(lt, H[1], 0.2) * 0.12 + hit(lt, H[2], 0.2) * 0.12 + hit(lt, H[3], 0.3) * 0.5 + lastHit * 0.8;
      fx.aberration += hit(lt, H[3], 0.4) * 1.5 + lastHit * 2;
      fx.fade = lt > H[5] + 0.18 ? 1 : smoothstep(END - 0.2, END, lt);
    },
  };
}
