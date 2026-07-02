import { clamp } from "./math";

/** A trim selection in seconds, always satisfying `0 <= start < end <= duration`. */
export interface TrimSelection {
  start: number;
  end: number;
}

/** The narrowest selection allowed, in seconds — prevents a zero-length export. */
export const MIN_SELECTION_SECONDS = 0.01;

/**
 * Clamps a proposed (start, end) selection to a valid range within
 * `[0, duration]`, preserving a minimum gap and ordering start <= end.
 */
export function clampSelection(
  start: number,
  end: number,
  duration: number,
): TrimSelection {
  if (duration <= 0) {
    return { start: 0, end: 0 };
  }

  let clampedStart = clamp(start, 0, duration);
  let clampedEnd = clamp(end, 0, duration);

  if (clampedEnd < clampedStart) {
    [clampedStart, clampedEnd] = [clampedEnd, clampedStart];
  }

  if (clampedEnd - clampedStart < MIN_SELECTION_SECONDS) {
    if (clampedEnd + MIN_SELECTION_SECONDS <= duration) {
      clampedEnd = clampedStart + MIN_SELECTION_SECONDS;
    } else {
      clampedStart = Math.max(0, duration - MIN_SELECTION_SECONDS);
      clampedEnd = duration;
    }
  }

  return { start: clampedStart, end: clampedEnd };
}

/** Converts a time-based selection to inclusive-start/exclusive-end sample indices. */
export function selectionToSampleRange(
  selection: TrimSelection,
  sampleRate: number,
  totalSamples: number,
): { startSample: number; endSample: number } {
  const startSample = clamp(Math.round(selection.start * sampleRate), 0, totalSamples);
  const endSample = clamp(Math.round(selection.end * sampleRate), 0, totalSamples);
  return {
    startSample: Math.min(startSample, endSample),
    endSample: Math.max(startSample, endSample),
  };
}
