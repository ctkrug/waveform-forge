/**
 * Encodes interleaved-ready multi-channel PCM float samples to a 16-bit
 * PCM WAV container. Used to hand a trimmed selection to ffmpeg.wasm for
 * transcoding (ffmpeg reads WAV natively, no separate demux pass needed).
 */

const BYTES_PER_SAMPLE = 2; // 16-bit PCM
const WAV_HEADER_SIZE = 44;

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function floatTo16BitPcm(view: DataView, offset: number, sample: number): void {
  const clamped = Math.max(-1, Math.min(1, sample));
  const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  view.setInt16(offset, value, true);
}

/**
 * Encodes multi-channel float PCM (one Float32Array per channel, all the
 * same length) to a WAV file buffer.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const channelCount = Math.max(1, channels.length);
  const frameCount = channels[0]?.length ?? 0;
  const dataSize = frameCount * channelCount * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(WAV_HEADER_SIZE + dataSize);
  const view = new DataView(buffer);
  const blockAlign = channelCount * BYTES_PER_SAMPLE;
  const byteRate = sampleRate * blockAlign;

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = WAV_HEADER_SIZE;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      floatTo16BitPcm(view, offset, channels[channel][frame]);
      offset += BYTES_PER_SAMPLE;
    }
  }

  return buffer;
}
