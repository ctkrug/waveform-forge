import { applyWindow, fft, hannWindow, magnitudes } from "./fft";

/** One time-slice of the spectrogram: magnitude per frequency bin (0..Nyquist). */
export type SpectrogramFrame = Float64Array;

export interface SpectrogramOptions {
  /** FFT size in samples; must be a power of two. Determines frequency resolution. */
  fftSize: number;
  /** Samples to advance between frames. Smaller = smoother in time, more frames. */
  hopSize: number;
}

/**
 * Computes a sliding-window FFT spectrogram over mono PCM samples. Each
 * frame is Hann-windowed before transforming, and only the first
 * `fftSize / 2 + 1` bins (DC through Nyquist) are kept — the rest mirror
 * the real-input spectrum's conjugate symmetry and carry no information.
 */
export function computeSpectrogram(
  samples: Float32Array,
  { fftSize, hopSize }: SpectrogramOptions,
): SpectrogramFrame[] {
  if ((fftSize & (fftSize - 1)) !== 0 || fftSize <= 0) {
    throw new Error("computeSpectrogram: fftSize must be a power of two");
  }
  if (hopSize <= 0) {
    throw new Error("computeSpectrogram: hopSize must be positive");
  }

  const window = hannWindow(fftSize);
  const binCount = fftSize / 2 + 1;
  const frames: SpectrogramFrame[] = [];

  if (samples.length === 0) {
    return frames;
  }

  for (let start = 0; start < samples.length; start += hopSize) {
    const real = new Float64Array(fftSize);
    const imag = new Float64Array(fftSize);
    const available = Math.min(fftSize, samples.length - start);
    for (let i = 0; i < available; i++) {
      real[i] = samples[start + i];
    }
    applyWindow(real, window);
    fft(real, imag);
    frames.push(magnitudes({ real, imag }).slice(0, binCount));

    if (start + fftSize >= samples.length) {
      break;
    }
  }

  return frames;
}

/** Converts a linear magnitude to decibels, floored to avoid -Infinity on silence. */
export function magnitudeToDb(magnitude: number, floorDb = -100): number {
  // `magnitude <= 0` alone doesn't catch NaN (`NaN <= 0` is false) — see the
  // same guard in lib/meter.ts's amplitudeToDb. A malformed/corrupt decoded
  // buffer could otherwise feed a NaN sample through the FFT and leak NaN
  // out of this "always floored" function into the spectrogram color ramp.
  if (!(magnitude > 0)) return floorDb;
  return Math.max(floorDb, 20 * Math.log10(magnitude));
}

/** Normalizes a dB value in `[minDb, maxDb]` to `[0, 1]`, clamped at both ends. */
export function normalizeDb(db: number, minDb: number, maxDb: number): number {
  if (maxDb <= minDb) return 0;
  return Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)));
}
