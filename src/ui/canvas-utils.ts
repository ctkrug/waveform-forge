/** Backing-store pixel dimensions for a canvas rendered at a given CSS size and DPR. */
export interface BackingSize {
  width: number;
  height: number;
}

/**
 * Computes the integer backing-store size for a canvas so it renders crisp
 * at `devicePixelRatio`, given its CSS box size. Pure so the rounding
 * behavior is unit-tested without a DOM.
 */
export function computeBackingSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): BackingSize {
  const ratio = Math.max(1, devicePixelRatio);
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
  };
}

/**
 * Resizes a canvas's backing store to match its current CSS box at
 * `devicePixelRatio`, and returns a 2D context pre-scaled so drawing
 * commands can be issued in CSS pixel units. No-ops (returns the existing
 * context) if the CSS size hasn't changed since the last call.
 */
export function fitCanvasToContainer(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = computeBackingSize(cssWidth, cssHeight, dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("fitCanvasToContainer: 2D canvas context is unavailable");
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}
