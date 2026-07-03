/** One axis tick: the value it sits at, and the label to draw beside it. */
export interface Tick {
  value: number;
  label: string;
}

/** Picks a "nice" step (1/2/5 x 10^n) that yields roughly `targetCount` ticks over `span`. */
function niceStep(span: number, targetCount: number): number {
  if (span <= 0 || targetCount <= 0) return 1;
  const roughStep = span / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  let niceResidual: number;
  if (residual > 5) niceResidual = 10;
  else if (residual > 2) niceResidual = 5;
  else if (residual > 1) niceResidual = 2;
  else niceResidual = 1;
  return niceResidual * magnitude;
}

function formatTimeTick(seconds: number, step: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds - minutes * 60;
  const secsLabel = step < 1 ? secs.toFixed(2).padStart(5, "0") : Math.round(secs).toString().padStart(2, "0");
  return `${minutes}:${secsLabel}`;
}

/**
 * Generates evenly-spaced time-axis ticks (in seconds) covering `[start, end]`,
 * landing on "nice" values (whole/half/fifth seconds, minutes, etc).
 */
export function timeTicks(start: number, end: number, targetCount = 6): Tick[] {
  const span = end - start;
  if (span <= 0) return [];
  const step = niceStep(span, targetCount);
  const first = Math.ceil(start / step) * step;
  const count = Math.floor((end - first) / step + 1e-9) + 1;
  const ticks: Tick[] = [];
  for (let i = 0; i < count; i++) {
    const value = first + i * step;
    if (value < start - 1e-9 || value > end + 1e-9) continue;
    ticks.push({ value, label: formatTimeTick(value, step) });
  }
  return ticks;
}

function formatFrequencyTick(hz: number): string {
  if (hz === 0) return "0";
  if (hz >= 1000) {
    const khz = hz / 1000;
    return `${Number.isInteger(khz) ? khz.toFixed(0) : khz.toFixed(1)}k`;
  }
  return `${Math.round(hz)}`;
}

/**
 * Generates evenly-spaced frequency-axis ticks (in Hz) covering `[0, maxHz]`,
 * landing on "nice" values and labeled with a `k` suffix above 1kHz.
 */
export function frequencyTicks(maxHz: number, targetCount = 5): Tick[] {
  if (maxHz <= 0) return [];
  const step = niceStep(maxHz, targetCount);
  const count = Math.floor(maxHz / step + 1e-9) + 1;
  const ticks: Tick[] = [];
  for (let i = 0; i < count; i++) {
    const value = i * step;
    if (value > maxHz + 1e-9) continue;
    ticks.push({ value, label: formatFrequencyTick(value) });
  }
  return ticks;
}
