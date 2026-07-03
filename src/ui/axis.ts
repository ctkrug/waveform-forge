import type { Tick } from "../lib/ticks";

const GRID_COLOR = "rgba(138, 143, 156, 0.18)";
const LABEL_COLOR = "#8a8f9c";
const LABEL_HALO_COLOR = "rgba(21, 23, 27, 0.85)";
const LABEL_FONT = "10px Inter, system-ui, sans-serif";

/** Draws label text with a dark halo so it stays legible over busy canvas content. */
function drawLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = LABEL_HALO_COLOR;
  ctx.strokeText(label, x, y);
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(label, x, y);
}

/** Draws vertical gridlines + labels at each tick's x position (e.g. a time axis). */
export function drawVerticalTicks(
  ctx: CanvasRenderingContext2D,
  ticks: Tick[],
  toX: (value: number) => number,
  height: number,
): void {
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.textBaseline = "bottom";
  for (const tick of ticks) {
    const x = Math.round(toX(tick.value)) + 0.5;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    drawLabel(ctx, tick.label, x + 3, height - 2);
  }
  ctx.restore();
}

/** Draws horizontal gridlines + labels at each tick's y position (e.g. a frequency axis). */
export function drawHorizontalTicks(
  ctx: CanvasRenderingContext2D,
  ticks: Tick[],
  toY: (value: number) => number,
  width: number,
): void {
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.textBaseline = "bottom";
  for (const tick of ticks) {
    const y = Math.round(toY(tick.value)) + 0.5;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    drawLabel(ctx, tick.label, 3, y - 2);
  }
  ctx.restore();
}
