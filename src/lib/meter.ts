import { clamp } from "./math";

/** Meter floor: anything at or below this reads as the bottom of the scale. */
const MIN_DB = -60;
/** Meter ceiling: 0dBFS, full scale. */
const MAX_DB = 0;

/** Converts a linear peak amplitude (0..1, or above for a clipping signal) to decibels full-scale. */
export function amplitudeToDb(amplitude: number): number {
  if (amplitude <= 0) return MIN_DB;
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
