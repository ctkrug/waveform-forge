import { describe, expect, it } from "vitest";
import { computeSpectrogram, magnitudeToDb, normalizeDb } from "../src/lib/spectrogram";

describe("computeSpectrogram", () => {
  it("returns no frames for an empty buffer", () => {
    expect(computeSpectrogram(new Float32Array(0), { fftSize: 8, hopSize: 4 })).toEqual(
      [],
    );
  });

  it("produces frames with fftSize / 2 + 1 bins", () => {
    const samples = new Float32Array(32).map((_, i) => Math.sin(i));
    const frames = computeSpectrogram(samples, { fftSize: 8, hopSize: 4 });
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame.length).toBe(5);
    }
  });

  it("zero-pads the final partial frame instead of dropping it", () => {
    const samples = new Float32Array(10).fill(1);
    const frames = computeSpectrogram(samples, { fftSize: 8, hopSize: 8 });
    // 10 samples, hop 8 -> frames at start=0 and start=8 (2 samples + padding).
    expect(frames.length).toBe(2);
  });

  it("rejects a non-power-of-two fftSize", () => {
    expect(() =>
      computeSpectrogram(new Float32Array(16), { fftSize: 6, hopSize: 4 }),
    ).toThrow();
  });

  it("rejects a non-positive hopSize", () => {
    expect(() =>
      computeSpectrogram(new Float32Array(16), { fftSize: 8, hopSize: 0 }),
    ).toThrow();
  });
});

describe("magnitudeToDb", () => {
  it("converts unity magnitude to 0 dB", () => {
    expect(magnitudeToDb(1)).toBeCloseTo(0, 9);
  });

  it("floors silence instead of returning -Infinity", () => {
    expect(magnitudeToDb(0)).toBe(-100);
    expect(magnitudeToDb(0, -60)).toBe(-60);
  });
});

describe("normalizeDb", () => {
  it("maps the range endpoints to 0 and 1", () => {
    expect(normalizeDb(-100, -100, 0)).toBe(0);
    expect(normalizeDb(0, -100, 0)).toBe(1);
  });

  it("clamps values outside the range", () => {
    expect(normalizeDb(-200, -100, 0)).toBe(0);
    expect(normalizeDb(50, -100, 0)).toBe(1);
  });

  it("returns 0 for a degenerate range", () => {
    expect(normalizeDb(-10, 0, 0)).toBe(0);
  });
});
