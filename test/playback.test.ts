import { describe, expect, it } from "vitest";
import { resolvePlaybackTime } from "../src/lib/playback";

describe("resolvePlaybackTime", () => {
  it("advances linearly within the selection when not looping", () => {
    expect(resolvePlaybackTime(1.5, 2, 6, false)).toBeCloseTo(3.5, 9);
  });

  it("clamps to the selection end when not looping", () => {
    expect(resolvePlaybackTime(10, 2, 6, false)).toBe(6);
  });

  it("wraps back to the selection start when looping past the end", () => {
    // Selection is [2, 6) (span 4); 5 seconds elapsed wraps 1 second in.
    expect(resolvePlaybackTime(5, 2, 6, true)).toBeCloseTo(3, 9);
  });

  it("wraps multiple times for a much longer elapsed duration", () => {
    // span 4, 4*3 + 1.25 elapsed wraps to 1.25 seconds into the loop.
    expect(resolvePlaybackTime(13.25, 2, 6, true)).toBeCloseTo(3.25, 9);
  });

  it("stays at the selection start for zero elapsed time while looping", () => {
    expect(resolvePlaybackTime(0, 2, 6, true)).toBeCloseTo(2, 9);
  });

  it("returns the selection start for a degenerate zero-length selection", () => {
    expect(resolvePlaybackTime(3, 5, 5, true)).toBe(5);
    expect(resolvePlaybackTime(3, 5, 5, false)).toBe(5);
  });

  it("wraps a negative elapsed time forward instead of returning a negative offset", () => {
    // JS's `%` can return a negative result for a negative dividend
    // (-1 % 4 === -1, not 3) — resolvePlaybackTime corrects for that so a
    // caller can never be handed a position before the selection start.
    // Not reachable via SelectionPlayer today (context.currentTime only
    // advances), but the correction is explicit in the source, so it's
    // worth locking in as a regression guard.
    expect(resolvePlaybackTime(-1, 2, 6, true)).toBeCloseTo(5, 9);
  });
});
