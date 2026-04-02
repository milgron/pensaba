# pensaba

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC_BY--NC--SA_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

A real-time 3D tunnel of ephemeral thoughts. Visitors scroll through a curved tunnel, see other users' cursors moving, approach floating thoughts that reveal themselves progressively, and can leave one thought per day. At 00:00 GMT-3, everything disappears.

**[pensaba.com](https://pensaba.com)** — un lugar para pensar en compañía.

---

## Stack

- **Three.js r128** — 3D tunnel, camera path, scene
- **[@chenglou/pretext](https://github.com/chenglou/pretext)** — glyph-level text measurement for curved text rendering
- **Supabase** — Realtime (cursors + live typing), Postgres (thoughts + 24h TTL), Auth (anonymous)
- **Vite + TypeScript** — build toolchain
- **No framework** — vanilla TS, direct DOM manipulation

---

## Architecture

### The tunnel

A `CatmullRomCurve3` path through control points spanning ~260+ world units. A `TubeGeometry` (BackSide rendered) wraps it with a wireframe overlay for depth perception. The camera follows the curve, controlled by scroll — `targetT` lerped to `cameraT` each frame (0 to 1 parametric position). Mouse parallax adds lateral drift.

The tunnel grows dynamically based on thought count. Beyond 20 thoughts, additional control points extend the curve (~50 units per 10 extra thoughts, max ~1000 units).

### Thought coordinate system

Each thought lives at `(t, ox, oy)`:
- `t` — parametric position along the curve (0 to 1)
- `ox` — lateral offset from curve center (normal vector)
- `oy` — vertical offset (binormal vector)

Click position maps to tunnel coordinates via raycasting against the tube mesh, then projecting the hit point onto the local Frenet frame.

### Text rendering

Each thought is rendered as a `THREE.Sprite` with a `CanvasTexture`. Per-glyph arc distortion is applied on the canvas to simulate curvature along the tunnel. Thoughts near the tube walls receive increased arc. The canvas is re-rendered per frame when cursor repulsion or progressive reveal requires it.

---

## Pretext integration

[Pretext](https://github.com/chenglou/pretext) (by Cheng Lou) is a text measurement library that works without DOM layout. It measures text glyph-by-glyph using the browser's font engine via Canvas `measureText`, but performs line-breaking, word-wrapping, and bounding box calculation entirely in JavaScript — no `getBoundingClientRect`, no reflow.

pensaba uses Pretext for three things that would be difficult or impossible with traditional DOM-based text measurement:

### 1. Line-breaking without DOM reflow

Thoughts are created asynchronously inside a 60fps render loop. Traditional text measurement requires creating a hidden DOM element, inserting text, and reading its dimensions — which triggers layout reflow (~5-15ms per measurement, blocking the main thread).

Pretext's `layoutWithLines()` performs the same line-breaking in ~0.1ms without touching the DOM. This allows creating and re-laying out thoughts without frame drops.

```typescript
const prepared = prepareWithSegments(text, font);
const result = layoutWithLines(prepared, maxWidth, lineHeight);
// result.lines: array of { text, width, start, end }
// No DOM element created, no reflow triggered
```

### 2. Progressive reveal without reflow

As the camera approaches a thought, text reveals gradually — from a few words to the full text. The naive approach (truncate the string and re-measure) causes visual jumps because line breaks change unpredictably when text length changes.

Pretext solves this: `layoutWithLines()` computes line breaks for the full text once. The canvas is sized for the complete text. All glyphs are positioned at their final locations from the start — only the `charFraction` parameter controls how many are drawn. The bounding box never changes, so there's no reflow or jumping.

```
Distance > 38 units: ~12% of characters visible (1-2 words)
Distance 24-38:      12-35% visible (first clause)
Distance 14-24:      35-65% visible (most of it)
Distance 6-14:       65-88% visible (almost all)
Distance < 6:        100% visible (full thought)
```

The last few visible glyphs fade in with reduced opacity for a smooth transition.

### 3. Instant bounding box for collision avoidance

When a user submits a thought, it must not overlap existing thoughts. Computing the bounding box of arbitrary text at a given font size traditionally requires rendering it first (to a canvas or DOM element).

Pretext's `prepare()` + `layout()` returns accurate `{width, height}` dimensions in <1ms. This feeds the collision detection system, which nudges new thoughts away from existing ones before they're rendered.

```typescript
const prepared = prepareWithSegments(text, font);
const result = layoutWithLines(prepared, maxWidth, lineHeight);
const bounds = {
  width: Math.max(...result.lines.map(l => l.width)),
  height: result.lines.length * lineHeight
};
// Instant, no rendering required
```

### What Pretext does NOT do here

- **Per-glyph widths**: Pretext provides per-segment widths, not per-grapheme. Individual glyph widths still use `ctx.measureText()` as fallback for multi-grapheme segments.
- **The magnetic cursor repulsion effect**: Pure Canvas2D displacement math, unrelated to Pretext.
- **The arc/curvature distortion**: Canvas2D rotation per glyph, geometric calculation, not text measurement.
- **Rendering**: Pretext is measurement-only. All visual output goes through Canvas2D.

---

## Features

### Ephemeral by design
Every thought exists for exactly one day. At 00:00 GMT-3, everything disappears. One thought per day per user — enforced client-side (localStorage) and server-side (Supabase RPC with timezone-aware rate limiting).

### Magnetic cursor repulsion
When the mouse cursor approaches a thought, glyphs scatter away like a magnet repelling iron filings. Each glyph computes its distance to the cursor and displaces outward with cubic easing. The canvas re-renders per frame only for affected thoughts.

### Real-time presence
- **Cursors**: Other users' positions broadcast via Supabase Presence at ~15fps, rendered as glowing sprites with spatial filtering
- **Live typing**: Partial text broadcast via Supabase Broadcast, shown as translucent ghost thoughts

### Internationalization
Full ES/EN support with language toggle in onboarding and menu bar. All UI strings managed through a minimal i18n module (`src/i18n.ts`).

### Adaptive tunnel
The tunnel extends dynamically based on thought count. More thoughts = longer tunnel to explore. The curve maintains its meandering character with deterministic seeded extensions.

---

## Project structure

```
src/
  main.ts                    # Boot sequence, event wiring
  state.ts                   # Shared mutable state
  events.ts                  # Typed event bus
  types.ts                   # Shared interfaces
  i18n.ts                    # ES/EN translations

  tunnel/
    curve.ts                 # CatmullRomCurve3, Frenet frames, dynamic extension
    tube.ts                  # TubeGeometry (wall + wireframe)
    scene.ts                 # Three.js scene, renderer, camera
    camera.ts                # Scroll-driven camera controller
    parallax.ts              # Mouse parallax offset
    loop.ts                  # RAF loop

  thoughts/
    curved-text.ts           # Pretext integration, glyph layout, canvas rendering
    renderer.ts              # Thought lifecycle, reveal, repulsion orchestration
    placement.ts             # (t, ox, oy) to world position
    reveal.ts                # Distance-based progressive reveal stages
    collision.ts             # Bounding box collision avoidance
    text-layout.ts           # Pretext bridge for measurement

  input/
    composer.ts              # Click-to-think UI with raycasting
    rate-limit.ts            # 1/day client-side enforcement
    nickname.ts              # localStorage nickname management

  realtime/
    client.ts                # Supabase client + anonymous auth
    thoughts-sync.ts         # Postgres CDC subscription
    presence.ts              # Cursor broadcast
    live-typing.ts           # Typing broadcast

  ui/
    onboarding.ts            # 3-step first-visit flow
    menu.ts                  # Bottom menu bar with manifesto, audio controls
    audio.ts                 # White noise with volume + frequency control
    cursor-renderer.ts       # Remote cursor sprites
    typing-indicator.ts      # Ghost thought previews
    mobile-touchpad.ts       # Touch scroll control for mobile

  admin.ts                   # Admin page (soft-delete)

supabase/migrations/
  001_create_thoughts.sql    # Schema, RLS, rate-limit function
  002_create_admin.sql       # Admin users, permissions
```

---

## Development

```bash
pnpm install
pnpm dev
```

Runs at `http://localhost:5173`. Works in local-only mode without Supabase (shows test thoughts).

### With Supabase

1. Create a Supabase project
2. Run the migrations in `supabase/migrations/`
3. Create `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Restart dev server

### Build

```bash
pnpm build
```

Outputs to `dist/`. Deploy as static files.

---

## Manifesto

pensaba is not a social network. No profile, no followers, no metrics. It's a place you go to think.

Every thought exists for exactly one day. At 00:00 it disappears — no warning, no archive, no recovery. When you know something will vanish, you do it differently.

One thought per day. The constraint forces you to know what you really think.

---

## License

This project is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). You're free to share and adapt the code for non-commercial purposes, with attribution and under the same license.

---

*Built with Three.js, Pretext, and Supabase. A [Taller Oliva](https://talleroliva.com) project.*
