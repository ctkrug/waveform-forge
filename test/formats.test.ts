import { describe, expect, it } from "vitest";
import { MAX_FILE_SIZE_BYTES, validateAudioFile } from "../src/audio/formats";

describe("validateAudioFile", () => {
  it("accepts a file with a recognized audio MIME type", () => {
    expect(
      validateAudioFile({ name: "clip.mp3", type: "audio/mpeg", size: 1024 }),
    ).toEqual({
      valid: true,
    });
  });

  it("accepts a file with a known extension but no MIME type", () => {
    expect(
      validateAudioFile({ name: "field-recording.flac", type: "", size: 1024 }),
    ).toEqual({
      valid: true,
    });
  });

  it("rejects an empty file", () => {
    const result = validateAudioFile({ name: "clip.mp3", type: "audio/mpeg", size: 0 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("empty");
  });

  it("rejects a file over the size limit", () => {
    const result = validateAudioFile({
      name: "huge.wav",
      type: "audio/wav",
      size: MAX_FILE_SIZE_BYTES + 1,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("limit");
  });

  it("rejects a non-audio file", () => {
    const result = validateAudioFile({
      name: "notes.txt",
      type: "text/plain",
      size: 100,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("doesn't look like an audio file");
  });

  it("is case-insensitive about extensions", () => {
    expect(validateAudioFile({ name: "TRACK.MP3", type: "", size: 100 }).valid).toBe(
      true,
    );
  });
});
