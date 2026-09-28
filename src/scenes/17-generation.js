// 2:24–2:36 · Generation. The model writes, token by token, on the beat.
// Its probability distribution over the vocabulary is a neon EQ skyline on
// the horizon: every step reshapes it, the winning bar fires, and the token
// shoots up into the text.
import * as THREE from 'three';
import { textMesh, DynamicText, FAMILY } from '../core/text.js';
import { synthColor, glowSprite, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { Caption } from '../core/hud.js';
import { CAPTIONS, GENERATED, GENERATED_ZH } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, hash1 } from '../core/math.js';
import { THEME } from '../core/theme.js';

const DECOR = THEME.k.decor;

const BARS = 96;
const ALTS = [' the', ' a', ' it', ' we', ' and', ' to', ' was', ' they', ' is', ' of', ' in', ' all'];

// token schedule: 8th notes, the last line on 16ths
function schedule() {
  const out = [];
  let t = 0.375;
  let line = 0;
  for (const tok of GENERATED) {
    if (tok === '\n') {
      line++;
      continue;
    }
    out.push({ tok, t, line });
    t += line >= 3 ? 0.1875 : 0.375;
  }
  return out;
}

export default function generationScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 3000);
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 48 });
  scene.add(env.group);
  const steps = schedule();

  // the skyline
  const sky = new THREE.Group();
  sky.position.set(0, 0, -35);
  scene.add(sky);
  const barGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const barMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const bars = new THREE.InstancedMesh(barGeo, barMat, BARS);
  bars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BARS * 3), 3);
  sky.add(bars);
  const SW = 100;
  const barX = (i) => -SW / 2 + (i + 0.5) * (SW / BARS);
  const dist = (s) => {
    // a peaked, Zipf-like distribution whose winner depends on the step
    const win = Math.floor(hash1(s * 3.1 + 1) * (BARS - 20)) + 10;
    const arr = new Float32Array(BARS);
    for (let i = 0; i < BARS; i++) {
      const rank = Math.abs(i - win) + hash1(i * 7.7 + s) * 6;
      arr[i] = 0.16 + (0.6 / (1 + rank * rank * 0.03)) * (0.35 + hash1(i + s * 13) * 0.65) + 0.1 * hash1(i * 3.3 + s * 0.7);
    }
    arr[win] = 0.75 + hash1(s + 99) * 0.2;
    return { arr, win };
  };
  const dists = steps.map((_, s) => dist(s));
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const winGlow = glowSprite(PALETTE.white, 8, 0);
  sky.add(winGlow);

  // generated text (HUD)
  const lines = [0, 1, 2, 3].map((i) => {
    const d = new DynamicText({ width: 1800, height: 110, size: 64, family: FAMILY.body, weight: 600, color: '#ffffff', glow: 12, glowColor: HEX.cyan, pxPerUnit: 1, align: 'left' });
    d.mesh.position.set(40, 430 - i * 108, 0);
    d.mesh.material.depthTest = false;
    hud.add(d.mesh);
    return d;
  });
  const zhLines = GENERATED_ZH.map((z, i) => {
    const m = textMesh({ text: z, family: FAMILY.zh, weight: 300, size: 30 * 2, letterSpacing: 6, color: '#d8c8ff', pxPerUnit: 2, anchor: 'left', depthTest: false });
    m.position.set(-852, 430 - i * 108 - 46, 0);
    hud.add(m);
    return m;
  });
  const cand = [0, 1, 2].map((i) => {
    const d = new DynamicText({ width: 700, height: 70, size: 40, family: FAMILY.mono, color: i === 0 ? '#ffe9a8' : '#b9a7ff', pxPerUnit: 1, align: 'left' });
    d.mesh.position.set(-510 + 0, -196 - i * 40, 0);
    d.mesh.material.depthTest = false;
    hud.add(d.mesh);
    return d;
  });
  const candTitle = textMesh({ text: 'next token · 下一个词元', family: FAMILY.zh, weight: 500, size: 26 * 2, color: '#ffffff', pxPerUnit: 2, anchor: 'left', depthTest: false });
  candTitle.position.set(-852, -150, 0);
  hud.add(candTitle);
  const vocab = textMesh({ text: 'P(next token)  ·  50,257-token vocabulary', family: FAMILY.mono, size: 24 * 2, letterSpacing: 4, color: '#bfb0ff', pxPerUnit: 2, depthTest: false });
  vocab.position.set(0, -170, 0);
  hud.add(vocab);
  const cap = new Caption(CAPTIONS.generation);
  hud.add(cap.group);

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, height }) {
      env.update({ t: lt + 144, scroll: 1600 + lt * 22, sunY: 48, sunScale: 1.05, sunIntensity: 1.4, glow: 0.8, pulse: f.kick, mountain: 7, gridIntensity: 1.2 });
      env.setCamera(camera, height);
      camera.position.set(Math.sin(lt * 0.4) * 1.2, 2.2 + f.kick * 0.06, 12);
      camera.lookAt(0, 8.5, -60);

      // current step
      let s = -1;
      for (let i = 0; i < steps.length; i++) if (lt >= steps[i].t) s = i;
      const tIn = s >= 0 ? lt - steps[s].t : 0;
      const morph = ease.outCubic(clamp(tIn / 0.12));
      const prev = s > 0 ? dists[s - 1].arr : null;
      const cur = s >= 0 ? dists[s] : null;
      for (let i = 0; i < BARS; i++) {
        const target = cur ? cur.arr[i] : 0.03 + 0.03 * Math.sin(lt * 5 + i);
        const from = prev ? prev[i] : 0.02;
        let h = lerp(from, target, morph);
        h *= 1 + f.kick * 0.15;
        const isWin = cur && i === cur.win;
        const hh = h * 10.5 * smoothstep(0, 0.4, lt);
        m4.makeScale((SW / BARS) * 0.84, Math.max(0.01, hh), 1);
        m4.setPosition(barX(i), 0, 0);
        bars.setMatrixAt(i, m4);
        synthColor(0.25 + h * 0.9, col).multiplyScalar((isWin ? 1.8 + hit(tIn, 0, 0.25) * 3 : 1.1) * (isWin ? Math.sqrt(DECOR) : DECOR));
        bars.setColorAt(i, col);
      }
      bars.instanceMatrix.needsUpdate = true;
      bars.instanceColor.needsUpdate = true;
      if (cur) {
        winGlow.position.set(barX(cur.win), cur.arr[cur.win] * 10.5, 0.2);
        winGlow.material.opacity = hit(tIn, 0, 0.3) * 1.2;
      }

      // text so far
      const text = ['', '', '', ''];
      for (let i = 0; i <= s; i++) {
        const st = steps[i];
        text[st.line] += text[st.line] === '' ? st.tok.trimStart() : st.tok;
      }
      const blink = Math.floor(lt * 4) % 2 ? '▍' : ' ';
      lines.forEach((d, i) => {
        const active = s >= 0 && steps[s].line === i;
        d.set(text[i] + (active ? blink : ''));
        d.mesh.material.opacity = text[i] ? 1 : 0;
      });
      zhLines.forEach((m, i) => {
        const lastOfLine = steps.filter((st) => st.line === i).pop();
        m.material.opacity = lastOfLine ? smoothstep(lastOfLine.t + 0.2, lastOfLine.t + 0.6, lt) * 0.9 : 0;
      });

      // top-3 candidates for this step
      if (s >= 0) {
        const st = steps[s];
        const p1 = cur.arr[cur.win];
        const a1 = ALTS[Math.floor(hash1(s * 5 + 1) * ALTS.length)];
        const a2 = ALTS[Math.floor(hash1(s * 5 + 2) * ALTS.length)];
        const tokShow = JSON.stringify(st.tok).slice(1, -1);
        cand[0].set(`▶ "${tokShow}"  ${(p1).toFixed(2)}`);
        cand[1].set(`  "${a1}"  ${(p1 * 0.22).toFixed(2)}`);
        cand[2].set(`  "${a2}"  ${(p1 * 0.09).toFixed(2)}`);
      }
      cand.forEach((d) => (d.mesh.material.opacity = s >= 0 ? 1 : 0));
      candTitle.material.opacity = s >= 0 ? 0.9 : 0;
      vocab.material.opacity = smoothstep(0.3, 0.8, lt) * 0.8;

      fx.flash += hit(lt, 0, 0.3) * 0.4;
      fx.aberration += s >= 0 ? hit(tIn, 0, 0.12) * 0.5 : 0;
      cap.update(lt, 0.6, 11.8);
    },
  };
}
