import { rmsAmplitude } from "../lib/meter";
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
  /**
   * Bumped by both `play()` and `stop()`; `play()` captures its own value
   * right after calling `stop()` and checks it again after the
   * `context.resume()` await. `resume()` only actually awaits anything on
   * the first playback (a fresh AudioContext starts suspended) — without
   * this, a second `play()` (or a `stop()`) landing while the first is
   * still resuming couldn't be seen by that first call, which would go on
   * to create and start a source nothing could ever stop: either two
   * overlapping sources playing at once, or one starting up after the
   * player was told to stop.
   */
  private playToken = 0;

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
    // stop() first (it also bumps playToken, invalidating any play() call
    // still awaiting a pending resume), then take this call's own token —
    // taking the token before stop() would have this call invalidate itself.
    this.stop();
    const token = ++this.playToken;
    if (this.context.state === "suspended") {
      await this.context.resume();
      // A newer play() call has since started (e.g. a fast double-click on
      // the transport button) and owns playback now — starting a source
      // here too would leave two overlapping sources running with only one
      // reachable through `stop()`.
      if (token !== this.playToken) return;
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
    // Invalidates any play() call still awaiting a pending resume() too —
    // without this, stopping (or resetting the session) during that narrow
    // window wouldn't stop a source that hasn't been created yet, and it
    // would still start playing once the resume settles.
    this.playToken++;
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
      this.sourceNode = null;
    }
  }

  /**
   * Peak and RMS absolute sample amplitude (0..1+) over the most recent
   * audio frame, both `0` when stopped. Read together from a single
   * analyser snapshot — the meter needs both every animation frame (RMS
   * for the fill, peak for clip detection), and `AnalyserNode` data only
   * updates once per frame anyway, so a second `getFloatTimeDomainData`
   * call would just re-read the same snapshot at twice the cost.
   */
  levels(): { peak: number; rms: number } {
    if (!this.sourceNode) return { peak: 0, rms: 0 };
    this.analyser.getFloatTimeDomainData(this.analyserBuffer);
    let peak = 0;
    for (const sample of this.analyserBuffer) {
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
    return { peak, rms: rmsAmplitude(this.analyserBuffer) };
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
