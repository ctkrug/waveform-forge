import { afterEach, describe, expect, it } from "vitest";
import { computeBackingSize, fitCanvasToContainer } from "../src/ui/canvas-utils";

/**
 * A duck-typed stand-in for HTMLCanvasElement tracking how many times
 * width/height are actually written, so a test can tell whether the
 * unchanged-size no-op path ran without a real DOM.
 */
function fakeCanvas(clientWidth: number, clientHeight: number) {
  let width = 0;
  let height = 0;
  let widthWrites = 0;
  let heightWrites = 0;
  const setTransformCalls: number[][] = [];
  const context = {
    setTransform: (...args: number[]) => setTransformCalls.push(args),
  };
  const canvas = {
    clientWidth,
    clientHeight,
    get width() {
      return width;
    },
    set width(value: number) {
      width = value;
      widthWrites++;
    },
    get height() {
      return height;
    },
    set height(value: number) {
      height = value;
      heightWrites++;
    },
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return {
    canvas,
    setTransformCalls,
    writes: () => ({ width: widthWrites, height: heightWrites }),
  };
}

describe("computeBackingSize", () => {
  it("scales CSS size by the device pixel ratio", () => {
    expect(computeBackingSize(300, 150, 2)).toEqual({ width: 600, height: 300 });
  });

  it("rounds fractional device pixel ratios", () => {
    expect(computeBackingSize(100, 100, 1.5)).toEqual({ width: 150, height: 150 });
  });

  it("floors a device pixel ratio below 1 to 1", () => {
    expect(computeBackingSize(100, 100, 0.5)).toEqual({ width: 100, height: 100 });
  });

  it("never returns a zero-sized backing store", () => {
    expect(computeBackingSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
  });
});

describe("fitCanvasToContainer", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("sizes the backing store to CSS size x devicePixelRatio", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 2 } });
    const { canvas } = fakeCanvas(300, 150);

    fitCanvasToContainer(canvas);

    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(300);
  });

  it("scales the returned context by the device pixel ratio", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 2 } });
    const { canvas, setTransformCalls } = fakeCanvas(100, 100);

    fitCanvasToContainer(canvas);

    expect(setTransformCalls).toEqual([[2, 0, 0, 2, 0, 0]]);
  });

  it("falls back to a devicePixelRatio of 1 when window.devicePixelRatio is unset", () => {
    Object.assign(globalThis, { window: {} });
    const { canvas } = fakeCanvas(50, 50);

    fitCanvasToContainer(canvas);

    expect(canvas.width).toBe(50);
  });

  it("skips resizing the backing store when the CSS size hasn't changed", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
    const { canvas, writes } = fakeCanvas(50, 50);

    fitCanvasToContainer(canvas);
    fitCanvasToContainer(canvas);

    expect(writes()).toEqual({ width: 1, height: 1 });
  });

  it("throws if the 2D context is unavailable", () => {
    Object.assign(globalThis, { window: { devicePixelRatio: 1 } });
    const canvas = {
      clientWidth: 10,
      clientHeight: 10,
      width: 0,
      height: 0,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    expect(() => fitCanvasToContainer(canvas)).toThrow(/2D canvas context/);
  });
});
