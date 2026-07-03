import { describe, expect, it } from "vitest";
import { describeAudioTech, formatDuration } from "../src/lib/format";

describe("describeAudioTech", () => {
  it("formats a whole-number kHz rate", () => {
    expect(describeAudioTech(48000, 2)).toBe("48kHz · stereo");
  });

  it("formats a fractional kHz rate to one decimal place", () => {
    expect(describeAudioTech(44100, 2)).toBe("44.1kHz · stereo");
  });

  it("labels a single channel as mono", () => {
    expect(describeAudioTech(44100, 1)).toBe("44.1kHz · mono");
  });

  it("labels more than two channels by count", () => {
    expect(describeAudioTech(48000, 6)).toBe("48kHz · 6ch");
  });

  it("rounds an odd sample rate to one decimal place", () => {
    expect(describeAudioTech(22050, 1)).toBe("22.1kHz · mono");
  });
});

describe("formatDuration", () => {
  it("formats a sub-minute duration", () => {
    expect(formatDuration(5.5)).toBe("00:05.500");
  });

  it("formats a multi-minute duration", () => {
    expect(formatDuration(125.25)).toBe("02:05.250");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("00:00.000");
  });

  it("clamps negative input to zero instead of printing a sign", () => {
    expect(formatDuration(-1)).toBe("00:00.000");
  });

  it("does not roll the seconds field to 60 when rounding to the millisecond crosses a minute boundary", () => {
    // 59.9998 rounds to 60.000s at millisecond precision, which must carry
    // into the minutes field rather than rendering "00:60.000".
    expect(formatDuration(59.9998)).toBe("01:00.000");
  });

  it("carries a minute-boundary rollover past an existing minute count", () => {
    expect(formatDuration(119.9996)).toBe("02:00.000");
  });
});
