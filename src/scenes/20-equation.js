// 3:00–3:27 · The equation. After the peak, everything resolves into one
// line of math glowing over a setting sun; each part lights up in turn.
import * as THREE from 'three';
import { textMesh, canvasTexture, fontString, FAMILY } from '../core/text.js';
import { GlowLines, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { V } from '../core/shapes.js';
import { Caption, setOpacity } from '../core/hud.js';
import { CAPTIONS, EQUATION_PARTS } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit } from '../core/math.js';

const PART_COLORS = { Q: HEX.pink, K: HEX.cyan, V: HEX.amber, softmax: HEX.violet, sqrt: HEX.teal };

/**
 * Lay out Attention(Q, K, V) = softmax(QKᵀ/√dₖ)V on a canvas. Returns the
 * canvas plus the x-extent of every highlightable part (canvas px).
 */
function drawEquation(highlight = null, scale = 2) {
  const S = 92 * scale;
  const W = 2300 * scale;
  const H = 400 * scale;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const base = H * 0.56;
  const it = fontString({ family: FAMILY.math, size: S, italic: true, weight: 400 });
  const rm = fontString({ family: FAMILY.math, size: S, weight: 400 });
  const small = fontString({ family: FAMILY.math, size: S * 0.62, italic: true });
  const smallRm = fontString({ family: FAMILY.math, size: S * 0.62 });
  const parts = {};
  const ops = [];
  let x = 40 * scale;
  const put = (text, font, key = null, dy = 0) => {
    g.font = font;
    const w = g.measureText(text).width;
    ops.push({ text, font, x, y: base + dy, key });
    if (key) {
      parts[key] = parts[key] || { x0: x, x1: x + w };
      parts[key].x0 = Math.min(parts[key].x0, x);
      parts[key].x1 = Math.max(parts[key].x1, x + w);
    }
    x += w;
    return w;
  };
  put('Attention', rm);
  put('(', rm);
  put('Q', it, 'Q');
  put(', ', rm);
  put('K', it, 'K');
  put(', ', rm);
  put('V', it, 'V');
  put(')  =  ', rm);
  put('softmax', rm, 'softmax');
  put('(', rm, 'softmax');
  // fraction
  const fx0 = x + 10 * scale;
  g.font = it;
  const numW = g.measureText('QK').width + g.measureText('T').width * 0.7;
  g.font = small;
  const denW = S * 0.62 + g.measureText('d').width * 1.6 + 30 * scale;
  const fw = Math.max(numW, denW) + 30 * scale;
  const nx = fx0 + (fw - numW) / 2;
  const numY = base - S * 0.42;
  ops.push({ text: 'Q', font: it, x: nx, y: numY, key: 'Q' });
  g.font = it;
  const qw = g.measureText('Q').width;
  ops.push({ text: 'K', font: it, x: nx + qw, y: numY, key: 'K' });
  const kw = g.measureText('K').width;
  ops.push({ text: 'T', font: smallRm, x: nx + qw + kw + 4 * scale, y: numY - S * 0.38, key: 'K' });
  const barY = base - S * 0.28;
  const dx = fx0 + (fw - denW) / 2;
  const denY = base + S * 0.62;
  const sqrtOp = { sqrt: true, x: dx, y: denY, h: S * 0.8, w: denW, key: 'sqrt' };
  ops.push(sqrtOp);
  ops.push({ text: 'd', font: it, x: dx + S * 0.5, y: denY, key: 'sqrt' });
  g.font = it;
  ops.push({ text: 'k', font: small, x: dx + S * 0.5 + g.measureText('d').width, y: denY + S * 0.18, key: 'sqrt' });
  ops.push({ bar: true, x: fx0, y: barY, w: fw, key: null });
  parts.sqrt = { x0: dx, x1: dx + denW };
  parts.Q.x1 = Math.max(parts.Q.x1, nx + qw);
  x = fx0 + fw + 10 * scale;
  put(')', rm, 'softmax');
  put('V', it, 'V');

  const drawOp = (op) => {
    if (op.bar) {
      g.fillRect(op.x, op.y - 3 * scale, op.w, 6 * scale);
    } else if (op.sqrt) {
      g.beginPath();
      g.lineWidth = 5 * scale;
      g.lineJoin = 'round';
      const top = op.y - op.h;
      g.moveTo(op.x, op.y - op.h * 0.45);
      g.lineTo(op.x + S * 0.14, op.y - op.h * 0.55);
      g.lineTo(op.x + S * 0.3, op.y + S * 0.06);
      g.lineTo(op.x + S * 0.45, top);
      g.lineTo(op.x + op.w, top);
      g.stroke();
    } else {
      g.font = op.font;
      g.fillText(op.text, op.x, op.y);
    }
  };
  for (const op of ops) {
    const on = highlight && op.key === highlight;
    const col = on ? PART_COLORS[highlight] : highlight ? 'rgba(235,225,255,0.55)' : '#ffffff';
    g.save();
    g.fillStyle = col;
    g.strokeStyle = col;
    g.shadowColor = on ? PART_COLORS[highlight] : 'rgba(255,79,216,0.8)';
    g.shadowBlur = on ? 40 * scale : 16 * scale;
    drawOp(op);
    g.shadowBlur = 0;
    drawOp(op);
    g.restore();
  }
  // trim to the laid-out width so the formula centres correctly
  const used = Math.ceil(x + 40 * scale);
  const out = document.createElement('canvas');
  out.width = used;
  out.height = H;
  out.getContext('2d').drawImage(c, 0, 0);
  return { canvas: out, parts, width: used, height: H, scale };
}

