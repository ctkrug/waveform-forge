import { describe, expect, it } from "vitest";
import { amplitudeToDb, dbToMeterRatio, isClipping } from "../src/lib/meter";

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
