// Post-processing: HDR scene → bloom (dual-filter) → tone map → HUD → final
// grade (chromatic aberration, scanlines, vignette, flash, glitch, grain).
import * as THREE from 'three';
import { THEME } from './theme.js';

const K = THEME.k;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
vec3 pre(vec3 c) {
  c = min(c, vec3(24.0));
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  return c * w;
}
void main() {
  vec3 a = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4(pre((a + b + c + d) * 0.25), 1.0);
}
`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - h).rgb;
  s += texture2D(tSrc, vUv + h).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb;
  s += texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}
`;

const UP = /* glsl */ `
uniform sampler2D tLow; uniform sampler2D tCur; uniform vec2 uTexel; uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 s = texture2D(tLow, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture2D(tLow, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture2D(tLow, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture2D(tLow, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture2D(tLow, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture2D(tLow, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture2D(tLow, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture2D(tLow, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 * uWeight + texture2D(tCur, vUv).rgb, 1.0);
}
`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloom; uniform float uExposure; uniform float uSaturation; uniform float uContrast;
uniform vec3 uLift; uniform vec3 uGain;
varying vec2 vUv;
// Khronos PBR Neutral: keeps neon hues, rolls highlights off to white.
vec3 neutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 b = texture2D(tBloom, vUv).rgb;
  c = (c + b * uBloom) * uExposure;
  c = neutral(max(c, 0.0));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContrast + 0.5;
  c = c * uGain + uLift * (1.0 - c);
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}
`;

const FINAL = /* glsl */ `
uniform sampler2D tComp; uniform sampler2D tHud; uniform vec2 uRes; uniform float uSeed;
uniform float uAberration; uniform float uScan; uniform float uVignette; uniform float uGrain;
uniform float uFlash; uniform vec3 uFlashColor; uniform float uFlashGain; uniform float uFlashMix; uniform float uFade; uniform float uGlitch;
uniform float uZoom; uniform vec2 uShake;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 uv = (vUv - 0.5) / uZoom + 0.5 + uShake;
  if (uGlitch > 0.001) {
    float s = floor(uSeed * 24.0);
    float band = floor(uv.y * 18.0 + hash(vec2(s, 3.0)) * 18.0);
    float r = hash(vec2(band, s));
    if (r < uGlitch * 0.6) uv.x += (hash(vec2(band, s + 1.0)) - 0.5) * 0.18 * uGlitch;
    float thin = floor(uv.y * 140.0);
    if (hash(vec2(thin, s + 7.0)) < uGlitch * 0.15) uv.x += (hash(vec2(thin, s)) - 0.5) * 0.05;
  }
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  vec2 off = d * uAberration * (1.0 + r2 * 4.0) * 0.0035 + vec2(uGlitch * 0.006, 0.0);
  vec3 c;
  c.r = texture2D(tComp, uv + off).r;
  c.g = texture2D(tComp, uv).g;
  c.b = texture2D(tComp, uv - off).b;
  vec4 hud = texture2D(tHud, vUv);
  c = c * (1.0 - hud.a) + hud.rgb;
  float scan = 0.5 + 0.5 * sin(vUv.y * uRes.y * 3.14159265);
  c *= 1.0 - uScan * (1.0 - scan);
  c *= 1.0 - uVignette * smoothstep(0.15, 0.75, r2 * 2.0);
  c *= (1.0 + uFlash * uFlashGain) * (1.0 - uFade);
  vec3 o = toSRGB(c);
  o = mix(o, uFlashColor, clamp(uFlash, 0.0, 1.0) * uFlashMix);
  o += (hash(vUv * uRes + fract(uSeed * 7.13) * 100.0) - 0.5) * uGrain;
  gl_FragColor = vec4(o, 1.0);
}
`;

export const DEFAULT_FX = () => ({
  bloom: 1.0,
  threshold: 0.62,
  knee: 0.35,
  exposure: 1.0,
  saturation: 1.1,
  contrast: 1.04,
  lift: [0.012, 0.0, 0.03],
  gain: [1, 1, 1],
  aberration: 0.15,
  scan: 0.1,
  vignette: 0.5,
  grain: 0.02,
  flash: 0,
  flashColor: [1, 1, 1],
  fade: 0,
  glitch: 0,
  zoom: 1,
  shake: [0, 0],
  ...THEME.fx,
});

function fsMaterial(frag, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
}

export class Post {
  constructor(renderer, { width, height, msaa = 4, bloomLevels = 6 }) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const hf = { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: msaa,
      depthBuffer: true,
    });
    this.compTarget = new THREE.WebGLRenderTarget(width, height, { ...hf, depthBuffer: false });
    // HUD (captions, badges) is composited after the lens effects so it stays crisp
    this.hudTarget = new THREE.WebGLRenderTarget(width, height, { ...hf, depthBuffer: true });
    this.down = [];
    this.up = [];
    let w = width;
    let h = height;
    for (let i = 0; i < bloomLevels; i++) {
      w = Math.max(2, Math.round(w / 2));
      h = Math.max(2, Math.round(h / 2));
      this.down.push(new THREE.WebGLRenderTarget(w, h, hf));
      this.up.push(new THREE.WebGLRenderTarget(w, h, hf));
    }

    this.mPre = fsMaterial(PREFILTER, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 0.6 },
      uKnee: { value: 0.3 },
    });
    this.mDown = fsMaterial(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = fsMaterial(UP, {
      tLow: { value: null },
      tCur: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uWeight: { value: 1 },
    });
    this.mComp = fsMaterial(COMPOSITE, {
      tScene: { value: null },
      tBloom: { value: null },
      uBloom: { value: 1 },
      uExposure: { value: 1 },
      uSaturation: { value: 1 },
      uContrast: { value: 1 },
      uLift: { value: new THREE.Vector3() },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
    });
    this.mFinal = fsMaterial(FINAL, {
      tComp: { value: null },
      tHud: { value: null },
      uRes: { value: new THREE.Vector2(width, height) },
      uSeed: { value: 0 },
      uAberration: { value: 0 },
      uScan: { value: 0 },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color(1, 1, 1) },
      uFlashGain: { value: K.flashGain ?? 0 },
      uFlashMix: { value: K.flashMix ?? 0.9 },
      uFade: { value: 0 },
      uGlitch: { value: 0 },
      uZoom: { value: 1 },
      uShake: { value: new THREE.Vector2() },
    });
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  /** Bloom + tone map the HDR scene into compTarget. */
  composite(fx) {
    const src = this.sceneTarget;
    const d = this.down;
    this.mPre.uniforms.tSrc.value = src.texture;
    this.mPre.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
    this.mPre.uniforms.uThreshold.value = fx.threshold;
    this.mPre.uniforms.uKnee.value = fx.knee;
    this.pass(this.mPre, d[0]);
    for (let i = 1; i < d.length; i++) {
      this.mDown.uniforms.tSrc.value = d[i - 1].texture;
      this.mDown.uniforms.uTexel.value.set(1 / d[i - 1].width, 1 / d[i - 1].height);
      this.pass(this.mDown, d[i]);
    }
    let low = d[d.length - 1];
    for (let i = d.length - 2; i >= 0; i--) {
      this.mUp.uniforms.tLow.value = low.texture;
      this.mUp.uniforms.tCur.value = d[i].texture;
      this.mUp.uniforms.uTexel.value.set(0.5 / low.width, 0.5 / low.height);
      this.mUp.uniforms.uWeight.value = 1.0;
      this.pass(this.mUp, this.up[i]);
      low = this.up[i];
    }
    const u = this.mComp.uniforms;
    u.tScene.value = src.texture;
    u.tBloom.value = low.texture;
    u.uBloom.value = (fx.bloom * K.bloom) / d.length;
    u.uExposure.value = fx.exposure;
    u.uSaturation.value = fx.saturation;
    u.uContrast.value = fx.contrast;
    u.uLift.value.set(...fx.lift);
    u.uGain.value.set(...fx.gain);
    this.pass(this.mComp, this.compTarget);
  }

  final(fx, seed) {
    const u = this.mFinal.uniforms;
    u.tComp.value = this.compTarget.texture;
    u.tHud.value = this.hudTarget.texture;
    u.uSeed.value = seed;
    u.uAberration.value = fx.aberration * K.aberration;
    u.uScan.value = fx.scan * K.scan;
    u.uVignette.value = fx.vignette;
    u.uGrain.value = fx.grain;
    u.uFlash.value = fx.flash * K.flash;
    u.uFlashColor.value.setRGB(...fx.flashColor);
    u.uFade.value = fx.fade;
    u.uGlitch.value = fx.glitch * K.glitch;
    u.uZoom.value = fx.zoom;
    u.uShake.value.set(...fx.shake);
    this.pass(this.mFinal, null);
  }
}
