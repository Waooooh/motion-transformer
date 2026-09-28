// 1:48–2:00 · Then scale it up. Landmark Transformer models on a log scale
// (published parameter counts), one every other beat, and the curve keeps
// climbing out of the chart.
import * as THREE from 'three';
import { textMesh, DynamicText, FAMILY } from '../core/text.js';
import { GlowLines, GlowPoints, softPanel, HEX, PALETTE } from '../core/materials.js';
import { SynthwaveEnv } from '../core/env.js';
import { linePts, V } from '../core/shapes.js';
import { Caption } from '../core/hud.js';
import { CAPTIONS, SCALE_POINTS } from '../copy.js';
import { clamp, ease, lerp, smoothstep, hit, grouped } from '../core/math.js';

const X0 = 2017;
const X1 = 2021.6;
const Y0 = 7;
const Y1 = 13;
const CW = 16;
const CH = 9;
const px = (year) => -CW / 2 + ((year - X0) / (X1 - X0)) * CW;
const py = (p) => ((Math.log10(p) - Y0) / (Y1 - Y0)) * CH;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).split('').map((d) => SUP[+d]).join('');

export default function scaleScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 3000);
  const hud = new THREE.Scene();
  const env = new SynthwaveEnv({ seed: 36 });
  scene.add(env.group);
  const chart = new THREE.Group();
  chart.position.set(0, 1.2, 0);
  scene.add(chart);
  const back = softPanel(22, 13, { opacity: 0.8, feather: 0.4 });
  back.position.set(0, CH / 2, -0.3);
  chart.add(back);

  const polys = [];
  polys.push({ points: [V(-CW / 2, CH, 0), V(-CW / 2, 0, 0), V(CW / 2, 0, 0)], color: PALETTE.violet, width: 2 });
  for (let e = Y0 + 1; e <= Y1; e++) {
    const y = ((e - Y0) / (Y1 - Y0)) * CH;
    polys.push({ points: linePts(V(-CW / 2, y, 0), V(CW / 2, y, 0), 4), color: PALETTE.purple.clone().multiplyScalar(2.5), width: 0.8 });
  }
  const trend = SCALE_POINTS.map((p) => V(px(p.year), py(p.params), 0.05));
  const smooth = new THREE.CatmullRomCurve3(trend).getPoints(120);
  // extrapolation beyond the chart
  const last = trend[trend.length - 1];
  const ext = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    ext.push(V(last.x + t * 5, last.y + t * t * 9 + t * 2, 0.05));
  }
  polys.push({ points: smooth, color: PALETTE.pink, width: 3.5 });
  polys.push({ points: ext, color: PALETTE.yellow, width: 3 });
  const lines = new GlowLines(polys, { width: 2, core: 0.9, pulseWidth: 0.05 });
  chart.add(lines.object);
  const GRID0 = 1;
  const TREND = polys.length - 2;
  const EXT = polys.length - 1;

  const axisLabels = [];
  for (let e = Y0; e <= Y1; e++) {
    const m = textMesh({ text: `10${sup(e)}`, family: FAMILY.mono, size: 64, color: '#bfb0ff', pxPerUnit: 200, anchor: 'right' });
    m.position.set(-CW / 2 - 0.25, ((e - Y0) / (Y1 - Y0)) * CH, 0);
    chart.add(m);
    axisLabels.push(m);
  }
  for (let y = 2017; y <= 2021; y++) {
    const m = textMesh({ text: String(y), family: FAMILY.mono, size: 64, color: '#bfb0ff', pxPerUnit: 200 });
    m.position.set(px(y), -0.45, 0);
    chart.add(m);
    axisLabels.push(m);
  }
  const yTitle = textMesh({ text: 'parameters · 参数量', family: FAMILY.zh, weight: 500, size: 60, color: '#ffc4f1', pxPerUnit: 200, anchor: 'left' });
  yTitle.position.set(-CW / 2 + 0.2, CH + 0.5, 0);
  chart.add(yTitle);

  const pts = new GlowPoints(SCALE_POINTS.length, { core: 1.5, minSize: 3 });
  chart.add(pts.object);
  const labels = SCALE_POINTS.map((p) => {
    const m = textMesh({ text: `${p.name}  ${p.label}`, family: FAMILY.display, weight: 700, size: 70, letterSpacing: 4, color: '#ffffff', glow: 12, glowColor: HEX.pink, pxPerUnit: 200, anchor: 'right' });
    m.position.set(px(p.year) - 0.35, py(p.params) + 0.4, 0.1);
    chart.add(m);
    return m;
  });

  const big = new DynamicText({ width: 1900, height: 200, size: 108, family: FAMILY.display, weight: 900, color: '#ffffff', glow: 26, glowColor: HEX.pink, pxPerUnit: 1 });
  big.mesh.position.set(0, 330, 0);
  big.mesh.material.depthTest = false;
  hud.add(big.mesh);
  const cap = new Caption(CAPTIONS.scale);
  hud.add(cap.group);
  const T = (i) => 0.75 + i * 1.5;

  return {
    scene,
    camera,
    hud,
    update({ lt, f, fx, width, height }) {
      lines.setResolution(width, height);
      env.update({ t: lt + 108, scroll: 1400 + lt * 16, sunY: 30, sunIntensity: 1.5, glow: 0.6, pulse: f.kick * 1.0, mountain: 17, fade: 0.25 });
      env.setCamera(camera, height);
      pts.setCamera(camera, height);

      // camera rides up along the curve, then lifts off with it
      const n = SCALE_POINTS.length;
      const cur = Math.max(0, Math.min(n - 1, Math.floor((lt - 0.75) / 1.5)));
      const fly = ease.inCubic(clamp((lt - 9.3) / 2.7));
      const focus = trend[cur].clone().add(chart.position);
      const k = ease.inOutCubic(clamp(lt / 9.3));
      const pos = V(lerp(-2, 3, k), lerp(4.5, 9.5, k), lerp(19, 16, k));
      const look = V(lerp(-1, focus.x * 0.4, k), lerp(4.2, 6.3, k), 0);
      pos.add(V(fly * 6, fly * 16, -fly * 6));
      look.add(V(fly * 7, fly * 18, 0));
      camera.position.copy(pos);
      camera.position.y += f.kick * 0.05;
      camera.lookAt(look);

      lines.set(0, 0, ease.outCubic(clamp(lt / 0.6)), 1.2, -1);
      for (let e = 0; e < Y1 - Y0; e++) lines.set(GRID0 + e, 0, ease.outCubic(clamp((lt - e * 0.06) / 0.6)), 0.6, -1);
      // trend grows point by point
      const segT = clamp((lt - T(0)) / (T(n - 1) - T(0)));
      lines.set(TREND, 0, segT, 1.4 + f.kick * 0.5, segT < 1 ? segT : -1);
      const er = ease.inQuad(clamp((lt - T(n - 1) - 0.4) / 2.6));
      lines.set(EXT, 0, er, 1.6 + fly * 2, er < 1 ? er : ((lt * 0.8) % 1));
      lines.commit();

      SCALE_POINTS.forEach((p, i) => {
        const on = lt >= T(i);
        const pop = hit(lt, T(i), 0.35);
        const c = i === n - 1 ? PALETTE.yellow : PALETTE.pink;
        pts.setPoint(i, px(p.year), py(p.params), 0.1, c.r * (1.5 + pop * 3), c.g * (1.5 + pop * 3), c.b * (1.5 + pop * 3), on ? 0.55 + pop * 0.6 : 0, on ? 1 : 0);
        labels[i].material.opacity = on ? 1 : 0;
        labels[i].scale.setScalar(1 + pop * 0.3);
      });
      pts.commit();
      axisLabels.forEach((m) => (m.material.opacity = smoothstep(0.2, 0.7, lt) * 0.85 * (1 - fly)));
      yTitle.material.opacity = smoothstep(0.3, 0.8, lt) * (1 - fly);

      const cp = SCALE_POINTS[Math.max(0, Math.min(n - 1, Math.floor((lt - 0.75) / 1.5)))];
      const shownParams = lt < T(0) ? 0 : lt < T(n - 1) + 0.6 ? cp.params : Math.min(9.99e13, 1.6e12 * (1 + Math.pow(er, 2) * 60));
      big.set(lt < T(0) ? '' : grouped(shownParams));
      big.mesh.material.opacity = smoothstep(T(0), T(0) + 0.2, lt) * 0.9;
      big.mesh.scale.setScalar(1 + hit(lt, T(cur), 0.3) * 0.1 + fly * 0.15);

      fx.aberration += hit(lt, T(cur), 0.3) * 0.6;
      fx.bloom += fly * 0.6;
      cap.update(lt, 1.2, 9.3);
    },
  };
}
