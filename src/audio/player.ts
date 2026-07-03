import { resolvePlaybackTime } from "../lib/playback";
import type { TrimSelection } from "../lib/trim";

/**
 * Plays back a trimmed selection of an AudioBuffer via
 * AudioBufferSourceNode, tracking enough state to report a live playhead
 * position without polling the node itself (which exposes no position API).
 */
export class SelectionPlayer {
  private sourceNode: AudioBufferSourceNode | null = null;
  private contextTimeAtStart = 0;
  private selectionAtStart: TrimSelection = { start: 0, end: 0 };
  private loopAtStart = false;
  private onEnded: () => void = () => {};
  private readonly analyser: AnalyserNode;
  private readonly analyserBuffer: Float32Array<ArrayBuffer>;

  constructor(private readonly context: AudioContext) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(context.destination);
    this.analyserBuffer = new Float32Array(this.analyser.fftSize);
  }

  subscribe(onEnded: () => void): void {
    this.onEnded = onEnded;
  }

  get playing(): boolean {
    return this.sourceNode !== null;
  }

  async play(buffer: AudioBuffer, selection: TrimSelection, loop = false): Promise<void> {
    this.stop();
    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    source.onended = () => {
      if (this.sourceNode === source) {
        this.sourceNode = null;
        this.onEnded();
      }
    };

    const duration = Math.max(0, selection.end - selection.start);
    if (loop && duration > 0) {
      source.loop = true;
      source.loopStart = selection.start;
      source.loopEnd = selection.end;
      source.start(0, selection.start);
    } else {
      source.start(0, selection.start, duration);
    }

    this.sourceNode = source;
    this.contextTimeAtStart = this.context.currentTime;
    this.selectionAtStart = selection;
    this.loopAtStart = loop;
  }

  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
      this.sourceNode = null;
    }
  }

  /** Peak absolute sample amplitude (0..1+) over the most recent audio frame, or 0 when stopped. */
  peakLevel(): number {
    if (!this.sourceNode) return 0;
    this.analyser.getFloatTimeDomainData(this.analyserBuffer);
    let peak = 0;
    for (const sample of this.analyserBuffer) {
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  /** Current absolute playback position in seconds within the full file, or null when stopped. */
  currentTime(): number | null {
    if (!this.sourceNode) return null;
    const elapsed = this.context.currentTime - this.contextTimeAtStart;
    return resolvePlaybackTime(
      elapsed,
      this.selectionAtStart.start,
      this.selectionAtStart.end,
      this.loopAtStart,
    );
  }
}
