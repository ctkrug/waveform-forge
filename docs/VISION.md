# Vision

## The problem

Every "convert my audio" or "view this waveform" tool on the web is built the same way:
you upload a file to a server, wait, and download the result. That's three problems at
once:

1. **Privacy** — a voice memo, a demo recording, a field interview, a therapy session
   note — none of it should have to leave your machine just to be trimmed or converted.
2. **Latency and reliability** — upload + queue + process + download is slow, and it
   breaks the moment the server is down, rate-limited, or the file is large.
3. **Cost and gatekeeping** — free tiers cap file size or duration, then ask for a
   subscription for something a browser can already do.

Meanwhile the browser platform has quietly gained everything needed to do this work
locally: the Web Audio API can decode most container formats natively, WebAssembly can
run a full ffmpeg build for anything it can't, and `<canvas>` can render tens of
thousands of samples at 60fps. Nobody has wired these together into one clean tool.

## Who it's for

Anyone who needs to look at or reshape a short audio clip without installing software
or trusting a third party with the file: podcasters trimming a clip, musicians pulling a
sample, developers inspecting a bug report's attached recording, or anyone who just wants
to see what a sound "looks like." No account, no upload, no waiting room.

## The core idea

A single-page, client-only pipeline:

```
file (drag/drop or picker)
  → decode (Web Audio API, ffmpeg.wasm demuxer as fallback for exotic formats)
  → analyze (waveform envelope + windowed FFT for the spectrogram)
  → render (two <canvas> layers: waveform + spectrogram, both zoomable)
  → trim (draggable in/out handles operating on the decoded PCM buffer)
  → export (ffmpeg.wasm transcodes the trimmed selection to MP3 / AAC / WAV)
  → download (Blob URL, no network round-trip)
```

Nothing in this chain touches a server. The only network activity is the one-time
download of the ffmpeg.wasm core (cached by the browser after first load).

## Key design decisions

- **ffmpeg.wasm does encoding, not necessarily decoding.** The Web Audio API's
  `decodeAudioData` handles the common formats (MP3, WAV, AAC, OGG) fast and natively;
  ffmpeg.wasm is the fallback for anything it rejects and is always used for export,
  since `MediaRecorder`-based encoding is inconsistent across browsers for MP3/AAC.
- **The FFT is hand-written, not a dependency.** A charting or audio-analysis library
  would hide the interesting part of this project. `src/lib` implements windowing (Hann)
  and a radix-2 Cooley-Tukey FFT directly, unit-tested against known transforms.
- **Static, single-directory output.** No backend, no API routes — the whole app is a
  Vite build artifact deployable to a static host or subpath (see `README.md` /
  `vite.config.ts`'s relative `base`). This keeps the "nothing is uploaded" claim
  literally true: there's nowhere on the server side for a file to go.
- **Trim operates on decoded PCM, not on the compressed file.** This makes trimming
  sample-accurate and instant (no re-encode until export time), and keeps preview
  playback trivial via an `AudioBufferSourceNode`.
- **Progressive disclosure of ffmpeg.wasm's cost.** The ~30MB wasm core is only fetched
  when the user actually exports, not on page load, so the initial page stays light.

## What "v1 done" looks like

- Drag-and-drop or file-picker load of MP3/WAV/AAC/OGG/FLAC/M4A files.
- A waveform view that renders the full file, supports zoom/pan, and tracks a live
  playhead during preview playback.
- A spectrogram view (FFT-based, adjustable FFT size) rendered under or alongside the
  waveform.
- Draggable trim handles with a live preview of just the selected region.
- Export of the trimmed selection to MP3, AAC, and WAV, each downloadable with no
  server round-trip.
- The whole app is a single static site, buildable with one command, deployable to a
  subpath, and matches the visual direction in `docs/DESIGN.md`.
- Core math (FFT, windowing, waveform reduction, trim-bounds clamping) is unit-tested.
