import { describe, expect, it } from "vitest";
import { computeBackingSize } from "../src/ui/canvas-utils";

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
