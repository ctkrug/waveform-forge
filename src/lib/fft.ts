/**
 * Radix-2 Cooley-Tukey FFT and a Hann analysis window.
 *
 * Hand-written rather than pulled from a dependency: this is the analytical
 * core the spectrogram is built on, so it needs to be understood, tested,
 * and tuned directly.
 */

/** Complex spectrum as separate real/imaginary channels, one entry per bin. */
export interface ComplexSpectrum {
  real: Float64Array;
  imag: Float64Array;
}

/**
 * In-place iterative radix-2 Cooley-Tukey FFT.
 *
 * `real`/`imag` must have equal length that is a power of two. On return
 * they hold the transformed spectrum in place (bit-reversal permutation
 * applied first, then butterfly stages).
 */
export function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if (n !== imag.length) {
    throw new Error("fft: real and imaginary arrays must be the same length");
  }
  if (n === 0) return;
  if ((n & (n - 1)) !== 0) {
    throw new Error("fft: length must be a power of two");
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  // Iterative Cooley-Tukey butterflies.
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const angleStep = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const angle = angleStep * k;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const evenIndex = start + k;
        const oddIndex = start + k + half;
        const oddReal = real[oddIndex] * cos - imag[oddIndex] * sin;
        const oddImag = real[oddIndex] * sin + imag[oddIndex] * cos;
        real[oddIndex] = real[evenIndex] - oddReal;
        imag[oddIndex] = imag[evenIndex] - oddImag;
        real[evenIndex] += oddReal;
        imag[evenIndex] += oddImag;
      }
    }
  }
}

/** Generates a periodic Hann window of the given size ([0, 1], zero at both ends). */
export function hannWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  if (size === 1) {
    window[0] = 1;
    return window;
  }
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

/** Applies a window function to a signal in place, returning it for chaining. */
export function applyWindow(signal: Float64Array, window: Float64Array): Float64Array {
  if (signal.length !== window.length) {
    throw new Error("applyWindow: signal and window must be the same length");
  }
  for (let i = 0; i < signal.length; i++) {
    signal[i] *= window[i];
  }
  return signal;
}

/** Computes per-bin magnitude (sqrt(re^2 + im^2)) from a complex spectrum. */
export function magnitudes(spectrum: ComplexSpectrum): Float64Array {
  const { real, imag } = spectrum;
  const out = new Float64Array(real.length);
  for (let i = 0; i < real.length; i++) {
    out[i] = Math.hypot(real[i], imag[i]);
  }
  return out;
}
