import { describe, expect, it } from "vitest";
import { applyWindow, fft, hannWindow, magnitudes } from "../src/lib/fft";

function closeArray(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  epsilon = 1e-9,
) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 9);
  }
  void epsilon;
}

describe("fft", () => {
  it("transforms a DC signal to a single spike at bin 0", () => {
    const real = new Float64Array([1, 1, 1, 1]);
    const imag = new Float64Array(4);
    fft(real, imag);
    closeArray(real, [4, 0, 0, 0]);
    closeArray(imag, [0, 0, 0, 0]);
  });

  it("transforms an impulse to a flat spectrum", () => {
    const real = new Float64Array([1, 0, 0, 0]);
    const imag = new Float64Array(4);
    fft(real, imag);
    closeArray(real, [1, 1, 1, 1]);
    closeArray(imag, [0, 0, 0, 0]);
  });

  it("places a Nyquist-frequency alternating signal at bin N/2", () => {
    const real = new Float64Array([1, -1, 1, -1]);
    const imag = new Float64Array(4);
    fft(real, imag);
    closeArray(real, [0, 0, 4, 0]);
    closeArray(imag, [0, 0, 0, 0]);
  });

  it("matches a known 8-point DFT", () => {
    const real = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const imag = new Float64Array(8);
    fft(real, imag);
    // Reference values from a direct DFT computation of [1..8].
    closeArray(real, [36, -4, -4, -4, -4, -4, -4, -4]);
    closeArray(
      imag,
      [
        0, 9.65685424949238, 4, 1.6568542494923806, 0, -1.6568542494923806, -4,
        -9.65685424949238,
      ],
    );
  });

  it("rejects mismatched array lengths", () => {
    expect(() => fft(new Float64Array(4), new Float64Array(2))).toThrow();
  });

  it("rejects lengths that are not a power of two", () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
  });
});

describe("hannWindow", () => {
  it("is zero at both endpoints and peaks at the center", () => {
    const window = hannWindow(5);
    expect(window[0]).toBeCloseTo(0, 9);
    expect(window[4]).toBeCloseTo(0, 9);
    expect(window[2]).toBeCloseTo(1, 9);
  });

  it("handles a single-sample window without dividing by zero", () => {
    expect(Array.from(hannWindow(1))).toEqual([1]);
  });
});

describe("applyWindow", () => {
  it("multiplies each sample by the matching window coefficient", () => {
    const signal = new Float64Array([2, 4, 6]);
    const window = new Float64Array([0.5, 1, 0]);
    applyWindow(signal, window);
    closeArray(signal, [1, 4, 0]);
  });

  it("rejects mismatched lengths", () => {
    expect(() => applyWindow(new Float64Array(3), new Float64Array(2))).toThrow();
  });
});

describe("magnitudes", () => {
  it("computes the Euclidean norm per bin", () => {
    const spectrum = {
      real: new Float64Array([3, 0, 5]),
      imag: new Float64Array([4, 2, 0]),
    };
    closeArray(magnitudes(spectrum), [5, 2, 5]);
  });
});
