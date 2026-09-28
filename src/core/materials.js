// Reusable neon primitives: glowing point clouds, screen-space glow lines
// (with per-line reveal / intensity / travelling pulse), and heatmap panels
// for matrices.
import * as THREE from 'three';

export const PALETTE = {
  bgDeep: new THREE.Color('#05010f'),
  night: new THREE.Color('#0d0425'),
  purple: new THREE.Color('#2a0a4a'),
  violet: new THREE.Color('#7b2cff'),
  magenta: new THREE.Color('#ff2a9d'),
  pink: new THREE.Color('#ff4fd8'),
  hot: new THREE.Color('#ff2a6d'),
  cyan: new THREE.Color('#1ee3ff'),
  teal: new THREE.Color('#00ffd0'),
  blue: new THREE.Color('#3b6bff'),
  orange: new THREE.Color('#ff8a1f'),
  amber: new THREE.Color('#ffb627'),
  yellow: new THREE.Color('#ffe66d'),
  white: new THREE.Color('#ffffff'),
};

export const HEX = {
  magenta: '#ff2a9d',
  pink: '#ff4fd8',
  hot: '#ff2a6d',
  cyan: '#1ee3ff',
  teal: '#00ffd0',
  violet: '#9d5cff',
  orange: '#ff8a1f',
  amber: '#ffb627',
  yellow: '#ffe66d',
  white: '#ffffff',
  dim: '#b9a7ff',
};

/** Synthwave colormap for values in 0..1 (GLSL). */
export const GLSL_COLORMAP = /* glsl */ `
vec3 synthMap(float v) {
  v = clamp(v, 0.0, 1.0);
  vec3 c0 = vec3(0.03, 0.01, 0.10);
  vec3 c1 = vec3(0.32, 0.04, 0.62);
  vec3 c2 = vec3(1.00, 0.10, 0.55);
  vec3 c3 = vec3(1.00, 0.52, 0.12);
  vec3 c4 = vec3(1.00, 0.95, 0.62);
  if (v < 0.25) return mix(c0, c1, v / 0.25);
  if (v < 0.5) return mix(c1, c2, (v - 0.25) / 0.25);
  if (v < 0.75) return mix(c2, c3, (v - 0.5) / 0.25);
  return mix(c3, c4, (v - 0.75) / 0.25);
}
vec3 iceMap(float v) {
  v = clamp(v, 0.0, 1.0);
  vec3 c0 = vec3(0.02, 0.02, 0.10);
  vec3 c1 = vec3(0.10, 0.20, 0.75);
  vec3 c2 = vec3(0.10, 0.85, 1.00);
  vec3 c3 = vec3(0.85, 1.00, 1.00);
  if (v < 0.33) return mix(c0, c1, v / 0.33);
  if (v < 0.66) return mix(c1, c2, (v - 0.33) / 0.33);
  return mix(c2, c3, (v - 0.66) / 0.34);
}
// diverging: negative → cyan, positive → magenta
vec3 divMap(float v) {
  float a = clamp(abs(v), 0.0, 1.0);
  vec3 pos = vec3(1.0, 0.16, 0.62);
  vec3 neg = vec3(0.12, 0.85, 1.0);
  return mix(vec3(0.05, 0.02, 0.12), v >= 0.0 ? pos : neg, pow(a, 0.8));
}
`;

export function synthColor(v, target = new THREE.Color()) {
  v = Math.min(1, Math.max(0, v));
  const stops = [
    [0.03, 0.01, 0.1],
    [0.32, 0.04, 0.62],
    [1.0, 0.1, 0.55],
    [1.0, 0.52, 0.12],
    [1.0, 0.95, 0.62],
  ];
  const x = v * 4;
  const i = Math.min(3, Math.floor(x));
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return target.setRGB(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
}

export function divColor(v, target = new THREE.Color()) {
  const a = Math.pow(Math.min(1, Math.abs(v)), 0.8);
  const base = [0.05, 0.02, 0.12];
  const c = v >= 0 ? [1.0, 0.16, 0.62] : [0.12, 0.85, 1.0];
  return target.setRGB(base[0] + (c[0] - base[0]) * a, base[1] + (c[1] - base[1]) * a, base[2] + (c[2] - base[2]) * a);
}

// ------------------------------------------------------------------ points
const POINTS_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float alpha;
uniform float uScale;
uniform float uSizeMul;
uniform float uMinSize;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = size * uSizeMul * uScale / max(0.001, -mv.z);
  gl_PointSize = clamp(s, uMinSize, 512.0);
  vColor = color;
  vAlpha = alpha * min(1.0, s / max(uMinSize, 0.0001));
}
`;
const POINTS_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uCore;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float glow = exp(-r2 * 4.0);
  float core = smoothstep(0.18, 0.0, r2) * uCore;
  gl_FragColor = vec4(vColor * (glow + core) * vAlpha * uOpacity, 1.0);
}
`;

