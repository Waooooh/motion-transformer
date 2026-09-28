// Text is drawn with Canvas2D (so any font / script / glow works) and mapped
// onto planes. Static labels are cached; DynamicText re-draws only when its
// string changes (counters, typing effects).
import * as THREE from 'three';
import { THEME } from './theme.js';

const GLOW_K = THEME.k.textGlow;

export const FAMILY = {
  display: 'Orbitron',
  body: 'Rajdhani',
  mono: 'Share Tech Mono',
  script: 'Mr Dafoe',
  math: 'STIX Two Text',
  zh: 'Noto Sans SC',
};

// Faces that must be loaded before any canvas is drawn.
export const FONT_FACES = [
  `900 64px ${FAMILY.display}`,
  `700 64px ${FAMILY.display}`,
  `500 64px ${FAMILY.display}`,
  `500 64px ${FAMILY.body}`,
  `600 64px ${FAMILY.body}`,
  `700 64px ${FAMILY.body}`,
  `400 64px "${FAMILY.mono}"`,
  `400 64px "${FAMILY.script}"`,
  `italic 400 64px "${FAMILY.math}"`,
  `italic 600 64px "${FAMILY.math}"`,
  `400 64px "${FAMILY.math}"`,
  `300 64px "${FAMILY.zh}"`,
  `500 64px "${FAMILY.zh}"`,
  `900 64px "${FAMILY.zh}"`,
];

export async function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(FONT_FACES.map((f) => document.fonts.load(f, 'AaZz09一切注意力').catch(() => null)));
  await document.fonts.ready;
}

export function fontString({ family = FAMILY.body, size = 48, weight = 500, italic = false }) {
  const fam = /\s/.test(family) ? `"${family}"` : family;
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}`;
}

let measureCtx = null;
export function measureText(text, font, letterSpacing = 0) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  measureCtx.letterSpacing = `${letterSpacing}px`;
  return measureCtx.measureText(text).width;
}

/**
 * Draw text into a new canvas. Sizes are in canvas pixels.
 * opts: text, family, size, weight, italic, color, letterSpacing, align,
 *       lineHeight, glow (px), glowColor, glowPasses, stroke (px), strokeColor,
 *       gradient [[stop, color], ...] (vertical), padding, minWidth, fixedWidth
 */
export function drawTextCanvas(opts) {
  const {
    text,
    size = 48,
    color = '#ffffff',
    letterSpacing = 0,
    align = 'center',
    lineHeight = 1.2,
    glow: glowIn = 0,
    glowColor = color,
    glowPasses: passesIn = 2,
    stroke = 0,
    strokeColor = '#000',
    strokeOnly = false,
    gradient = null,
    fixedWidth = 0,
    fixedHeight = 0,
  } = opts;
  const glow = glowIn * GLOW_K;
  const glowPasses = GLOW_K < 1 ? Math.max(1, Math.round(passesIn * GLOW_K + 0.4)) : passesIn;
  const font = fontString(opts);
  const lines = String(text).split('\n');
  const pad = opts.padding ?? Math.ceil(glow * 2 + stroke + size * 0.15);
  const widths = lines.map((l) => measureText(l, font, letterSpacing));
  const textW = Math.max(1, ...widths);
  const lh = size * lineHeight;
  const textH = lh * (lines.length - 1) + size * 1.25;
  const w = Math.ceil(fixedWidth || textW + pad * 2);
  const h = Math.ceil(fixedHeight || textH + pad * 2);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.letterSpacing = `${letterSpacing}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const top = (h - textH) / 2;

  const xFor = (i) => {
    // letterSpacing adds trailing space after the last glyph; compensate so
    // centred text is optically centred.
    const lw = widths[i] - letterSpacing;
    if (align === 'left') return pad;
    if (align === 'right') return w - pad - lw;
    return (w - lw) / 2;
  };
  const yFor = (i) => top + size * 0.98 + i * lh;

  let fill = color;
  if (gradient) {
    const g = ctx.createLinearGradient(0, top, 0, top + textH);
    for (const [s, c] of gradient) g.addColorStop(s, c);
    fill = g;
  }

  const paint = (mode) => {
    lines.forEach((l, i) => {
      if (mode === 'stroke') ctx.strokeText(l, xFor(i), yFor(i));
      else ctx.fillText(l, xFor(i), yFor(i));
    });
  };

  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.fillStyle = glowColor;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = Math.max(1, stroke);
    for (let p = 0; p < glowPasses; p++) {
      ctx.shadowBlur = glow * (p + 1);
      paint(strokeOnly ? 'stroke' : 'fill');
    }
    ctx.restore();
  }
  if (stroke > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke;
    ctx.strokeStyle = strokeColor;
    paint('stroke');
  }
  if (!strokeOnly) {
    ctx.fillStyle = fill;
    paint('fill');
  }
  return { canvas, width: w, height: h, pad, textWidth: textW, textHeight: textH };
}

