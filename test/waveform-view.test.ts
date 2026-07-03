import { afterEach, describe, expect, it } from "vitest";
import { WaveformView } from "../src/ui/waveform-view";
import type { WaveformEnvelope } from "../src/lib/waveform";

/**
 * A duck-typed fake `<canvas>` + 2D context: enough surface area for
 * WaveformView.render() (which goes through fitCanvasToContainer) to run
 * end-to-end and lets a test inspect what got drawn, without a real DOM.
 */
function fakeCanvas(clientWidth: number, clientHeight: number) {
  const calls: string[] = [];
  const context = {
    clearRect: (...args: number[]) => calls.push(`clearRect ${args.join(" ")}`),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    shadowColor: "",
    shadowBlur: 0,
    setTransform: () => {},
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo ${x} ${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo ${x} ${y}`),
    stroke: () => calls.push("stroke"),
    fill: () => calls.push("fill"),
    strokeText: () => {},
    fillText: () => {},
  };
  const canvas = {
    clientWidth,
    clientHeight,
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

function envelope(min: number[], max: number[]): WaveformEnvelope {
  return { min: Float32Array.from(min), max: Float32Array.from(max) };
}

describe("WaveformView.render", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("clears and draws the center line even for an empty envelope", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
    const { canvas, calls } = fakeCanvas(200, 100);
    const view = new WaveformView(canvas);

    view.render(envelope([], []));

    expect(calls).toContain("clearRect 0 0 200 100");
    expect(calls).toContain("moveTo 0 50");
    expect(calls).toContain("lineTo 200 50");
    // No columns to trace -> the fill path never opens.
    expect(calls).not.toContain("fill");
  });

  it("traces a filled envelope path across the full width", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
    const { canvas, calls } = fakeCanvas(100, 100);
    const view = new WaveformView(canvas);

    view.render(envelope([-0.5, -1], [0.5, 1]));

    expect(calls).toContain("fill");
    expect(calls.filter((c) => c === "closePath")).toHaveLength(1);
  });

  it("draws time-axis gridlines when a view window is given", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
    const { canvas, calls } = fakeCanvas(100, 100);
    const view = new WaveformView(canvas);

    view.render(envelope([0], [0]), { start: 0, end: 10 });

    // drawVerticalTicks brackets its gridlines with save/restore.
    expect(calls).toContain("save");
    expect(calls).toContain("restore");
  });
});
