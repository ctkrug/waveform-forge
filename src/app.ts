import { decodeAudioFile } from "./audio/decode";
import { validateAudioFile } from "./audio/formats";
import { computeSpectrogram } from "./lib/spectrogram";
import { computeWaveformEnvelope, downmixToMono } from "./lib/waveform";
import { SpectrogramView } from "./ui/spectrogram-view";
import { WaveformView } from "./ui/waveform-view";

/** FFT size for the spectrogram analysis window; balances frequency vs. time resolution. */
const SPECTROGRAM_FFT_SIZE = 1024;
const SPECTROGRAM_HOP_SIZE = 512;

interface Elements {
  dropzone: HTMLElement;
  fileInput: HTMLInputElement;
  scopeStack: HTMLElement;
  statusLine: HTMLElement;
  fileName: HTMLElement;
  fileDuration: HTMLElement;
  transport: HTMLElement;
  waveformCanvas: HTMLCanvasElement;
  spectrogramCanvas: HTMLCanvasElement;
  waveformWrap: HTMLElement;
}

function requireElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`WaveformForgeApp: missing required element "${selector}"`);
  }
  return el;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds - minutes * 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
}

/** Top-level controller: wires the DOM shell to the audio pipeline. */
export class WaveformForgeApp {
  private readonly el: Elements;
  private readonly waveformView: WaveformView;
  private readonly spectrogramView: SpectrogramView;
  private monoSamples: Float32Array | null = null;
  private spectrogramFrames: ReturnType<typeof computeSpectrogram> | null = null;

  constructor() {
    this.el = {
      dropzone: requireElement("[data-dropzone]"),
      fileInput: requireElement("[data-file-input]"),
      scopeStack: requireElement("[data-scope-stack]"),
      statusLine: requireElement("[data-status-line]"),
      fileName: requireElement("[data-file-name]"),
      fileDuration: requireElement("[data-file-duration]"),
      transport: requireElement("[data-transport]"),
      waveformCanvas: requireElement("[data-waveform-canvas]"),
      spectrogramCanvas: requireElement("[data-spectrogram-canvas]"),
      waveformWrap: requireElement("[data-waveform-wrap]"),
    };

    this.waveformView = new WaveformView(this.el.waveformCanvas);
    this.spectrogramView = new SpectrogramView(this.el.spectrogramCanvas);

    this.wireIntake();
    this.wireResize();
  }

  private wireResize(): void {
    const observer = new ResizeObserver(() => this.render());
    observer.observe(this.el.waveformWrap);
  }

  private render(): void {
    if (!this.monoSamples || !this.spectrogramFrames) return;
    const columns = Math.max(1, this.el.waveformCanvas.clientWidth);
    this.waveformView.render(computeWaveformEnvelope(this.monoSamples, columns));
    this.spectrogramView.render(this.spectrogramFrames);
  }

  private wireIntake(): void {
    const { dropzone, fileInput } = this.el;

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) void this.handleFile(file);
      fileInput.value = "";
    });

    dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("is-dragover");
    });
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (file) void this.handleFile(file);
    });
  }

  private async handleFile(file: File): Promise<void> {
    this.el.dropzone.classList.remove("is-error");
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      this.showError(validation.reason ?? "That file couldn't be loaded.");
      return;
    }

    this.setStatus(`Decoding "${file.name}"...`);

    try {
      const { buffer, usedFallback } = await decodeAudioFile(file);
      this.monoSamples = downmixToMono(
        Array.from({ length: buffer.numberOfChannels }, (_, i) =>
          buffer.getChannelData(i),
        ),
      );

      this.spectrogramFrames = computeSpectrogram(this.monoSamples, {
        fftSize: SPECTROGRAM_FFT_SIZE,
        hopSize: SPECTROGRAM_HOP_SIZE,
      });

      this.el.fileName.textContent = file.name;
      this.el.fileDuration.textContent = formatDuration(buffer.duration);
      this.el.dropzone.hidden = true;
      this.el.scopeStack.hidden = false;
      this.el.transport.hidden = false;
      this.setStatus(
        usedFallback ? "Decoded via ffmpeg.wasm fallback." : "Decoded natively.",
      );
      this.render();
    } catch (error) {
      this.showError(
        error instanceof Error
          ? `Couldn't decode "${file.name}": ${error.message}`
          : `Couldn't decode "${file.name}".`,
      );
    }
  }

  private setStatus(message: string): void {
    this.el.statusLine.textContent = message;
    this.el.statusLine.classList.remove("is-error");
  }

  private showError(message: string): void {
    this.el.statusLine.textContent = message;
    this.el.statusLine.classList.add("is-error");
    this.el.dropzone.classList.add("is-error");
    this.el.dropzone.hidden = false;
    this.el.scopeStack.hidden = true;
    this.el.transport.hidden = true;
  }
}