export default function equationScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 3000);
  const overlay = new THREE.Scene();
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 60 });
  scene.add(env.group);

  const keys = [null, 'Q', 'K', 'V', 'softmax', 'sqrt'];
  const variants = keys.map((k) => drawEquation(k));
  const PX = 3; // canvas px per design px
  const eqW = variants[0].width / PX;
  const eqH = variants[0].height / PX;
  const eqGroup = new THREE.Group();
  eqGroup.position.set(0, 190, 0);
  overlay.add(eqGroup);
  const clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const eqMeshes = variants.map((v) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(eqW, eqH),
      new THREE.MeshBasicMaterial({ map: canvasTexture(v.canvas), transparent: true, depthTest: false, depthWrite: false, toneMapped: false, clippingPlanes: [clip] }),
    );
    eqGroup.add(m);
    return m;
  });
  const toDesign = (cx) => cx / PX - eqW / 2;

  // annotation: leader line + bilingual label for the highlighted part
  const notes = EQUATION_PARTS.map((p) => {
    const g = new THREE.Group();
    const en = textMesh({ text: p.en, family: FAMILY.body, weight: 600, size: 38 * 2, letterSpacing: 6, color: '#ffffff', pxPerUnit: 2, depthTest: false });
    const zh = textMesh({ text: p.zh, family: FAMILY.zh, weight: 500, size: 40 * 2, letterSpacing: 8, color: PART_COLORS[p.key], glow: 12, glowColor: PART_COLORS[p.key], pxPerUnit: 2, depthTest: false });
    zh.position.y = 8;
    en.position.y = -52;
    g.add(zh, en);
    g.position.set(0, 430, 0);
    hud.add(g);
    return g;
  });
  const leaders = new GlowLines(
    EQUATION_PARTS.map((p) => {
      const part = variants[0].parts[p.key];
      const x = toDesign((part.x0 + part.x1) / 2);
      return { points: [V(x, 190 + eqH * 0.36, 0), V(x, 312, 0), V(0, 334, 0)], color: new THREE.Color(PART_COLORS[p.key]), width: 2 };
    }),
    { width: 2, core: 1 },
  );
  overlay.add(leaders.object);

  const cap = new Caption(CAPTIONS.equation);
  hud.add(cap.group);

  return {
    scene,
    camera,
    overlay,
    hud,
    update({ lt, f, fx, width, height }) {
      leaders.setResolution(width, height);
      const set = smoothstep(0, 27, lt);
      env.update({
        t: lt + 180,
        scroll: 2800 + lt * lerp(10, 4, set),
        sunY: lerp(22, -8, set),
        sunScale: 1.3,
        sunIntensity: 1.5,
        glow: lerp(0.9, 0.5, set),
        pulse: f.kick * 0.7,
        mountain: 14,
        gridIntensity: lerp(1.2, 0.8, set),
      });
      env.setCamera(camera, height);
      camera.position.set(Math.sin(lt * 0.08) * 1.5, lerp(2.4, 3.6, set), lerp(10, 16, set));
      camera.lookAt(0, lerp(9, 10, set), -100);

      // reveal the equation left → right on the first bar
      const w = ease.inOutCubic(clamp((lt - 0.3) / 1.8));
      clip.constant = lerp(-eqW / 2 - 20, eqW / 2 + 40, w);
      const partIdx = lt < 3 ? 0 : lt < 18 ? 1 + Math.floor((lt - 3) / 3) : 0;
      eqMeshes.forEach((m, i) => {
        const target = i === partIdx ? 1 : 0;
        m.material.opacity = target;
        m.visible = target > 0;
      });
      const breathe = 1 + Math.sin(lt * 0.8) * 0.01 + f.kick * 0.008;
      eqGroup.scale.setScalar(breathe * lerp(1, 0.92, set));
      eqGroup.position.y = 190 + lerp(0, 30, set);

      notes.forEach((g, i) => {
        const t0 = 3 + i * 3;
        setOpacity(g, smoothstep(t0 + 0.1, t0 + 0.4, lt) * (1 - smoothstep(t0 + 2.7, t0 + 2.95, lt)));
        const k = ease.outCubic(clamp((lt - t0) / 0.5));
        g.position.y = 430 + (1 - k) * 20;
        const on = lt >= t0 && lt < t0 + 3 ? ease.outCubic(clamp((lt - t0) / 0.45)) * (1 - smoothstep(t0 + 2.6, t0 + 2.95, lt)) : 0;
        leaders.set(i, 0, on, 1.2, on < 1 ? on : -1);
      });
      leaders.commit();

      fx.flash += hit(lt, 0, 0.25) * 1.0 + hit(lt, 3, 0.2) * 0.1 + hit(lt, 6, 0.2) * 0.1 + hit(lt, 9, 0.2) * 0.1;
      fx.aberration += hit(lt, 0, 0.6) * 1.5;
      fx.fade = smoothstep(25.5, 27, lt) * 0.4;
      cap.update(lt, 18.3, 26.6, 0.8);
    },
  };
}
