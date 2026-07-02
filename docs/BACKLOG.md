# Backlog

High-level epic/story breakdown for the build. Stories are intentionally broad — they
guide later BUILD runs, not a sprint board. All start unchecked.

## Epic 1: Audio Intake & Decoding

- [x] Drag-and-drop and file-picker input, with basic format/type validation and a
      friendly rejection message for unsupported files.
- [x] Web Audio API decode path (`decodeAudioData`) with an ffmpeg.wasm demuxer
      fallback for formats the browser rejects.
- [x] Design polish: intake screen — empty state, loading state, and error state all
      match `docs/DESIGN.md`, not just the happy path.

## Epic 2: Waveform & Spectrogram Visualization

- [x] Waveform envelope rendering to `<canvas>` (min/max peak reduction per pixel
      column) with zoom and horizontal pan.
- [x] Hand-written FFT + Hann windowing library in `src/lib`, unit-tested against known
      transforms — the analytical core the spectrogram depends on.
- [x] Spectrogram rendering: sliding-window FFT over the buffer, rendered as a
      frequency (y) × time (x) heatmap. FFT size is a fixed constant
      (`SPECTROGRAM_FFT_SIZE` in `src/app.ts`), not yet user-adjustable — a UI control
      for that is still open.
- [x] Playhead overlay synced to preview playback position on both canvases.
- [x] Design polish: visualization theming (studio-scope color map) and a responsive
      layout that fills the viewport at desktop and phone widths. Grid/axis labels
      (frequency/time tick marks) are not yet drawn — open polish item.

## Epic 3: Trim & Preview

- [x] Draggable in/out trim handles overlaid on the waveform, with sample-accurate,
      clamped selection bounds.
- [x] Live preview playback of just the trimmed selection via
      `AudioBufferSourceNode`.
- [x] Design polish: themed hover/focus/active states for the trim handles, plus
      keyboard and touch support (not mouse-only dragging).

## Epic 4: Export & Ship

- [x] ffmpeg.wasm transcode of the trimmed selection to MP3, AAC, and WAV.
- [x] Export progress indicator and one-click Blob-URL download flow, with a clear
      error state if encoding fails.
- [x] Static build hardening for subpath deployment: verify relative asset paths and a
      single self-contained `dist/` output under a non-root base path.
- [ ] Design polish: full responsive/mobile pass across intake, visualization, trim,
      and export (done for the app — verified at 390/768/1440 in a real browser), plus
      the landing/marketing page (`site/`) sharing the same design tokens — the landing
      page itself doesn't exist yet.
