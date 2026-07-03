/** How long the clip LED stays lit after the last clipping sample, in ms. */
const CLIP_HOLD_MS = 1500;

export interface LevelMeterElements {
  fill: HTMLElement;
  clipLed: HTMLElement;
}

/**
 * A DOM-based analog-VU-style peak meter: a fill bar whose width tracks the
 * current level ratio (see `src/lib/meter.ts` for the amplitude -> ratio
 * math), plus a clip LED that latches on for `CLIP_HOLD_MS` after the last
 * clipping sample rather than flickering on/off frame to frame.
 */
export class LevelMeter {
  private clipTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly el: LevelMeterElements) {}

  setLevel(ratio: number, clipping: boolean): void {
    // Callers already clamp (dbToMeterRatio), but clamping again here keeps
    // this reusable primitive safe on its own — an out-of-range ratio would
    // otherwise silently produce a >100%-wide or negative-width fill bar.
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    this.el.fill.style.width = `${Math.round(clampedRatio * 100)}%`;

    if (clipping) {
      this.el.clipLed.classList.add("is-lit");
      if (this.clipTimeoutId !== null) clearTimeout(this.clipTimeoutId);
      this.clipTimeoutId = setTimeout(() => {
        this.el.clipLed.classList.remove("is-lit");
        this.clipTimeoutId = null;
      }, CLIP_HOLD_MS);
    }
  }

  reset(): void {
    this.el.fill.style.width = "0%";
    this.el.clipLed.classList.remove("is-lit");
    if (this.clipTimeoutId !== null) {
      clearTimeout(this.clipTimeoutId);
      this.clipTimeoutId = null;
    }
  }
}
