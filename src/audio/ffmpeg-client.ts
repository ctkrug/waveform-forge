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
    })();
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
}

/**
 * Transcodes a WAV PCM buffer to the requested export format via
 * ffmpeg.wasm, returning a downloadable Blob.
 */
export async function transcode(
  wavBuffer: ArrayBuffer,
  format: ExportFormat,
): Promise<Blob> {
  const ffmpeg = await getFfmpeg();
  const inputName = `trim-${crypto.randomUUID()}.wav`;
  const outputName = OUTPUT_FILENAMES[format];

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
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}
