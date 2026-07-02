# Backlog

High-level epic/story breakdown for the build. Stories are intentionally broad — they
guide later BUILD runs, not a sprint board. All start unchecked.

## Epic 1: Audio Intake & Decoding

- [ ] Drag-and-drop and file-picker input, with basic format/type validation and a
      friendly rejection message for unsupported files.
- [ ] Web Audio API decode path (`decodeAudioData`) with an ffmpeg.wasm demuxer
      fallback for formats the browser rejects.
- [ ] Design polish: intake screen — empty state, loading state, and error state all
      match `docs/DESIGN.md`, not just the happy path.

## Epic 2: Waveform & Spectrogram Visualization

- [ ] Waveform envelope rendering to `<canvas>` (min/max peak reduction per pixel
      column) with zoom and horizontal pan.
- [ ] Hand-written FFT + Hann windowing library in `src/lib`, unit-tested against known
      transforms — the analytical core the spectrogram depends on.
- [ ] Spectrogram rendering: sliding-window FFT over the buffer, rendered as a
      frequency (y) × time (x) heatmap with an adjustable FFT size.
- [ ] Playhead overlay synced to preview playback position on both canvases.
- [ ] Design polish: visualization theming (color map, grid/axis labels) and a
      responsive layout that fills the viewport at desktop and phone widths.

## Epic 3: Trim & Preview

- [ ] Draggable in/out trim handles overlaid on the waveform, with sample-accurate,
      clamped selection bounds.
- [ ] Live preview playback of just the trimmed selection via
      `AudioBufferSourceNode`.
- [ ] Design polish: themed hover/focus/active states for the trim handles, plus
      keyboard and touch support (not mouse-only dragging).

## Epic 4: Export & Ship

- [ ] ffmpeg.wasm transcode of the trimmed selection to MP3, AAC, and WAV.
- [ ] Export progress indicator and one-click Blob-URL download flow, with a clear
      error state if encoding fails.
- [ ] Static build hardening for subpath deployment: verify relative asset paths and a
      single self-contained `dist/` output under a non-root base path.
- [ ] Design polish: full responsive/mobile pass across intake, visualization, trim,
      and export, plus the landing/marketing page sharing the same design tokens.
