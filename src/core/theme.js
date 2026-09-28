// Visual "looks". Every scene reads its world colours and glow levels from
// here, so the whole film can change mood in one place.
//
//   deep (default) — dark navy space, dim steel-blue grid, an eclipse instead
//                    of the striped sun, restrained bloom / glow / flashes
//   neon           — the original hot-pink synthwave look
//
// Pick with ?look=neon in the player, or --look neon in the render tools.

const LOOKS = {
  deep: {
    name: 'deep',
    env: {
      grid: '#3c4f8f',
      grid2: '#2d5577',
      floor: '#010208',
      fog: '#060b20',
      zenith: '#000104',
      mid: '#040816',
      horizon: '#1a2a5c',
      skySpread: 0.32,
      sunTop: '#e6dcc4',
      sunMid: '#b89a86',
      sunBottom: '#6d5a86',
      rim: '#cfdcff',
      ridgeRim: '#223058',
      ridgeFill: '#010207',
      eclipse: 1,
      fogNear: 25,
      fogFar: 300,
      lineGlow: 0.08,
      warmStars: 0.05,
    },
    // multipliers applied on top of what each scene asks for
    k: {
      grid: 0.5,
      pulse: 0.3,
      sun: 1,
      halo: 0.8,
      horizon: 0.25,
      stars: 0.55,
      streak: 0,
      ridgeRim: 0.45,
      bloom: 0.42,
      flash: 0.6,
      flashGain: 2.6,
      flashMix: 0.06,
      aberration: 0.3,
      glitch: 0.45,
      scan: 0.5,
      textGlow: 0.4,
      sprite: 0.45,
      decor: 0.55,
    },
    fx: {
      threshold: 0.86,
      knee: 0.3,
      saturation: 0.9,
      contrast: 1.07,
      lift: [0, 0.003, 0.01],
      vignette: 0.62,
    },
  },
  neon: {
    name: 'neon',
    env: {
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
      rim: '#ffffff',
      ridgeRim: '#ff2bd6',
      ridgeFill: '#07010f',
      eclipse: 0,
      fogNear: 60,
      fogFar: 420,
      lineGlow: 0.35,
      warmStars: 0.25,
    },
    k: {
      grid: 1,
      pulse: 1,
      sun: 1,
      halo: 1,
      horizon: 1,
      stars: 1,
      streak: 1,
      ridgeRim: 1,
      bloom: 1,
      flash: 1,
      aberration: 1,
      glitch: 1,
      scan: 1,
      textGlow: 1,
      sprite: 1,
      decor: 1,
    },
    fx: {},
  },
};

function pick() {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('look');
    if (q && LOOKS[q]) return LOOKS[q];
  } catch {}
  return LOOKS.deep;
}

export const THEME = pick();
export const LOOK_NAMES = Object.keys(LOOKS);
