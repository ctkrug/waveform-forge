import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadMock = vi.fn();
const execMock = vi.fn();
const writeFileMock = vi.fn();
const readFileMock = vi.fn();
const deleteFileMock = vi.fn();

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: vi.fn().mockImplementation(() => ({
    load: loadMock,
    exec: execMock,
    writeFile: writeFileMock,
    readFile: readFileMock,
    deleteFile: deleteFileMock,
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

vi.mock("@ffmpeg/util", () => ({
  fetchFile: vi.fn().mockResolvedValue(new Uint8Array()),
  toBlobURL: vi.fn().mockResolvedValue("blob:fake"),
}));

/**
 * ffmpeg-client.ts keeps its ffmpeg instance/load-promise/call-queue as
 * module-level singleton state, by design (there's exactly one ffmpeg.wasm
 * instance for the whole page). Each test needs a fresh module instance so
 * that state doesn't leak between cases.
 */
async function freshModule() {
  vi.resetModules();
  return import("../src/audio/ffmpeg-client");
}

const fakeFile = {} as File;

beforeEach(() => {
  loadMock.mockReset();
  execMock.mockReset();
  writeFileMock.mockReset().mockResolvedValue(undefined);
  readFileMock.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]));
  deleteFileMock.mockReset().mockResolvedValue(undefined);
  // ffmpeg-client.ts names its scratch files with crypto.randomUUID(); the
  // Vitest worker's Node runtime doesn't always expose the WebCrypto global.
  let uuidCounter = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `test-uuid-${uuidCounter++}` });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFfmpeg", () => {
  it("caches a successful load across calls", async () => {
    loadMock.mockResolvedValue(undefined);
    const { getFfmpeg } = await freshModule();

    const first = await getFfmpeg();
    const second = await getFfmpeg();

    expect(first).toBe(second);
    expect(loadMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed load, so a later call retries instead of staying broken", async () => {
    loadMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(undefined);
    const { getFfmpeg } = await freshModule();

    await expect(getFfmpeg()).rejects.toThrow("network down");
    await expect(getFfmpeg()).resolves.toBeDefined();
    expect(loadMock).toHaveBeenCalledTimes(2);
  });
});

describe("demuxToWav / transcode call serialization", () => {
  it("never overlaps two exec() calls on the shared instance", async () => {
    loadMock.mockResolvedValue(undefined);
    let concurrent = 0;
    let maxConcurrent = 0;
    execMock.mockImplementation(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 5));
      concurrent--;
      return 0;
    });
    const { demuxToWav, transcode } = await freshModule();

    await Promise.all([demuxToWav(fakeFile), transcode(new ArrayBuffer(4), "wav")]);

    expect(maxConcurrent).toBe(1);
    expect(execMock).toHaveBeenCalledTimes(2);
  });

  it("still runs a later queued call after an earlier one rejects", async () => {
    loadMock.mockResolvedValue(undefined);
    execMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(0);
    const { demuxToWav } = await freshModule();

    const first = demuxToWav(fakeFile).then(
      () => "resolved",
      () => "rejected",
    );
    const second = demuxToWav(fakeFile).then(
      () => "resolved",
      () => "rejected",
    );

    expect(await first).toBe("rejected");
    expect(await second).toBe("resolved");
  });

  it("cleans up the input and output scratch files even when exec() throws", async () => {
    loadMock.mockResolvedValue(undefined);
    execMock.mockRejectedValueOnce(new Error("boom"));
    const { demuxToWav } = await freshModule();

    await expect(demuxToWav(fakeFile)).rejects.toThrow("boom");

    expect(deleteFileMock).toHaveBeenCalledTimes(2);
  });
});
