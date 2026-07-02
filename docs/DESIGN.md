# Design

## 1. Aesthetic direction

**Waveform Forge is analog studio hardware:** a dark brushed-metal rack fascia housing
a phosphor-green CRT scope display, amber panel lighting, and knurled-metal controls —
the tool should feel like a piece of gear you'd find bolted into a mixing desk, not a
web form. This is distinct from a generic "dark cards + one accent" theme: surfaces
read as machined metal panels with real depth (inset shadows, screw-head corner
details), and the waveform/spectrogram trace is the one glowing thing in the room.

## 2. Tokens

| Token              | Value     | Use                                                         |
| ------------------ | --------- | ----------------------------------------------------------- |
| `--bg`             | `#15171b` | page background — brushed-metal charcoal                    |
| `--surface-1`      | `#1f222a` | rack panel surface (toolbar, transport strip)               |
| `--surface-2`      | `#292d37` | raised control surface (buttons, selects, cards)            |
| `--text`           | `#e9e7df` | primary text — warm backlit-label off-white                 |
| `--text-muted`     | `#8a8f9c` | secondary/meta text                                         |
| `--accent`         | `#39ff88` | phosphor-green — scope trace, primary actions, focus ring   |
| `--accent-support` | `#ffb020` | amber — panel lighting, secondary highlights, active meters |
| `--danger`         | `#ff5252` | clip warnings, decode/export errors                         |
| `--success`        | `#39ff88` | shares the phosphor accent (export complete, valid file)    |

- **Type pairing:** `JetBrains Mono` (display — wordmark, headings, numeric readouts:
  timecodes, Hz labels, dB values look native in a monospace) + `Inter` (UI — body copy,
  buttons, form labels), both from Google Fonts with system-mono/system-sans fallbacks.
- **Type scale:** 1.25 ratio — 13 / 16 / 20 / 25 / 31 / 39px.
- **Spacing unit:** 8px scale — 8 / 16 / 24 / 32 / 48 / 64px.
- **Corner radius:** 4px on controls (knobs, buttons, inputs — tight machined edges),
  10px on panel-level containers (toolbar, card groups).
- **Shadow/glow:** raised controls get a soft outer shadow (`0 2px 6px rgb(0 0 0 / 0.4)`)
  plus a 1px top highlight for a beveled-metal edge; the active waveform/spectrogram and
  any focused control get a `--accent` glow (`0 0 12px rgb(57 255 136 / 0.35)`).
- **Motion:** UI transitions 150ms ease-out (buttons, panels, focus rings); the playhead
  and trim handles move continuously (no easing lag) since they track audio time
  directly; meter-style feedback (level indicators) uses 90ms ease-out.

## 3. Layout intent

The hero is the **scope stack** — waveform canvas above a spectrogram canvas, framed as
a single rack-mounted display panel. It owns the majority of the viewport everywhere.

- **1440×900 desktop:** a slim top strip (wordmark + file name/duration) and a slim
  transport strip pinned to the bottom (play/pause, trim handles readout, export
  button) sandwich a scope panel that fills the remaining space — the waveform and
  spectrogram together occupy roughly 65–70% of viewport height, edge to edge with a
  16px panel margin. No sidebars; this isn't a dashboard.
- **390×844 phone:** wordmark strip collapses to a single compact row; the scope panel
  stacks to fill most of the remaining height (waveform above spectrogram, both full
  width); the transport strip becomes a fixed bottom bar with icon-labeled buttons at
  ≥44px touch targets. No horizontal scrolling, no dead margins.

## 4. Signature detail

The wordmark "WAVEFORM FORGE" is traced on load by a scanline sweep — a thin
`--accent`-colored line animates left-to-right once across the logotype (CSS
`clip-path`/mask animation, ~800ms, `prefers-reduced-motion`-aware no-op fallback),
as if the CRT just powered on. The empty state (before a file is loaded) shows a flat,
faintly glowing idle trace across the scope panel with a "NO SIGNAL — drop a file"
label, styled like a disconnected scope input rather than a blank box.

## 5. Juice plan

Not applicable — Waveform Forge is a utility, not a game or playful toy. Interaction
feedback is covered by the craft rules in the shared design standard (themed hover/
focus/active states, 120–250ms transitions, designed empty/loading/error states) rather
than a game-feel/SFX plan.
