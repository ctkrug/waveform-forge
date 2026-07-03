import { demuxToWav } from "./ffmpeg-client";

/** Result of a successful decode: the PCM buffer plus which path produced it. */
export interface DecodeResult {
  buffer: AudioBuffer;
  usedFallback: boolean;
}

let sharedContext: AudioContext | null = null;

/** Returns the shared AudioContext, creating it lazily on first use (playback + decode). */
export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

/**
 * Decodes a file to PCM. Tries the fast native `decodeAudioData` path
 * first; if the browser rejects the container/codec, falls back to
 * demuxing through ffmpeg.wasm and decoding the resulting WAV.
 *
 * `onFallback`, if given, fires right before that fallback starts — the
 * ffmpeg.wasm core is a ~30MB one-time download, so on a slow or offline
 * connection the fallback can take far longer than the native path with no
 * visible progress; callers use this to tell the user why.
 */
export async function decodeAudioFile(
  file: File,
  onFallback?: () => void,
): Promise<DecodeResult> {
  const context = getAudioContext();
  const originalBytes = await file.arrayBuffer();

  try {
    const buffer = await context.decodeAudioData(originalBytes.slice(0));
    return { buffer, usedFallback: false };
  } catch {
    onFallback?.();
    const wavBytes = await demuxToWav(file);
    const buffer = await context.decodeAudioData(wavBytes);
    return { buffer, usedFallback: true };
  }
}
