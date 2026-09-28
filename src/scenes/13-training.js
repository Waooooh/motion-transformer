// 1:36–1:48 · Learning. A neon loss landscape; the model's parameters roll
// downhill one gradient step per beat while it learns to predict the next word.
import * as THREE from 'three';
import { textMesh, DynamicText, FAMILY } from '../core/text.js';
import { GlowLines, GlowPoints, glowSprite, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { V } from '../core/shapes.js';
import { Caption, setOpacity } from '../core/hud.js';
import { CAPTIONS, TRAINING_PROMPTS } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, grouped } from '../core/math.js';

const HEIGHT_GLSL = /* glsl */ `
float lossH(vec2 p) {
  float r2 = dot(p, p);
  return 7.0 * (1.0 - exp(-r2 / 420.0)) + 0.9 * sin(p.x * 0.32) * cos(p.y * 0.27) + 0.55 * sin(p.x * 0.11 + 1.2) * sin(p.y * 0.15 + 0.4) + 0.6;
}`;
function lossH(x, z) {
  const r2 = x * x + z * z;
  return 7 * (1 - Math.exp(-r2 / 420)) + 0.9 * Math.sin(x * 0.32) * Math.cos(z * 0.27) + 0.55 * Math.sin(x * 0.11 + 1.2) * Math.sin(z * 0.15 + 0.4) + 0.6;
}

const VERT = /* glsl */ `
${HEIGHT_GLSL}
varying vec3 vP;
void main() {
  vec3 p = position;
  p.y = lossH(p.xz);
  vP = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = /* glsl */ `
