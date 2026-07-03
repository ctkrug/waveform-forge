import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadMock = vi.fn();
const execMock = vi.fn();
const writeFileMock = vi.fn();
const readFileMock = vi.fn();
const deleteFileMock = vi.fn();
const onMock = vi.fn();
const offMock = vi.fn();

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: vi.fn().mockImplementation(() => ({
    load: loadMock,
    exec: execMock,
    writeFile: writeFileMock,
    readFile: readFileMock,
    deleteFile: deleteFileMock,
    on: onMock,
    off: offMock,
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
  onMock.mockReset();
  offMock.mockReset();
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

describe("transcode", () => {
  it("registers a progress listener only for the call's own lock turn, then unregisters it", async () => {
    loadMock.mockResolvedValue(undefined);
    execMock.mockResolvedValue(0);
    const { transcode } = await freshModule();

    await transcode(new ArrayBuffer(4), "mp3", () => {});

    expect(onMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith("progress", expect.any(Function));
    expect(offMock).toHaveBeenCalledTimes(1);
  });

  it("skips progress-listener registration entirely when no callback is given", async () => {
    loadMock.mockResolvedValue(undefined);
    execMock.mockResolvedValue(0);
    const { transcode } = await freshModule();

    await transcode(new ArrayBuffer(4), "wav");

    expect(onMock).not.toHaveBeenCalled();
    expect(offMock).not.toHaveBeenCalled();
  });

  it("clamps a reported progress ratio into 0..1 before forwarding it", async () => {
    loadMock.mockResolvedValue(undefined);
    execMock.mockImplementation(async () => {
      const listener = onMock.mock.calls[0][1] as (e: { progress: number }) => void;
      listener({ progress: 1.5 });
      listener({ progress: -0.2 });
      return 0;
    });
    const ratios: number[] = [];
    const { transcode } = await freshModule();

    await transcode(new ArrayBuffer(4), "aac", (ratio) => ratios.push(ratio));

    expect(ratios).toEqual([1, 0]);
  });

  it("rejects with the exit code when ffmpeg reports a non-zero result", async () => {
    loadMock.mockResolvedValue(undefined);
    execMock.mockResolvedValue(1);
    const { transcode } = await freshModule();

    await expect(transcode(new ArrayBuffer(4), "mp3")).rejects.toThrow(/exit code 1/);
  });

  it("resolves a Blob typed for the requested export format", async () => {
    loadMock.mockResolvedValue(undefined);
    execMock.mockResolvedValue(0);
    const { transcode } = await freshModule();

    const blob = await transcode(new ArrayBuffer(4), "mp3");

    expect(blob.type).toBe("audio/mpeg");
  });
});
