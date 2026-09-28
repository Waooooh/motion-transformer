// The recurring synthwave world: gradient sky, stars, striped sun, far ridge,
// and a scrolling neon-grid terrain with wireframe mountains on both sides.
import * as THREE from 'three';
import { GlowPoints } from './materials.js';
import { Rng } from './math.js';

const NOISE = /* glsl */ `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

const TERRAIN_VERT = /* glsl */ `
${NOISE}
uniform float uScroll;
uniform float uMountain;
uniform float uRoad;
varying vec3 vWorld;
varying float vH;
float height(vec2 p) {
  float side = smoothstep(uRoad, uRoad + 18.0, abs(p.x));
  float n = snoise(p * 0.035) * 0.5 + 0.5;
  float r = 1.0 - abs(snoise(p * 0.018 + 7.0));
  float d = snoise(p * 0.11) * 0.12;
  return side * (n * 0.55 + r * r * 0.9 + d) * uMountain * (0.55 + abs(p.x) * 0.012);
}
void main() {
  vec3 p = position;
  vec2 q = vec2(p.x, p.z - uScroll);
  p.y += height(q);
  vH = p.y;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = vec3(p.x, p.y, p.z);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const TERRAIN_FRAG = /* glsl */ `
uniform float uScroll;
uniform float uCell;
uniform vec3 uGrid;
uniform vec3 uGrid2;
uniform vec3 uFloor;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform float uPulse;
uniform float uIntensity;
uniform float uFade;
uniform float uSunX;
uniform vec3 uSunCol;
uniform float uRoad;
varying vec3 vWorld;
varying float vH;
void main() {
  vec2 gc = vec2(vWorld.x, vWorld.z - uScroll) / uCell;
  vec2 fw = fwidth(gc);
  vec2 dist = abs(fract(gc - 0.5) - 0.5) / max(fw, 1e-4);
  float line = 1.0 - clamp(min(dist.x, dist.y) - 0.3, 0.0, 1.0);
  float glow = exp(-min(dist.x, dist.y) * 0.35) * 0.35;
  float far = clamp(max(fw.x, fw.y) * 1.4, 0.0, 1.0);
  float g = (line + glow) * (1.0 - far * 0.85);
  float depth = -vWorld.z;
  float fog = smoothstep(uFogNear, uFogFar, depth);
  float mount = smoothstep(0.4, 6.0, vH);
  vec3 lineCol = mix(uGrid, uGrid2, mount);
  vec3 col = uFloor + lineCol * g * uIntensity * (1.0 + uPulse * 1.4);
  // sun reflection streak on the floor
  float streak = exp(-pow((vWorld.x - uSunX) / (6.0 + depth * 0.06), 2.0)) * (1.0 - mount) * smoothstep(20.0, 320.0, depth);
  col += uSunCol * streak * 0.35;
  col = mix(col, uFog, fog);
  gl_FragColor = vec4(col * (1.0 - uFade), 1.0);
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform float uGlow;
uniform float uFade;
uniform float uHorizonY;
varying vec3 vDir;
void main() {
  float h = vDir.y - uHorizonY;
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.16, h));
  col = mix(col, uZenith, smoothstep(0.12, 0.55, h));
  col += uHorizon * exp(-abs(h) * 28.0) * uGlow;
  if (h < 0.0) col = mix(col, uZenith * 0.5, smoothstep(0.0, -0.08, h));
  gl_FragColor = vec4(col * (1.0 - uFade), 1.0);
}
`;

const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SUN_FRAG = /* glsl */ `
uniform float uTime;
uniform float uBands;
uniform float uIntensity;
uniform float uHalo;
uniform float uFade;
uniform vec3 uTop;
uniform vec3 uMidC;
uniform vec3 uBottom;
uniform float uCut;
varying vec2 vUv;
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * 2.4;
  float r = length(p);
  float aa = fwidth(r) * 1.5;
  float disc = smoothstep(1.0 + aa, 1.0 - aa, r);
  float y = p.y * 0.5 + 0.5;
  vec3 col = mix(uBottom, uMidC, smoothstep(0.0, 0.55, y));
  col = mix(col, uTop, smoothstep(0.5, 1.0, y));
  float by = 1.0 - y;
  float s = fract(by * uBands + uTime * 0.25);
  float thick = smoothstep(0.42, 1.05, by) * 0.62;
  float gap = 1.0 - smoothstep(thick - 0.04, thick, s);
  gap *= step(0.42, by);
  disc *= 1.0 - gap;
  // cut the bottom part below the horizon line (uCut in disc space)
  disc *= smoothstep(uCut - 0.01, uCut + 0.01, p.y);
  float halo = exp(-max(r - 0.95, 0.0) * 3.2) * uHalo * (1.0 - disc) * (1.0 - smoothstep(1.5, 2.35, r));
  vec3 c = col * disc * uIntensity + mix(uBottom, uMidC, 0.5) * halo;
  gl_FragColor = vec4(c * (1.0 - uFade), 1.0);
}
`;

const RIDGE_FRAG = /* glsl */ `
uniform vec3 uFill;
uniform vec3 uRim;
uniform float uFade;
varying vec2 vUv;
varying float vTop;
void main() {
  float rim = exp(-vTop * 60.0);
  gl_FragColor = vec4((uFill + uRim * rim * 1.6) * (1.0 - uFade), 1.0);
}
`;
const RIDGE_VERT = /* glsl */ `
attribute float aTop;
varying vec2 vUv;
varying float vTop;
void main() { vUv = uv; vTop = aTop; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export const ENV_DEFAULTS = {
  grid: '#ff2bd6',
  grid2: '#29e0ff',
  floor: '#0a0218',
  fog: '#3a0a4f',
  zenith: '#03010c',
  mid: '#1b0736',
  horizon: '#ff3d8b',
  sunTop: '#ffe86b',
  sunMid: '#ff8a3d',
  sunBottom: '#ff2a9d',
};

export class SynthwaveEnv {
  constructor(opts = {}) {
    const o = { ...ENV_DEFAULTS, ...opts };
    this.group = new THREE.Group();
    const rng = new Rng(opts.seed || 7);

    // sky
    this.skyU = {
      uZenith: { value: new THREE.Color(o.zenith) },
      uMid: { value: new THREE.Color(o.mid) },
      uHorizon: { value: new THREE.Color(o.horizon) },
      uGlow: { value: 0.35 },
      uFade: { value: 0 },
      uHorizonY: { value: 0.0 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 24),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: this.skyU,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    sky.renderOrder = -100;
    sky.frustumCulled = false;
    this.sky = sky;
    this.group.add(sky);

    // stars
    const N = 1600;
    this.stars = new GlowPoints(N, { core: 1.2, minSize: 1.2 });
    this.starBase = [];
    for (let i = 0; i < N; i++) {
      const th = rng.float(0, Math.PI * 2);
      const y = Math.pow(rng.float(0.02, 1), 0.7);
      const r = Math.sqrt(1 - y * y);
      const R = 700;
      const warm = rng.next() < 0.25;
      const s = rng.float(1.2, 4.2) * (rng.next() < 0.04 ? 2.2 : 1);
      this.stars.setPoint(i, Math.cos(th) * r * R, y * R * 0.9 + 10, Math.sin(th) * r * R, warm ? 1 : 0.75, warm ? 0.7 : 0.85, 1, s, 1);
      this.starBase.push({ s, a: rng.float(0.35, 1), ph: rng.float(0, 100), sp: rng.float(0.5, 2.5), y });
    }
    this.stars.commit();
    this.stars.object.renderOrder = -90;
    this.group.add(this.stars.object);

    // sun
    this.sunU = {
      uTime: { value: 0 },
      uBands: { value: 9 },
      uIntensity: { value: 1.6 },
      uHalo: { value: 0.9 },
      uFade: { value: 0 },
      uTop: { value: new THREE.Color(o.sunTop) },
      uMidC: { value: new THREE.Color(o.sunMid) },
      uBottom: { value: new THREE.Color(o.sunBottom) },
      uCut: { value: -2 },
    };
    this.sun = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: SUN_VERT,
        fragmentShader: SUN_FRAG,
        uniforms: this.sunU,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.sun.renderOrder = -80;
    this.sunRadius = 70;
    this.sun.scale.setScalar(this.sunRadius * 2 * 2.4);
    this.sun.position.set(0, 40, -520);
    this.group.add(this.sun);

    // far ridge silhouette in front of the sun
    this.ridgeU = {
      uFill: { value: new THREE.Color('#07010f') },
      uRim: { value: new THREE.Color(o.grid) },
      uFade: { value: 0 },
    };
    this.ridge = this.makeRidge(rng);
    this.group.add(this.ridge);

    // terrain
    this.terrainU = {
      uScroll: { value: 0 },
      uMountain: { value: 16 },
      uRoad: { value: 16 },
      uCell: { value: 5 },
      uGrid: { value: new THREE.Color(o.grid) },
      uGrid2: { value: new THREE.Color(o.grid2) },
      uFloor: { value: new THREE.Color(o.floor) },
      uFog: { value: new THREE.Color(o.fog) },
      uFogNear: { value: 60 },
      uFogFar: { value: 420 },
      uPulse: { value: 0 },
      uIntensity: { value: 1.4 },
      uFade: { value: 0 },
      uSunX: { value: 0 },
      uSunCol: { value: new THREE.Color(o.sunMid) },
    };
    const tg = new THREE.PlaneGeometry(420, 460, 170, 190);
    tg.rotateX(-Math.PI / 2);
    tg.translate(0, 0, -210);
    this.terrain = new THREE.Mesh(
      tg,
      new THREE.ShaderMaterial({
        vertexShader: TERRAIN_VERT,
        fragmentShader: TERRAIN_FRAG,
        uniforms: this.terrainU,
      }),
    );
    this.terrain.frustumCulled = false;
    this.group.add(this.terrain);
  }

  makeRidge(rng) {
    const segs = 160;
    const width = 1400;
    const pos = [];
    const top = [];
    const idx = [];
    const heights = [];
    for (let i = 0; i <= segs; i++) {
      const x = (i / segs - 0.5) * width;
      const u = i / segs;
      const edge = Math.abs(u - 0.5) * 2;
      let h = 18 + 30 * Math.pow(edge, 1.5);
      h += Math.sin(u * 31.0 + 1.3) * 6 + Math.sin(u * 77.0) * 3 + rng.float(-2, 2);
      h *= 0.9 + 0.35 * Math.abs(Math.sin(u * 9.0));
      heights.push(Math.max(4, h));
      pos.push(x, Math.max(4, h), 0, x, -60, 0);
      top.push(0, 1);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // distance from the top edge in normalised units for the rim glow
    const topAttr = [];
    for (let i = 0; i <= segs; i++) topAttr.push(0, 1);
    g.setAttribute('aTop', new THREE.Float32BufferAttribute(topAttr, 1));
    g.setIndex(idx);
    const m = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({ vertexShader: RIDGE_VERT, fragmentShader: RIDGE_FRAG, uniforms: this.ridgeU }),
    );
    m.position.set(0, -2, -470);
    m.renderOrder = -70;
    m.frustumCulled = false;
    return m;
  }

  /**
   * p: { t, scroll, sunY, sunIntensity, sunScale, pulse, fade, glow, mountain,
   *      road, starAlpha, gridIntensity, bands, fogNear, fogFar }
   */
  update(p = {}) {
    const t = p.t ?? 0;
    const tu = this.terrainU;
    tu.uScroll.value = p.scroll ?? t * 8;
    tu.uPulse.value = p.pulse ?? 0;
    tu.uFade.value = p.fade ?? 0;
    if (p.mountain !== undefined) tu.uMountain.value = p.mountain;
    if (p.road !== undefined) tu.uRoad.value = p.road;
    if (p.gridIntensity !== undefined) tu.uIntensity.value = p.gridIntensity;
    if (p.fogNear !== undefined) tu.uFogNear.value = p.fogNear;
    if (p.fogFar !== undefined) tu.uFogFar.value = p.fogFar;
    this.skyU.uFade.value = p.fade ?? 0;
    this.skyU.uGlow.value = p.glow ?? 0.35;
    this.ridgeU.uFade.value = p.fade ?? 0;
    const su = this.sunU;
    su.uTime.value = t;
    su.uFade.value = p.fade ?? 0;
    su.uIntensity.value = p.sunIntensity ?? 1.6;
    su.uHalo.value = p.sunHalo ?? 0.9;
    if (p.bands !== undefined) su.uBands.value = p.bands;
    const sunY = p.sunY ?? 40;
    this.sun.position.y = sunY;
    const sc = (p.sunScale ?? 1) * this.sunRadius * 2 * 2.4;
    this.sun.scale.setScalar(sc);
    // stars twinkle
    const sa = p.starAlpha ?? 1;
    const st = this.stars;
    for (let i = 0; i < this.starBase.length; i++) {
      const b = this.starBase[i];
      const tw = 0.6 + 0.4 * Math.sin(t * b.sp + b.ph);
      st.alphas[i] = b.a * tw * sa * (1 - (p.fade ?? 0)) * Math.min(1, b.y * 6);
    }
    st.geometry.attributes.alpha.needsUpdate = true;
    this.stars.object.visible = sa > 0.001;
  }

  setCamera(camera, renderHeight) {
    this.stars.setCamera(camera, renderHeight);
  }
}
