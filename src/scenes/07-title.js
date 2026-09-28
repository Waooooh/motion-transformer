// 0:36–0:42 · DROP 1. White-out → the full synthwave vista, and the title
// slams in: ATTENTION IS ALL YOU NEED, with the neon "Transformer" script.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { HEX } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { setOpacity } from '../core/hud.js';
import { TITLE } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, hash1 } from '../core/math.js';

const CHROME = [
  [0, '#ffffff'],
  [0.3, '#bdeeff'],
  [0.47, '#58b4ff'],
  [0.5, '#1a1050'],
  [0.56, '#3b1d6e'],
  [0.8, '#ff5ec4'],
  [1, '#ffe3f6'],
];

export function chromeText(text, size, extra = {}) {
  return textMesh({
    text,
    family: 'Orbitron',
    weight: 900,
    size: size * 2,
    letterSpacing: 10,
    gradient: CHROME,
    stroke: 7,
    strokeColor: '#ff4fd8',
    glow: 26,
    glowColor: 'rgba(255, 42, 157, 0.9)',
    glowPasses: 2,
    pxPerUnit: 2,
    depthTest: false,
    ...extra,
  });
}

export function neonScript(text, size, extra = {}) {
  return textMesh({
    text,
    family: FAMILY.script,
    size: size * 2,
    color: '#ffe4fa',
    glow: 30,
    glowColor: '#ff2a9d',
    glowPasses: 3,
    stroke: 3,
    strokeColor: '#ff7de0',
    pxPerUnit: 2,
    depthTest: false,
    ...extra,
  });
}

export default function titleScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000);
  const overlay = new THREE.Scene();
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 12 });
  scene.add(env.group);

  const title = new THREE.Group();
  const l1 = chromeText(TITLE.main[0], 138);
  const l2 = chromeText(TITLE.main[1], 138);
  l1.position.y = 95;
  l2.position.y = -70;
  title.add(l1, l2);
  title.position.y = 150;
  overlay.add(title);

  const clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -2000);
  const script = neonScript(TITLE.script, 190);
  script.material.clippingPlanes = [clip];
  script.rotation.z = THREE.MathUtils.degToRad(-8);
  script.position.set(230, -95, 0);
  overlay.add(script);

  const zh = textMesh({ text: TITLE.zh, family: FAMILY.zh, weight: 500, size: 46 * 2, letterSpacing: 18 * 2, color: '#ffffff', glow: 12, glowColor: 'rgba(255,79,216,0.7)', pxPerUnit: 2, depthTest: false });
  zh.position.y = -300;
  const sub = textMesh({ text: TITLE.sub, family: FAMILY.body, weight: 600, size: 26 * 2, letterSpacing: 12 * 2, color: '#d9ccff', pxPerUnit: 2, depthTest: false });
  sub.position.y = -360;
  const subs = new THREE.Group();
  subs.add(zh, sub);
  hud.add(subs);

  return {
    scene,
    camera,
    overlay,
    hud,
    update({ lt, f, fx, width, height }) {
      const e = f.energy;
      const out = smoothstep(5.2, 6.0, lt);
      env.update({
        t: lt + 36,
        scroll: 60 + lt * (26 + out * 30),
        sunY: 36,
        sunScale: 1.18,
        sunIntensity: 1.9 + f.kick * 0.4,
        sunHalo: 1.1,
        glow: 0.8,
        pulse: f.kick * 0.9,
        mountain: 17,
        gridIntensity: 1.35,
      });
      env.setCamera(camera, height);
      const sway = Math.sin(lt * 0.9) * 0.4;
      camera.position.set(sway, 1.7 + Math.sin(lt * 1.3) * 0.08 + f.kick * 0.05, 10);
      camera.lookAt(sway * 0.4, 6.2, -100);
      camera.rotation.z = Math.sin(lt * 0.7) * 0.025;

      // slam in on the downbeat
      const slam = ease.outExpo(clamp(lt / 0.45));
      const s = lerp(1.45, 1, slam) * (1 + f.kick * 0.018) * (1 + out * 0.35);
      title.scale.setScalar(s);
      title.position.y = 150 + out * 90;
      setOpacity(title, clamp(lt / 0.08) * (1 - out));
      // the script writes itself in on beat 2
      const w = ease.inOutCubic(clamp((lt - 0.75) / 0.55));
      clip.constant = lerp(-760, 760, w) + 230;
      const flick = lt > 1.4 && hash1(Math.floor(lt * 14)) < 0.05 ? 0.4 : 1;
      script.material.opacity = (lt > 0.75 ? 1 : 0) * flick * (1 - out);
      script.scale.setScalar(1 + hit(lt, 1.3, 0.25) * 0.08 + f.snare * 0.02);
      subs.visible = true;
      setOpacity(subs, smoothstep(1.6, 2.2, lt) * (1 - smoothstep(4.8, 5.4, lt)));

      fx.flash += hit(lt, 0, 0.32) * 1.1;
      fx.aberration += hit(lt, 0, 0.4) * 2.5 + hit(lt, 0.75, 0.3) * 0.8;
      fx.bloom += 0.25 + e * 0.2;
      fx.zoom = 1 + hit(lt, 0, 0.5) * 0.04 + out * 0.05;
      fx.glitch += out > 0.6 ? (out - 0.6) * 1.2 : 0;
    },
  };
}
