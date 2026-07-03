/** Renders a sample rate in Hz as a compact kHz label, e.g. 44100 -> "44.1kHz". */
function formatSampleRate(sampleRateHz: number): string {
  const khz = sampleRateHz / 1000;
  const rounded = Math.round(khz * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}kHz`;
}

/** Renders a channel count as a familiar audio label rather than a bare number. */
function formatChannelCount(channels: number): string {
  if (channels === 1) return "mono";
  if (channels === 2) return "stereo";
  return `${channels}ch`;
}

/** Combines sample rate + channel count into the topbar's technical readout, e.g. "44.1kHz · stereo". */
export function describeAudioTech(sampleRateHz: number, channels: number): string {
  return `${formatSampleRate(sampleRateHz)} · ${formatChannelCount(channels)}`;
}
