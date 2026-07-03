import { decodeAudioFile, getAudioContext } from "./audio/decode";
import { type ExportFormat, transcode } from "./audio/ffmpeg-client";
import { validateAudioFile } from "./audio/formats";
import { SelectionPlayer } from "./audio/player";
import { sliceChannels } from "./audio/trim-export";
import { encodeWav } from "./audio/wav-encoder";
import { describeAudioTech, formatDuration } from "./lib/format";
import { amplitudeToDb, dbToMeterRatio, isClipping } from "./lib/meter";
import { readPref, writePref } from "./lib/prefs";
import { computeSpectrogram } from "./lib/spectrogram";
import { selectionToSampleRange } from "./lib/trim";
import { computeWaveformEnvelope, downmixToMono } from "./lib/waveform";
import { panWindow, pinchZoomFactor, type ViewWindow, zoomWindow } from "./lib/zoom";
import { LevelMeter } from "./ui/level-meter";
import { SpectrogramView } from "./ui/spectrogram-view";
import { TrimHandles } from "./ui/trim-handles";
import { WaveformView } from "./ui/waveform-view";

/** Default FFT size for the spectrogram analysis window; user-adjustable via the FFT select. */
const DEFAULT_SPECTROGRAM_FFT_SIZE = 1024;
const PREF_FFT_SIZE = "fft-size";
const PREF_EXPORT_FORMAT = "export-format";

/** True if `value` matches one of `select`'s options, so a stored preference can't set an invalid value. */
function isValidOption(select: HTMLSelectElement, value: string): boolean {
  return Array.from(select.options).some((option) => option.value === value);
}

interface Elements {
  dropzone: HTMLElement;
  dropzoneTitle: HTMLElement;
  fileInput: HTMLInputElement;
  scopeStack: HTMLElement;
  statusLine: HTMLElement;
  fileName: HTMLElement;
  fileDuration: HTMLElement;
  fileTech: HTMLElement;
  loadNewButton: HTMLButtonElement;
  transport: HTMLElement;
  waveformCanvas: HTMLCanvasElement;
  spectrogramCanvas: HTMLCanvasElement;
  waveformWrap: HTMLElement;
  trimStart: HTMLElement;
  trimEnd: HTMLElement;
  trimRegion: HTMLElement;
  trimReadout: HTMLElement;
  playhead: HTMLElement;
  spectrogramPlayhead: HTMLElement;
  playToggle: HTMLButtonElement;
  playIcon: HTMLElement;
  loopToggle: HTMLButtonElement;
  levelMeter: HTMLElement;
  levelMeterFill: HTMLElement;
  levelMeterClip: HTMLElement;
  timeReadout: HTMLElement;
  fftSizeSelect: HTMLSelectElement;
  formatSelect: HTMLSelectElement;
  exportButton: HTMLButtonElement;
  exportProgress: HTMLElement;
  exportProgressBar: HTMLElement;
  downloadLink: HTMLAnchorElement;
}

const ICON_PLAY = "▶";
const ICON_PAUSE = "⏸";
const DROPZONE_IDLE_TITLE = "NO SIGNAL — DROP A FILE";
const DROPZONE_LOADING_TITLE = "DECODING...";

function requireElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`WaveformForgeApp: missing required element "${selector}"`);
  }
  return el;
}

/** Top-level controller: wires the DOM shell to the audio pipeline. */
export class WaveformForgeApp {
  private readonly el: Elements;
  private readonly waveformView: WaveformView;
  private readonly spectrogramView: SpectrogramView;
  private readonly trimHandles: TrimHandles;
  private readonly player: SelectionPlayer;
  private readonly levelMeterUi: LevelMeter;
  private monoSamples: Float32Array | null = null;
  private spectrogramFrames: ReturnType<typeof computeSpectrogram> | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private playheadRafId: number | null = null;
  private viewWindow: ViewWindow = { start: 0, end: 0 };
  private spectrogramFftSize = DEFAULT_SPECTROGRAM_FFT_SIZE;
  private loopEnabled = false;
  private readonly activePointers = new Map<number, number>();
  private panState: { startClientX: number; startWindow: ViewWindow } | null = null;
  private pinchState: {
    startDistance: number;
    startWindow: ViewWindow;
    pivotRatio: number;
  } | null = null;

