// Polyline builders for GlowLines (all return arrays of THREE.Vector3).
import * as THREE from 'three';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

export function linePts(a, b, segments = 1) {
  const pts = [];
  for (let i = 0; i <= segments; i++) pts.push(a.clone().lerp(b, i / segments));
  return pts;
}

export function circlePts(cx, cy, r, n = 64, z = 0, a0 = Math.PI / 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 - (i / n) * Math.PI * 2;
    pts.push(V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z));
  }
  return pts;
}

/** Rounded rectangle centred at (cx, cy), starting top-middle, clockwise. */
export function roundRectPts(cx, cy, w, h, r = 0.15, z = 0, seg = 6) {
  r = Math.min(r, w / 2, h / 2);
  const pts = [];
  const hw = w / 2;
  const hh = h / 2;
  pts.push(V(cx, cy + hh, z));
  const corner = (x, y, start) => {
    for (let i = 0; i <= seg; i++) {
      const a = start - (i / seg) * (Math.PI / 2);
      pts.push(V(x + Math.cos(a) * r, y + Math.sin(a) * r, z));
    }
  };
  corner(cx + hw - r, cy + hh - r, Math.PI / 2);
  corner(cx + hw - r, cy - hh + r, 0);
  corner(cx - hw + r, cy - hh + r, -Math.PI / 2);
  corner(cx - hw + r, cy + hh - r, Math.PI);
  pts.push(V(cx, cy + hh, z));
  return pts;
}

/** Matrix bracket: side = -1 for "[" (left), +1 for "]" (right). */
export function bracketPts(x, y, h, side = -1, lip = 0.18, z = 0) {
  const hh = h / 2;
  const s = -side;
  return [V(x + s * lip, y + hh, z), V(x, y + hh, z), V(x, y - hh, z), V(x + s * lip, y - hh, z)];
}

/** Smooth arc (quadratic-ish) from a to b rising by `height` along `up`. */
export function arcPts(a, b, height, n = 40, up = V(0, 1, 0)) {
  const pts = [];
  const mid = a.clone().add(b).multiplyScalar(0.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    const bump = 4 * t * (1 - t);
    p.addScaledVector(up, height * bump);
    pts.push(p);
  }
  void mid;
  return pts;
}

/** Arrow: shaft from a to b plus two head strokes, as separate polylines. */
export function arrowPolylines(a, b, head = 0.18) {
  const dir = b.clone().sub(a).normalize();
  const n = V(-dir.y, dir.x, 0);
  const h1 = b.clone().addScaledVector(dir, -head).addScaledVector(n, head * 0.6);
  const h2 = b.clone().addScaledVector(dir, -head).addScaledVector(n, -head * 0.6);
  return [linePts(a, b, 8), [h1, b.clone(), h2]];
}

export { V };