uniform float uPulse;
uniform float uGlow;
varying vec3 vP;
void main() {
  vec2 gc = vP.xz / 1.6;
  vec2 fw = fwidth(gc);
  vec2 d = abs(fract(gc - 0.5) - 0.5) / max(fw, 1e-4);
  float line = 1.0 - clamp(min(d.x, d.y) - 0.4, 0.0, 1.0);
  float glow = exp(-min(d.x, d.y) * 0.4) * 0.3;
  float h = clamp(vP.y / 7.5, 0.0, 1.0);
  vec3 low = vec3(0.05, 0.95, 1.0);
  vec3 mid = vec3(0.55, 0.2, 1.0);
  vec3 high = vec3(1.0, 0.16, 0.62);
  vec3 c = mix(low, mid, smoothstep(0.0, 0.45, h));
  c = mix(c, high, smoothstep(0.45, 1.0, h));
  float fade = 1.0 - smoothstep(30.0, 42.0, length(vP.xz));
  vec3 fill = vec3(0.02, 0.0, 0.05) + c * 0.04;
  gl_FragColor = vec4(fill + c * (line + glow) * (1.1 + uPulse) * uGlow * fade, 1.0);
}`;

export default function trainingScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 3000);
  const hud = new THREE.Scene();
  const overlay = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 32 });
  env.terrain.visible = false;
  env.ridge.visible = false;
  scene.add(env.group);

  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(84, 84, 220, 220).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uPulse: { value: 0 }, uGlow: { value: 1 } } }),
  );
  land.position.z = -22;
  scene.add(land);

  // gradient-descent path from a ridge down to the minimum
  const path = [];
  let x = 27;
  let z = -19;
  for (let i = 0; i < 900; i++) {
    path.push(V(x, lossH(x, z) + 0.45, z - 22));
    const e = 0.01;
    const gx = (lossH(x + e, z) - lossH(x - e, z)) / (2 * e);
    const gz = (lossH(x, z + e) - lossH(x, z - e)) / (2 * e);
    x -= gx * 0.9 + Math.sin(i * 0.15) * 0.02;
    z -= gz * 0.9;
  }
  const trail = new GlowLines([{ points: path, color: PALETTE.yellow, width: 3 }], { width: 2, core: 1 });
  scene.add(trail.object);
  const ball = glowSprite(PALETTE.amber, 3.2, 1);
  const core = glowSprite(PALETTE.white, 1.1, 1);
  scene.add(ball, core);
  const sparks = new GlowPoints(80, { core: 1, minSize: 2 });
  scene.add(sparks.object);

  // loss curve (overlay, design px)
  const curve = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const loss = 2.0 + 8.8 * Math.exp(-t * 4.2) + Math.sin(i * 1.7) * 0.12 * (1 - t);
    curve.push(V(420 + t * 420, 170 + (loss - 2) * 26, 0));
  }
  const axes = [
    { points: [V(420, 380, 0), V(420, 160, 0), V(850, 160, 0)], color: PALETTE.violet, width: 1.5 },
    { points: curve, color: PALETTE.cyan, width: 3 },
  ];
  const chart = new GlowLines(axes, { width: 2, core: 1 });
  overlay.add(chart.object);
  const lossLbl = textMesh({ text: 'loss', family: FAMILY.mono, size: 30 * 2, color: '#bff6ff', pxPerUnit: 2, anchor: 'left', depthTest: false });
  lossLbl.position.set(432, 392, 0);
  const lossVal = new DynamicText({ width: 520, height: 90, size: 64, family: FAMILY.mono, color: '#ffffff', glow: 10, glowColor: HEX.cyan, pxPerUnit: 2, align: 'right' });
  lossVal.mesh.position.set(720, 405, 0);
  const tokensSeen = new DynamicText({ width: 1300, height: 90, size: 56, family: FAMILY.mono, color: '#ffe9a8', glow: 8, glowColor: HEX.amber, pxPerUnit: 2, align: 'right' });
  tokensSeen.mesh.position.set(530, 120, 0);
  hud.add(lossLbl, lossVal.mesh, tokensSeen.mesh);

  // next-token prompts, one per bar
  const prompts = TRAINING_PROMPTS.map((p) => {
    const g = new THREE.Group();
    const isZh = /[一-鿿]/.test(p.text);
    const fam = isZh ? FAMILY.zh : FAMILY.body;
    const q = textMesh({ text: p.text, family: fam, weight: isZh ? 500 : 600, size: 58 * 2, color: '#ffffff', glow: 8, glowColor: 'rgba(30,227,255,0.6)', pxPerUnit: 2, anchor: 'left', depthTest: false });
    const blank = textMesh({ text: '____', family: FAMILY.mono, size: 58 * 2, color: '#ff9ce9', pxPerUnit: 2, anchor: 'left', depthTest: false });
    const ans = textMesh({ text: p.answer, family: fam, weight: 700, size: 58 * 2, color: '#ffe9a8', glow: 16, glowColor: HEX.amber, pxPerUnit: 2, anchor: 'left', depthTest: false });
    const prob = textMesh({ text: `p = ${p.p.toFixed(2)}`, family: FAMILY.mono, size: 34 * 2, color: '#ffe9a8', pxPerUnit: 2, anchor: 'left', depthTest: false });
    const qw = q.userData.size.tw;
    blank.position.x = qw + 22;
    ans.position.x = qw + 22;
    prob.position.set(qw + 22, -62, 0);
    g.add(q, blank, ans, prob);
    g.position.set(-880, 400, 0);
    hud.add(g);
    return { g, blank, ans, prob };
  });

  const cap = new Caption(CAPTIONS.training);
  hud.add(cap.group);

  return {
    scene,
    camera,
    hud,
    overlay,
    update({ lt, f, fx, width, height }) {
      trail.setResolution(width, height);
      chart.setResolution(width, height);
      env.update({ t: lt + 96, sunY: 12, sunScale: 1.0, sunIntensity: 1.4, glow: 0.6, mountain: 0 });
      env.setCamera(camera, height);
      sparks.setCamera(camera, height);
      land.material.uniforms.uPulse.value = f.kick * 0.6;

      // one gradient step per beat: the ball dashes, then settles
      const beat = Math.floor(lt / 0.75);
      const bp = lt / 0.75 - beat;
      const stepT = (beat + ease.outCubic(clamp(bp / 0.4))) / 16;
      const prog = Math.pow(clamp(stepT), 0.55);
      const idx = Math.min(path.length - 1, Math.floor(prog * (path.length - 1)));
      const p = path[idx];
      ball.position.copy(p);
      core.position.copy(p);
      ball.scale.setScalar(3.2 + hit(lt, beat * 0.75, 0.25) * 1.8);
      trail.set(0, 0, idx / (path.length - 1), 1.4, -1);
      trail.commit();
      for (let i = 0; i < 80; i++) {
        const a = i * 2.39996;
        const age = bp;
        const rr = age * 2.2 * (0.5 + (i % 7) / 7);
        sparks.setPoint(i, p.x + Math.cos(a) * rr, p.y + age * 1.2 * ((i % 5) / 5), p.z + Math.sin(a) * rr, 1.4, 1.0, 0.4, 0.12, (1 - age) * 0.8);
      }
      sparks.commit();

      // camera follows the descent
      const k = ease.inOutCubic(clamp(lt / 12));
      camera.position.set(lerp(40, 14, k) + Math.sin(lt * 0.3) * 2, lerp(19, 11, k) + f.kick * 0.08, lerp(18, 8, k));
      camera.lookAt(p.x * 0.6, p.y * 0.6, p.z * 0.6 - 8);

      // chart + counters
      chart.set(0, 0, smoothstep(0.2, 0.8, lt), 1, -1);
      chart.set(1, 0, clamp(stepT) * 0.98 + 0.02, 1.2, -1);
      chart.commit();
      const loss = 2.0 + 8.8 * Math.exp(-clamp(stepT) * 4.2);
      lossVal.set(loss.toFixed(2));
      lossLbl.material.opacity = smoothstep(0.2, 0.8, lt);
      lossVal.mesh.material.opacity = smoothstep(0.2, 0.8, lt);
      tokensSeen.set(`tokens seen  ${grouped(3e11 * Math.pow(clamp(stepT), 1.6))}`);
      tokensSeen.mesh.material.opacity = smoothstep(0.4, 1.0, lt);

      prompts.forEach((pr, i) => {
        const t0 = i * 3;
        const vis = smoothstep(t0, t0 + 0.15, lt) * (1 - smoothstep(t0 + 2.75, t0 + 2.95, lt));
        setOpacity(pr.g, vis);
        const tAns = t0 + 1.5;
        pr.blank.visible = vis > 0 && lt < tAns;
        pr.blank.material.opacity = vis * (Math.floor(lt * 6) % 2 ? 1 : 0.35);
        pr.ans.visible = vis > 0 && lt >= tAns;
        pr.ans.scale.setScalar(1 + hit(lt, tAns, 0.2) * 0.3);
        pr.prob.visible = vis > 0 && lt >= tAns + 0.2;
      });

      fx.aberration += hit(lt, beat * 0.75, 0.15) * 0.25;
      cap.update(lt, 0.8, 11.8);
    },
  };
}
