import { describe, expect, it } from "vitest";
import { intensityToColor } from "../src/lib/colormap";

describe("intensityToColor", () => {
  it("returns the background stop at zero intensity", () => {
    expect(intensityToColor(0)).toBe("rgb(21, 23, 27)");
  });

  it("returns the amber stop at full intensity", () => {
    expect(intensityToColor(1)).toBe("rgb(255, 176, 32)");
  });

  it("returns the accent-green stop at its exact position", () => {
    expect(intensityToColor(0.75)).toBe("rgb(57, 255, 136)");
  });

  it("clamps out-of-range intensities", () => {
    expect(intensityToColor(-1)).toBe(intensityToColor(0));
    expect(intensityToColor(2)).toBe(intensityToColor(1));
  });

  it("produces a valid rgb() string for interpolated values", () => {
    expect(intensityToColor(0.2)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});
