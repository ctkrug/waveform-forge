---
title: "I built a browser audio trimmer that never uploads your file"
published: false
tags: webdev, typescript, webaudio, wasm
---

I kept hitting the same wall: I'd have a voice memo or a rough demo, I'd need to cut ten
seconds out of it or convert it to MP3, and every tool I found wanted me to upload the file
to a server first. For a throwaway clip that's just annoying. For anything sensitive it's a
non-starter.

So I built [Cathode](https://apps.charliekrug.com/waveform-forge/): drop an audio file in
the browser, see its waveform and spectrogram, trim it, and export to MP3, AAC, or WAV. The
whole pipeline runs client-side. The only network request is the one-time download of the
ffmpeg.wasm core, and that's cached after first use. Here are the decisions that made it
work.

## The browser already decodes audio, so let it

The reflex is to reach for ffmpeg.wasm for everything. But `AudioContext.decodeAudioData`
decodes MP3, WAV, AAC, and OGG natively and fast, and it hands you the raw PCM as a set of
`Float32Array` channels, which is exactly what you need to draw a waveform.

So the decode path is native first. Only if `decodeAudioData` rejects (FLAC, some M4A
containers) does Cathode fall back to running ffmpeg.wasm as a demuxer. That fallback
matters for a second reason: ffmpeg.wasm's core is about 30MB, and I did not want to pay
that on page load. It loads lazily, on the first export or the first format the browser
can't decode, and the UI tells you before the download starts. The initial page stays a few
hundred KB.

## A hand-written FFT, on purpose

The spectrogram needs a Fourier transform per analysis window. A library would have hidden
the most interesting part of the project, so `src/lib/fft.ts` is a plain radix-2
Cooley-Tukey FFT with a Hann window, unit-tested against transforms I can compute by hand (a
DC signal, a single bin, a Nyquist-frequency signal). The spectrogram slides that window
across the PCM, converts each frame's magnitudes to dB, normalizes, and maps intensity to a
studio-scope palette (dark to green to amber). Writing it out meant I actually understood
why the window function matters instead of trusting a black box.

## Trim the PCM, not the file

Trimming operates on the decoded PCM buffer, never the compressed file. That keeps the
selection sample-accurate and makes preview instant: playing just the trimmed region is one
`AudioBufferSourceNode` with `start`/`stop` offsets, no re-encode. ffmpeg.wasm only gets
involved at export time, when the trimmed channels are encoded to a 16-bit WAV in a few
lines and handed to ffmpeg for the final MP3/AAC/WAV.

## The race conditions nobody screenshots

The tricky part wasn't the audio, it was letting the user change their mind mid-flight.
Decode and export are both async and both tied to a specific file, and the UI lets you drop
a second file while the first is still decoding, or hit "Load new file" while an export is
running.

The fix is a `sessionGeneration` counter, bumped on every new file and every reset. Each
async task captures the counter before its `await` and checks it again after. If it changed,
the continuation is a no-op instead of clobbering the UI with a stale result. One level down,
ffmpeg.wasm is a single non-reentrant instance, so its calls are serialized through a small
promise queue that guarantees two `exec()` calls never overlap.

## Testing a DOM app without a DOM

The whole thing is unit-tested to about 99.8% statement coverage, and there's no jsdom in
the project. Vitest runs in plain Node, and each test builds a small duck-typed fake of only
the DOM surface the module under test touches: a fake canvas context that records its call
order, a fake `EventTarget`, a selector-keyed `querySelector`. That's what exercises the
concurrency guards above, which a happy-path browser screenshot would never reach.

## What I'd do differently

I'd add real streaming for very large files. Right now the whole file is decoded into memory,
which is fine for the clip-sized recordings this is built for but would strain on a
feature-length file. That's the honest limit of "do it all in the tab."

Source is on [GitHub](https://github.com/ctkrug/waveform-forge), MIT licensed, and the live
version is at [apps.charliekrug.com/waveform-forge](https://apps.charliekrug.com/waveform-forge/).
</content>
