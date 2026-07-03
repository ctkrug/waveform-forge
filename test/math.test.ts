import { describe, expect, it } from "vitest";
import { clamp } from "../src/lib/math";

describe("clamp", () => {
  it("passes values already inside the range through unchanged", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps values below the minimum", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("clamps values above the maximum", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("resolves to the max bound for an inverted (min > max) range", () => {
    // `Math.min(Math.max(value, min), max)` always applies `max` last, so
    // an inverted range degrades to a constant rather than throwing or
    // returning something inconsistent — several callers (zoomWindow's
    // span clamp) rely on this when a file is shorter than the minimum
    // allowed span.
    expect(clamp(100, 5, 2)).toBe(2);
    expect(clamp(-100, 5, 2)).toBe(2);
  });
});
