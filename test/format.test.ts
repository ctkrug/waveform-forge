import { describe, expect, it } from "vitest";
import { describeAudioTech } from "../src/lib/format";

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
