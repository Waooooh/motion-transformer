// 2:36–2:48 · One architecture, every modality. A Transformer tower stands on
// the grid; each bar the camera whips around to a new source — text, an
// image, this very song's waveform, code & protein sequences — which breaks
// into tokens that are sucked into the same tower.
import * as THREE from 'three';
import { textMesh, FAMILY } from '../core/text.js';
import { GlowLines, glowSprite, HEX, PALETTE } from '../core/materials.js';
import { LabelAtlas, LabelField } from '../core/labels.js';
import { SynthwaveEnv } from '../core/env.js';
import { linePts, V } from '../core/shapes.js';
import { Caption, setOpacity } from '../core/hud.js';
import { CAPTIONS, MODALITIES } from '../copy.js';
import { REFERENCE_ENVELOPE } from '../data/reference-envelope.js';
import { clamp, ease, lerp, smoothstep, hit, Rng } from '../core/math.js';

const R = 12;
const PANEL_Y = 4.6;
const THETA = [Math.PI * 0.5, Math.PI * 0.5 + Math.PI / 2, Math.PI * 0.5 + Math.PI, Math.PI * 0.5 + (3 * Math.PI) / 2];
const SLABS = 26;

function sunsetCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 480;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 480);
  sky.addColorStop(0, '#12022e');
  sky.addColorStop(0.45, '#6a1b6e');
  sky.addColorStop(0.6, '#ff4f9a');
  sky.addColorStop(0.6, '#1a0433');
  sky.addColorStop(1, '#0b0120');
  g.fillStyle = sky;
  g.fillRect(0, 0, 480, 480);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.12})`;
    g.fillRect((i * 97) % 480, (i * 53) % 200, 2, 2);
  }
  const sun = g.createLinearGradient(0, 130, 0, 288);
  sun.addColorStop(0, '#ffe66d');
  sun.addColorStop(1, '#ff2a9d');
  g.fillStyle = sun;
  g.beginPath();
  g.arc(240, 288, 140, Math.PI, 0);
  g.fill();
  g.fillStyle = '#5a1466';
  for (let i = 0; i < 6; i++) g.fillRect(90, 222 + i * 12, 300, 2 + i * 1.5);
  g.strokeStyle = '#ff2bd6';
  g.lineWidth = 2.5;
  for (let i = 0; i < 10; i++) {
    const y = 288 + Math.pow(i / 9, 2) * 192;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(480, y);
    g.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    g.beginPath();
    g.moveTo(240 + i * 10, 288);
    g.lineTo(240 + i * 80, 480);
    g.stroke();
  }
  return c;
}

function waveCanvas() {
  const c = document.createElement('canvas');
  c.width = 1800;
  c.height = 300;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1800, 0);
  grad.addColorStop(0, '#1ee3ff');
  grad.addColorStop(0.5, '#ff4fd8');
  grad.addColorStop(1, '#ffb627');
  g.fillStyle = grad;
  REFERENCE_ENVELOPE.forEach((v, i) => {
    const h = (v / 140) * 140;
    g.fillRect(i, 150 - h, 1, h * 2);
  });
  return c;
}

export default function modalitiesScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 3000);
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 52 });
  scene.add(env.group);
  const rng = new Rng(52);

  // ---- the tower
  const tower = new THREE.Group();
  scene.add(tower);
  const slabPolys = [];
  for (let i = 0; i < SLABS; i++) {
    const y = 0.6 + i * 0.32;
    const c = new THREE.Color().lerpColors(PALETTE.pink, PALETTE.cyan, i / (SLABS - 1));
    slabPolys.push({ points: [V(-1.8, y, -1.3), V(1.8, y, -1.3), V(1.8, y, 1.3), V(-1.8, y, 1.3), V(-1.8, y, -1.3)], color: c, width: 1.6 });
  }
  slabPolys.push({ points: linePts(V(0, -1, 0), V(0, 0.6 + SLABS * 0.32 + 2, 0), 60), color: PALETTE.white, width: 4 });
  const towerLines = new GlowLines(slabPolys, { width: 2, core: 0.9, pulseWidth: 0.05 });
  tower.add(towerLines.object);
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, SLABS * 0.32, 2.6),
    new THREE.MeshBasicMaterial({ color: '#ff4fd8', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  fill.position.y = 0.6 + (SLABS * 0.32) / 2;
  tower.add(fill);
  const glow = glowSprite(PALETTE.pink, 12, 0.5);
  glow.position.y = 4.8;
  tower.add(glow);

  // ---- panel frames: centre, right and normal for each modality
  const frames = THETA.map((th) => {
    const n = V(Math.cos(th), 0, Math.sin(th));
    const r = V(Math.sin(th), 0, -Math.cos(th));
    return { c: n.clone().multiplyScalar(R).setY(PANEL_Y).addScaledVector(r, -3.4), n, r };
  });
  const onPanel = (p, x, y) => frames[p].c.clone().addScaledVector(frames[p].r, x).addScaledVector(V(0, 1, 0), y);

  const meshItems = [];
  const addMesh = (m, p, x, y, order) => {
    m.position.copy(onPanel(p, x, y));
    m.lookAt(m.position.clone().add(frames[p].n));
    scene.add(m);
    meshItems.push({ m, p, x, y, order, home: m.position.clone(), target: V(rng.float(-1.2, 1.2), rng.float(1.2, 8.6), rng.float(-0.8, 0.8)) });
  };

  // 1. TEXT
  const para = 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks . We propose a new simple network architecture , the Transformer , based solely on attention mechanisms .'.split(' ');
  const atlas = new LabelAtlas([...new Set(para)], { family: FAMILY.body, weight: 600, size: 72, color: '#ffffff' });
  const words = new LabelField(atlas, para.length);
  scene.add(words.object);
  const wordItems = [];
  {
    let x = -4.6;
    let y = 1.6;
    para.forEach((w, i) => {
      const r = atlas.rects[atlas.index.get(w)];
      const wd = r.aspect * 0.5;
      if (x + wd > 4.6) {
        x = -4.6;
        y -= 0.62;
      }
      words.setLabel(i, atlas.index.get(w));
      wordItems.push({ x: x + wd / 2, y, order: i / para.length, target: V(rng.float(-1.2, 1.2), rng.float(1.2, 8.6), rng.float(-0.8, 0.8)) });
      x += wd + 0.12;
    });
  }

  // 2. IMAGE → patches
  const itex = new THREE.CanvasTexture(sunsetCanvas());
  itex.colorSpace = THREE.SRGBColorSpace;
  const P = 8;
  const IS = 5.6;
  for (let r = 0; r < P; r++) {
    for (let c = 0; c < P; c++) {
      const g = new THREE.PlaneGeometry(IS / P, IS / P);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + uv.getX(k)) / P, 1 - (r + 1 - uv.getY(k)) / P);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: itex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.material.color.setScalar(1.3);
      addMesh(m, 1, -IS / 2 + (c + 0.5) * (IS / P), IS / 2 - (r + 0.5) * (IS / P), (r * P + c) / (P * P));
    }
  }

  // 3. SOUND → frames of this song's waveform
  const wtex = new THREE.CanvasTexture(waveCanvas());
  wtex.colorSpace = THREE.SRGBColorSpace;
  const WF = 30;
  const WW = 10;
  for (let i = 0; i < WF; i++) {
    const g = new THREE.PlaneGeometry(WW / WF, 2.4);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / WF);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: wtex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
    m.material.color.setScalar(1.8);
    addMesh(m, 2, -WW / 2 + (i + 0.5) * (WW / WF), 0, i / WF);
  }

  // 4. CODE + PROTEIN
  const code = ['def attention(q, k, v):', '    w = softmax(q @ k.T / sqrt(d))', '    return w @ v'];
  code.forEach((line, i) => {
    const m = textMesh({ text: line, family: FAMILY.mono, size: 72, color: '#b6ffb6', glow: 8, glowColor: '#00ff88', pxPerUnit: 150, anchor: 'left', align: 'left' });
    m.material.side = THREE.DoubleSide;
    addMesh(m, 3, -4.8, 2.0 - i * 0.62, i / 6);
  });
  const protein = 'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRV';
  protein.split('').forEach((ch, i) => {
    const m = textMesh({ text: ch, family: FAMILY.mono, size: 72, color: ['#ff9ce9', '#9fefff', '#ffe3a3'][i % 3], glow: 8, glowColor: HEX.violet, pxPerUnit: 170 });
    m.material.side = THREE.DoubleSide;
    const a = i * 0.55;
    addMesh(m, 3, -4.6 + i * 0.235, -1.1 + Math.sin(a) * 0.35, 0.5 + i / 80);
  });

  // HUD labels, one per bar
  const labels = [MODALITIES[0], MODALITIES[1], MODALITIES[2], { en: 'CODE · PROTEINS', zh: '代码 · 蛋白质' }].map((m, i) => {
    const g = new THREE.Group();
    const en = textMesh({ text: m.en, family: FAMILY.display, weight: 900, size: 76 * 2, letterSpacing: 20, color: '#ffffff', glow: 18, glowColor: [HEX.cyan, HEX.pink, HEX.amber, '#00ff88'][i], pxPerUnit: 2, anchor: 'left', depthTest: false });
    const zh = textMesh({ text: m.zh, family: FAMILY.zh, weight: 500, size: 40 * 2, letterSpacing: 12, color: '#ffe6fa', pxPerUnit: 2, anchor: 'left', depthTest: false });
    zh.position.y = -78;
    g.add(en, zh);
    g.position.set(-860, 420, 0);
    hud.add(g);
    return g;
  });
  const cap = new Caption(CAPTIONS.modalities);
  hud.add(cap.group);

  const flight = (home, target, t) => {
    const k = ease.inCubic(clamp(t));
    const p = home.clone().lerp(target, k);
    p.y += Math.sin(k * Math.PI) * 1.5;
    return { p, k };
  };
  const tFly = (bar, order) => bar * 3 + 1.1 + order * 1.3;

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      towerLines.setResolution(width, height);
      env.update({ t: lt + 156, scroll: 1900 + lt * 12, sunY: 26, sunScale: 1.25, sunIntensity: 1.6, glow: 0.8, pulse: f.kick, mountain: 10, gridIntensity: 1.1 });
      env.setCamera(camera, height);

      // whip-pan between the four sources
      const bar = Math.min(3, Math.floor(lt / 3));
      const bt = lt - bar * 3;
      const prevTh = bar > 0 ? THETA[bar - 1] : THETA[0] - 0.6;
      const th = lerp(prevTh, THETA[bar], ease.inOutExpo(clamp(bt / 0.55)));
      const push = ease.inOutCubic(clamp((bt - 1.0) / 2.0));
      const dist = R + lerp(11, 7.5, push);
      const side = V(Math.sin(th), 0, -Math.cos(th));
      camera.position.set(Math.cos(th) * dist, lerp(6.4, 5.6, push) + f.kick * 0.05, Math.sin(th) * dist).addScaledVector(side, -2.2);
      camera.lookAt(V(0, lerp(4.6, 4.9, push), 0).addScaledVector(side, -1.6));

      // tower brightens as each modality arrives
      const arrivals = clamp(lt / 12);
      for (let i = 0; i < SLABS; i++) {
        const wave = Math.exp(-Math.pow((i / SLABS - ((lt * 1.33) % 1)) * 6, 2));
        towerLines.set(i, 0, 1, 0.7 + arrivals * 0.8 + wave * 0.8 + f.kick * 0.5 + hit(bt, 2.55, 0.3) * 1.5, -1);
      }
      towerLines.set(SLABS, 0, 1, 1 + f.kick + hit(bt, 2.55, 0.3) * 2, (lt * 0.8) % 1);
      towerLines.commit();
      fill.material.opacity = 0.06 + arrivals * 0.08 + hit(bt, 2.55, 0.3) * 0.2;
      glow.material.opacity = 0.35 + arrivals * 0.3 + hit(bt, 2.55, 0.35) * 0.6;

      // text tokens (panel 0)
      wordItems.forEach((w, i) => {
        const home = onPanel(0, w.x, w.y);
        const t = (lt - tFly(0, w.order)) / 1.1;
        const { p, k } = flight(home, w.target, t);
        const vis = lt > 0 && t < 1 ? 1 : 0;
        words.set(i, p.x, p.y, p.z, 0.5 * (1 - Math.pow(k, 4)), vis * (0.6 + 0.4 * smoothstep(0, 0.3, lt)), 0.8, 1.0, 1.25);
      });
      words.commit();

      meshItems.forEach((it) => {
        const t = (lt - tFly(it.p, it.order)) / 1.1;
        const shown = lt > it.p * 3 - 0.8 && t < 1;
        it.m.visible = shown;
        if (!shown) return;
        // patchify: small gaps open up before the pieces fly
        const sep = smoothstep(it.p * 3 + 0.5, it.p * 3 + 1.0, lt) * 0.12;
        const home = onPanel(it.p, it.x * (1 + sep), it.y * (1 + sep));
        const { p, k } = flight(home, it.target, t);
        it.m.position.copy(p);
        it.m.scale.setScalar(Math.max(0.001, 1 - Math.pow(k, 4)));
        it.m.material.opacity = smoothstep(it.p * 3 - 0.8, it.p * 3 - 0.3, lt);
      });

      labels.forEach((g, i) => {
        const vis = i === bar ? smoothstep(0.2, 0.45, bt) * (1 - smoothstep(2.6, 2.95, bt)) : 0;
        setOpacity(g, vis);
        g.position.x = -860 + (1 - ease.outCubic(clamp((bt - 0.2) / 0.5))) * -60;
      });

      fx.flash += hit(lt, 0, 0.3) * 0.35;
      fx.aberration += hit(bt, 0, 0.35) * 1.5 + hit(bt, 2.55, 0.3);
      fx.bloom += 0.2;
      cap.update(lt, 1.0, 11.8);
    },
  };
}
