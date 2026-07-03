import type { ViewWindow } from "../lib/zoom";
import type { WaveformEnvelope } from "../lib/waveform";
import { timeTicks } from "../lib/ticks";
import { drawVerticalTicks } from "./axis";
import { fitCanvasToContainer } from "./canvas-utils";

const TRACE_COLOR = "#39ff88";
const TRACE_GLOW = "rgba(57, 255, 136, 0.45)";
const CENTER_LINE_COLOR = "rgba(138, 143, 156, 0.35)";

/**
 * Renders a min/max waveform envelope to a canvas, phosphor-scope style.
 * The playhead and trim handles are separate DOM overlays (see main.ts)
 * so they can track audio time every frame without a full canvas redraw.
 */
export class WaveformView {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  render(envelope: WaveformEnvelope, viewWindow?: ViewWindow): void {
    const ctx = fitCanvasToContainer(this.canvas);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const midY = height / 2;

    ctx.clearRect(0, 0, width, height);

    if (viewWindow) {
      const span = viewWindow.end - viewWindow.start;
      const ticks = timeTicks(viewWindow.start, viewWindow.end);
      drawVerticalTicks(
        ctx,
        ticks,
        (value) => (span === 0 ? 0 : ((value - viewWindow.start) / span) * width),
        height,
      );
    }

    ctx.strokeStyle = CENTER_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    const columns = envelope.min.length;
    if (columns === 0 || width === 0) {
      return;
    }

    ctx.save();
    ctx.shadowColor = TRACE_GLOW;
    ctx.shadowBlur = 6;
    ctx.fillStyle = TRACE_COLOR;
    ctx.beginPath();

    for (let i = 0; i < columns; i++) {
      const x = (i / columns) * width;
      const y = midY - envelope.max[i] * midY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = columns - 1; i >= 0; i--) {
      const x = (i / columns) * width;
      const y = midY - envelope.min[i] * midY;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
