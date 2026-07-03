import { describe, expect, it } from "vitest";
import { encodeWav } from "../src/audio/wav-encoder";

describe("encodeWav", () => {
  it("writes a valid RIFF/WAVE header", () => {
    const buffer = encodeWav([new Float32Array([0, 0.5, -0.5])], 44100);
    const view = new DataView(buffer);
    const bytesToString = (offset: number, length: number) =>
      Array.from({ length }, (_, i) =>
        String.fromCharCode(view.getUint8(offset + i)),
      ).join("");

    expect(bytesToString(0, 4)).toBe("RIFF");
    expect(bytesToString(8, 4)).toBe("WAVE");
    expect(bytesToString(12, 4)).toBe("fmt ");
    expect(bytesToString(36, 4)).toBe("data");
  });

  it("encodes sample rate, channel count, and bit depth correctly", () => {
    const buffer = encodeWav([new Float32Array([0, 0]), new Float32Array([0, 0])], 48000);
    const view = new DataView(buffer);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2); // stereo
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  it("sizes the buffer to the header plus 16-bit interleaved samples", () => {
    const buffer = encodeWav([new Float32Array(10), new Float32Array(10)], 44100);
    expect(buffer.byteLength).toBe(44 + 10 * 2 * 2);
  });

  it("round-trips full-scale samples without overflow", () => {
    const buffer = encodeWav([new Float32Array([1, -1, 0])], 44100);
    const view = new DataView(buffer);
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
    expect(view.getInt16(48, true)).toBe(0);
  });

  it("clamps out-of-range samples instead of wrapping", () => {
    const buffer = encodeWav([new Float32Array([2, -2])], 44100);
    const view = new DataView(buffer);
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });

  it("produces an empty data chunk for a zero-length channel", () => {
    const buffer = encodeWav([new Float32Array(0)], 44100);
    expect(buffer.byteLength).toBe(44);
  });

  it("falls back to a valid mono header for a channels array with no channels at all", () => {
    const buffer = encodeWav([], 44100);
    const view = new DataView(buffer);
    expect(buffer.byteLength).toBe(44);
    expect(view.getUint16(22, true)).toBe(1); // channelCount floors to 1, not 0
  });

  it("rounds to the nearest 16-bit value instead of truncating toward zero", () => {
    // 0.5 * 32767 = 16383.5 — truncation would yield 16383, rounding 16384.
    const buffer = encodeWav([new Float32Array([0.5])], 44100);
    const view = new DataView(buffer);
    expect(view.getInt16(44, true)).toBe(16384);
  });

  it("writes silence rather than throwing for a shorter non-first channel", () => {
    // frameCount is driven by channels[0].length; every real caller
    // (sliceChannels) produces equal-length channels from a shared sample
    // range, but this locks in the fail-safe behavior if that were ever
    // violated: an out-of-bounds read is `undefined`, and floatTo16BitPcm's
    // clamp (`Math.max(-1, Math.min(1, undefined))` -> NaN) round-trips
    // through DataView.setInt16 as 0, not a thrown error or garbage value.
    const buffer = encodeWav([new Float32Array([1, 1]), new Float32Array([1])], 44100);
    const view = new DataView(buffer);
    expect(view.getInt16(44, true)).toBe(0x7fff); // ch0, frame0
    expect(view.getInt16(46, true)).toBe(0x7fff); // ch1, frame0
    expect(view.getInt16(48, true)).toBe(0x7fff); // ch0, frame1
    expect(view.getInt16(50, true)).toBe(0); // ch1, frame1 (out of bounds -> silence)
  });
});
