# Implementation Plan: Interactive Art Pages

## Overview

Add three full-screen canvas-based interactive art pages (Boids, Voronoi, Aurora) and easter egg systems to the existing Flask app. The implementation proceeds in layers: Flask routing and template scaffolding first, then each simulation, then the easter egg system, then ASCII page easter eggs. All simulation logic lives in vanilla JavaScript embedded in Jinja2 templates.

## Tasks

- [x] 1. Extend Flask app with new routes and update PAGES list
  - [x] 1.1 Add three canvas page templates to PAGES and register dedicated routes
    - In `hello/__init__.py`, add `"pages/boids.html"`, `"pages/voronoi.html"`, `"pages/aurora.html"` to the `PAGES` list (total 8 entries)
    - Register `/boids`, `/voronoi`, and `/aurora` routes inside `create_app()`, each rendering the corresponding template
    - _Requirements: 1.1, 1.2, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 1.2 Write Python tests for new routes and PAGES list
    - Extend `tests/test_hello.py` with tests for HTTP 200 on `/boids`, `/voronoi`, `/aurora`
    - Test that each route response contains the correct `data-page` marker
    - Test that `PAGES` has exactly 8 entries and includes all three canvas page paths
    - _Requirements: 1.1, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 2. Create canvas template scaffold (shared structure)
  - [x] 2.1 Create `pages/boids.html` template scaffold
    - Extend `base.html`, override `content` block with `<canvas id="c" data-page="boids">`, inline `<style>` to reset body layout and hide tagline, empty `<script>` block, and `<div id="panel" class="control-panel" hidden>` stub
    - _Requirements: 1.3, 1.4, 1.6, 1.8, 9.1_

  - [x] 2.2 Create `pages/voronoi.html` template scaffold
    - Same structure as boids scaffold with `data-page="voronoi"`, plus CDN `<script>` tag for d3-delaunay 6.0.4
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.8, 9.2_

  - [x] 2.3 Create `pages/aurora.html` template scaffold
    - Same structure as boids scaffold with `data-page="aurora"`
    - _Requirements: 1.3, 1.4, 1.6, 1.8, 9.3_

- [x] 3. Implement Boids simulation
  - [x] 3.1 Implement Boids core simulation functions
    - Write `initBoids()` to create 120 boids with random positions and velocities
    - Write `updateBoids(dt)` implementing separation, alignment, cohesion steering forces using the O(n²) neighbor loop from the design
    - Write `steerSeparation()`, `steerAlignment()`, `steerCohesion()` helper functions
    - Write `wrapEdges(boid)` for toroidal wrapping
    - Clamp speed to `CFG.maxSpeed` after combining forces
    - Scale position updates by `dt / 16.67` for frame-rate independence
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 3.2 Write property test for boid speed cap (Property 1)
    - **Property 1: Boid Speed Cap Invariant**
    - **Validates: Requirements 2.3**
    - Use fast-check to generate arbitrary boid arrays and maxSpeed values; assert every boid's speed ≤ maxSpeed after `updateBoids`

  - [x] 3.3 Write property test for toroidal edge wrapping (Property 3)
    - **Property 3: Toroidal Edge Wrapping**
    - **Validates: Requirements 2.5**
    - Use fast-check to generate arbitrary (x, y, W, H) values including out-of-bounds positions; assert `0 ≤ x < W` and `0 ≤ y < H` after `wrapEdges`

  - [x] 3.4 Implement Boids rendering and mouse attraction
    - Write `drawBoids()` to render each boid as a filled isosceles triangle oriented toward velocity, with `shadowBlur` glow in `#00ff99`
    - Write `drawBoid(ctx, boid, color)` helper
    - Add mouse tracking (`mousemove` listener) and apply mouse attraction force in `updateBoids` when cursor is within canvas bounds
    - _Requirements: 2.2, 2.4, 2.6_

  - [x] 3.5 Wire Boids animation loop, init, and resize
    - Write `init()` calling `initBoids()`, `attachEventListeners()`, and `requestAnimationFrame(loop)`
    - Write `loop(timestamp)` computing clamped `dt` (max 100ms), calling `update(dt)` and `draw()`
    - Write `resize()` rescaling boid positions as fractions of old dimensions, updating canvas size, preserving velocities
    - Attach debounced (100ms) `resize` listener on `window`
    - Call `init()` on `DOMContentLoaded`
    - _Requirements: 1.7, 2.7_

  - [x] 3.6 Write property test for mouse attraction direction (Property 2)
    - **Property 2: Mouse Attraction Direction**
    - **Validates: Requirements 2.4**
    - Use fast-check to generate boid positions and cursor positions within canvas bounds; apply only mouse force; assert dot product of velocity delta with (mx-bx, my-by) is positive

