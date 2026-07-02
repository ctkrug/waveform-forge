/**
 * Peak-reduction of raw PCM samples down to a per-pixel-column envelope,
 * so the waveform canvas can draw a fixed-width trace regardless of how
 * many samples the decoded buffer actually holds.
 */

/** Per-column min/max envelope, one entry per output column. */
export interface WaveformEnvelope {
  min: Float32Array;
  max: Float32Array;
}

/**
 * Reduces `samples` to `columns` (min, max) pairs by scanning each column's
 * slice of samples. A single sample repeats into a flat column rather than
 * dividing by zero when `columns` exceeds the sample count.
 */
export function computeWaveformEnvelope(
  samples: Float32Array,
  columns: number,
): WaveformEnvelope {
  if (columns <= 0) {
    throw new Error("computeWaveformEnvelope: columns must be positive");
  }

  const min = new Float32Array(columns);
  const max = new Float32Array(columns);

  if (samples.length === 0) {
    return { min, max };
  }

  const samplesPerColumn = samples.length / columns;

  for (let column = 0; column < columns; column++) {
    const start = Math.floor(column * samplesPerColumn);
    const end = Math.max(start + 1, Math.floor((column + 1) * samplesPerColumn));
    let columnMin = Infinity;
    let columnMax = -Infinity;
    for (let i = start; i < end && i < samples.length; i++) {
      const value = samples[i];
      if (value < columnMin) columnMin = value;
      if (value > columnMax) columnMax = value;
    }
    min[column] = columnMin === Infinity ? 0 : columnMin;
    max[column] = columnMax === -Infinity ? 0 : columnMax;
  }

  return { min, max };
}

/**
 * Downmixes a multi-channel PCM buffer (channel-major, as returned by
 * `AudioBuffer.getChannelData`) to mono by averaging channels per sample.
 */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) {
    return new Float32Array(0);
  }
  if (channels.length === 1) {
    return channels[0];
  }
  const length = channels[0].length;
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) {
      sum += channel[i];
    }
    mono[i] = sum / channels.length;
  }
  return mono;
}
