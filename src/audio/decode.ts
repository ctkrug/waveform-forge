import { demuxToWav } from "./ffmpeg-client";

/** Result of a successful decode: the PCM buffer plus which path produced it. */
export interface DecodeResult {
  buffer: AudioBuffer;
  usedFallback: boolean;
}

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

/**
 * Decodes a file to PCM. Tries the fast native `decodeAudioData` path
 * first; if the browser rejects the container/codec, falls back to
 * demuxing through ffmpeg.wasm and decoding the resulting WAV.
 */
export async function decodeAudioFile(file: File): Promise<DecodeResult> {
  const context = getAudioContext();
  const originalBytes = await file.arrayBuffer();

  try {
    const buffer = await context.decodeAudioData(originalBytes.slice(0));
    return { buffer, usedFallback: false };
  } catch {
    const wavBytes = await demuxToWav(file);
    const buffer = await context.decodeAudioData(wavBytes);
    return { buffer, usedFallback: true };
  }
}
