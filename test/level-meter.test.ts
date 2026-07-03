import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LevelMeter } from "../src/ui/level-meter";

/**
 * A minimal duck-typed stand-in for the two DOM elements LevelMeter touches
 * (`.style.width` and `.classList.add/remove/contains`) — enough to test
 * the class's behavior without pulling in jsdom for a single small module.
 */
function fakeElement() {
  const classes = new Set<string>();
  return {
    style: { width: "" },
    classList: {
      add: (cls: string) => classes.add(cls),
      remove: (cls: string) => classes.delete(cls),
      contains: (cls: string) => classes.has(cls),
    },
  } as unknown as HTMLElement;
}

describe("LevelMeter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets the fill width from the ratio", () => {
    const fill = fakeElement();
    const clipLed = fakeElement();
    const meter = new LevelMeter({ fill, clipLed });

    meter.setLevel(0.42, false);

    expect(fill.style.width).toBe("42%");
  });

  it("clamps a ratio above 1 to a 100% fill", () => {
    const fill = fakeElement();
    const meter = new LevelMeter({ fill, clipLed: fakeElement() });

    meter.setLevel(1.5, false);

    expect(fill.style.width).toBe("100%");
  });

  it("clamps a negative ratio to a 0% fill", () => {
    const fill = fakeElement();
    const meter = new LevelMeter({ fill, clipLed: fakeElement() });

    meter.setLevel(-0.2, false);

    expect(fill.style.width).toBe("0%");
  });

  it("lights the clip LED while clipping and holds it after clipping stops", () => {
    const clipLed = fakeElement();
    const meter = new LevelMeter({ fill: fakeElement(), clipLed });

    meter.setLevel(1, true);
    expect(clipLed.classList.contains("is-lit")).toBe(true);

    meter.setLevel(0.5, false);
    expect(clipLed.classList.contains("is-lit")).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(clipLed.classList.contains("is-lit")).toBe(false);
  });

  it("extends the clip hold instead of stacking timeouts on repeated clipping", () => {
    const clipLed = fakeElement();
    const meter = new LevelMeter({ fill: fakeElement(), clipLed });

    meter.setLevel(1, true);
    vi.advanceTimersByTime(1000);
    meter.setLevel(1, true);
    vi.advanceTimersByTime(1000);

    expect(clipLed.classList.contains("is-lit")).toBe(true);

    vi.advanceTimersByTime(500);
    expect(clipLed.classList.contains("is-lit")).toBe(false);
  });

  it("resets the fill and clip state, cancelling any pending hold timeout", () => {
    const fill = fakeElement();
    const clipLed = fakeElement();
    const meter = new LevelMeter({ fill, clipLed });

    meter.setLevel(1, true);
    meter.reset();

    expect(fill.style.width).toBe("0%");
    expect(clipLed.classList.contains("is-lit")).toBe(false);

    // The pending timeout from before reset() must not fire and re-add the class.
    vi.advanceTimersByTime(1500);
    expect(clipLed.classList.contains("is-lit")).toBe(false);
  });
});
