/**
 * Maps a normalized intensity in [0, 1] to an RGB color for the
 * spectrogram heatmap. Ramps through the studio-scope palette from
 * `docs/DESIGN.md`: near-black background surface, up through phosphor
 * green, out to amber at the hottest bins — one continuous hue journey
 * rather than a generic rainbow LUT.
 */

interface RgbStop {
  at: number;
  r: number;
  g: number;
  b: number;
}

const STOPS: RgbStop[] = [
  { at: 0, r: 0x15, g: 0x17, b: 0x1b }, // --bg
  { at: 0.45, r: 0x0d, g: 0x5a, b: 0x38 }, // dim phosphor green
  { at: 0.75, r: 0x39, g: 0xff, b: 0x88 }, // --accent
  { at: 1, r: 0xff, g: 0xb0, b: 0x20 }, // --accent-support
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Returns a `rgb(r, g, b)` CSS color string for a normalized intensity value. */
export function intensityToColor(intensity: number): string {
  // `Math.min(1, Math.max(0, NaN))` is NaN, not a clamped number — without
  // this guard a NaN intensity (e.g. a corrupt spectrogram bin) would
  // silently produce "rgb(NaN, NaN, NaN)" instead of a valid color.
  const t = Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 0;

  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t >= STOPS[i].at && t <= STOPS[i + 1].at) {
      lower = STOPS[i];
      upper = STOPS[i + 1];
      break;
    }
  }

  const span = upper.at - lower.at;
  const localT = span === 0 ? 0 : (t - lower.at) / span;
  const r = Math.round(lerp(lower.r, upper.r, localT));
  const g = Math.round(lerp(lower.g, upper.g, localT));
  const b = Math.round(lerp(lower.b, upper.b, localT));

  return `rgb(${r}, ${g}, ${b})`;
}
