// HUD elements drawn after bloom in 1920×1080 design pixels (origin at the
// centre, +y up): bilingual captions and the history "year badges".
import * as THREE from 'three';
import { textMesh, FAMILY } from './text.js';
import { clamp, smoothstep, ease, hash1 } from './math.js';
import { HEX } from './materials.js';

const PX = 2; // text is drawn at 2× for crisp edges

function setOpacity(obj, a) {
  obj.traverse((o) => {
    if (o.material) {
      o.material.opacity = (o.userData.baseOpacity ?? 1) * a;
      o.visible = a > 0.002;
    }
  });
}

function line(width, color, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false }),
  );
  m.userData.baseOpacity = opacity;
  return m;
}

/** Bilingual caption: Chinese line on top, English below, with a hairline. */
export class Caption {
  constructor({ zh, en, y = -392, zhSize = 44, enSize = 26, color = '#f6f0ff', accent = HEX.pink }) {
    this.group = new THREE.Group();
    this.group.position.y = y;
    this.zh = textMesh({
      text: zh,
      family: FAMILY.zh,
      weight: 500,
      size: zhSize * PX,
      letterSpacing: 6 * PX,
      color,
      glow: 10,
      glowColor: 'rgba(255,79,216,0.55)',
      pxPerUnit: PX,
    });
    this.zh.position.y = 18;
    this.en = textMesh({
      text: en.toUpperCase(),
      family: FAMILY.body,
      weight: 600,
      size: enSize * PX,
      letterSpacing: 7 * PX,
      color: '#cbbcff',
      pxPerUnit: PX,
    });
    this.en.position.y = -34;
    const w = Math.max(this.zh.userData.size.tw, this.en.userData.size.tw) * 0.7;
    this.rule = line(w, accent, 0.85);
    this.rule.position.y = -8;
    this.ruleWidth = w;
    this.group.add(this.zh, this.en, this.rule);
    for (const m of [this.zh, this.en]) {
      m.material.depthTest = false;
      m.userData.baseOpacity = 1;
    }
  }
  /** lt: local time; shows between tIn and tOut with short fades. */
  update(lt, tIn, tOut, fade = 0.45) {
    const a = Math.min(smoothstep(tIn, tIn + fade, lt), 1 - smoothstep(tOut - fade, tOut, lt));
    setOpacity(this.group, a);
    const k = ease.outCubic(clamp((lt - tIn) / 0.9));
    this.rule.scale.x = Math.max(0.001, k);
    this.zh.position.y = 18 + (1 - k) * 10;
    this.en.position.y = -34 - (1 - k) * 6;
    // letter-spacing "breath" on the English line
    this.en.scale.x = 1 + (1 - k) * 0.06;
    return a;
  }
}

/** History badge: big outlined year + title + Chinese name + authors. */
export class YearBadge {
  constructor({ year, en, zh, who, x = -885, y = 455, color = HEX.cyan }) {
    this.group = new THREE.Group();
    this.group.position.set(x, y, 0);
    this.year = textMesh({
      text: year,
      family: FAMILY.display,
      weight: 900,
      size: 118 * PX,
      letterSpacing: 6 * PX,
      color: 'rgba(0,0,0,0)',
      stroke: 3 * PX,
      strokeColor: color,
      strokeOnly: true,
      glow: 16,
      glowColor: color,
      anchor: 'top-left',
      pxPerUnit: PX,
    });
    this.fill = textMesh({
      text: year,
      family: FAMILY.display,
      weight: 900,
      size: 118 * PX,
      letterSpacing: 6 * PX,
      gradient: [
        [0, 'rgba(255,255,255,0.0)'],
        [0.55, 'rgba(255,79,216,0.0)'],
        [1, 'rgba(255,79,216,0.35)'],
      ],
      anchor: 'top-left',
      pxPerUnit: PX,
    });
    this.title = textMesh({
      text: en,
      family: FAMILY.display,
      weight: 700,
      size: 26 * PX,
      letterSpacing: 6 * PX,
      color: '#ffffff',
      glow: 8,
      glowColor: color,
      anchor: 'top-left',
      pxPerUnit: PX,
    });
    this.title.position.set(4, -136, 0);
    this.zh = textMesh({
      text: zh,
      family: FAMILY.zh,
      weight: 500,
      size: 27 * PX,
      letterSpacing: 8 * PX,
      color: '#ffd9f5',
      anchor: 'top-left',
      pxPerUnit: PX,
    });
    this.zh.position.set(4, -176, 0);
    this.who = textMesh({
      text: who,
      family: FAMILY.body,
      weight: 500,
      size: 22 * PX,
      letterSpacing: 4 * PX,
      color: '#a99be0',
      anchor: 'top-left',
      pxPerUnit: PX,
    });
    this.who.position.set(4, -214, 0);
    this.bar = line(6, color, 1);
    this.bar.geometry = new THREE.PlaneGeometry(4, 104);
    this.bar.position.set(-20, -182, 0);
    this.group.add(this.fill, this.year, this.title, this.zh, this.who, this.bar);
    this.group.traverse((o) => {
      if (o.material) {
        o.material.depthTest = false;
        if (o.userData.baseOpacity === undefined) o.userData.baseOpacity = 1;
      }
    });
    this.x = x;
  }
  update(lt, tIn, tOut) {
    const a = Math.min(smoothstep(tIn, tIn + 0.25, lt), 1 - smoothstep(tOut - 0.4, tOut, lt));
    // glitch-in: flicker and horizontal jitter for the first 0.35 s
    const g = 1 - clamp((lt - tIn) / 0.35);
    const jitter = g > 0 ? (hash1(Math.floor(lt * 30)) - 0.5) * 40 * g : 0;
    const flicker = g > 0 ? (hash1(Math.floor(lt * 24) + 5) > 0.35 ? 1 : 0.2) : 1;
    setOpacity(this.group, a * flicker);
    this.group.position.x = this.x + jitter;
    const k = ease.outExpo(clamp((lt - tIn) / 0.8));
    this.title.position.x = 4 + (1 - k) * 30;
    this.zh.position.x = 4 + (1 - k) * 50;
    this.who.position.x = 4 + (1 - k) * 70;
    this.bar.scale.y = Math.max(0.001, k);
    return a;
  }
}

export { setOpacity };