- [x] 4. Checkpoint — Boids simulation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Voronoi simulation
  - [x] 5.1 Implement Voronoi seed initialization and hue assignment
    - Write `initSeeds()` to create 18 seed points with random positions, velocities, and hues
    - Write `assignHues(count)` returning hues spaced ≥ 25° apart on the HSL wheel
    - _Requirements: 3.1_

  - [x] 5.2 Write property test for Voronoi hue spacing (Property 4)
    - **Property 4: Voronoi Hue Spacing**
    - **Validates: Requirements 3.1**
    - Use fast-check to generate counts in [12, 40]; assert all pairwise circular distances ≥ 25° for the result of `assignHues(count)`

  - [x] 5.3 Implement Voronoi seed movement and cell rendering
    - Write `updateSeeds(dt)` moving seeds by velocity scaled to `dt / 16.67`, bouncing off edges
    - Write `buildDelaunay(seeds)` constructing the d3-delaunay Voronoi object
    - Write `drawCell(ctx, polygon, seed, neighbors, seeds)` rendering each cell with base HSL fill (saturation ≥ 70%, lightness 35–65%) and radial gradient overlay for soft edges (blurWidth ≥ 20px)
    - Write `drawVoronoi()` iterating cells, skipping null polygons
    - Guard against `Delaunay` being undefined (CDN failure) with a fallback error message
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 5.4 Write property test for seed displacement bound (Property 5)
    - **Property 5: Seed Point Displacement Bound**
    - **Validates: Requirements 3.2**
    - Use fast-check to generate seed points with arbitrary velocities; assert displacement after `updateSeeds(16.67)` is ≤ 5px

  - [x] 5.5 Write property test for Voronoi cell color constraints (Property 6)
    - **Property 6: Voronoi Cell Color Constraints**
    - **Validates: Requirements 3.5**
    - Assert that for any seed, the HSL color produced has saturation ≥ 70% and lightness in [35%, 65%]

  - [x] 5.6 Wire Voronoi animation loop, init, and resize
    - Write `init()`, `loop(timestamp)`, and `resize()` following the same pattern as Boids
    - _Requirements: 1.7, 3.6_

- [x] 6. Checkpoint — Voronoi simulation complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement Aurora simulation
  - [x] 7.1 Implement Aurora ribbon initialization and update
    - Write `initRibbons()` creating 7 ribbons with evenly spaced `baseY` values and randomized hue, phase, amplitude, frequency, opacity, thickness within CFG bounds
    - Write `updateRibbons(dt)` advancing phase, interpolating amplitude/frequency toward targets, occasionally picking new targets, shifting hue
    - Clamp all parameters to their CFG bounds after each update step
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.7_

  - [x] 7.2 Write property test for ribbon parameter bounds (Property 7)
    - **Property 7: Ribbon Parameter Bounds Invariant**
    - **Validates: Requirements 4.2, 4.4, 4.5, 4.7**
    - Use fast-check to generate ribbon states and update counts; assert amplitude, frequency, opacity, thickness, and hue rate all remain within CFG bounds after any number of `updateRibbon` calls

  - [x] 7.3 Implement Aurora ribbon rendering
    - Write `buildRibbonPath(ctx, ribbon, W, H)` tracing the sinusoidal polygon (200 steps, top edge left→right, bottom edge right→left)
    - Write `buildRibbonGradient(ctx, ribbon, H)` creating the vertical linear gradient with aurora hues
    - Write `drawRibbons()` clearing canvas and rendering all ribbons
    - _Requirements: 4.3, 4.4, 4.7_

  - [x] 7.4 Wire Aurora animation loop, init, and resize
    - Write `init()`, `loop(timestamp)`, and `resize()` following the same pattern as Boids and Voronoi
    - _Requirements: 1.7, 4.6_

