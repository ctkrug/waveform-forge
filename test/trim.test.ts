import { describe, expect, it } from "vitest";
import {
  clampEdgeAgainstOther,
  clampSelection,
  MIN_SELECTION_SECONDS,
  selectionToSampleRange,
} from "../src/lib/trim";

describe("clampSelection", () => {
  it("passes through a valid selection unchanged", () => {
    expect(clampSelection(1, 4, 10)).toEqual({ start: 1, end: 4 });
  });

  it("clamps a start before zero", () => {
    expect(clampSelection(-2, 4, 10)).toEqual({ start: 0, end: 4 });
  });

  it("clamps an end beyond the duration", () => {
    expect(clampSelection(1, 20, 10)).toEqual({ start: 1, end: 10 });
  });

  it("swaps an inverted selection", () => {
    expect(clampSelection(8, 2, 10)).toEqual({ start: 2, end: 8 });
  });

  it("expands a too-narrow selection to the minimum width", () => {
    const { start, end } = clampSelection(5, 5, 10);
    expect(end - start).toBeCloseTo(MIN_SELECTION_SECONDS, 9);
    expect(start).toBe(5);
  });

  it("pulls the minimum-width window back when it would overflow the end", () => {
    const duration = 10;
    const { start, end } = clampSelection(duration, duration, duration);
    expect(end).toBe(duration);
    expect(end - start).toBeCloseTo(MIN_SELECTION_SECONDS, 9);
  });

  it("collapses to a zero-length selection for a zero-duration file", () => {
    expect(clampSelection(1, 4, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe("clampEdgeAgainstOther", () => {
  it("passes a start proposal through unchanged when it stays left of end", () => {
    expect(clampEdgeAgainstOther("start", 1, { start: 0, end: 4 })).toBe(1);
  });

  it("stops a start proposal from reaching or crossing end", () => {
    const result = clampEdgeAgainstOther("start", 10, { start: 0, end: 4 });
    expect(result).toBeCloseTo(4 - MIN_SELECTION_SECONDS, 9);
  });

  it("stops an end proposal from reaching or crossing start", () => {
    const result = clampEdgeAgainstOther("end", -5, { start: 3, end: 8 });
    expect(result).toBeCloseTo(3 + MIN_SELECTION_SECONDS, 9);
  });
});

describe("selectionToSampleRange", () => {
  it("converts seconds to sample indices at the given sample rate", () => {
    const range = selectionToSampleRange({ start: 1, end: 2 }, 44100, 88200);
    expect(range).toEqual({ startSample: 44100, endSample: 88200 });
  });

  it("clamps sample indices to the buffer length", () => {
    const range = selectionToSampleRange({ start: 0, end: 100 }, 44100, 44100);
    expect(range.endSample).toBe(44100);
  });

  it("normalizes an inverted selection instead of returning start > end", () => {
    const range = selectionToSampleRange({ start: 2, end: 1 }, 44100, 88200);
    expect(range).toEqual({ startSample: 44100, endSample: 88200 });
  });

  it("clamps a negative start to sample 0 instead of an out-of-bounds index", () => {
    const range = selectionToSampleRange({ start: -1, end: 1 }, 44100, 88200);
    expect(range).toEqual({ startSample: 0, endSample: 44100 });
  });
});
