import { beforeEach, describe, expect, it, vi } from "vitest";
import { SelectionPlayer } from "../src/audio/player";

class FakeAnalyserNode {
  fftSize = 256;
  connect = vi.fn();
  getFloatTimeDomainData = vi.fn((arr: Float32Array) => {
    arr.fill(0.5);
  });
}

class FakeSourceNode {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  state: "running" | "suspended" = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createAnalyser = vi.fn(() => new FakeAnalyserNode());
  createBufferSource = vi.fn(() => new FakeSourceNode());
}

const fakeBuffer = {} as AudioBuffer;

let context: FakeAudioContext;
let player: SelectionPlayer;

beforeEach(() => {
  context = new FakeAudioContext();
  player = new SelectionPlayer(context as unknown as AudioContext);
});

describe("SelectionPlayer", () => {
  it("is not playing before play() is called", () => {
    expect(player.playing).toBe(false);
    expect(player.currentTime()).toBeNull();
    expect(player.levels()).toEqual({ peak: 0, rms: 0 });
  });

  it("starts a bounded, non-looping source for the selection", async () => {
    await player.play(fakeBuffer, { start: 1, end: 3 }, false);

    expect(player.playing).toBe(true);
    const source = context.createBufferSource.mock.results[0].value as FakeSourceNode;
    expect(source.buffer).toBe(fakeBuffer);
    expect(source.loop).toBe(false);
    expect(source.start).toHaveBeenCalledWith(0, 1, 2);
  });

  it("starts a looping source spanning the selection", async () => {
    await player.play(fakeBuffer, { start: 1, end: 3 }, true);

    const source = context.createBufferSource.mock.results[0].value as FakeSourceNode;
    expect(source.loop).toBe(true);
    expect(source.loopStart).toBe(1);
    expect(source.loopEnd).toBe(3);
    expect(source.start).toHaveBeenCalledWith(0, 1);
  });

  it("falls back to a non-looping start when the loop selection is empty", async () => {
    await player.play(fakeBuffer, { start: 2, end: 2 }, true);

    const source = context.createBufferSource.mock.results[0].value as FakeSourceNode;
    expect(source.loop).toBe(false);
    expect(source.start).toHaveBeenCalledWith(0, 2, 0);
  });

  it("resumes a suspended context before starting playback", async () => {
    context.state = "suspended";
    await player.play(fakeBuffer, { start: 0, end: 1 });

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(player.playing).toBe(true);
  });

  it("stops the current source and clears onended", async () => {
    await player.play(fakeBuffer, { start: 0, end: 1 });
    const source = context.createBufferSource.mock.results[0].value as FakeSourceNode;

    player.stop();

    expect(source.stop).toHaveBeenCalledTimes(1);
    expect(source.onended).toBeNull();
    expect(player.playing).toBe(false);
  });

  it("clears playing state and notifies subscribers when the source ends naturally", async () => {
    const onEnded = vi.fn();
    player.subscribe(onEnded);
    await player.play(fakeBuffer, { start: 0, end: 1 });
    const source = context.createBufferSource.mock.results[0].value as FakeSourceNode;

    source.onended?.();

    expect(player.playing).toBe(false);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale onended fired after a newer play() replaced the source", async () => {
    const onEnded = vi.fn();
    player.subscribe(onEnded);
    await player.play(fakeBuffer, { start: 0, end: 1 });
    const firstSource = context.createBufferSource.mock.results[0]
      .value as FakeSourceNode;
    await player.play(fakeBuffer, { start: 0, end: 1 });

    firstSource.onended?.();

    expect(onEnded).not.toHaveBeenCalled();
    expect(player.playing).toBe(true);
  });

  it("discards a play() call superseded by a stop() during a pending resume", async () => {
    let resolveResume: () => void = () => {};
    context.state = "suspended";
    context.resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveResume = () => {
            context.state = "running";
            resolve();
          };
        }),
    );

    const playPromise = player.play(fakeBuffer, { start: 0, end: 1 });
    player.stop();
    resolveResume();
    await playPromise;

    expect(context.createBufferSource).not.toHaveBeenCalled();
    expect(player.playing).toBe(false);
  });

  it("discards a play() call superseded by a newer play() during a pending resume", async () => {
    let resolveFirstResume: () => void = () => {};
    context.state = "suspended";
    context.resume = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstResume = () => {
              context.state = "running";
              resolve();
            };
          }),
      )
      .mockImplementation(async () => {
        context.state = "running";
      });

    const firstPlay = player.play(fakeBuffer, { start: 0, end: 1 });
    const secondPlay = player.play(fakeBuffer, { start: 5, end: 6 });
    resolveFirstResume();
    await Promise.all([firstPlay, secondPlay]);

    expect(context.createBufferSource).toHaveBeenCalledTimes(1);
    const source = context.createBufferSource.mock.results[0].value as FakeSourceNode;
    expect(source.start).toHaveBeenCalledWith(0, 5, 1);
  });

  it("reports peak and RMS levels from the analyser while playing", async () => {
    await player.play(fakeBuffer, { start: 0, end: 1 });

    const levels = player.levels();

    expect(levels.peak).toBeCloseTo(0.5);
    expect(levels.rms).toBeCloseTo(0.5);
  });

  it("reports the current absolute playback position while playing", async () => {
    await player.play(fakeBuffer, { start: 2, end: 5 });
    context.currentTime = 1.5;

    expect(player.currentTime()).toBeCloseTo(3.5);
  });
});
