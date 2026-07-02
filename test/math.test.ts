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
});
