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
  -> SelectionPlayer             (src/audio/player.ts)          -> live preview + playhead + RMS/peak level
  -> export: sliceChannels + encodeWav + ffmpeg transcode()     -> Blob -> download
```

`src/app.ts`'s `WaveformForgeApp` class owns all of this as one controller: it holds
the current `AudioBuffer`/mono samples/spectrogram frames as private fields and wires
DOM events to the pipeline above. There's no framework and no global store — state
lives on the controller instance, and each user action re-renders only what it touched
(trim drag repositions DOM overlays; a resize re-renders the waveform canvas; decode
re-renders both canvases). `resetSession()` (wired to the topbar's "Load new file"
button) nulls out that state and swaps the shell back to the empty dropzone
(`showDropzone()`, shared with the error path) so a session can move to a second file
without a full page reload.

`decodeAudioFile` and `transcode` are both async work tied to whichever file is
currently loaded, and the UI lets a user start a new one before the previous settles
(load a second file mid-decode; hit "Load new file" mid-export). Each `handleFile`
call and `runExport` call captures `sessionGeneration` (bumped on every new
`handleFile` and on `resetSession`) before its awaits and checks it again after —
if it's changed, that call's continuation is abandoned instead of clobbering the UI
with a stale result. `src/audio/ffmpeg-client.ts` has a matching guard one level
down: `demuxToWav` and `transcode` both drive the single shared (non-reentrant)
ffmpeg.wasm instance, so they're serialized through a promise queue
(`withFfmpegLock`) rather than ever issuing two concurrent `exec()` calls.
`SelectionPlayer.play()` (`src/audio/player.ts`) has the same shape of guard for the
same reason: it awaits `AudioContext.resume()` on the first playback, and a `playToken`
bumped by both `play()` and `stop()` stops a superseded or since-stopped call from
starting a source once that await settles.

## Modules

| Path                         | Responsibility                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/fft.ts`             | Radix-2 Cooley-Tukey FFT + Hann window (hand-written, unit-tested against known transforms).                                                                                                                                                                                                                                   |
| `src/lib/waveform.ts`        | Min/max peak reduction to a fixed-width envelope; mono downmix.                                                                                                                                                                                                                                                                |
| `src/lib/spectrogram.ts`     | Sliding-window FFT over PCM -> per-frame magnitude bins; dB conversion/normalization.                                                                                                                                                                                                                                          |
| `src/lib/colormap.ts`        | Normalized intensity -> RGB along the studio-scope palette (bg -> green -> amber).                                                                                                                                                                                                                                             |
| `src/lib/trim.ts`            | `clampSelection`/`selectionToSampleRange` — the sample-accurate trim-bounds math.                                                                                                                                                                                                                                              |
| `src/lib/zoom.ts`            | `zoomWindow`/`panWindow` — pivot-preserving zoom and clamped pan over a waveform view window.                                                                                                                                                                                                                                  |
| `src/lib/ticks.ts`           | `timeTicks`/`frequencyTicks` — "nice" (1/2/5x10^n) axis tick generation for gridlines and labels.                                                                                                                                                                                                                              |
| `src/lib/math.ts`            | `clamp`.                                                                                                                                                                                                                                                                                                                       |
| `src/lib/playback.ts`        | `resolvePlaybackTime` — wraps elapsed playback time into the selection range when looping instead of clamping it to the selection end.                                                                                                                                                                                         |
| `src/lib/prefs.ts`           | `readPref`/`writePref` — try/caught `localStorage` wrapper for small persisted UI preferences (FFT size, export format).                                                                                                                                                                                                       |
| `src/lib/format.ts`          | `describeAudioTech` (sample rate/channel readout) and `formatDuration` (`MM:SS.mmm`, rounding to the millisecond before splitting so a value can't render as a seconds field of "60").                                                                                                                                         |
| `src/lib/meter.ts`           | `amplitudeToDb`/`dbToMeterRatio`/`isClipping`/`rmsAmplitude` — the level meter's linear-amplitude -> dB -> 0..1 fill-ratio scale, its clip threshold, and the RMS reduction the fill reads (peak alone is used only for clip detection).                                                                                       |
| `src/audio/formats.ts`       | Intake file validation (size + type), independent of the DOM `File` type.                                                                                                                                                                                                                                                      |
| `src/audio/decode.ts`        | `decodeAudioFile` — native decode with ffmpeg.wasm fallback; shared `AudioContext`.                                                                                                                                                                                                                                            |
| `src/audio/ffmpeg-client.ts` | Lazy-loaded ffmpeg.wasm singleton; `demuxToWav` (decode fallback) and `transcode` (export), both wired for the ~30MB core to load only on first use, serialized through `withFfmpegLock` so their `exec()` calls never overlap, and retried on the next call if the initial load itself fails (a failed load is never cached). |
| `src/audio/wav-encoder.ts`   | Pure 16-bit PCM WAV encoder (multi-channel Float32 -> WAV `ArrayBuffer`).                                                                                                                                                                                                                                                      |
| `src/audio/trim-export.ts`   | `sliceChannels` — cuts PCM channels to the trim sample range.                                                                                                                                                                                                                                                                  |
| `src/audio/player.ts`        | `SelectionPlayer` — plays a trim selection via `AudioBufferSourceNode`, optionally looped, exposes a clock-derived `currentTime()` and an `AnalyserNode`-backed `levels()` (peak + RMS from one snapshot) for the playhead and level meter.                                                                                    |
| `src/ui/canvas-utils.ts`     | `fitCanvasToContainer` — devicePixelRatio-correct canvas backing-store sizing.                                                                                                                                                                                                                                                 |
| `src/ui/axis.ts`             | `drawVerticalTicks`/`drawHorizontalTicks` — shared gridline + halo-backed label rendering for canvas axes.                                                                                                                                                                                                                     |
| `src/ui/waveform-view.ts`    | Renders the min/max envelope as a glowing phosphor trace, with a time-axis overlay against the current view window.                                                                                                                                                                                                            |
| `src/ui/spectrogram-view.ts` | Renders spectrogram frames as a colormapped heatmap, with frequency (0..Nyquist) and time (0..duration) axis overlays.                                                                                                                                                                                                         |
| `src/ui/trim-handles.ts`     | Draggable (Pointer Events) + keyboard-nudgeable in/out trim handles, DOM-overlay based.                                                                                                                                                                                                                                        |
| `src/ui/level-meter.ts`      | `LevelMeter` — sets the RMS-driven meter fill width and latches its clip LED on for 1.5s after the last full-scale peak sample.                                                                                                                                                                                                |
| `src/app.ts`                 | `WaveformForgeApp` — the top-level controller wiring intake, rendering, trim, playback, and export together.                                                                                                                                                                                                                   |
| `src/main.ts`                | Entry point; instantiates `WaveformForgeApp`.                                                                                                                                                                                                                                                                                  |

## Rendering strategy

- The waveform/spectrogram canvases are sized via `fitCanvasToContainer`, which reads
  `canvas.clientWidth/Height`, scales the backing store by `devicePixelRatio`, and
  pre-scales the 2D context so draw calls work in CSS-pixel units.
- The spectrogram's FFT is computed **once per decoded file** (and recomputed once if
  the user changes the FFT-size select) and cached (`spectrogramFrames`); a resize only
  re-renders (cheap canvas redraw), it never recomputes the FFT. The waveform envelope,
  being cheap to recompute, is redone on every resize/render call directly from the
  cached mono samples.
