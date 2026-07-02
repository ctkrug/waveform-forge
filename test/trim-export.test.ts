import { describe, expect, it } from "vitest";
import { sliceChannels } from "../src/audio/trim-export";

describe("sliceChannels", () => {
  it("slices every channel to the same sample range", () => {
    const channels = [
      new Float32Array([0, 1, 2, 3, 4]),
      new Float32Array([10, 11, 12, 13, 14]),
    ];
    const sliced = sliceChannels(channels, 1, 4);
    expect(Array.from(sliced[0])).toEqual([1, 2, 3]);
    expect(Array.from(sliced[1])).toEqual([11, 12, 13]);
  });

  it("returns empty arrays for a zero-length range", () => {
    const sliced = sliceChannels([new Float32Array([1, 2, 3])], 1, 1);
    expect(sliced[0].length).toBe(0);
  });

  it("leaves the source channels unmodified", () => {
    const source = new Float32Array([1, 2, 3]);
    sliceChannels([source], 0, 2);
    expect(Array.from(source)).toEqual([1, 2, 3]);
  });
});
