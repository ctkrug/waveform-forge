import { afterEach, describe, expect, it } from "vitest";
import { readPref, writePref } from "../src/lib/prefs";

function fakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("readPref / writePref", () => {
  it("returns null when nothing has been written", () => {
    globalThis.localStorage = fakeStorage();
    expect(readPref("fft-size")).toBeNull();
  });

  it("round-trips a written value under a namespaced key", () => {
    const storage = fakeStorage();
    globalThis.localStorage = storage;
    writePref("fft-size", "2048");
    expect(readPref("fft-size")).toBe("2048");
    expect(storage.getItem("waveform-forge:fft-size")).toBe("2048");
  });

  it("returns null when localStorage is unavailable", () => {
    expect(readPref("fft-size")).toBeNull();
  });

  it("does not throw when writing without localStorage available", () => {
    expect(() => writePref("fft-size", "1024")).not.toThrow();
  });

  it("does not throw when localStorage access itself throws", () => {
    globalThis.localStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(readPref("fft-size")).toBeNull();
    expect(() => writePref("fft-size", "1024")).not.toThrow();
  });
});
