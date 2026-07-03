import { afterEach, describe, expect, it } from "vitest";
import { SpectrogramView } from "../src/ui/spectrogram-view";
import type { SpectrogramFrame } from "../src/lib/spectrogram";

/** A duck-typed fake `<canvas>` + 2D context, same pattern as waveform-view.test.ts. */
function fakeCanvas(clientWidth: number, clientHeight: number) {
  const calls: string[] = [];
  const context = {
    clearRect: (...args: number[]) => calls.push(`clearRect ${args.join(" ")}`),
    fillRect: (...args: number[]) => calls.push(`fillRect ${args.join(" ")}`),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    setTransform: () => {},
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    beginPath: () => calls.push("beginPath"),
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
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

describe("SpectrogramView.render", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("clears and no-ops for an empty frame list", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
    const { canvas, calls } = fakeCanvas(200, 100);
    const view = new SpectrogramView(canvas);

    view.render([]);

    expect(calls).toEqual(["clearRect 0 0 200 100"]);
  });

  it("fills one rect per frame x bin", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
    const { canvas, calls } = fakeCanvas(100, 100);
    const view = new SpectrogramView(canvas);
    const frames: SpectrogramFrame[] = [
      Float64Array.from([0.1, 0.5]),
      Float64Array.from([0.2, 0.9]),
    ];

    view.render(frames);

    expect(calls.filter((c) => c.startsWith("fillRect"))).toHaveLength(4);
  });

  it("draws axis gridlines when axis info is given, skipping the 0Hz tick", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
    const { canvas, calls } = fakeCanvas(100, 100);
    const view = new SpectrogramView(canvas);
    const frames: SpectrogramFrame[] = [Float64Array.from([0.1, 0.5])];

    view.render(frames, { sampleRate: 44100, duration: 2 });

    // drawHorizontalTicks + drawVerticalTicks each bracket their gridlines.
    expect(calls.filter((c) => c === "save")).toHaveLength(2);
    expect(calls.filter((c) => c === "restore")).toHaveLength(2);
  });
});
