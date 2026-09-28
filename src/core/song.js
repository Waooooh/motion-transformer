// Musical map of "Hong Kong Story" — Lazer Boomerang (2022), 3:56.
//
// Measured from the track: the pulse is exactly 0.75 s (80 BPM, 4/4), so one
// bar is 3.0 s and bar 0 starts at t = 0. The loudness contour gives the form:
//
//   bars  0–11   0:00–0:36  intro — drumless swell (steps up at 0:18 and 0:30)
//   bars 12–27   0:36–1:24  drop 1 — full energy
//   bars 28–43   1:24–2:12  groove — mid energy, drums forward
//   bars 44–59   2:12–3:00  drop 2 — full energy (the climax)
//   bars 60–68   3:00–3:27  outro — beat keeps going while everything fades
//   bars 69–78   3:27–3:56  tail — sparse hits, last hit at 3:55.95
//
// All scenes are scheduled in bars, so if a different recording starts a bit
// earlier/later the whole film shifts with a single offset (see features.js).

export const SONG = {
  title: 'Hong Kong Story',
  artist: 'Lazer Boomerang',
  bpm: 80,
  beatsPerBar: 4,
  duration: 236.47,
};

export const BEAT = 60 / SONG.bpm; // 0.75 s
export const BAR = BEAT * SONG.beatsPerBar; // 3.0 s
export const STEP = BEAT / 4; // a 16th note, 0.1875 s

/** Song time (s) at the start of bar `b` (fractional bars allowed). */
export const bars = (b) => b * BAR;
/** Song time (s) of beat `n` counted from the top of the song. */
export const beats = (n) => n * BEAT;

export const SECTIONS = [
  { id: 'intro', from: 0, to: 12 },
  { id: 'drop1', from: 12, to: 28 },
  { id: 'groove', from: 28, to: 44 },
  { id: 'drop2', from: 44, to: 60 },
  { id: 'outro', from: 60, to: 69 },
  { id: 'tail', from: 69, to: 79 },
];

// Accents in the tail, read off the loudness contour (seconds).
export const TAIL_HITS = [210.07, 213.09, 216.0, 222.02, 225.83, 235.95];

export function sectionAt(t) {
  const b = t / BAR;
  for (const s of SECTIONS) if (b >= s.from && b < s.to) return s;
  return b < 0 ? SECTIONS[0] : SECTIONS[SECTIONS.length - 1];
}
