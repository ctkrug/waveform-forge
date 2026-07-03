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
      frequency (y) × time (x) heatmap. FFT size is user-adjustable via a transport
      select (512/1024/2048/4096), recomputing the spectrogram in place.
- [x] Playhead overlay synced to preview playback position on both canvases.
- [x] Design polish: visualization theming (studio-scope color map) and a responsive
      layout that fills the viewport at desktop and phone widths. Grid/axis labels
      (frequency/time tick marks) are drawn on both canvases via `src/lib/ticks.ts`.

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
- [x] Design polish: full responsive/mobile pass across intake, visualization, trim,
      and export — verified at 390/768/1440 in a real browser (fixed a `.app`/
      `.scope-panel` sizing bug that let the page overflow the viewport and push the
      transport off-screen), plus a `landing/` marketing page sharing the same design
      tokens (named `landing/` rather than `site/`, since `site/` is this project's
      gitignored build-output directory, not a source directory).

## Epic 5: Session Controls & Studio Readouts

All of v1's core pipeline (intake → visualize → trim → export) is done. This epic is
the "lived-with tool" pass: things you only notice once you've used it for more than
one file.

- [x] Loop preview playback of the trim selection, toggleable from the transport, with
      a loop-aware playhead.
- [x] "Load a new file" control so a session can move to a second file without a page
      reload (today the dropzone is gone for good once one file is decoded).
- [x] Persist the last-used FFT size and export format across sessions
      (`localStorage`), so the transport remembers your preferences.
- [x] A live peak-level meter during preview playback, styled as an analog VU meter —
      reinforces the studio-hardware design direction and gives instant clip feedback.
- [x] Technical file readout (sample rate / channel count) in the topbar file-meta
      strip, alongside the existing name/duration. (Bit depth is dropped from this
      story's original scope: `decodeAudioData` always yields 32-bit float PCM, so the
      source file's original bit depth isn't observable from the decoded `AudioBuffer`
      without adding a metadata-probing step, which is out of scope here.)