export function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

const ANCHORS = {
  center: [0, 0],
  left: [0.5, 0],
  right: [-0.5, 0],
  top: [0, -0.5],
  bottom: [0, 0.5],
  'top-left': [0.5, -0.5],
  'top-right': [-0.5, -0.5],
  'bottom-left': [0.5, 0.5],
  'bottom-right': [-0.5, 0.5],
};

function makeMaterial(tex, { additive = false, tint = 0xffffff, opacity = 1, depthTest = true } = {}) {
  return new THREE.MeshBasicMaterial({
    map: tex,
    color: tint,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest,
    toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * A text label as a mesh. `pxPerUnit` converts canvas pixels to world units
 * (for the HUD layer, which works in 1920×1080 design pixels, use 2 with
 * text drawn at 2× size for crispness).
 */
export function textMesh(opts) {
  const { pxPerUnit = 100, anchor = 'center' } = opts;
  const drawn = drawTextCanvas(opts);
  const tex = canvasTexture(drawn.canvas);
  const w = drawn.width / pxPerUnit;
  const h = drawn.height / pxPerUnit;
  const geo = new THREE.PlaneGeometry(w, h);
  const [ax, ay] = ANCHORS[anchor] || ANCHORS.center;
  // Anchor relative to the text box (not the glow padding).
  const tw = (drawn.textWidth + 0) / pxPerUnit;
  const th = drawn.textHeight / pxPerUnit;
  geo.translate(ax * tw, ay * th, 0);
  const mesh = new THREE.Mesh(geo, makeMaterial(tex, opts));
  mesh.userData.size = { w, h, tw, th };
  mesh.renderOrder = opts.renderOrder ?? 10;
  return mesh;
}

/** Text that can change every frame; redraws only when the string changes. */
export class DynamicText {
  constructor(opts) {
    this.opts = { align: 'center', ...opts };
    const { width, height, pxPerUnit = 100, anchor = 'center' } = this.opts;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = canvasTexture(this.canvas);
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    const geo = new THREE.PlaneGeometry(width / pxPerUnit, height / pxPerUnit);
    const [ax, ay] = ANCHORS[anchor] || ANCHORS.center;
    geo.translate((ax * width) / pxPerUnit, (ay * height) / pxPerUnit, 0);
    this.mesh = new THREE.Mesh(geo, makeMaterial(this.texture, this.opts));
    this.mesh.renderOrder = this.opts.renderOrder ?? 10;
    this.value = null;
  }
  set(text) {
    if (text === this.value) return;
    this.value = text;
    const o = this.opts;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontString(o);
    ctx.letterSpacing = `${o.letterSpacing || 0}px`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = o.align;
    const lines = String(text).split('\n');
    const lh = (o.size || 48) * (o.lineHeight || 1.25);
    const x = o.align === 'left' ? (o.padding ?? 8) : o.align === 'right' ? canvas.width - (o.padding ?? 8) : canvas.width / 2;
    const y0 =
      o.valign === 'top'
        ? (o.padding ?? 8) + lh / 2
        : canvas.height / 2 - ((lines.length - 1) * lh) / 2;
    const paint = () => lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
    if (o.glow) {
      ctx.save();
      ctx.shadowColor = o.glowColor || o.color || '#fff';
      ctx.shadowBlur = o.glow * GLOW_K;
      ctx.fillStyle = o.glowColor || o.color || '#fff';
      paint();
      ctx.restore();
    }
    ctx.fillStyle = o.color || '#fff';
    paint();
    this.texture.needsUpdate = true;
  }
}

/** Cache of text textures keyed by options, for labels reused across frames. */
export class TextCache {
  constructor() {
    this.map = new Map();
  }
  get(opts) {
    const key = JSON.stringify(opts);
    let v = this.map.get(key);
    if (!v) {
      const drawn = drawTextCanvas(opts);
      v = { ...drawn, texture: canvasTexture(drawn.canvas) };
      this.map.set(key, v);
    }
    return v;
  }
  dispose() {
    for (const v of this.map.values()) v.texture.dispose();
    this.map.clear();
  }
}