- Both canvases draw axis gridlines/labels (`src/ui/axis.ts`, tick values from
  `src/lib/ticks.ts`) directly into the same 2D context as the trace/heatmap, after it,
  so labels sit on top. Labels get a dark stroked halo (`drawLabel` in `axis.ts`) so
  they stay legible regardless of what's drawn underneath — the spectrogram's bottom
  row in particular can be bright with low-frequency energy.
- The playhead and trim handles are **DOM overlays**, not canvas-drawn — they need to
  move every animation frame during playback/drag without forcing a full waveform
  redraw, so they're positioned with `style.left` percentages against the same
  container the canvas fills.
- **Only the waveform zooms/pans.** `WaveformForgeApp` tracks a `viewWindow`
  (`{start, end}` in seconds, see `src/lib/zoom.ts`) driven by four independent inputs:
  mouse-wheel zoom, single-pointer click/touch-drag pan, two-pointer pinch-to-zoom, and
  (with the waveform panel focused) `+`/`-`/`0` keyboard shortcuts. Pan and pinch share
  one `activePointers` map keyed by `pointerId`; a second concurrent pointer switches
  the gesture from pan to pinch (distance between pointers -> zoom factor, their
  midpoint -> pivot) rather than running both at once. `render()` slices `monoSamples`
  to the current view window before computing the envelope, and
  `TrimHandles.setViewWindow` keeps handle positions in sync. The spectrogram always
  shows the full file (recomputing its FFT on every pan would be expensive), so its
  playhead is positioned against total duration while the waveform's playhead is
  positioned against the current view window — the two intentionally use different
  ratios.

## Layout

`.app` is a column flexbox given a **definite** height (`100vh`, upgraded to `100dvh`
where supported) rather than `min-height`. This matters: `.scope-panel`'s children
(`.waveform-wrap`/`.spectrogram-wrap`, `flex: 3`/`flex: 2`) only distribute space
proportionally when every ancestor up to `.app` has a definite height — a `min-height`
anywhere in that chain lets the browser fall back to sizing from content instead of the
viewport, which previously let the page overflow well past 100vh and pushed the
transport strip off-screen. Every panel in the chain (`.scope-panel`, `.scope-stack`)
uses `min-height: 0` (the standard flex-child override) rather than a `vh` floor.

## Landing page

`landing/index.html` + `landing/style.css` are a small static marketing page (no build
step — plain HTML/CSS, own copy of the `docs/DESIGN.md` tokens) that links to the app at
`../index.html`. It lives in `landing/`, not `site/`: `site/` is this project's
gitignored build-output directory name (see `.gitignore`), not a source directory.

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
