// The director owns the renderer pipeline and the schedule. For a song time
// t it decides which scenes are on screen, lets each one update itself as a
// pure function of time, then renders scene → bloom → HUD → final grade.
import * as THREE from 'three';
import { Post, DEFAULT_FX } from './post.js';
import { bars } from './song.js';
import { clamp, smoothstep } from './math.js';

export class Director {
  constructor({ renderer, width, height, features, schedule, msaa = 4 }) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;
    this.features = features;
    this.post = new Post(renderer, { width, height, msaa });
    this.hudCam = new THREE.OrthographicCamera(-960, 960, 540, -540, -2000, 2000);
    this.ctx = { width, height, aspect: width / height, renderer, director: this };
    this.entries = schedule.map((e, i) => {
      const from = bars(e.from);
      const to = bars(e.to);
      return { ...e, index: i, t0: from, t1: to, start: from - (e.pre || 0), end: to + (e.post || 0), inst: null };
    });
  }

  setFeatures(features) {
    this.features = features;
  }

  instance(entry) {
    if (!entry.inst) {
      entry.inst = entry.make(this.ctx);
      entry.inst.entry = entry;
    }
    return entry.inst;
  }

  /** Build every scene up front (avoids hitches during live playback). */
  warmup() {
    for (const e of this.entries) this.instance(e);
  }

  activeAt(t) {
    return this.entries.filter((e) => t >= e.start && t < e.end);
  }

  /** Free scenes that are far from t (keeps memory flat in long renders). */
  release(t, keep = 20) {
    for (const e of this.entries) {
      if (e.inst && (t > e.end + keep || t < e.start - keep)) {
        e.inst.dispose?.();
        disposeTree(e.inst.scene);
        disposeTree(e.inst.hud);
        disposeTree(e.inst.overlay);
        e.inst = null;
      }
    }
  }

  /** opts.clean: skip overlays and HUD (a clean plate, e.g. behind a menu). */
  renderAt(t, seed = t, opts = {}) {
    const r = this.renderer;
    const f = this.features.sample(t);
    const fx = DEFAULT_FX();
    // global groove: snare pushes the colour fringes, kick adds a little bloom
    fx.aberration += f.snare * 0.3 * f.drums + f.kick * 0.1 * f.drums;
    fx.bloom += f.kick * 0.18 * f.drums;
    fx.zoom = 1 + f.kick * 0.006 * f.drums;
    const active = this.activeAt(t);

    r.setRenderTarget(this.post.sceneTarget);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    const frames = [];
    for (const e of active) {
      const s = this.instance(e);
      const lt = t - e.t0;
      const dur = e.t1 - e.t0;
      const info = {
        t,
        lt,
        dur,
        p: clamp(lt / dur),
        f,
        fx,
        fadeIn: e.pre ? smoothstep(e.start, e.t0, t) : 1,
        fadeOut: e.post ? 1 - smoothstep(e.t1, e.end, t) : 1,
        width: this.width,
        height: this.height,
      };
      info.vis = Math.min(info.fadeIn, info.fadeOut);
      s.update(info);
      frames.push(s);
    }
    for (const s of frames) {
      if (s.scene && s.camera && s.visible !== false) {
        r.clearDepth();
        r.render(s.scene, s.camera);
      }
      if (s.overlay && !opts.clean) {
        r.clearDepth();
        r.render(s.overlay, this.hudCam);
      }
    }
    this.post.composite(fx);
    r.setRenderTarget(this.post.hudTarget);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    for (const s of frames) {
      if (s.hud && !opts.clean) {
        r.clearDepth();
        r.render(s.hud, this.hudCam);
      }
    }
    this.post.final(fx, seed);
    return { active: active.map((e) => e.id), f };
  }
}

export function disposeTree(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k of Object.keys(m)) {
        const v = m[k];
        if (v && v.isTexture) v.dispose();
      }
      if (m.uniforms) {
        for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose();
      }
      m.dispose();
    }
  });
}
