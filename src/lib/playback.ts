/**
 * Resolves the absolute playback position (in seconds within the full file)
 * from wall-clock elapsed time since playback started, given the selection
 * being played and whether it's looping.
 *
 * Kept separate from `SelectionPlayer` (which owns the actual
 * `AudioBufferSourceNode`) so the wrap-around math is unit-testable without
 * a real `AudioContext`.
 */
export function resolvePlaybackTime(
  elapsedSeconds: number,
  selectionStart: number,
  selectionEnd: number,
  loop: boolean,
): number {
  const span = selectionEnd - selectionStart;
  if (span <= 0) return selectionStart;

  if (!loop) {
    return Math.min(selectionEnd, selectionStart + elapsedSeconds);
  }

  const wrapped = elapsedSeconds % span;
  return selectionStart + (wrapped < 0 ? wrapped + span : wrapped);
}
