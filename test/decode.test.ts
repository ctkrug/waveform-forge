import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const demuxToWavMock = vi.fn();

vi.mock("../src/audio/ffmpeg-client", () => ({
  demuxToWav: demuxToWavMock,
}));

/** decode.ts caches its AudioContext at module scope; reload per test to isolate it. */
async function freshModule() {
  vi.resetModules();
  return import("../src/audio/decode");
}

const fakeArrayBuffer = new ArrayBuffer(8);
const fakeFile = { arrayBuffer: vi.fn().mockResolvedValue(fakeArrayBuffer) } as unknown as File;
const decodedBuffer = {} as AudioBuffer;

let decodeAudioDataMock: ReturnType<typeof vi.fn>;
let audioContextCtor: ReturnType<typeof vi.fn>;

beforeEach(() => {
  demuxToWavMock.mockReset();
  (fakeFile.arrayBuffer as ReturnType<typeof vi.fn>).mockClear();
  decodeAudioDataMock = vi.fn();
  audioContextCtor = vi.fn().mockImplementation(() => ({
    decodeAudioData: decodeAudioDataMock,
  }));
  vi.stubGlobal("AudioContext", audioContextCtor);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAudioContext", () => {
  it("creates the AudioContext once and reuses it across calls", async () => {
    const { getAudioContext } = await freshModule();

    const first = getAudioContext();
    const second = getAudioContext();

    expect(first).toBe(second);
    expect(audioContextCtor).toHaveBeenCalledTimes(1);
  });
});

describe("decodeAudioFile", () => {
  it("returns the native decode result without falling back", async () => {
    decodeAudioDataMock.mockResolvedValueOnce(decodedBuffer);
    const { decodeAudioFile } = await freshModule();
    const onFallback = vi.fn();

    const result = await decodeAudioFile(fakeFile, onFallback);

    expect(result).toEqual({ buffer: decodedBuffer, usedFallback: false });
    expect(onFallback).not.toHaveBeenCalled();
    expect(demuxToWavMock).not.toHaveBeenCalled();
  });

  it("falls back to ffmpeg demuxing when the native decode rejects", async () => {
    const wavBytes = new Uint8Array([1, 2, 3]);
    decodeAudioDataMock.mockRejectedValueOnce(new Error("unsupported container"));
    decodeAudioDataMock.mockResolvedValueOnce(decodedBuffer);
    demuxToWavMock.mockResolvedValueOnce(wavBytes);
    const { decodeAudioFile } = await freshModule();
    const onFallback = vi.fn();

    const result = await decodeAudioFile(fakeFile, onFallback);

    expect(result).toEqual({ buffer: decodedBuffer, usedFallback: true });
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(demuxToWavMock).toHaveBeenCalledWith(fakeFile);
    expect(decodeAudioDataMock).toHaveBeenCalledTimes(2);
  });

  it("works without an onFallback callback", async () => {
    decodeAudioDataMock.mockRejectedValueOnce(new Error("unsupported container"));
    decodeAudioDataMock.mockResolvedValueOnce(decodedBuffer);
    demuxToWavMock.mockResolvedValueOnce(new Uint8Array([1]));
    const { decodeAudioFile } = await freshModule();

    const result = await decodeAudioFile(fakeFile);

    expect(result.usedFallback).toBe(true);
  });

  it("propagates a fallback demux failure", async () => {
    decodeAudioDataMock.mockRejectedValueOnce(new Error("unsupported container"));
    demuxToWavMock.mockRejectedValueOnce(new Error("ffmpeg exited with code 1"));
    const { decodeAudioFile } = await freshModule();

    await expect(decodeAudioFile(fakeFile)).rejects.toThrow("ffmpeg exited with code 1");
  });

  it("reads the original bytes independently of the fallback demux input", async () => {
    decodeAudioDataMock.mockResolvedValueOnce(decodedBuffer);
    const { decodeAudioFile } = await freshModule();

    await decodeAudioFile(fakeFile);

    expect(fakeFile.arrayBuffer).toHaveBeenCalledTimes(1);
    const passedBytes = decodeAudioDataMock.mock.calls[0][0] as ArrayBuffer;
    expect(passedBytes).not.toBe(fakeArrayBuffer);
    expect(passedBytes.byteLength).toBe(fakeArrayBuffer.byteLength);
  });
});
