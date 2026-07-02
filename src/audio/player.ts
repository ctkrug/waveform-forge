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
  private onEnded: () => void = () => {};

  constructor(private readonly context: AudioContext) {}

  subscribe(onEnded: () => void): void {
    this.onEnded = onEnded;
  }

  get playing(): boolean {
    return this.sourceNode !== null;
  }

  async play(buffer: AudioBuffer, selection: TrimSelection): Promise<void> {
    this.stop();
    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.onended = () => {
      if (this.sourceNode === source) {
        this.sourceNode = null;
        this.onEnded();
      }
    };

    const duration = Math.max(0, selection.end - selection.start);
    source.start(0, selection.start, duration);

    this.sourceNode = source;
    this.contextTimeAtStart = this.context.currentTime;
    this.selectionAtStart = selection;
  }

  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
      this.sourceNode = null;
    }
  }

  /** Current absolute playback position in seconds within the full file, or null when stopped. */
  currentTime(): number | null {
    if (!this.sourceNode) return null;
    const elapsed = this.context.currentTime - this.contextTimeAtStart;
    return Math.min(this.selectionAtStart.end, this.selectionAtStart.start + elapsed);
  }
}
