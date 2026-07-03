# Cathode

**▶ Live demo: [apps.charliekrug.com/waveform-forge](https://apps.charliekrug.com/waveform-forge/)**

[![CI](https://github.com/ctkrug/waveform-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/waveform-forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

See, trim, and convert audio in your browser. Drop in an audio file and Cathode draws a
waveform and spectrogram, lets you trim to the sample, and exports the result to MP3,
AAC, or WAV. Every step runs on your own machine. Nothing is uploaded.

## Who it's for

Podcasters pulling a clean 20-second clip, beatmakers grabbing a sample, anyone who needs
to look at or cut a short recording without handing the file to a server. No account, no
queue, no upload.

## Why

Almost every "convert my audio" tool on the web is a form that ships your file to a server.
That's a privacy problem for anything sensitive (voice memos, demos, field recordings) and
a latency problem for everything else. Cathode does the opposite: it pulls in a full audio
engine (`ffmpeg.wasm`) and a from-scratch FFT spectrogram renderer, and runs the whole
pipeline (decode, visualize, trim, encode) inside WebAssembly and the Web Audio API. Your
file never leaves the tab.

## What it does

- **Load** almost any audio file (drag-and-drop or file picker): MP3, WAV, AAC, FLAC, OGG,
  M4A, decoded locally via the Web Audio API with an ffmpeg.wasm fallback for exotic
  containers.
- **See** an interactive waveform (min/max envelope, zoomable and pannable) above a
  spectrogram (FFT-based frequency-over-time heatmap, adjustable FFT size), both with
  labeled time and frequency axes and a playhead synced to playback.
- **Trim** with draggable, keyboard- and touch-nudgeable in/out handles directly on the
  waveform, with sample-accurate bounds and live preview of just the selection, optionally
  looped, with a VU-style level meter (RMS fill, peak clip detection).
- **Export** the trimmed selection to MP3, AAC, or WAV via `ffmpeg.wasm`, entirely
  in-browser, with a progress bar and a one-click download. Your last-used FFT size and
  export format are remembered for next time.
- Load a second file without a page reload, and read its sample rate and channel count at
  a glance.
- Fully static, zero-backend deployment: works from a single `dist/` directory at any
  subpath.

## Stack

- **TypeScript** (strict mode) for the application logic.
- **Vite** for the dev server and static build.
- **ffmpeg.wasm** (`@ffmpeg/ffmpeg` + `@ffmpeg/core`) for in-browser decode and transcode.
- **Web Audio API** (`AudioContext.decodeAudioData`) for the fast native decode path and
  playback.
- **Canvas 2D** for waveform and spectrogram rendering (a hand-written FFT, no charting
  library).
- **Vitest** for unit tests across the whole app (FFT/windowing/waveform math, the
  ffmpeg.wasm client, the top-level UI controller), ~99.8% statement coverage.

See [`docs/VISION.md`](docs/VISION.md) for the design rationale and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it's wired together.

## Local development

```bash
npm install
npm run dev       # start the Vite dev server
npm test          # run the unit test suite
npm run build     # produce the static site in dist/
```

## License

MIT, see [`LICENSE`](LICENSE).

---

More of Charlie's projects → [apps.charliekrug.com](https://apps.charliekrug.com)
</content>
</invoke>
