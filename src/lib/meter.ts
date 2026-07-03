import { clamp } from "./math";

/** Meter floor: anything at or below this reads as the bottom of the scale. */
const MIN_DB = -60;
/** Meter ceiling: 0dBFS, full scale. */
const MAX_DB = 0;

/** Converts a linear peak amplitude (0..1, or above for a clipping signal) to decibels full-scale. */
export function amplitudeToDb(amplitude: number): number {
  // `amplitude <= 0` alone doesn't catch NaN (`NaN <= 0` is false) — a
  // corrupt/malformed decoded file could feed a NaN sample into the
  // analyser, and Math.log10(NaN) would otherwise propagate NaN through to
  // the meter's CSS width.
  if (!(amplitude > 0)) return MIN_DB;
  return Math.max(MIN_DB, 20 * Math.log10(amplitude));
}

/** Normalizes a dB value onto a 0..1 meter-fill ratio across the [MIN_DB, MAX_DB] scale. */
export function dbToMeterRatio(db: number): number {
  return clamp((db - MIN_DB) / (MAX_DB - MIN_DB), 0, 1);
}

/** True once a linear peak amplitude reaches full scale — the signal is clipping. */
export function isClipping(amplitude: number): boolean {
  return amplitude >= 1;
}

/**
 * Root-mean-square amplitude of a sample block. A real VU meter reads
 * closer to average/RMS loudness than to instantaneous peak — peak alone
 * makes the needle flicker with every transient rather than settling on
 * the perceived level, so the level meter's fill uses this while
 * `isClipping` still checks peak (a single full-scale sample should still
 * light the clip LED even if it barely moves the RMS).
 */
export function rmsAmplitude(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sumOfSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    sumOfSquares += sample * sample;
  }
  return Math.sqrt(sumOfSquares / samples.length);
}
