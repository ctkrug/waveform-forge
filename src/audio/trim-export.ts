/** Slices each channel of multi-channel PCM to `[startSample, endSample)`. */
export function sliceChannels(
  channels: Float32Array[],
  startSample: number,
  endSample: number,
): Float32Array[] {
  return channels.map((channel) => channel.slice(startSample, endSample));
}