  constructor() {
    this.el = {
      dropzone: requireElement("[data-dropzone]"),
      dropzoneTitle: requireElement("[data-dropzone-title]"),
      fileInput: requireElement("[data-file-input]"),
      scopeStack: requireElement("[data-scope-stack]"),
      statusLine: requireElement("[data-status-line]"),
      fileName: requireElement("[data-file-name]"),
      fileDuration: requireElement("[data-file-duration]"),
      fileTech: requireElement("[data-file-tech]"),
      loadNewButton: requireElement("[data-load-new]"),
      transport: requireElement("[data-transport]"),
      waveformCanvas: requireElement("[data-waveform-canvas]"),
      spectrogramCanvas: requireElement("[data-spectrogram-canvas]"),
      waveformWrap: requireElement("[data-waveform-wrap]"),
      trimStart: requireElement("[data-trim-start]"),
      trimEnd: requireElement("[data-trim-end]"),
      trimRegion: requireElement("[data-trim-region]"),
      trimReadout: requireElement("[data-trim-readout]"),
      playhead: requireElement("[data-playhead]"),
      spectrogramPlayhead: requireElement("[data-spectrogram-playhead]"),
      playToggle: requireElement("[data-play-toggle]"),
      playIcon: requireElement("[data-play-icon]"),
      loopToggle: requireElement("[data-loop-toggle]"),
      levelMeter: requireElement("[data-level-meter]"),
      levelMeterFill: requireElement("[data-level-meter-fill]"),
      levelMeterClip: requireElement("[data-level-meter-clip]"),
      timeReadout: requireElement("[data-time-readout]"),
      fftSizeSelect: requireElement("[data-fft-size-select]"),
      formatSelect: requireElement("[data-format-select]"),
      exportButton: requireElement("[data-export-button]"),
      exportProgress: requireElement("[data-export-progress]"),
      exportProgressBar: requireElement("[data-export-progress-bar]"),
      downloadLink: requireElement("[data-download-link]"),
    };

    this.waveformView = new WaveformView(this.el.waveformCanvas);
    this.spectrogramView = new SpectrogramView(this.el.spectrogramCanvas);
    this.trimHandles = new TrimHandles({
      container: this.el.waveformWrap,
      startHandle: this.el.trimStart,
      endHandle: this.el.trimEnd,
      region: this.el.trimRegion,
    });
    this.trimHandles.subscribe((selection) => {
      this.el.trimReadout.textContent = `trim ${formatDuration(selection.start)}–${formatDuration(selection.end)}`;
      this.updateTimeReadout(selection.start);
    });
    this.levelMeterUi = new LevelMeter({
      fill: this.el.levelMeterFill,
      clipLed: this.el.levelMeterClip,
    });
    this.player = new SelectionPlayer(getAudioContext());
    this.player.subscribe(() => this.onPlaybackEnded());

    this.wireIntake();
    this.wireResize();
    this.wireTransport();
    this.wireLoopToggle();
    this.wireLoadNew();
    this.wireExport();
    this.wireZoomPan();
    this.wireFftSize();
    this.restorePreferences();
  }

  /** Applies previously saved FFT-size/export-format selections, if any, on startup. */
  private restorePreferences(): void {
    const savedFftSize = readPref(PREF_FFT_SIZE);
    if (savedFftSize && isValidOption(this.el.fftSizeSelect, savedFftSize)) {
      this.el.fftSizeSelect.value = savedFftSize;
      this.spectrogramFftSize = Number(savedFftSize);
    }

    const savedFormat = readPref(PREF_EXPORT_FORMAT);
    if (savedFormat && isValidOption(this.el.formatSelect, savedFormat)) {
      this.el.formatSelect.value = savedFormat;
    }
  }

  private wireLoadNew(): void {
    this.el.loadNewButton.addEventListener("click", () => this.resetSession());
  }

  /** Returns to the empty-dropzone state so a second file can be loaded without a page reload. */
  private resetSession(): void {
    this.player.stop();
    this.onPlaybackEnded();
    this.audioBuffer = null;
    this.monoSamples = null;
    this.spectrogramFrames = null;
    this.viewWindow = { start: 0, end: 0 };
    this.trimHandles.setDuration(0);

    this.el.fileName.textContent = "NO SIGNAL";
    this.el.fileDuration.textContent = "";
    this.el.fileTech.textContent = "";
    this.showDropzone();
    this.setStatus("");
  }

  /** Swaps the shell back to the empty-dropzone layout, shared by reset and error paths. */
  private showDropzone(): void {
    this.el.loadNewButton.hidden = true;
    this.el.dropzone.classList.remove("is-error", "is-loading");
    this.el.dropzoneTitle.textContent = DROPZONE_IDLE_TITLE;
    this.el.dropzone.hidden = false;
    this.el.scopeStack.hidden = true;
    this.el.transport.hidden = true;
  }