- [x] 8. Checkpoint — Aurora simulation complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Easter Egg system — shared infrastructure
  - [x] 9.1 Implement key sequence buffer and single-key dispatch (all three canvas pages)
    - Add `keyBuffer`, `keyBufferTimer`, and `onKeyDown` handler to each canvas page
    - Implement sequence matching (tail comparison within 3s window) and single-key matching
    - Cap buffer at 20 entries
    - Wire `dispatchTrigger(id)` to call `handleTransform`, `handleTransition`, or `handlePanelToggle` based on trigger type
    - _Requirements: 6.7, 7.5_

  - [x] 9.2 Implement transformation easter egg state machine (all three canvas pages)
    - Write `handleTransform(id)` implementing the IDLE/ACTIVE state machine: save CFG snapshot on first activation, restore on re-trigger, switch transforms correctly
    - Write `applyTransform(id)` for each page's specific transforms (chaos/scatter for Boids, storm/mono for Voronoi, storm/freeze for Aurora)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 9.3 Write property test for transformation round-trip (Property 8)
    - **Property 8: Transformation Easter Egg Round-Trip**
    - **Validates: Requirements 6.4, 6.5**
    - Use fast-check to pick a valid transform ID; call `handleTransform(id)` twice; assert CFG and `activeTransform` are restored to pre-call state

  - [x] 9.4 Write property test for at-most-one active transformation (Property 9)
    - **Property 9: At Most One Active Transformation**
    - **Validates: Requirements 6.6**
    - Use fast-check to pick two distinct transform IDs; activate id1 then id2; assert `activeTransform === id2`

  - [x] 9.5 Write property test for trigger uniqueness (Property 10)
    - **Property 10: Easter Egg Trigger Uniqueness**
    - **Validates: Requirements 7.5**
    - Assert that all trigger keys/sequences in each page's TRIGGERS registry are pairwise distinct

  - [x] 9.6 Implement transition easter eggs (all three canvas pages)
    - Write `handleTransition(url)` fading canvas opacity to 0 over 300ms then setting `window.location.href`
    - Wire Boids `v` key → `/voronoi`, Voronoi `a` key → `/aurora`, Aurora `b` key → `/boids`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 9.7 Implement mouse-still detection for control panel trigger (all three canvas pages)
    - Write `onMouseMove` handler tracking cursor position and resetting a `mouseStillTimer` (3000ms)
    - On timer fire, call `dispatchTrigger('panel')`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Implement Control Panel UI (all three canvas pages)
  - [x] 10.1 Build control panel HTML and CSS for Boids page
    - Populate `<div id="panel">` with close button, heading, and sliders/toggles for: Boid Count (20–300), Max Speed (1–8), Perception Radius (20–200), Separation (0–5), Trails toggle
    - Apply `.control-panel` CSS (dark background `#0d0d1a`, green border/text `#00ff99`, monospace font, fixed position top-right)
    - _Requirements: 8.6, 8.9_

  - [x] 10.2 Build control panel HTML and CSS for Voronoi page
    - Sliders/toggles for: Cell Count (6–40), Speed (0.5–6), Softness (5–80), Lightness (35–65), Saturation (50–100)
    - _Requirements: 8.6, 8.9_

  - [x] 10.3 Build control panel HTML and CSS for Aurora page
    - Sliders/toggles for: Ribbon Count (3–15), Max Amplitude (0.05–0.35), Hue Speed (0–10), Opacity (0.1–0.8), Blur toggle
    - _Requirements: 8.6, 8.9_

  - [x] 10.4 Wire control panel toggle, close button, and live parameter updates
    - Write `handlePanelToggle()` toggling the `hidden` attribute on `#panel`
    - Wire close button click to hide panel
    - Attach `input` event listeners on each slider/toggle to update `CFG` synchronously; reinit simulation when count sliders change
    - _Requirements: 8.4, 8.5, 8.7, 8.8_

  - [x] 10.5 Write property test for control panel toggle round-trip (Property 11)
    - **Property 11: Control Panel Toggle Round-Trip**
    - **Validates: Requirements 8.5**
    - Use fast-check to generate initial visibility state; call `handlePanelToggle()` twice; assert panel returns to original visibility

- [x] 11. Implement Easter Egg clues (all three canvas pages)
  - [x] 11.1 Add clue rendering to Boids page
    - In `drawBoids()`, after main render, call `drawClues(ctx, W, H)` with `globalAlpha ≤ 0.25`
    - Render at least two clues: a faint `?` glyph in the bottom-right corner and a ghost boid in a different hue
    - _Requirements: 5.1, 5.5_

  - [x] 11.2 Add clue rendering to Voronoi page
    - Render at least two clues at `globalAlpha ≤ 0.25`: a faint glyph near a seed point and a cell that pulses at a different rhythm
    - _Requirements: 5.2, 5.5_

  - [x] 11.3 Add clue rendering to Aurora page
    - Render at least two clues at `globalAlpha ≤ 0.25`: a dim star pattern and a ribbon segment with anomalous color
    - _Requirements: 5.3, 5.5_

