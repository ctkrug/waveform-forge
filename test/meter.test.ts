import { describe, expect, it } from "vitest";
import {
  amplitudeToDb,
  dbToMeterRatio,
  isClipping,
  rmsAmplitude,
} from "../src/lib/meter";

describe("amplitudeToDb", () => {
  it("returns 0dB for full-scale amplitude", () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0, 9);
  });

  it("returns roughly -6dB for half amplitude", () => {
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.02, 1);
  });

  it("floors silence and negative/zero amplitude at -60dB", () => {
    expect(amplitudeToDb(0)).toBe(-60);
    expect(amplitudeToDb(-0.5)).toBe(-60);
  });

  it("never returns below the -60dB floor for a tiny amplitude", () => {
    expect(amplitudeToDb(0.0000001)).toBe(-60);
  });

  it("floors NaN instead of propagating it (NaN <= 0 is false, so a naive guard misses it)", () => {
    expect(amplitudeToDb(NaN)).toBe(-60);
  });
});

describe("dbToMeterRatio", () => {
  it("maps 0dB to a full meter", () => {
    expect(dbToMeterRatio(0)).toBe(1);
  });

  it("maps -60dB to an empty meter", () => {
    expect(dbToMeterRatio(-60)).toBe(0);
  });

  it("maps the midpoint of the scale to 0.5", () => {
    expect(dbToMeterRatio(-30)).toBeCloseTo(0.5, 9);
  });

  it("clamps values above 0dB to 1", () => {
    expect(dbToMeterRatio(6)).toBe(1);
  });

  it("clamps values below -60dB to 0", () => {
    expect(dbToMeterRatio(-90)).toBe(0);
  });
});

describe("rmsAmplitude", () => {
  it("returns 0 for an empty block", () => {
    expect(rmsAmplitude(new Float32Array(0))).toBe(0);
  });

  it("returns 0 for silence", () => {
    expect(rmsAmplitude(new Float32Array([0, 0, 0]))).toBe(0);
  });

  it("returns the constant amplitude for a DC block", () => {
    expect(rmsAmplitude(new Float32Array([0.5, 0.5, 0.5, 0.5]))).toBeCloseTo(0.5, 9);
  });

  it("reads well below peak for a full-scale square wave (not just instantaneous peak)", () => {
    // A [-1, 1] square wave has an RMS of exactly 1 in theory, but a signal
    // that only touches full scale half the time should read lower than
    // its own peak — this is the whole reason the meter uses RMS instead
    // of peak: a single transient sample shouldn't read as "loud" as a
    // sustained one.
    const block = new Float32Array([1, 0, 1, 0, 1, 0]);
    expect(rmsAmplitude(block)).toBeCloseTo(Math.sqrt(0.5), 9);
    expect(rmsAmplitude(block)).toBeLessThan(1);
  });

  it("is unaffected by sign — a symmetric signal averages the same as its absolute value", () => {
    expect(rmsAmplitude(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5, 9);
  });
});

describe("isClipping", () => {
  it("is false below full scale", () => {
    expect(isClipping(0.99)).toBe(false);
  });

  it("is true at exactly full scale", () => {
    expect(isClipping(1)).toBe(true);
  });

  it("is true above full scale", () => {
    expect(isClipping(1.2)).toBe(true);
  });
});