  private wireLoopToggle(): void {
    this.el.loopToggle.addEventListener("click", () => {
      this.loopEnabled = !this.loopEnabled;
      this.el.loopToggle.setAttribute("aria-pressed", String(this.loopEnabled));
      if (this.player.playing && this.audioBuffer) {
        void this.player.play(
          this.audioBuffer,
          this.trimHandles.getSelection(),
          this.loopEnabled,
        );
      }
    });
  }

  private wireFftSize(): void {
    this.el.fftSizeSelect.addEventListener("change", () => {
      this.spectrogramFftSize = Number(this.el.fftSizeSelect.value);
      writePref(PREF_FFT_SIZE, this.el.fftSizeSelect.value);
      if (!this.monoSamples) return;
      this.spectrogramFrames = computeSpectrogram(this.monoSamples, {
        fftSize: this.spectrogramFftSize,
        hopSize: this.spectrogramFftSize / 2,
      });
      this.render();
    });
  }

  private wireZoomPan(): void {
    const { waveformWrap } = this.el;

    waveformWrap.addEventListener(
      "wheel",
      (event) => {
        if (!this.audioBuffer) return;
        event.preventDefault();
        const rect = waveformWrap.getBoundingClientRect();
        const pivotRatio =
          rect.width === 0 ? 0.5 : (event.clientX - rect.left) / rect.width;
        const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
        this.setViewWindow(
          zoomWindow(this.viewWindow, this.audioBuffer.duration, factor, pivotRatio),
        );
      },
      { passive: false },
    );

    waveformWrap.addEventListener("pointerdown", (event) => {
      if (!this.audioBuffer) return;
      if (event.target instanceof HTMLElement && event.target.closest(".trim-handle"))
        return;

      waveformWrap.setPointerCapture(event.pointerId);
      this.activePointers.set(event.pointerId, event.clientX);

      if (this.activePointers.size === 2) {
        this.panState = null;
        this.pinchState = this.beginPinch(waveformWrap);
      } else if (this.activePointers.size === 1) {
        this.panState = { startClientX: event.clientX, startWindow: this.viewWindow };
      }
    });

    waveformWrap.addEventListener("pointermove", (event) => {
      if (!this.audioBuffer || !this.activePointers.has(event.pointerId)) return;
      this.activePointers.set(event.pointerId, event.clientX);

      if (this.pinchState && this.activePointers.size >= 2) {
        this.applyPinch();
      } else if (this.panState && this.activePointers.size === 1) {
        const rect = waveformWrap.getBoundingClientRect();
        if (rect.width === 0) return;
        const { startClientX, startWindow } = this.panState;
        const deltaSeconds =
          (-(event.clientX - startClientX) / rect.width) *
          (startWindow.end - startWindow.start);
        this.setViewWindow(
          panWindow(startWindow, this.audioBuffer.duration, deltaSeconds),
        );
      }
    });

    const endPointer = (event: PointerEvent) => {
      this.activePointers.delete(event.pointerId);
      if (this.activePointers.size < 2) this.pinchState = null;
      if (this.activePointers.size === 0) this.panState = null;
    };
    waveformWrap.addEventListener("pointerup", endPointer);
    waveformWrap.addEventListener("pointercancel", endPointer);

    waveformWrap.addEventListener("dblclick", () => {
      if (!this.audioBuffer) return;
      this.setViewWindow({ start: 0, end: this.audioBuffer.duration });
    });

    waveformWrap.addEventListener("keydown", (event) => {
      if (!this.audioBuffer) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        this.setViewWindow(
          zoomWindow(this.viewWindow, this.audioBuffer.duration, 1 / 1.3, 0.5),
        );
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        this.setViewWindow(
          zoomWindow(this.viewWindow, this.audioBuffer.duration, 1.3, 0.5),
        );
      } else if (event.key === "0") {
        event.preventDefault();
        this.setViewWindow({ start: 0, end: this.audioBuffer.duration });
      }
    });
  }

  /** Captures the starting pinch distance/pivot from the two active touch pointers. */
  private beginPinch(waveformWrap: HTMLElement): {
    startDistance: number;
    startWindow: ViewWindow;
    pivotRatio: number;
  } | null {
    const positions = [...this.activePointers.values()];
    const [x1, x2] = positions;
    const startDistance = Math.abs(x2 - x1);
    if (startDistance === 0) return null;

    const rect = waveformWrap.getBoundingClientRect();
    const midClientX = (x1 + x2) / 2;
    const pivotRatio = rect.width === 0 ? 0.5 : (midClientX - rect.left) / rect.width;
    return { startDistance, startWindow: this.viewWindow, pivotRatio };
  }

  /** Applies the live pinch distance as a zoom factor relative to the pinch's start. */
  private applyPinch(): void {
    if (!this.pinchState || !this.audioBuffer) return;
    const [x1, x2] = [...this.activePointers.values()];
    const factor = pinchZoomFactor(this.pinchState.startDistance, Math.abs(x2 - x1));
    if (factor === null) return;

    this.setViewWindow(
      zoomWindow(
        this.pinchState.startWindow,
        this.audioBuffer.duration,
        factor,
        this.pinchState.pivotRatio,
      ),
    );
  }

  private setViewWindow(view: ViewWindow): void {
    this.viewWindow = view;
    this.trimHandles.setViewWindow(view.start, view.end);
    this.render();
  }

  private wireExport(): void {
    this.el.exportButton.addEventListener("click", () => void this.runExport());
    this.el.formatSelect.addEventListener("change", () => {
      writePref(PREF_EXPORT_FORMAT, this.el.formatSelect.value);
    });
  }

  private async runExport(): Promise<void> {
    const buffer = this.audioBuffer;
    if (!buffer) return;

    const format = this.el.formatSelect.value as ExportFormat;
    const selection = this.trimHandles.getSelection();
    const { startSample, endSample } = selectionToSampleRange(
      selection,
      buffer.sampleRate,
      buffer.length,
    );
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i),
    );
    const trimmed = sliceChannels(channels, startSample, endSample);
    const wav = encodeWav(trimmed, buffer.sampleRate);

    this.el.exportButton.disabled = true;
    this.el.exportProgress.hidden = false;
    this.el.exportProgressBar.style.width = "0%";
    this.setStatus(`Exporting to ${format.toUpperCase()}...`);

    try {
      const blob = await transcode(wav, format, (ratio) => {
        this.el.exportProgressBar.style.width = `${ratio * 100}%`;
      });
      const url = URL.createObjectURL(blob);
      this.el.downloadLink.href = url;
      this.el.downloadLink.download = this.exportFileName(format);
      this.el.downloadLink.click();
      // Defer revocation so the browser has started reading the blob for
      // download before its URL is invalidated.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.setStatus(`Exported ${format.toUpperCase()}.`);
    } catch (error) {
      this.setStatusError(
        error instanceof Error ? `Export failed: ${error.message}` : "Export failed.",
      );
    } finally {
      this.el.exportButton.disabled = false;
      this.el.exportProgress.hidden = true;
    }
  }

  private exportFileName(format: ExportFormat): string {
    const base = (this.el.fileName.textContent ?? "export").replace(/\.[^.]+$/, "");
    return `${base}-trim.${format}`;
  }

  private wireTransport(): void {
    this.el.playToggle.addEventListener("click", () => {
      if (this.player.playing) {
        this.player.stop();
        this.onPlaybackEnded();
        return;
      }
      if (!this.audioBuffer) return;
      void this.beginPlayback();
    });
  }

  /**
   * Starts playback and only then flips the transport to "playing" state.
   * `SelectionPlayer.play` awaits `AudioContext.resume()` on the first
   * playback (the context always starts suspended), which can take longer
   * than a single animation frame. Starting the playhead poll loop
   * synchronously used to race that: the loop's first tick would find no
   * source node yet, read it as "already ended," and immediately bounce
   * the play button back to its paused state before audio had even
   * started.
   */
  private async beginPlayback(): Promise<void> {
    if (!this.audioBuffer) return;
    try {
      await this.player.play(
        this.audioBuffer,
        this.trimHandles.getSelection(),
        this.loopEnabled,
      );
    } catch (error) {
      this.setStatusError(
        error instanceof Error ? `Playback failed: ${error.message}` : "Playback failed.",
      );
      return;
    }
    this.el.playIcon.textContent = ICON_PAUSE;
    this.el.playToggle.setAttribute("aria-label", "Pause");
    this.startPlayheadLoop();
  }

  private startPlayheadLoop(): void {
    const step = () => {
      const time = this.player.currentTime();
      if (time === null || !this.audioBuffer) {
        this.onPlaybackEnded();
        return;
      }
      this.positionPlayhead(time);
      this.updateTimeReadout(time);
      this.updateLevelMeter();
      this.playheadRafId = requestAnimationFrame(step);
    };
    this.playheadRafId = requestAnimationFrame(step);
  }

  private updateLevelMeter(): void {
    const peak = this.player.peakLevel();
    const ratio = dbToMeterRatio(amplitudeToDb(peak));
    this.levelMeterUi.setLevel(ratio, isClipping(peak));
    this.el.levelMeter.setAttribute("aria-valuenow", amplitudeToDb(peak).toFixed(1));
  }

  /**
   * Positions both playhead overlays. The waveform's tracks the current
   * zoomed/panned view window; the spectrogram always shows the full file
   * (it doesn't zoom), so its playhead tracks against total duration.
   */
  private positionPlayhead(time: number): void {
    const span = this.viewWindow.end - this.viewWindow.start;
    const waveformRatio = span === 0 ? 0 : (time - this.viewWindow.start) / span;
    this.el.playhead.style.left = `${waveformRatio * 100}%`;

    const duration = this.audioBuffer?.duration ?? 0;
    const spectrogramRatio = duration === 0 ? 0 : time / duration;
    this.el.spectrogramPlayhead.style.left = `${spectrogramRatio * 100}%`;
  }

  private onPlaybackEnded(): void {
    if (this.playheadRafId !== null) {
      cancelAnimationFrame(this.playheadRafId);
      this.playheadRafId = null;
    }
    this.el.playIcon.textContent = ICON_PLAY;
    this.el.playToggle.setAttribute("aria-label", "Play");
    const start = this.trimHandles.getSelection().start;
    this.positionPlayhead(start);
    this.updateTimeReadout(start);
    this.levelMeterUi.reset();
    this.el.levelMeter.setAttribute("aria-valuenow", "-60");
  }

  private updateTimeReadout(currentTime: number): void {
    const duration = this.audioBuffer?.duration ?? 0;
    this.el.timeReadout.textContent = `${formatDuration(currentTime)} / ${formatDuration(duration)}`;
  }

  private wireResize(): void {
    const observer = new ResizeObserver(() => this.render());
    observer.observe(this.el.waveformWrap);
  }

  private render(): void {
    if (!this.monoSamples || !this.spectrogramFrames || !this.audioBuffer) return;
    const columns = Math.max(1, this.el.waveformCanvas.clientWidth);
    const { startSample, endSample } = selectionToSampleRange(
      this.viewWindow,
      this.audioBuffer.sampleRate,
      this.monoSamples.length,
    );
    const visibleSamples = this.monoSamples.subarray(startSample, endSample);
    this.waveformView.render(
      computeWaveformEnvelope(visibleSamples, columns),
      this.viewWindow,
    );
    this.spectrogramView.render(this.spectrogramFrames, {
      sampleRate: this.audioBuffer.sampleRate,
      duration: this.audioBuffer.duration,
    });
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
    this.el.dropzone.classList.add("is-loading");
    this.el.dropzoneTitle.textContent = DROPZONE_LOADING_TITLE;

    try {
      this.player.stop();
      const { buffer, usedFallback } = await decodeAudioFile(file);
      this.audioBuffer = buffer;
      this.monoSamples = downmixToMono(
        Array.from({ length: buffer.numberOfChannels }, (_, i) =>
          buffer.getChannelData(i),
        ),
      );

      this.spectrogramFrames = computeSpectrogram(this.monoSamples, {
        fftSize: this.spectrogramFftSize,
        hopSize: this.spectrogramFftSize / 2,
      });

      this.trimHandles.setDuration(buffer.duration);
      this.viewWindow = { start: 0, end: buffer.duration };
      this.el.trimReadout.textContent = `trim ${formatDuration(0)}–${formatDuration(buffer.duration)}`;
      this.el.playhead.style.left = "0%";
      this.el.spectrogramPlayhead.style.left = "0%";
      this.onPlaybackEnded();

      this.el.dropzone.classList.remove("is-loading");
      this.el.dropzoneTitle.textContent = DROPZONE_IDLE_TITLE;
      this.el.fileName.textContent = file.name;
      this.el.fileDuration.textContent = formatDuration(buffer.duration);
      this.el.fileTech.textContent = describeAudioTech(
        buffer.sampleRate,
        buffer.numberOfChannels,
      );
      this.el.loadNewButton.hidden = false;
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

  /** Reports an error against an already-loaded file (playback/export) without tearing down its UI. */
  private setStatusError(message: string): void {
    this.el.statusLine.textContent = message;
    this.el.statusLine.classList.add("is-error");
  }

  /** Reports an intake error (bad file / failed decode) — no file is loaded, so fall back to the dropzone. */
  private showError(message: string): void {
    this.setStatusError(message);
    this.showDropzone();
    this.el.dropzone.classList.add("is-error");
  }
}