- [x] 12. Checkpoint — Canvas pages complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement ASCII page easter eggs
  - [x] 13.1 Add shared `_spanify` utility and key buffer to all five ASCII pages
    - Add inline `<script>` to each of `page1.html`–`page5.html`
    - Implement `_spanify(pre)` to wrap each character in a `<span>` with `data-orig`
    - Implement shared `_buf`, `_bufTimer`, `_onKey` key sequence infrastructure
    - Call `_spanify` and attach `keydown` listener on `DOMContentLoaded`
    - _Requirements: 10_

  - [x] 13.2 Implement Page 1 (Hello World) easter eggs
    - Easter Egg A (Glitch Mode): triple-click trigger, `_glitch(pre)` function scrambling characters with random ASCII and color shifts, auto-reset after 4s; clue: faint flicker on `W`
    - Easter Egg B (Typewriter Reveal): key sequence `h` `e` `l` `l` `o`, fade out then retype characters at 30ms each with blinking cursor, reveal hidden message; clue: faint `· · ·` below tagline
    - Easter Egg C (Transition to Boids): key `b`, fade to black, navigate to `/boids`
    - _Requirements: 10_

  - [x] 13.3 Implement Page 2 (Cat) easter eggs
    - Easter Egg A (Cat Speaks): click overlay on eyes line cycles through cat message array; clue: `cursor: pointer` and faint glow on eye `o` characters
    - Easter Egg B (Nyan Mode): key sequence `n` `y` `a` `n`, rainbow `hue-rotate` animation on body, `*` trail stream for 5s; clue: faint `·` at end of last line
    - Easter Egg C (Transition to Voronoi): mouse-still 4s over cat, fade to black, navigate to `/voronoi`; clue: pulsing `~` characters
    - _Requirements: 10_

  - [x] 13.4 Implement Page 3 (Robot) easter eggs
    - Easter Egg A (Robot Malfunction): key sequence `e` `r` `r` `o` `r`, display error-code lines in red then reboot to original art; clue: `[0]` vs `[O]` eye discrepancy
    - Easter Egg B (Robot Dance): double-click body overlay, `translateX` ±8px at 200ms for 2s, caption changes to `🕺`; clue: `title="..."` on arm `|` spans
    - Easter Egg C (Transition to Aurora): key `a`, fade to black, navigate to `/aurora`
    - _Requirements: 10_

  - [x] 13.5 Implement Page 4 (Space/Rocket) easter eggs
    - Easter Egg A (Launch Sequence): key sequence `3` `2` `1`, `translateY` rocket off top then drift back; clue: faint `▼` below rocket base
    - Easter Egg B (Star Field): click apex `*` overlay, inject 40 twinkling `*` elements, remove on next click; clue: `cursor: crosshair` on apex
    - Easter Egg C (Transition to Boids): key `b`, fade to black, navigate to `/boids`
    - _Requirements: 10_

  - [x] 13.6 Implement Page 5 (Ship) easter eggs
    - Easter Egg A (Storm Mode): key sequence `s` `t` `o` `r` `m`, animate wave characters cycling through `~^≈∿`, ship shifts ±4px, color shifts to `#aaddff` for 5s; clue: `≈≈` segment at `opacity: 0.6`
    - Easter Egg B (Message in a Bottle): triple-click hull overlay, fade in bottle message div for 4s; clue: `title="the sea keeps secrets"` on last wave row spans
    - Easter Egg C (Transition to Aurora): key `a`, fade to black, navigate to `/aurora`
    - _Requirements: 10_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use **fast-check** (JavaScript) and **pytest** (Python); set up `tests/js/` with Jest + fast-check before writing JS tests
- Unit tests validate specific examples and edge cases; property tests validate universal invariants
- The `dt` value is always clamped to 100ms max in the animation loop to prevent large jumps after tab switching
- Canvas pages use module-scoped variables (no ES module `export`) — test files re-implement or import the pure functions directly

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2", "2.3"] },
    { "id": 1, "tasks": ["1.2", "3.1", "5.1", "7.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "5.2", "5.3", "7.2", "7.3"] },
    { "id": 3, "tasks": ["3.5", "3.6", "5.4", "5.5", "5.6", "7.4"] },
    { "id": 4, "tasks": ["9.1", "9.2", "9.6", "9.7"] },
    { "id": 5, "tasks": ["9.3", "9.4", "9.5", "10.1", "10.2", "10.3"] },
    { "id": 6, "tasks": ["10.4", "11.1", "11.2", "11.3"] },
    { "id": 7, "tasks": ["10.5", "13.1"] },
    { "id": 8, "tasks": ["13.2", "13.3", "13.4", "13.5", "13.6"] }
  ]
}
```
