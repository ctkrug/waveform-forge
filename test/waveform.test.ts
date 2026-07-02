import { describe, expect, it } from "vitest";
import { computeWaveformEnvelope, downmixToMono } from "../src/lib/waveform";

describe("computeWaveformEnvelope", () => {
  it("splits samples evenly across columns", () => {
    const samples = new Float32Array([0, 1, -1, 0.5, -0.5, 0.25]);
    const { min, max } = computeWaveformEnvelope(samples, 3);
    expect(Array.from(min)).toEqual([0, -1, -0.5]);
    expect(Array.from(max)).toEqual([1, 0.5, 0.25]);
  });

  it("returns zeroed arrays for an empty buffer", () => {
    const { min, max } = computeWaveformEnvelope(new Float32Array(0), 4);
    expect(Array.from(min)).toEqual([0, 0, 0, 0]);
    expect(Array.from(max)).toEqual([0, 0, 0, 0]);
  });

  it("handles more columns than samples without gaps", () => {
    const samples = new Float32Array([0.2, -0.4]);
    const { min, max } = computeWaveformEnvelope(samples, 5);
    expect(min.length).toBe(5);
    expect(max.length).toBe(5);
    // Every sample must land in some column; nothing should stay at
    // the Infinity/-Infinity sentinel used during the scan.
    expect(Array.from(min).every((v) => Number.isFinite(v))).toBe(true);
    expect(Array.from(max).every((v) => Number.isFinite(v))).toBe(true);
  });

  it("rejects a non-positive column count", () => {
    expect(() => computeWaveformEnvelope(new Float32Array(4), 0)).toThrow();
  });
});

describe("downmixToMono", () => {
  it("returns an empty buffer for zero channels", () => {
    expect(downmixToMono([]).length).toBe(0);
  });

  it("passes a mono channel through unchanged", () => {
    const channel = new Float32Array([0.1, -0.2, 0.3]);
    expect(downmixToMono([channel])).toBe(channel);
  });

  it("averages stereo channels sample-by-sample", () => {
    const left = new Float32Array([1, -1, 0.5]);
    const right = new Float32Array([-1, 1, -0.5]);
    const mono = downmixToMono([left, right]);
    expect(Array.from(mono)).toEqual([0, 0, 0]);
  });
});
