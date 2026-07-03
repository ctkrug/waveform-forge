import { intensityToColor } from "../lib/colormap";
import { magnitudeToDb, normalizeDb, type SpectrogramFrame } from "../lib/spectrogram";
import { frequencyTicks, timeTicks } from "../lib/ticks";
import { drawHorizontalTicks, drawVerticalTicks } from "./axis";
import { fitCanvasToContainer } from "./canvas-utils";

const MIN_DB = -80;
const MAX_DB = 0;

/** Extra context needed to label the spectrogram's time and frequency axes. */
export interface SpectrogramAxisInfo {
  sampleRate: number;
  duration: number;
}

/**
 * Renders spectrogram frames (frequency x time magnitude data) to a
 * canvas as a heatmap: time on the x-axis, frequency (low at the bottom)
 * on the y-axis, intensity mapped through the studio-scope color ramp.
 */
export class SpectrogramView {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  render(frames: SpectrogramFrame[], axis?: SpectrogramAxisInfo): void {
    const ctx = fitCanvasToContainer(this.canvas);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);

    const frameCount = frames.length;
    if (frameCount === 0 || width === 0 || height === 0) {
      return;
    }

    const binCount = frames[0].length;
    const columnWidth = width / frameCount;
    const rowHeight = height / binCount;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const frame = frames[frameIndex];
      const x = frameIndex * columnWidth;
      for (let bin = 0; bin < binCount; bin++) {
        const db = magnitudeToDb(frame[bin], MIN_DB);
        const intensity = normalizeDb(db, MIN_DB, MAX_DB);
        ctx.fillStyle = intensityToColor(intensity);
        // Bin 0 is DC (lowest frequency); draw it at the bottom of the canvas.
        const y = height - (bin + 1) * rowHeight;
        ctx.fillRect(x, y, columnWidth + 1, rowHeight + 1);
      }
    }

    if (axis) {
      const nyquist = axis.sampleRate / 2;
      drawHorizontalTicks(
        ctx,
        frequencyTicks(nyquist),
        (hz) => height - (hz / nyquist) * height,
        width,
      );
      drawVerticalTicks(
        ctx,
        timeTicks(0, axis.duration),
        (seconds) => (axis.duration === 0 ? 0 : (seconds / axis.duration) * width),
        height,
      );
    }
  }
}
