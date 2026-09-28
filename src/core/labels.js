// Thousands of small text labels in one draw call: strings are packed into a
// canvas atlas and drawn as camera-facing instanced quads.
import * as THREE from 'three';
import { fontString, measureText } from './text.js';
import { THEME } from './theme.js';

export class LabelAtlas {
  constructor(strings, { family, weight = 500, size = 64, color = '#ffffff', glow = 0, glowColor = null, padding = 10, maxWidth = 2048 }) {
    const font = fontString({ family, weight, size });
    const items = strings.map((s) => ({ s, w: Math.ceil(measureText(s, font)) + padding * 2 + glow * 2 }));
    const h = Math.ceil(size * 1.35) + padding * 2 + glow * 2;
    // simple shelf packing
    let x = 0;
    let y = 0;
    for (const it of items) {
      if (x + it.w > maxWidth) {
        x = 0;
        y += h;
      }
      it.x = x;
      it.y = y;
      x += it.w;
    }
    const W = maxWidth;
    const H = THREE.MathUtils.ceilPowerOfTwo(y + h);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (const it of items) {
      const cx = it.x + it.w / 2;
      const cy = it.y + h / 2;
      if (glow) {
        ctx.save();
        ctx.shadowColor = glowColor || color;
        ctx.shadowBlur = glow * THEME.k.textGlow;
        ctx.fillStyle = glowColor || color;
        ctx.fillText(it.s, cx, cy);
        ctx.restore();
      }
      ctx.fillStyle = color;
      ctx.fillText(it.s, cx, cy);
    }
    this.canvas = canvas;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.rects = items.map((it) => ({
      u0: it.x / W,
      v0: 1 - (it.y + h) / H,
      u1: (it.x + it.w) / W,
      v1: 1 - it.y / H,
      aspect: it.w / h,
    }));
    this.index = new Map(strings.map((s, i) => [s, i]));
  }
}

const VERT = /* glsl */ `
attribute vec3 iOffset;
attribute vec4 iUV;
attribute vec3 iColor;
attribute vec2 iSize; // x: height, y: alpha
attribute float iAspect;
attribute float iRot;
uniform float uBillboard;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 q = position.xy * vec2(iSize.x * iAspect, iSize.x);
  float c = cos(iRot), s = sin(iRot);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  vec4 mv;
  if (uBillboard > 0.5) {
    mv = modelViewMatrix * vec4(iOffset, 1.0);
    mv.xy += q;
  } else {
    mv = modelViewMatrix * vec4(iOffset + vec3(q, 0.0), 1.0);
  }
  gl_Position = projectionMatrix * mv;
  vUv = vec2(mix(iUV.x, iUV.z, uv.x), mix(iUV.y, iUV.w, uv.y));
  vColor = iColor;
  vAlpha = iSize.y;
}
`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uAdditive;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vAlpha * uOpacity;
  if (a < 0.003) discard;
  vec3 c = t.rgb * vColor;
  gl_FragColor = uAdditive > 0.5 ? vec4(c * a, 1.0) : vec4(c, a);
}
`;

export class LabelField {
  constructor(atlas, count, { billboard = true, additive = true, depthTest = true } = {}) {
    this.atlas = atlas;
    this.count = count;
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    const mk = (n) => new THREE.InstancedBufferAttribute(new Float32Array(count * n), n).setUsage(THREE.DynamicDrawUsage);
    this.aOffset = mk(3);
    this.aUV = mk(4);
    this.aColor = mk(3);
    this.aSize = mk(2);
    this.aAspect = mk(1);
    this.aRot = mk(1);
    g.setAttribute('iOffset', this.aOffset);
    g.setAttribute('iUV', this.aUV);
    g.setAttribute('iColor', this.aColor);
    g.setAttribute('iSize', this.aSize);
    g.setAttribute('iAspect', this.aAspect);
    g.setAttribute('iRot', this.aRot);
    g.instanceCount = count;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: atlas.texture },
        uOpacity: { value: 1 },
        uBillboard: { value: billboard ? 1 : 0 },
        uAdditive: { value: additive ? 1 : 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.object = new THREE.Mesh(g, this.material);
    this.object.frustumCulled = false;
    this.geometry = g;
  }
  /** Assign label `li` to instance i. */
  setLabel(i, li) {
    const r = this.atlas.rects[li];
    this.aUV.setXYZW(i, r.u0, r.v0, r.u1, r.v1);
    this.aAspect.setX(i, r.aspect);
  }
  set(i, x, y, z, height, alpha = 1, r = 1, g = 1, b = 1, rot = 0) {
    this.aOffset.setXYZ(i, x, y, z);
    this.aSize.setXY(i, height, alpha);
    this.aColor.setXYZ(i, r, g, b);
    this.aRot.setX(i, rot);
  }
  commit() {
    this.aOffset.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aUV.needsUpdate = true;
    this.aAspect.needsUpdate = true;
    this.aRot.needsUpdate = true;
  }
}
