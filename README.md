# Waveform Forge

[![CI](https://github.com/ctkrug/waveform-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/ctkrug/waveform-forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Drop an audio file in the browser and get an instant waveform + spectrogram, trim it,
and export to MP3, AAC, or WAV — **entirely client-side**. Nothing is ever uploaded;
decoding, analysis, and transcoding all happen on your own machine, in your own tab.

## Why

Every "convert my audio" tool on the web is a form that ships your file to a server.
That's a privacy problem for anything sensitive (voice memos, demos, field recordings)
and a latency problem for everything else. Waveform Forge does the opposite: it pulls
in a full audio engine (`ffmpeg.wasm`) and a from-scratch FFT spectrogram renderer, and
runs the entire pipeline — decode, visualize, trim, encode — inside WebAssembly and the
Web Audio API. Your file never leaves the browser tab.

## What it does

- **Load** almost any audio file (drag-and-drop or file picker) — MP3, WAV, AAC, FLAC,
  OGG, M4A — decoded locally via the Web Audio API / ffmpeg.wasm demuxer.
- **Visualize** an interactive waveform (min/max envelope, zoomable/pannable) and a
  spectrogram (FFT-based frequency-over-time heatmap, adjustable FFT size), both with
  labeled time/frequency axes and a playhead synced to playback.
- **Trim** with draggable, keyboard- and touch-nudgeable in/out handles directly on the
  waveform, with sample-accurate bounds and live preview of just the selection.
- **Export** the trimmed selection to MP3, AAC, or WAV via `ffmpeg.wasm`, entirely
  in-browser, with a progress indicator and a one-click download.
- Fully static, zero-backend deployment — works from a single `dist/` directory at any
  subpath.

## Stack

- **TypeScript** — application logic, strict mode.
- **Vite** — dev server + static build.
- **ffmpeg.wasm** (`@ffmpeg/ffmpeg` + `@ffmpeg/core`) — in-browser decode/transcode.
- **Web Audio API** (`AudioContext.decodeAudioData`) — fast native decode path and
  playback.
- **Canvas 2D** — waveform + spectrogram rendering (a hand-written FFT, no charting
  library).
- **Vitest** — unit tests for the FFT, windowing, and waveform-reduction math.

See [`docs/VISION.md`](docs/VISION.md) for the full design rationale and
[`docs/BACKLOG.md`](docs/BACKLOG.md) for the build plan.

## Status

Feature-complete end-to-end: drop a file, see the waveform and spectrogram (with
adjustable FFT size and labeled axes), zoom/pan, drag the trim handles, preview
playback, and export to MP3/AAC/WAV. A `landing/` marketing page shares the app's
design tokens. See [`docs/BACKLOG.md`](docs/BACKLOG.md) for the full story breakdown and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it's wired together.

## Local development

```bash
npm install
npm run dev       # start the Vite dev server
npm test          # run the unit test suite
npm run build     # produce the static site in dist/
```

## License

MIT — see [`LICENSE`](LICENSE).
