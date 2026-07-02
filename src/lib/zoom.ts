import { clamp } from "./math";

/** A visible time window in seconds, `0 <= start < end <= duration`. */
export interface ViewWindow {
  start: number;
  end: number;
}

/** Narrowest zoomed-in window allowed, in seconds. */
export const MIN_VIEW_SECONDS = 0.05;

/**
 * Zooms a view window by `factor` (< 1 zooms in, > 1 zooms out), keeping
 * the point at `pivotRatio` (0..1 across the current window) stationary —
 * so zooming under the cursor keeps that instant in place rather than
 * always re-centering on the window's midpoint.
 */
export function zoomWindow(
  view: ViewWindow,
  duration: number,
  factor: number,
  pivotRatio: number,
): ViewWindow {
  if (duration <= 0) return { start: 0, end: 0 };

  const span = view.end - view.start;
  const newSpan = clamp(span * factor, MIN_VIEW_SECONDS, duration);
  const pivotTime = view.start + clamp(pivotRatio, 0, 1) * span;
  const newStart = clamp(pivotTime - pivotRatio * newSpan, 0, duration - newSpan);

  return { start: newStart, end: newStart + newSpan };
}

/** Pans a view window by `deltaSeconds`, clamped so it never leaves `[0, duration]`. */
export function panWindow(
  view: ViewWindow,
  duration: number,
  deltaSeconds: number,
): ViewWindow {
  if (duration <= 0) return { start: 0, end: 0 };

  const span = view.end - view.start;
  const newStart = clamp(view.start + deltaSeconds, 0, Math.max(0, duration - span));
  return { start: newStart, end: newStart + span };
}
