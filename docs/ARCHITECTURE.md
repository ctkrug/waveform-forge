# Architecture

A concise map of the codebase for anyone picking this project back up. No framework —
vanilla TypeScript + the DOM, built with Vite.

## Data flow

```
File (drag/drop or <input type=file>)
  -> validateAudioFile          (src/audio/formats.ts)          reject bad input early
  -> decodeAudioFile            (src/audio/decode.ts)           -> AudioBuffer
       decodeAudioData first; ffmpeg.wasm demuxToWav() fallback on rejection
  -> downmixToMono               (src/lib/waveform.ts)          -> Float32Array
  -> computeWaveformEnvelope     (src/lib/waveform.ts)          -> per-column min/max
  -> computeSpectrogram          (src/lib/spectrogram.ts)       -> FFT frames (Hann-windowed)
  -> WaveformView / SpectrogramView (src/ui/*)                  -> <canvas> render
  -> TrimHandles                 (src/ui/trim-handles.ts)       -> TrimSelection {start, end}
  -> SelectionPlayer             (src/audio/player.ts)          -> live preview + playhead
  -> export: sliceChannels + encodeWav + ffmpeg transcode()     -> Blob -> download
```

`src/app.ts`'s `WaveformForgeApp` class owns all of this as one controller: it holds
the current `AudioBuffer`/mono samples/spectrogram frames as private fields and wires
DOM events to the pipeline above. There's no framework and no global store — state
lives on the controller instance, and each user action re-renders only what it touched
(trim drag repositions DOM overlays; a resize re-renders the waveform canvas; decode
re-renders both canvases).

## Modules

| Path                         | Responsibility                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/fft.ts`             | Radix-2 Cooley-Tukey FFT + Hann window (hand-written, unit-tested against known transforms).                                                         |
| `src/lib/waveform.ts`        | Min/max peak reduction to a fixed-width envelope; mono downmix.                                                                                      |
| `src/lib/spectrogram.ts`     | Sliding-window FFT over PCM -> per-frame magnitude bins; dB conversion/normalization.                                                                |
| `src/lib/colormap.ts`        | Normalized intensity -> RGB along the studio-scope palette (bg -> green -> amber).                                                                   |
| `src/lib/trim.ts`            | `clampSelection`/`selectionToSampleRange` — the sample-accurate trim-bounds math.                                                                    |
| `src/lib/math.ts`            | `clamp`.                                                                                                                                             |
| `src/audio/formats.ts`       | Intake file validation (size + type), independent of the DOM `File` type.                                                                            |
| `src/audio/decode.ts`        | `decodeAudioFile` — native decode with ffmpeg.wasm fallback; shared `AudioContext`.                                                                  |
| `src/audio/ffmpeg-client.ts` | Lazy-loaded ffmpeg.wasm singleton; `demuxToWav` (decode fallback) and `transcode` (export), both wired for the ~30MB core to load only on first use. |
| `src/audio/wav-encoder.ts`   | Pure 16-bit PCM WAV encoder (multi-channel Float32 -> WAV `ArrayBuffer`).                                                                            |
| `src/audio/trim-export.ts`   | `sliceChannels` — cuts PCM channels to the trim sample range.                                                                                        |
| `src/audio/player.ts`        | `SelectionPlayer` — plays a trim selection via `AudioBufferSourceNode`, exposes a clock-derived `currentTime()` for the playhead.                    |
| `src/ui/canvas-utils.ts`     | `fitCanvasToContainer` — devicePixelRatio-correct canvas backing-store sizing.                                                                       |
| `src/ui/waveform-view.ts`    | Renders the min/max envelope as a glowing phosphor trace.                                                                                            |
| `src/ui/spectrogram-view.ts` | Renders spectrogram frames as a colormapped heatmap.                                                                                                 |
| `src/ui/trim-handles.ts`     | Draggable (Pointer Events) + keyboard-nudgeable in/out trim handles, DOM-overlay based.                                                              |
| `src/app.ts`                 | `WaveformForgeApp` — the top-level controller wiring intake, rendering, trim, playback, and export together.                                         |
| `src/main.ts`                | Entry point; instantiates `WaveformForgeApp`.                                                                                                        |

## Rendering strategy

- The waveform/spectrogram canvases are sized via `fitCanvasToContainer`, which reads
  `canvas.clientWidth/Height`, scales the backing store by `devicePixelRatio`, and
  pre-scales the 2D context so draw calls work in CSS-pixel units.
- The spectrogram's FFT is computed **once per decoded file** and cached
  (`spectrogramFrames`); a resize only re-renders (cheap canvas redraw), it never
  recomputes the FFT. The waveform envelope, being cheap to recompute, is redone on
  every resize/render call directly from the cached mono samples.
- The playhead and trim handles are **DOM overlays**, not canvas-drawn — they need to
  move every animation frame during playback/drag without forcing a full waveform
  redraw, so they're positioned with `style.left` percentages against the same
  container the canvas fills.

## Testing

Pure logic (`src/lib/**`, `src/audio/formats.ts`, `src/audio/wav-encoder.ts`,
`src/audio/trim-export.ts`, `src/ui/canvas-utils.ts`'s `computeBackingSize`) is
unit-tested with Vitest — see `test/`. Browser-only integration code
(`decode.ts`, `ffmpeg-client.ts`, `player.ts`, canvas rendering, `app.ts`'s DOM wiring)
is verified by running the app (`npm run dev`) rather than mocked in tests, per the
project's "test what's testable, run what isn't" split.

## Build / run

```bash
npm install
npm run dev         # Vite dev server
npm test            # Vitest unit suite
npm run typecheck   # tsc -b, no emit
npm run lint        # eslint
npm run format      # prettier --check
npm run build       # tsc -b && vite build -> dist/
```

The Vite `base` is `"./"` (see `vite.config.ts`) so `dist/` is deployable from any
subpath, not just a domain root — required for `apps.charliekrug.com/waveform-forge/`.
