import { describe, expect, it } from "vitest";
import { frequencyTicks, timeTicks } from "../src/lib/ticks";

describe("timeTicks", () => {
  it("returns nothing for a zero or negative span", () => {
    expect(timeTicks(5, 5)).toEqual([]);
    expect(timeTicks(5, 2)).toEqual([]);
  });

  it("lands on whole seconds for a short span", () => {
    const ticks = timeTicks(0, 10, 5);
    expect(ticks.map((t) => t.value)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(ticks.map((t) => t.label)).toEqual([
      "0:00",
      "0:02",
      "0:04",
      "0:06",
      "0:08",
      "0:10",
    ]);
  });

  it("formats minutes:seconds for a multi-minute span", () => {
    const ticks = timeTicks(0, 120, 6);
    expect(ticks[ticks.length - 1]).toEqual({ value: 120, label: "2:00" });
  });

  it("keeps sub-second precision when the step is fractional", () => {
    const ticks = timeTicks(0, 1, 5);
    expect(ticks.every((t) => t.label.includes("."))).toBe(true);
  });

  it("respects a non-zero start offset", () => {
    const ticks = timeTicks(100, 110, 5);
    expect(ticks.every((t) => t.value >= 100 && t.value <= 110)).toBe(true);
  });

  it("rounds up to a step of 10x the magnitude when one tick would be too sparse", () => {
    // span=9, targetCount=1 -> roughStep=9 -> residual=9, the >5 branch.
    const ticks = timeTicks(0, 9, 1);
    expect(ticks).toEqual([{ value: 0, label: "0:00" }]);
  });

  it("falls back to a step of 1 instead of looping forever for a zero targetCount", () => {
    const ticks = timeTicks(0, 3, 0);
    expect(ticks.map((t) => t.value)).toEqual([0, 1, 2, 3]);
  });
});

describe("frequencyTicks", () => {
  it("returns nothing for a zero or negative max", () => {
    expect(frequencyTicks(0)).toEqual([]);
    expect(frequencyTicks(-100)).toEqual([]);
  });

  it("starts at 0 and covers the full range", () => {
    const ticks = frequencyTicks(20000, 5);
    expect(ticks[0]).toEqual({ value: 0, label: "0" });
    expect(ticks[ticks.length - 1].value).toBeLessThanOrEqual(20000);
  });

  it("labels values at or above 1kHz with a k suffix", () => {
    const ticks = frequencyTicks(10000, 5);
    expect(ticks.some((t) => t.label.endsWith("k"))).toBe(true);
  });

  it("labels sub-kilohertz values as plain integers", () => {
    const ticks = frequencyTicks(500, 5);
    expect(ticks.every((t) => !t.label.endsWith("k"))).toBe(true);
  });

  it("keeps one decimal place for a non-whole kilohertz tick", () => {
    const ticks = frequencyTicks(3000, 6);
    expect(ticks).toContainEqual({ value: 1500, label: "1.5k" });
  });
});
