import { describe, expect, it } from "vitest";
import { MIN_VIEW_SECONDS, panWindow, zoomWindow } from "../src/lib/zoom";

describe("zoomWindow", () => {
  it("shrinks the window when zooming in", () => {
    const result = zoomWindow({ start: 0, end: 10 }, 10, 0.5, 0.5);
    expect(result.end - result.start).toBeCloseTo(5, 9);
  });

  it("keeps the pivot point stationary", () => {
    // Pivot at 25% across [0, 10] is time=2.5; zooming in should keep 2.5 fixed.
    const before = { start: 0, end: 10 };
    const after = zoomWindow(before, 10, 0.5, 0.25);
    const pivotBefore = before.start + 0.25 * (before.end - before.start);
    const pivotAfter = after.start + 0.25 * (after.end - after.start);
    expect(pivotAfter).toBeCloseTo(pivotBefore, 9);
  });

  it("never zooms in narrower than the minimum span", () => {
    const result = zoomWindow({ start: 0, end: 0.06 }, 10, 0.1, 0.5);
    expect(result.end - result.start).toBeGreaterThanOrEqual(MIN_VIEW_SECONDS);
  });

  it("never zooms out past the full duration", () => {
    const result = zoomWindow({ start: 2, end: 4 }, 10, 100, 0.5);
    expect(result.start).toBeGreaterThanOrEqual(0);
    expect(result.end).toBeLessThanOrEqual(10);
  });

  it("clamps the window back inside bounds when the pivot is near an edge", () => {
    const result = zoomWindow({ start: 0, end: 2 }, 10, 0.1, 0);
    expect(result.start).toBeGreaterThanOrEqual(0);
    expect(result.end).toBeLessThanOrEqual(10);
  });

  it("collapses to a zero window for a zero-duration file", () => {
    expect(zoomWindow({ start: 0, end: 0 }, 0, 0.5, 0.5)).toEqual({ start: 0, end: 0 });
  });
});

describe("panWindow", () => {
  it("shifts the window by the given delta", () => {
    expect(panWindow({ start: 2, end: 4 }, 10, 1)).toEqual({ start: 3, end: 5 });
  });

  it("clamps at the start of the file", () => {
    expect(panWindow({ start: 1, end: 3 }, 10, -5)).toEqual({ start: 0, end: 2 });
  });

  it("clamps at the end of the file", () => {
    expect(panWindow({ start: 7, end: 9 }, 10, 5)).toEqual({ start: 8, end: 10 });
  });

  it("preserves the window span", () => {
    const result = panWindow({ start: 2, end: 6 }, 10, 1);
    expect(result.end - result.start).toBe(4);
  });
});
