import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/** Where the ffmpeg-core wasm/js assets are fetched from at runtime. */
const CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

export type ExportFormat = "mp3" | "aac" | "wav";

const OUTPUT_FILENAMES: Record<ExportFormat, string> = {
  mp3: "output.mp3",
  aac: "output.aac",
  wav: "output.wav",
};

const OUTPUT_MIME_TYPES: Record<ExportFormat, string> = {
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
};

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let queue: Promise<void> = Promise.resolve();

/**
 * Chains `task` onto the shared ffmpeg call queue so it only starts once
 * every previously queued operation has settled. ffmpeg-core runs as a
 * single non-reentrant WASM instance: `demuxToWav` (decode fallback) and
 * `transcode` (export) can otherwise be triggered concurrently — e.g.
 * loading a new file that needs the fallback path while an export from the
 * previous file is still transcoding — and issuing two overlapping `exec()`
 * calls into the same instance is undefined behavior.
 */
function withFfmpegLock<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Lazily loads and caches the shared ffmpeg.wasm instance. The ~30MB core
 * is only fetched the first time this is called (on first decode-fallback
 * or export), never on initial page load.
 */
export async function getFfmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      instance = ffmpeg;
      return ffmpeg;
    })().catch((error: unknown) => {
      // A failed load (e.g. a transient network error fetching the ~30MB
      // core) must not be cached — leaving loadPromise set to a rejected
      // promise would permanently break decode-fallback and export for the
      // rest of the page session, even after connectivity recovers.
      // Confirmed live: without this reset, a second attempt after the
      // network came back still failed with the first attempt's stale
      // "Failed to fetch".
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

/**
 * Demuxes/decodes an arbitrary audio file to WAV via ffmpeg.wasm. Used as
 * the fallback path when `AudioContext.decodeAudioData` rejects a format
 * the browser doesn't natively support.
 */
export async function demuxToWav(file: File): Promise<ArrayBuffer> {
  const ffmpeg = await getFfmpeg();
  const inputName = `input-${crypto.randomUUID()}`;
  const outputName = `${inputName}.wav`;

  return withFfmpegLock(async () => {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    try {
      const code = await ffmpeg.exec(["-i", inputName, outputName]);
      if (code !== 0) {
        throw new Error(`ffmpeg demux failed with exit code ${code}`);
      }
      const data = await ffmpeg.readFile(outputName);
      return new Uint8Array(data as Uint8Array).buffer;
    } finally {
      await ffmpeg.deleteFile(inputName).catch(() => undefined);
      await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
  });
}

/**
 * Transcodes a WAV PCM buffer to the requested export format via
 * ffmpeg.wasm, returning a downloadable Blob. `onProgress` (0..1) reports
 * ffmpeg's own progress events for the export progress bar.
 */
export async function transcode(
  wavBuffer: ArrayBuffer,
  format: ExportFormat,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const ffmpeg = await getFfmpeg();
  const inputName = `trim-${crypto.randomUUID()}.wav`;
  const outputName = OUTPUT_FILENAMES[format];

  return withFfmpegLock(async () => {
    // Registered only once this call actually owns the lock: if it were
    // registered before queuing, a call still waiting its turn would start
    // receiving progress events from whatever unrelated operation is
    // currently running.
    const progressListener = ({ progress }: { progress: number }) => {
      onProgress?.(Math.min(1, Math.max(0, progress)));
    };
    if (onProgress) {
      ffmpeg.on("progress", progressListener);
    }

    await ffmpeg.writeFile(inputName, new Uint8Array(wavBuffer));
    try {
      const args =
        format === "wav"
          ? ["-i", inputName, outputName]
          : ["-i", inputName, "-b:a", "192k", outputName];
      const code = await ffmpeg.exec(args);
      if (code !== 0) {
        throw new Error(`ffmpeg transcode to ${format} failed with exit code ${code}`);
      }
      const data = await ffmpeg.readFile(outputName);
      return new Blob([new Uint8Array(data as Uint8Array)], {
        type: OUTPUT_MIME_TYPES[format],
      });
    } finally {
      if (onProgress) {
        ffmpeg.off("progress", progressListener);
      }
      await ffmpeg.deleteFile(inputName).catch(() => undefined);
      await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
  });
}