/**
 * Additive glowing points. Call `.setPoint(i, x, y, z, r, g, b, size, alpha)`
 * then `.commit()`; or write the typed arrays directly.
 */
export class GlowPoints {
  constructor(count, { sizeMul = 1, core = 0.6, minSize = 1.5 } = {}) {
    this.count = count;
    const g = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      uniforms: {
        uScale: { value: 540 },
        uSizeMul: { value: sizeMul },
        uOpacity: { value: 1 },
        uCore: { value: core },
        uMinSize: { value: minSize },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.Points(g, this.material);
    this.object.frustumCulled = false;
    this.geometry = g;
  }
  setPoint(i, x, y, z, r, gg, b, size, alpha = 1) {
    const p = this.positions;
    const c = this.colors;
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
    c[i * 3] = r;
    c[i * 3 + 1] = gg;
    c[i * 3 + 2] = b;
    this.sizes[i] = size;
    this.alphas[i] = alpha;
  }
  commit() {
    const a = this.geometry.attributes;
    a.position.needsUpdate = true;
    a.color.needsUpdate = true;
    a.size.needsUpdate = true;
    a.alpha.needsUpdate = true;
  }
  /** uScale should be (renderHeight/2) / tan(fov/2) for world-size points. */
  setCamera(camera, renderHeight) {
    const f = renderHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    this.material.uniforms.uScale.value = f;
  }
}

// ------------------------------------------------------------------- lines
const LINES_VERT = /* glsl */ `
attribute vec3 aA;
attribute vec3 aB;
attribute float aSide;
attribute float aEnd;
attribute float aU;
attribute float aLine;
attribute float aWidth;
attribute vec3 aColor;
uniform vec2 uResolution;
uniform float uWidth;
uniform float uPerspective;
uniform float uMaxWidth;
uniform sampler2D uData;
uniform vec2 uDataSize;
varying float vU;
varying float vSide;
varying vec3 vColor;
varying vec4 vData;
void main() {
  vec4 a = projectionMatrix * modelViewMatrix * vec4(aA, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(aB, 1.0);
  // keep both ends in front of the camera
  a.w = max(a.w, 0.02);
  b.w = max(b.w, 0.02);
  vec2 sa = a.xy / a.w * uResolution * 0.5;
  vec2 sb = b.xy / b.w * uResolution * 0.5;
  vec2 dv = sb - sa;
  float len = length(dv);
  vec2 dir = len > 1e-5 ? dv / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 p = mix(a, b, aEnd);
  float w = uWidth * aWidth;
  if (uPerspective > 0.5) w = w * uResolution.y * 0.5 * projectionMatrix[1][1] / p.w;
  w = clamp(w, 1.0, uMaxWidth * uResolution.y / 1080.0);
  p.xy += nrm * aSide * w * 0.5 / (uResolution * 0.5) * p.w;
  gl_Position = p;
  float id = aLine;
  vec2 duv = vec2((mod(id, uDataSize.x) + 0.5) / uDataSize.x, (floor(id / uDataSize.x) + 0.5) / uDataSize.y);
  vData = texture2D(uData, duv);
  vU = aU;
  vSide = aSide;
  vColor = aColor;
}
`;
const LINES_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uCore;
uniform float uPulseWidth;
uniform float uFalloff;
varying float vU;
varying float vSide;
varying vec3 vColor;
varying vec4 vData; // x: reveal start, y: reveal end, z: intensity, w: pulse position
void main() {
  if (vU < vData.x || vU > vData.y || vData.z <= 0.0) discard;
  float d = abs(vSide);
  float glow = exp(-d * d * uFalloff);
  float core = smoothstep(0.35, 0.0, d) * uCore;
  float tip = smoothstep(vData.y, vData.y - 0.015, vU) * 0.7 + 0.3;
  float pulse = exp(-pow((vU - vData.w) / uPulseWidth, 2.0));
  vec3 col = vColor * (glow + core) * tip + vec3(1.0, 0.95, 1.0) * pulse * glow * 1.5;
  gl_FragColor = vec4(col * vData.z * uOpacity, 1.0);
}
`;

/**
 * Many glowing polylines in one draw call. Each polyline gets a slot in a
 * data texture holding (revealStart, revealEnd, intensity, pulsePos), so it
 * can be animated every frame without touching geometry.
 */
export class GlowLines {
  constructor(polylines, { width = 3, perspective = false, core = 0.8, falloff = 3.0, pulseWidth = 0.04, opacity = 1, maxWidth = 400 } = {}) {
    const lineCount = polylines.length;
    let segs = 0;
    for (const pl of polylines) segs += Math.max(0, pl.points.length - 1);
    const vcount = segs * 4;
    const A = new Float32Array(vcount * 3);
    const B = new Float32Array(vcount * 3);
    const side = new Float32Array(vcount);
    const end = new Float32Array(vcount);
    const U = new Float32Array(vcount);
    const L = new Float32Array(vcount);
    const W = new Float32Array(vcount);
    const C = new Float32Array(vcount * 3);
    const index = new Uint32Array(segs * 6);
    let v = 0;
    let ii = 0;
    polylines.forEach((pl, li) => {
      const pts = pl.points;
      const n = pts.length;
      if (n < 2) return;
      // arc length parameterisation
      const acc = [0];
      for (let i = 1; i < n; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const total = acc[n - 1] || 1;
      const col = pl.color || new THREE.Color(1, 1, 1);
      const cols = pl.colors; // optional per-point colors
      const wid = pl.width ?? 1;
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        for (let k = 0; k < 4; k++) {
          const e = k < 2 ? 0 : 1;
          const s = k % 2 === 0 ? -1 : 1;
          A[v * 3] = p0.x;
          A[v * 3 + 1] = p0.y;
          A[v * 3 + 2] = p0.z;
          B[v * 3] = p1.x;
          B[v * 3 + 1] = p1.y;
          B[v * 3 + 2] = p1.z;
          side[v] = s;
          end[v] = e;
          U[v] = (e ? acc[i + 1] : acc[i]) / total;
          L[v] = li;
          W[v] = Array.isArray(wid) ? wid[e ? i + 1 : i] : wid;
          const cc = cols ? cols[e ? i + 1 : i] : col;
          C[v * 3] = cc.r;
          C[v * 3 + 1] = cc.g;
          C[v * 3 + 2] = cc.b;
          v++;
        }
        const base = v - 4;
        index[ii++] = base;
        index[ii++] = base + 1;
        index[ii++] = base + 2;
        index[ii++] = base + 2;
        index[ii++] = base + 1;
        index[ii++] = base + 3;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(A, 3)); // for bounds only
    g.setAttribute('aA', new THREE.BufferAttribute(A, 3));
    g.setAttribute('aB', new THREE.BufferAttribute(B, 3));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    g.setAttribute('aU', new THREE.BufferAttribute(U, 1));
    g.setAttribute('aLine', new THREE.BufferAttribute(L, 1));
    g.setAttribute('aWidth', new THREE.BufferAttribute(W, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(C, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));

    const dw = 256;
    const dh = Math.max(1, Math.ceil(lineCount / dw));
    this.data = new Float32Array(dw * dh * 4);
    for (let i = 0; i < lineCount; i++) this.data.set([0, 1, 1, -1], i * 4);
    this.dataTex = new THREE.DataTexture(this.data, dw, dh, THREE.RGBAFormat, THREE.FloatType);
    this.dataTex.minFilter = THREE.NearestFilter;
    this.dataTex.magFilter = THREE.NearestFilter;
    this.dataTex.needsUpdate = true;

    this.material = new THREE.ShaderMaterial({
      vertexShader: LINES_VERT,
      fragmentShader: LINES_FRAG,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        uWidth: { value: width },
        uPerspective: { value: perspective ? 1 : 0 },
        uMaxWidth: { value: maxWidth },
        uData: { value: this.dataTex },
        uDataSize: { value: new THREE.Vector2(dw, dh) },
        uOpacity: { value: opacity },
        uCore: { value: core },
        uFalloff: { value: falloff },
        uPulseWidth: { value: pulseWidth },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.object = new THREE.Mesh(g, this.material);
    this.object.frustumCulled = false;
    this.count = lineCount;
    this.baseWidth = width;
  }
  set(i, start, end, intensity = 1, pulse = -1) {
    const o = i * 4;
    this.data[o] = start;
    this.data[o + 1] = end;
    this.data[o + 2] = intensity;
    this.data[o + 3] = pulse;
  }
  setAll(start, end, intensity = 1, pulse = -1) {
    for (let i = 0; i < this.count; i++) this.set(i, start, end, intensity, pulse);
  }
  commit() {
    this.dataTex.needsUpdate = true;
  }
  /** Width is specified in 1080p pixels; call with the render size. */
  setResolution(w, h) {
    this.material.uniforms.uResolution.value.set(w, h);
    this.material.uniforms.uWidth.value = this.baseWidth * (h / 1080);
  }
}

// ----------------------------------------------------------------- heatmap
const HEAT_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const HEAT_FRAG = /* glsl */ `
${GLSL_COLORMAP}
uniform sampler2D uValues;
uniform vec2 uDims;
uniform float uGap;
uniform float uRadius;
uniform float uReveal;
uniform float uOpacity;
uniform float uIntensity;
uniform float uHighlightRow;
uniform float uHighlightCol;
uniform float uHighlightGain;
uniform float uMap;
uniform float uBorder;
uniform float uRevealMode;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec2 g = vec2(vUv.x * uDims.x, (1.0 - vUv.y) * uDims.y);
  vec2 cell = min(floor(g), uDims - 1.0);
  vec2 f = g - cell;
  float idx = uRevealMode < 0.5 ? cell.y * uDims.x + cell.x : cell.x * uDims.y + cell.y;
  float total = uDims.x * uDims.y;
  float rv = clamp(uReveal * total - idx, 0.0, 1.0);
  if (rv <= 0.0) discard;
  float v = texture2D(uValues, (vec2(cell.x, cell.y) + 0.5) / uDims).r;
  vec2 q = abs(f - 0.5) - (0.5 - uGap * 0.5) + uRadius;
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float aa = fwidth(dist) * 1.2;
  float m = smoothstep(aa, -aa, dist);
  float edge = smoothstep(aa * 2.0, 0.0, abs(dist + 0.02)) * uBorder;
  vec3 col = uMap < 0.5 ? synthMap(v) : (uMap < 1.5 ? iceMap(v) : (uMap < 2.5 ? divMap(v * 2.0 - 1.0) : mix(vec3(0.03, 0.01, 0.08), vec3(1.0), v)));
  float hl = 0.0;
  if (abs(cell.y - uHighlightRow) < 0.5) hl += 1.0;
  if (abs(cell.x - uHighlightCol) < 0.5) hl += 1.0;
  col *= uTint * uIntensity * (1.0 + hl * uHighlightGain);
  col += vec3(1.0, 0.8, 1.0) * edge * (0.4 + hl);
  gl_FragColor = vec4(col, m * uOpacity * rv);
}
`;

/** A rows×cols matrix drawn as glowing rounded cells. Values 0..1. */
export class HeatmapPanel {
  constructor({ rows, cols, width = 1, height = 1, values = null, map = 'synth', gap = 0.14, radius = 0.12, intensity = 1.4, additive = false }) {
    this.rows = rows;
    this.cols = cols;
    this.values = new Float32Array(rows * cols);
    if (values) this.values.set(values);
    this.tex = new THREE.DataTexture(this.values, cols, rows, THREE.RedFormat, THREE.FloatType);
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.needsUpdate = true;
    this.uniforms = {
      uValues: { value: this.tex },
      uDims: { value: new THREE.Vector2(cols, rows) },
      uGap: { value: gap },
      uRadius: { value: radius },
      uReveal: { value: 1 },
      uRevealMode: { value: 0 },
      uOpacity: { value: 1 },
      uIntensity: { value: intensity },
      uHighlightRow: { value: -10 },
      uHighlightCol: { value: -10 },
      uHighlightGain: { value: 1.2 },
      uMap: { value: { synth: 0, ice: 1, div: 2, mono: 3 }[map] ?? 0 },
      uBorder: { value: 0.35 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: HEAT_VERT,
      fragmentShader: HEAT_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
  }
  /** Values are stored row-major with row 0 at the top. */
  setValues(arr) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.values[r * this.cols + c] = arr[r * this.cols + c];
      }
    }
    this.tex.needsUpdate = true;
  }
  set(r, c, v) {
    this.values[r * this.cols + c] = v;
    this.tex.needsUpdate = true;
  }
}

// --------------------------------------------------------------- helpers
export function basicMat(color, { opacity = 1, additive = true, wireframe = false, side = THREE.FrontSide } = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    wireframe,
    side,
    toneMapped: false,
  });
}

/** Soft radial sprite texture (for halos, lens glows). */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glowSprite(color, scale = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

/** Cubic Bézier arc between two points, bulging along `up`. */
export function arcPoints(a, b, height, segments = 32, up = new THREE.Vector3(0, 1, 0)) {
  const mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(up, height);
  const c1 = a.clone().lerp(mid, 0.66).addScaledVector(up, height * 0.35);
  const c2 = b.clone().lerp(mid, 0.66).addScaledVector(up, height * 0.35);
  const curve = new THREE.CubicBezierCurve3(a.clone(), c1, c2, b.clone());
  return curve.getPoints(segments);
}

/** A soft-edged dark panel placed behind busy content to lift contrast. */
export function softPanel(w, h, { opacity = 0.55, color = '#05010f', feather = 0.25 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uFeather: { value: feather }, uAspect: { value: w / h } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uFeather; uniform float uAspect;
      varying vec2 vUv;
      void main(){
        vec2 d = abs(vUv - 0.5) * 2.0;
        float fx = smoothstep(1.0, 1.0 - uFeather / uAspect, d.x);
        float fy = smoothstep(1.0, 1.0 - uFeather, d.y);
        gl_FragColor = vec4(uColor, uOpacity * fx * fy);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.renderOrder = -10;
  return m;
}
