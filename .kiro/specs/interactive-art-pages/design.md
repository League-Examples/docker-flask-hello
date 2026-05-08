# Design Document: Interactive Art Pages

## Overview

This feature adds three full-screen, canvas-based interactive art pages to the existing Flask "Hello World" application. The app currently serves one of five static ASCII art pages at random; after this change it will serve one of eight pages, with the three new pages being animated simulations rendered entirely in the browser via the HTML5 Canvas API.

The three simulations are:

- **Boids** (`/boids`) — a classic Craig Reynolds flocking simulation rendered as glowing green triangles
- **Voronoi** (`/voronoi`) — a soft-blob stained-glass pattern built from moving Voronoi seed points using the d3-delaunay library
- **Aurora** (`/aurora`) — sinusoidal color ribbons that shift hue and amplitude over time, evoking the aurora borealis

Each page also contains a hidden easter egg system: faint visual clues hint at secret interactions that trigger color/physics transformations, navigate to another art page, or reveal a floating configuration panel.

The server side is minimal — three new Flask routes and three new Jinja2 templates added to the existing `PAGES` list. All simulation logic lives in vanilla JavaScript embedded in each template's `<script>` block.

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Rendering API | HTML5 Canvas 2D | No build toolchain needed; fits the single-file template pattern |
| Voronoi library | d3-delaunay 6.x (CDN) | Battle-tested Delaunay/Voronoi; ~30 KB gzipped; versioned CDN URL |
| Boids / Aurora | Vanilla JS, no library | Both are straightforward vector math; no dependency needed |
| Template structure | Jinja2 `{% extends "base.html" %}` | Consistent with existing pages; inherits `<head>` meta tags |
| CSS reset | Inline `<style>` block in each template | Overrides base.html flex layout without touching shared CSS |
| Easter egg state | In-memory JS module-level variables | No persistence needed; state resets on page reload |
| Control panel | Vanilla HTML/CSS overlay div | Matches green-glow aesthetic; no external CSS framework |

---

## Architecture

### High-Level Structure

```
Flask App (hello/__init__.py)
├── Route: /          → random.choice(PAGES)  [8 entries]
├── Route: /boids     → pages/boids.html
├── Route: /voronoi   → pages/voronoi.html
└── Route: /aurora    → pages/aurora.html

Templates
├── base.html                  (unchanged)
├── pages/page1.html … page5.html  (unchanged)
├── pages/boids.html           (new)
├── pages/voronoi.html         (new)
└── pages/aurora.html          (new)
```

### Per-Page JavaScript Architecture

Each canvas page follows the same module pattern:

```
Template <script> block
├── Constants / config object
├── Simulation state (entities array, time counter)
├── Easter egg state (activeTransform, panelVisible, inputBuffer)
├── init()          — called once on DOMContentLoaded
│   ├── createEntities()
│   ├── attachEventListeners()
│   └── requestAnimationFrame(loop)
├── loop(timestamp)
│   ├── update(dt)
│   └── draw()
├── update(dt)      — advances simulation by dt milliseconds
├── draw()          — clears canvas and renders all entities
├── resize()        — called on window resize
└── Easter egg handlers
    ├── handleTransform(id)
    ├── handleTransition(url)
    └── handlePanelToggle()
```

### Resize Strategy

On `window.resize`, each page:
1. Records the current entity positions as fractions of the old canvas dimensions
2. Updates `canvas.width` and `canvas.height` to `window.innerWidth / innerHeight`
3. Rescales entity positions to the new dimensions
4. Does **not** reset velocities, phases, or other non-positional state

This satisfies Requirement 1.7 (no simulation restart on resize).

---

## Components and Interfaces

### Flask Layer

**`hello/__init__.py` changes:**

```python
PAGES = [
    "pages/page1.html",
    "pages/page2.html",
    "pages/page3.html",
    "pages/page4.html",
    "pages/page5.html",
    "pages/boids.html",    # new
    "pages/voronoi.html",  # new
    "pages/aurora.html",   # new
]

# Three new dedicated routes added inside create_app():
@app.route("/boids")
def boids():
    return render_template("pages/boids.html")

@app.route("/voronoi")
def voronoi():
    return render_template("pages/voronoi.html")

@app.route("/aurora")
def aurora():
    return render_template("pages/aurora.html")
```

### Template Layer

Each canvas template follows this skeleton:

```html
{% extends "base.html" %}
{% block content %}
<style>
  /* Override base.html flex centering */
  body { margin: 0; padding: 0; overflow: hidden; display: block; }
  .tagline { display: none; }
  canvas { display: block; }
</style>
<canvas id="c" data-page="[boids|voronoi|aurora]"></canvas>
<div id="panel" class="control-panel" hidden>
  <!-- simulation-specific controls -->
</div>
<script>
  /* All simulation logic here */
</script>
{% endblock %}
```

The `data-page` attribute satisfies Requirement 9.1–9.3 (unique string marker per page).

### JavaScript Simulation Modules

Each page exposes the same internal interface (not exported — all module-scoped):

| Function | Signature | Description |
|---|---|---|
| `init` | `() → void` | Bootstrap: create entities, attach listeners, start loop |
| `loop` | `(ts: DOMHighResTimeStamp) → void` | rAF callback; computes dt, calls update+draw |
| `update` | `(dt: number) → void` | Advance simulation state by dt ms |
| `draw` | `() → void` | Clear canvas and render current state |
| `resize` | `() → void` | Rescale canvas and entity positions |
| `handleTransform` | `(id: string) → void` | Toggle a named transformation easter egg |
| `handleTransition` | `(url: string) → void` | Navigate to another art page |
| `handlePanelToggle` | `() → void` | Show/hide the control panel |

### Control Panel Component

Shared structure across all three pages:

```html
<div id="panel" class="control-panel" hidden>
  <button id="panel-close">✕</button>
  <h3>Controls</h3>
  <!-- page-specific sliders and toggles -->
</div>
```

```css
.control-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #0d0d1a;
  border: 1px solid #00ff99;
  color: #00ff99;
  font-family: monospace;
  padding: 16px;
  border-radius: 6px;
  z-index: 100;
  min-width: 220px;
}
.control-panel label { display: block; margin: 8px 0 2px; font-size: 0.85rem; }
.control-panel input[type=range] { width: 100%; accent-color: #00ff99; }
.control-panel input[type=checkbox] { accent-color: #00ff99; }
```

---

## Data Models

### Boid

```javascript
{
  x:  number,   // canvas x position (px)
  y:  number,   // canvas y position (px)
  vx: number,   // velocity x component (px/frame)
  vy: number,   // velocity y component (px/frame)
}
```

**Config object (defaults, overridable by control panel):**

```javascript
const CFG = {
  count:           120,   // number of boids
  maxSpeed:        3.5,   // px/frame at 60fps
  perceptionRadius: 80,   // px — neighbor detection radius
  separationRadius: 30,   // px — hard separation zone
  separationWeight: 1.8,
  alignmentWeight:  1.0,
  cohesionWeight:   1.0,
  mouseWeight:      0.8,  // attraction to cursor
  size:             10,   // triangle base half-width (px)
};
```

### Seed Point (Voronoi)

```javascript
{
  x:   number,   // canvas x position (px)
  y:   number,   // canvas y position (px)
  vx:  number,   // velocity x (px/frame, ≤ 5px at 60fps)
  vy:  number,   // velocity y (px/frame)
  hue: number,   // HSL hue 0–360°
}
```

**Config object:**

```javascript
const CFG = {
  count:      18,    // number of seed points
  maxSpeed:   2.0,   // px/frame
  saturation: 80,    // HSL % (≥ 70 per req)
  lightness:  50,    // HSL % (35–65 per req)
  blurWidth:  30,    // gradient transition zone px (≥ 20 per req)
};
```

### Ribbon (Aurora)

```javascript
{
  baseY:     number,   // vertical center as fraction of canvas height (0–1)
  hue:       number,   // current HSL hue (0–360°)
  hueSpeed:  number,   // °/second (≤ 10 per req)
  amplitude: number,   // current wave amplitude as fraction of canvas height
  ampTarget: number,   // target amplitude (system slowly interpolates toward)
  frequency: number,   // cycles across canvas width (0.5–3)
  freqTarget: number,  // target frequency
  phase:     number,   // current horizontal phase offset (radians)
  phaseSpeed: number,  // radians/second
  opacity:   number,   // fill alpha (0.15–0.55)
  thickness: number,   // ribbon vertical extent as fraction of canvas height (≥ 0.08)
}
```

**Config object:**

```javascript
const CFG = {
  count:        7,     // number of ribbons
  minAmplitude: 0.05,  // fraction of canvas height
  maxAmplitude: 0.20,
  minFrequency: 0.5,
  maxFrequency: 3.0,
  minOpacity:   0.15,
  maxOpacity:   0.55,
  minThickness: 0.08,
  maxThickness: 0.18,
  maxHueSpeed:  10,    // °/second
};
```

### Easter Egg State (shared pattern, per page)

```javascript
// Active transformation id, or null
let activeTransform = null;   // string | null

// Saved baseline config for restoration
let savedCFG = null;          // object | null

// Control panel visibility
let panelVisible = false;

// Key sequence buffer for sequence-based triggers
let keyBuffer = [];           // string[]
let keyBufferTimer = null;    // setTimeout handle

// Mouse tracking for gesture-based triggers
let mouseStillTimer = null;
let lastMouseX = 0, lastMouseY = 0;
```

### Easter Egg Trigger Registry (per page)

Each page defines a static trigger table:

```javascript
const TRIGGERS = {
  // Boids page example
  transform_chaos:    { type: 'key',      key: 'c' },
  transform_scatter:  { type: 'sequence', keys: ['ArrowUp','ArrowUp','ArrowDown','ArrowDown'] },
  transition_voronoi: { type: 'key',      key: 'v' },
  panel:              { type: 'still',    durationMs: 3000 },
};
```

---

## Simulation Algorithms (Low-Level Design)

### Boids Algorithm

The classic Reynolds boids algorithm runs in O(n²) per frame, which is acceptable for n ≤ 200 on modern hardware.

#### Pseudocode: `updateBoids(dt)`

```
for each boid B:
  neighbors = []
  for each other boid O:
    d = distance(B, O)
    if d < CFG.perceptionRadius and d > 0:
      neighbors.push(O)

  sep = (0, 0)   // separation steering
  ali = (0, 0)   // alignment steering
  coh = (0, 0)   // cohesion steering

  for each N in neighbors:
    d = distance(B, N)
    if d < CFG.separationRadius:
      sep += normalize(B.pos - N.pos) / d   // weighted by inverse distance

    ali += (N.vx, N.vy)
    coh += (N.x, N.y)

  if len(neighbors) > 0:
    ali = normalize(ali / len(neighbors)) * CFG.maxSpeed - (B.vx, B.vy)
    coh = normalize(coh / len(neighbors) - B.pos) * CFG.maxSpeed - (B.vx, B.vy)

  // Mouse attraction
  if mouseInCanvas:
    mouse_force = normalize(mouse - B.pos) * CFG.maxSpeed - (B.vx, B.vy)
  else:
    mouse_force = (0, 0)

  // Combine forces
  B.vx += sep.x * CFG.separationWeight
         + ali.x * CFG.alignmentWeight
         + coh.x * CFG.cohesionWeight
         + mouse_force.x * CFG.mouseWeight
  B.vy += sep.y * CFG.separationWeight
         + ali.y * CFG.alignmentWeight
         + coh.y * CFG.cohesionWeight
         + mouse_force.y * CFG.mouseWeight

  // Clamp speed
  speed = sqrt(B.vx² + B.vy²)
  if speed > CFG.maxSpeed:
    B.vx = B.vx / speed * CFG.maxSpeed
    B.vy = B.vy / speed * CFG.maxSpeed

  // Advance position (dt-scaled to 60fps baseline)
  scale = dt / 16.67
  B.x = (B.x + B.vx * scale + W) % W
  B.y = (B.y + B.vy * scale + H) % H
```

#### Pseudocode: `drawBoids()`

```
ctx.clearRect(0, 0, W, H)
ctx.shadowBlur = 12
ctx.shadowColor = '#00ff99'

for each boid B:
  angle = atan2(B.vy, B.vx)
  ctx.save()
  ctx.translate(B.x, B.y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(CFG.size * 1.5, 0)          // apex (forward)
  ctx.lineTo(-CFG.size * 0.75,  CFG.size * 0.6)  // rear-left
  ctx.lineTo(-CFG.size * 0.75, -CFG.size * 0.6)  // rear-right
  ctx.closePath()
  ctx.fillStyle = currentFillColor       // '#00ff99' or easter-egg override
  ctx.fill()
  ctx.restore()
```

#### Function Signatures

```javascript
function initBoids()                          // populate boids array
function updateBoids(dt)                      // advance physics
function drawBoids()                          // render frame
function steerSeparation(boid, neighbors)     // returns {x, y} force vector
function steerAlignment(boid, neighbors)      // returns {x, y} force vector
function steerCohesion(boid, neighbors)       // returns {x, y} force vector
function wrapEdges(boid)                      // toroidal wrapping
function drawBoid(ctx, boid, color)           // draw single triangle
```

---

### Voronoi Algorithm

Uses **d3-delaunay** (loaded from CDN) to compute the Voronoi diagram each frame from the current seed point positions.

#### CDN URL

```html
<script src="https://cdn.jsdelivr.net/npm/d3-delaunay@6.0.4/dist/d3-delaunay.min.js"></script>
```

#### Pseudocode: `updateVoronoi(dt)`

```
scale = dt / 16.67
for each seed S:
  S.x += S.vx * scale
  S.y += S.vy * scale

  // Bounce off edges
  if S.x < 0 or S.x > W: S.vx *= -1; clamp S.x
  if S.y < 0 or S.y > H: S.vy *= -1; clamp S.y
```

#### Pseudocode: `drawVoronoi()`

```
ctx.clearRect(0, 0, W, H)

// Build flat points array for d3-delaunay
points = seeds.flatMap(s => [s.x, s.y])
delaunay = Delaunay.from(points)   // actually use new Delaunay(Float64Array)
voronoi  = delaunay.voronoi([0, 0, W, H])

for i, seed in enumerate(seeds):
  cell = voronoi.cellPolygon(i)
  if cell is null: continue

  // Base fill
  ctx.beginPath()
  ctx.moveTo(cell[0][0], cell[0][1])
  for pt in cell[1:]:
    ctx.lineTo(pt[0], pt[1])
  ctx.closePath()
  ctx.fillStyle = hsl(seed.hue, CFG.saturation%, CFG.lightness%)
  ctx.fill()

  // Soft-blob gradient overlay: for each edge of the cell polygon,
  // draw a radial gradient centered on the seed point that fades
  // from the cell color (alpha 0) at the seed to transparent at the edge.
  // This is achieved by drawing a second pass with a radial gradient
  // clipped to the cell path.
  ctx.save()
  ctx.clip()   // clip to cell polygon (already in path)
  for each neighbor j of seed i (from delaunay.neighbors(i)):
    midX = (seed.x + seeds[j].x) / 2
    midY = (seed.y + seeds[j].y) / 2
    grad = ctx.createRadialGradient(midX, midY, 0, midX, midY, CFG.blurWidth)
    grad.addColorStop(0, hsla(seeds[j].hue, sat%, light%, 0.6))
    grad.addColorStop(1, hsla(seeds[j].hue, sat%, light%, 0))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)   // fills only within clip
  ctx.restore()
```

**Design note on soft edges:** The gradient overlay approach blends neighbor colors at cell boundaries, producing the "soft blob stained-glass" look without requiring a full per-pixel distance computation. The `CFG.blurWidth` (≥ 20px) controls the transition zone width.

#### Function Signatures

```javascript
function initSeeds()                          // populate seeds array with hue spacing
function updateSeeds(dt)                      // move seeds, bounce edges
function drawVoronoi()                        // full frame render
function assignHues(count)                    // returns array of hues spaced ≥ 25° apart
function buildDelaunay(seeds)                 // returns d3-delaunay Voronoi object
function drawCell(ctx, polygon, seed, neighbors, seeds)  // render one cell with gradient
```

---

### Aurora Algorithm

Pure vanilla JS — no library needed. Each ribbon is a filled polygon traced along a sinusoidal path.

#### Pseudocode: `updateAurora(dt)`

```
dtSec = dt / 1000
for each ribbon R:
  R.phase += R.phaseSpeed * dtSec

  // Slowly interpolate amplitude and frequency toward targets
  R.amplitude += (R.ampTarget  - R.amplitude)  * 0.005
  R.frequency += (R.freqTarget - R.frequency)  * 0.005

  // Occasionally pick new targets
  if random() < 0.002:
    R.ampTarget  = random(CFG.minAmplitude, CFG.maxAmplitude)
  if random() < 0.002:
    R.freqTarget = random(CFG.minFrequency, CFG.maxFrequency)

  // Shift hue
  R.hue = (R.hue + R.hueSpeed * dtSec) % 360
```

#### Pseudocode: `drawAurora()`

```
ctx.clearRect(0, 0, W, H)

for each ribbon R:
  centerY = R.baseY * H
  halfH   = R.thickness * H / 2
  ampPx   = R.amplitude * H

  // Build top and bottom edge paths
  topPts = []
  botPts = []
  steps  = 200   // horizontal resolution

  for i in 0..steps:
    x = i / steps * W
    t = x / W * R.frequency * 2π + R.phase
    y = centerY + sin(t) * ampPx
    topPts.push([x, y - halfH])
    botPts.push([x, y + halfH])

  // Vertical gradient
  grad = ctx.createLinearGradient(0, centerY - halfH - ampPx,
                                   0, centerY + halfH + ampPx)
  grad.addColorStop(0,   hsla(R.hue,        80%, 60%, 0))
  grad.addColorStop(0.3, hsla(R.hue,        80%, 60%, R.opacity))
  grad.addColorStop(0.5, hsla((R.hue+30)%360, 75%, 55%, R.opacity))
  grad.addColorStop(0.7, hsla((R.hue+60)%360, 70%, 50%, R.opacity))
  grad.addColorStop(1,   hsla(R.hue,        80%, 60%, 0))

  // Draw filled polygon: top edge left→right, bottom edge right→left
  ctx.beginPath()
  ctx.moveTo(topPts[0][0], topPts[0][1])
  for pt in topPts[1:]:
    ctx.lineTo(pt[0], pt[1])
  for pt in reversed(botPts):
    ctx.lineTo(pt[0], pt[1])
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
```

#### Function Signatures

```javascript
function initRibbons()                        // populate ribbons array
function updateRibbons(dt)                    // advance phases, hues, interpolate params
function drawRibbons()                        // render all ribbons
function buildRibbonPath(ctx, ribbon, W, H)   // traces the polygon path for one ribbon
function buildRibbonGradient(ctx, ribbon, H)  // returns CanvasGradient for one ribbon
```

---

## Easter Egg System (Low-Level Design)

### Clue Rendering

Each page renders its clues in the `draw()` function after the main simulation, using a saved/restored context with low `globalAlpha`:

```javascript
// Example: Boids page clue — faint "?" glyph in bottom-right corner
function drawClues(ctx, W, H) {
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.font = '14px monospace'
  ctx.fillStyle = '#00ff99'
  ctx.fillText('?', W - 24, H - 16)   // clue 1: corner glyph

  // clue 2: one "ghost" boid rendered at 0.15 alpha in a different hue
  ctx.globalAlpha = 0.15
  drawBoid(ctx, ghostBoid, '#ff99ff')
  ctx.restore()
}
```

All clues use `globalAlpha ≤ 0.25` per Requirements 5.1–5.3 and 5.5.

### Transformation Easter Egg State Machine

```
State: IDLE
  → on trigger(id): save CFG snapshot → apply transform(id) → State: ACTIVE(id)

State: ACTIVE(id)
  → on trigger(id):  restore CFG snapshot → State: IDLE
  → on trigger(id2): restore CFG snapshot → apply transform(id2) → State: ACTIVE(id2)
```

```javascript
function handleTransform(id) {
  if (activeTransform === id) {
    // Toggle off: restore saved config
    Object.assign(CFG, savedCFG)
    savedCFG = null
    activeTransform = null
  } else {
    // Switch to new transform (deactivates any prior one)
    if (savedCFG === null) savedCFG = Object.assign({}, CFG)
    else Object.assign(CFG, savedCFG)   // restore before applying new
    applyTransform(id)
    activeTransform = id
  }
}

function applyTransform(id) {
  switch (id) {
    case 'chaos':
      CFG.maxSpeed *= 3
      CFG.separationWeight = 0.1
      currentFillColor = '#ff4444'
      break
    case 'scatter':
      CFG.separationWeight = 5.0
      CFG.cohesionWeight   = 0.0
      currentFillColor = '#44aaff'
      break
    // ... per-page variants
  }
}
```

### Key Sequence Buffer

```javascript
function onKeyDown(e) {
  keyBuffer.push(e.key)
  clearTimeout(keyBufferTimer)
  keyBufferTimer = setTimeout(() => { keyBuffer = [] }, 3000)  // 3s window

  // Check all sequence triggers
  for (const [id, trigger] of Object.entries(TRIGGERS)) {
    if (trigger.type !== 'sequence') continue
    const seq = trigger.keys
    if (keyBuffer.length >= seq.length) {
      const tail = keyBuffer.slice(-seq.length)
      if (tail.every((k, i) => k === seq[i])) {
        keyBuffer = []
        clearTimeout(keyBufferTimer)
        dispatchTrigger(id)
        return
      }
    }
  }

  // Check single-key triggers
  for (const [id, trigger] of Object.entries(TRIGGERS)) {
    if (trigger.type === 'key' && e.key === trigger.key) {
      dispatchTrigger(id)
      return
    }
  }
}
```

### Mouse-Still Detection (Control Panel trigger)

```javascript
function onMouseMove(e) {
  mouseX = e.clientX; mouseY = e.clientY
  clearTimeout(mouseStillTimer)
  mouseStillTimer = setTimeout(() => {
    dispatchTrigger('panel')
  }, CFG.panelStillMs)   // default 3000ms
}
```

### Transition Easter Egg

```javascript
function handleTransition(url) {
  // Brief fade-out then navigate
  canvas.style.transition = 'opacity 300ms'
  canvas.style.opacity = '0'
  setTimeout(() => { window.location.href = url }, 300)
}
```

### Per-Page Easter Egg Trigger Tables

#### Boids Page

| ID | Type | Trigger | Effect |
|---|---|---|---|
| `transform_chaos` | key | `c` | 3× speed, red fill, weak separation |
| `transform_scatter` | sequence | `↑↑↓↓` (within 3s) | Max separation, blue fill, zero cohesion |
| `transition_voronoi` | key | `v` | Navigate to `/voronoi` |
| `panel` | mouse-still | 3s without moving | Toggle control panel |

#### Voronoi Page

| ID | Type | Trigger | Effect |
|---|---|---|---|
| `transform_storm` | key | `s` | Seeds speed ×4, desaturated palette |
| `transform_mono` | sequence | `m` `o` `n` `o` (within 3s) | Monochrome (all cells same hue) |
| `transition_aurora` | key | `a` | Navigate to `/aurora` |
| `panel` | mouse-still | 3s without moving | Toggle control panel |

#### Aurora Page

| ID | Type | Trigger | Effect |
|---|---|---|---|
| `transform_storm` | key | `s` | All ribbons max amplitude, fast hue shift |
| `transform_freeze` | sequence | `f` `r` `z` (within 3s) | Phase speed → 0, opacity → max |
| `transition_boids` | key | `b` | Navigate to `/boids` |
| `panel` | mouse-still | 3s without moving | Toggle control panel |

### Control Panel Controls

#### Boids Control Panel

| Label | Control | Parameter |
|---|---|---|
| Boid Count | range 20–300 | `CFG.count` (triggers reinit) |
| Max Speed | range 1–8 | `CFG.maxSpeed` |
| Perception Radius | range 20–200 | `CFG.perceptionRadius` |
| Separation | range 0–5 | `CFG.separationWeight` |
| Trails | toggle | enables `ctx.globalCompositeOperation = 'source-over'` with partial clear |

#### Voronoi Control Panel

| Label | Control | Parameter |
|---|---|---|
| Cell Count | range 6–40 | `CFG.count` (triggers reinit) |
| Speed | range 0.5–6 | `CFG.maxSpeed` |
| Softness | range 5–80 | `CFG.blurWidth` |
| Lightness | range 35–65 | `CFG.lightness` |
| Saturation | range 50–100 | `CFG.saturation` |

#### Aurora Control Panel

| Label | Control | Parameter |
|---|---|---|
| Ribbon Count | range 3–15 | `CFG.count` (triggers reinit) |
| Max Amplitude | range 0.05–0.35 | `CFG.maxAmplitude` |
| Hue Speed | range 0–10 | `CFG.maxHueSpeed` |
| Opacity | range 0.1–0.8 | `CFG.maxOpacity` |
| Blur | toggle | enables `ctx.filter = 'blur(4px)'` on ribbon draw |

---

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before writing properties, reviewing the prework for redundancy:

- **2.3 (speed cap) and 2.4 (mouse attraction direction)** are independent — speed cap is an invariant, mouse attraction is a directional property. Keep both.
- **2.5 (edge wrapping)** is independent of the above. Keep.
- **3.1 (hue spacing) and 3.5 (HSL saturation/lightness)** are independent color constraints. Keep both.
- **3.2 (seed displacement ≤ 5px)** is independent. Keep.
- **4.2 (amplitude/frequency bounds), 4.4 (opacity bounds), 4.5 (hue rate), 4.7 (thickness bounds)** are all ribbon invariants. These can be combined into a single "ribbon parameters stay within bounds" property.
- **6.4 (transform changes something) and 6.5 (transform round-trip restores state)** — 6.5 subsumes 6.4 (if round-trip restores, the transform must have changed something). Consolidate into one round-trip property.
- **6.6 (at most one transform active)** is independent. Keep.
- **7.5 (trigger uniqueness)** is independent. Keep.
- **8.5 (panel toggle round-trip)** is independent. Keep.

After reflection: 9 distinct properties.

---

### Property 1: Boid Speed Cap Invariant

*For any* collection of boids with arbitrary positions and velocities, after one call to `updateBoids(dt)`, every boid's speed (magnitude of velocity vector) SHALL be less than or equal to `CFG.maxSpeed`.

**Validates: Requirements 2.3**

---

### Property 2: Mouse Attraction Direction

*For any* boid position `(bx, by)` and any cursor position `(mx, my)` within canvas bounds, when only the mouse attraction force is applied (all other forces zeroed), the resulting velocity change SHALL have a positive dot product with the vector `(mx - bx, my - by)`, meaning the boid accelerates toward the cursor.

**Validates: Requirements 2.4**

---

### Property 3: Toroidal Edge Wrapping

*For any* boid position `(x, y)` — including positions far outside canvas bounds — after `wrapEdges(boid)`, the resulting position SHALL satisfy `0 ≤ x < W` and `0 ≤ y < H`, where `W` and `H` are the canvas dimensions.

**Validates: Requirements 2.5**

---

### Property 4: Voronoi Hue Spacing

*For any* count `n` in the range `[12, 40]`, `assignHues(n)` SHALL return an array of `n` hue values such that for every pair of hues `(h1, h2)`, the minimum circular distance `min(|h1 - h2|, 360 - |h1 - h2|)` is at least 25°.

**Validates: Requirements 3.1**

---

### Property 5: Seed Point Displacement Bound

*For any* seed point with any velocity vector, after `updateSeeds(16.67)` (one frame at 60fps), the Euclidean distance between the seed's new position and its previous position SHALL be at most 5px.

**Validates: Requirements 3.2**

---

### Property 6: Voronoi Cell Color Constraints

*For any* seed point, the HSL color assigned to its cell SHALL have saturation ≥ 70% and lightness in the range `[35%, 65%]`.

**Validates: Requirements 3.5**

---

### Property 7: Ribbon Parameter Bounds Invariant

*For any* ribbon in any state, after any number of calls to `updateRibbons(dt)`:
- amplitude SHALL remain in `[CFG.minAmplitude, CFG.maxAmplitude]` (i.e., `[0.05, 0.20]`)
- frequency SHALL remain in `[CFG.minFrequency, CFG.maxFrequency]` (i.e., `[0.5, 3.0]`)
- opacity SHALL remain in `[CFG.minOpacity, CFG.maxOpacity]` (i.e., `[0.15, 0.55]`)
- thickness SHALL remain ≥ `CFG.minThickness` (i.e., ≥ 0.08)
- the absolute hue change per second SHALL not exceed `CFG.maxHueSpeed` (i.e., ≤ 10°/s)

**Validates: Requirements 4.2, 4.4, 4.5, 4.7**

---

### Property 8: Transformation Easter Egg Round-Trip

*For any* valid transformation easter egg ID `id`, calling `handleTransform(id)` twice in succession SHALL leave all `CFG` parameters and color variables in a state identical to their values before the first call (i.e., the transform is its own inverse).

**Validates: Requirements 6.4, 6.5**

---

### Property 9: At Most One Active Transformation

*For any* two distinct valid transformation IDs `id1` and `id2`, after calling `handleTransform(id1)` followed by `handleTransform(id2)`, the `activeTransform` variable SHALL equal `id2` and SHALL NOT equal `id1`.

**Validates: Requirements 6.6**

---

### Property 10: Easter Egg Trigger Uniqueness

*For any* canvas page's `TRIGGERS` registry, all trigger values (single keys and key sequences) SHALL be pairwise distinct — no two easter eggs on the same page SHALL share the same trigger key or key sequence.

**Validates: Requirements 7.5**

---

### Property 11: Control Panel Toggle Round-Trip

*For any* initial panel visibility state `v`, calling `handlePanelToggle()` twice SHALL result in the panel returning to visibility state `v` (i.e., the toggle is its own inverse).

**Validates: Requirements 8.5**

---

## Error Handling

### Canvas Unavailability

```javascript
const canvas = document.getElementById('c')
if (!canvas || !canvas.getContext) {
  document.body.innerHTML = '<p style="color:#00ff99;font-family:monospace;padding:2rem">Canvas not supported.</p>'
  return
}
```

### d3-delaunay CDN Failure (Voronoi page)

If the CDN script fails to load, `Delaunay` will be undefined. The Voronoi page guards against this:

```javascript
if (typeof Delaunay === 'undefined') {
  ctx.fillStyle = '#00ff99'
  ctx.font = '1rem monospace'
  ctx.fillText('Voronoi library failed to load.', 20, 40)
  return
}
```

### Degenerate Voronoi Cells

`voronoi.cellPolygon(i)` can return `null` for degenerate configurations (e.g., duplicate seed positions). The draw loop skips null cells:

```javascript
const cell = voronoi.cellPolygon(i)
if (!cell) continue
```

### Resize During Animation

The resize handler uses a debounce of 100ms to avoid thrashing canvas dimensions during continuous resize events:

```javascript
let resizeTimer = null
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(resize, 100)
})
```

### Easter Egg Key Buffer Overflow

The key buffer is capped at 20 entries to prevent unbounded growth from rapid key presses:

```javascript
if (keyBuffer.length > 20) keyBuffer.shift()
```

### Animation Loop Timing

`dt` is clamped to a maximum of 100ms to prevent large position jumps after tab switching or browser throttling:

```javascript
const dt = Math.min(timestamp - lastTimestamp, 100)
```

---

## Testing Strategy

### Overview

This feature uses a dual testing approach: example-based unit tests for specific behaviors and property-based tests for universal invariants. The JavaScript simulation logic is tested using **fast-check** (a property-based testing library for JavaScript/TypeScript) running in Node.js via Jest.

### Test File Structure

```
tests/
├── test_hello.py              (existing — extend with new route tests)
├── js/
│   ├── boids.test.js          (boids unit + property tests)
│   ├── voronoi.test.js        (voronoi unit + property tests)
│   ├── aurora.test.js         (aurora unit + property tests)
│   └── easter_eggs.test.js    (easter egg system tests)
```

### Python Tests (pytest)

Extend `tests/test_hello.py` with:

```python
# Route existence and HTTP 200
def test_boids_route_returns_200(client):
    assert client.get('/boids').status_code == 200

def test_voronoi_route_returns_200(client):
    assert client.get('/voronoi').status_code == 200

def test_aurora_route_returns_200(client):
    assert client.get('/aurora').status_code == 200

# Unique page markers (Requirement 9.1–9.3)
def test_boids_page_marker(client):
    assert b'data-page="boids"' in client.get('/boids').data

def test_voronoi_page_marker(client):
    assert b'data-page="voronoi"' in client.get('/voronoi').data

def test_aurora_page_marker(client):
    assert b'data-page="aurora"' in client.get('/aurora').data

# PAGES list has 8 entries (Requirement 1.1)
def test_pages_list_has_8_entries():
    from hello import PAGES
    assert len(PAGES) == 8
    assert 'pages/boids.html' in PAGES
    assert 'pages/voronoi.html' in PAGES
    assert 'pages/aurora.html' in PAGES
```

### JavaScript Property-Based Tests (fast-check + Jest)

**Library:** [fast-check](https://fast-check.dev/) — a mature property-based testing library for JavaScript.

Each property test runs a minimum of **100 iterations** (fast-check default is 100; set `numRuns: 100` explicitly).

The simulation functions are extracted into importable modules (or the test file re-implements the pure functions) to enable Node.js testing without a browser.

#### Property 1: Boid Speed Cap

```javascript
// Feature: interactive-art-pages, Property 1: Boid speed cap invariant
test('boid speed never exceeds maxSpeed after update', () => {
  fc.assert(fc.property(
    fc.array(fc.record({
      x: fc.float({ min: 0, max: 800 }),
      y: fc.float({ min: 0, max: 600 }),
      vx: fc.float({ min: -20, max: 20 }),
      vy: fc.float({ min: -20, max: 20 }),
    }), { minLength: 1, maxLength: 50 }),
    fc.float({ min: 1, max: 8 }),  // maxSpeed
    (boids, maxSpeed) => {
      const cfg = { ...DEFAULT_CFG, maxSpeed }
      updateBoids(boids, cfg, 16.67, null, 800, 600)
      return boids.every(b => Math.hypot(b.vx, b.vy) <= maxSpeed + 1e-9)
    }
  ), { numRuns: 100 })
})
```

#### Property 3: Toroidal Edge Wrapping

```javascript
// Feature: interactive-art-pages, Property 3: Toroidal edge wrapping
test('wrapEdges always produces in-bounds position', () => {
  fc.assert(fc.property(
    fc.float({ min: -10000, max: 10000 }),
    fc.float({ min: -10000, max: 10000 }),
    fc.float({ min: 100, max: 2000 }),   // W
    fc.float({ min: 100, max: 2000 }),   // H
    (x, y, W, H) => {
      const boid = { x, y, vx: 0, vy: 0 }
      wrapEdges(boid, W, H)
      return boid.x >= 0 && boid.x < W && boid.y >= 0 && boid.y < H
    }
  ), { numRuns: 100 })
})
```

#### Property 4: Voronoi Hue Spacing

```javascript
// Feature: interactive-art-pages, Property 4: Voronoi hue spacing
test('assignHues produces hues spaced ≥ 25° apart', () => {
  fc.assert(fc.property(
    fc.integer({ min: 12, max: 40 }),
    (count) => {
      const hues = assignHues(count)
      for (let i = 0; i < hues.length; i++) {
        for (let j = i + 1; j < hues.length; j++) {
          const diff = Math.abs(hues[i] - hues[j])
          const circDist = Math.min(diff, 360 - diff)
          if (circDist < 25) return false
        }
      }
      return true
    }
  ), { numRuns: 100 })
})
```

#### Property 7: Ribbon Parameter Bounds

```javascript
// Feature: interactive-art-pages, Property 7: Ribbon parameter bounds invariant
test('ribbon parameters stay within bounds after many updates', () => {
  fc.assert(fc.property(
    fc.record({
      amplitude: fc.float({ min: 0.05, max: 0.20 }),
      ampTarget:  fc.float({ min: 0.05, max: 0.20 }),
      frequency:  fc.float({ min: 0.5,  max: 3.0  }),
      freqTarget: fc.float({ min: 0.5,  max: 3.0  }),
      opacity:    fc.float({ min: 0.15, max: 0.55 }),
      thickness:  fc.float({ min: 0.08, max: 0.18 }),
      hue:        fc.float({ min: 0,    max: 360   }),
      hueSpeed:   fc.float({ min: 0,    max: 10    }),
      phase:      fc.float({ min: 0,    max: 6.28  }),
      phaseSpeed: fc.float({ min: 0.5,  max: 3.0   }),
      baseY:      fc.float({ min: 0,    max: 1     }),
    }),
    fc.integer({ min: 1, max: 200 }),  // number of update steps
    fc.float({ min: 8, max: 50 }),     // dt per step (ms)
    (ribbon, steps, dt) => {
      for (let i = 0; i < steps; i++) updateRibbon(ribbon, dt, DEFAULT_CFG)
      return (
        ribbon.amplitude >= 0.05 - 1e-9 && ribbon.amplitude <= 0.20 + 1e-9 &&
        ribbon.frequency >= 0.5  - 1e-9 && ribbon.frequency <= 3.0  + 1e-9 &&
        ribbon.opacity   >= 0.15 - 1e-9 && ribbon.opacity   <= 0.55 + 1e-9 &&
        ribbon.thickness >= 0.08 - 1e-9
      )
    }
  ), { numRuns: 100 })
})
```

#### Property 8: Transformation Easter Egg Round-Trip

```javascript
// Feature: interactive-art-pages, Property 8: Transformation easter egg round-trip
test('triggering a transform twice restores original CFG', () => {
  fc.assert(fc.property(
    fc.constantFrom(...Object.keys(TRANSFORMS)),
    (id) => {
      const cfg = { ...DEFAULT_CFG }
      const state = { activeTransform: null, savedCFG: null, fillColor: '#00ff99' }
      const before = JSON.stringify(cfg)
      handleTransform(id, cfg, state)
      handleTransform(id, cfg, state)
      return JSON.stringify(cfg) === before && state.activeTransform === null
    }
  ), { numRuns: 100 })
})
```

#### Property 9: At Most One Active Transformation

```javascript
// Feature: interactive-art-pages, Property 9: At most one active transformation
test('triggering id2 while id1 is active leaves only id2 active', () => {
  const ids = Object.keys(TRANSFORMS)
  fc.assert(fc.property(
    fc.constantFrom(...ids),
    fc.constantFrom(...ids).filter((id2, ctx) => id2 !== ctx.id1),  // distinct
    (id1, id2) => {
      fc.pre(id1 !== id2)
      const cfg = { ...DEFAULT_CFG }
      const state = { activeTransform: null, savedCFG: null, fillColor: '#00ff99' }
      handleTransform(id1, cfg, state)
      handleTransform(id2, cfg, state)
      return state.activeTransform === id2
    }
  ), { numRuns: 100 })
})
```

#### Property 10: Trigger Uniqueness

```javascript
// Feature: interactive-art-pages, Property 10: Easter egg trigger uniqueness
test('all easter egg triggers on a page are distinct', () => {
  for (const triggers of [BOIDS_TRIGGERS, VORONOI_TRIGGERS, AURORA_TRIGGERS]) {
    const keys = Object.values(triggers).map(t =>
      t.type === 'sequence' ? t.keys.join(',') : t.key ?? t.type
    )
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  }
})
```

#### Property 11: Control Panel Toggle Round-Trip

```javascript
// Feature: interactive-art-pages, Property 11: Control panel toggle round-trip
test('toggling panel twice returns to original visibility', () => {
  fc.assert(fc.property(
    fc.boolean(),
    (initialVisible) => {
      const panel = { hidden: !initialVisible }
      let visible = initialVisible
      const toggle = () => { visible = !visible; panel.hidden = !visible }
      toggle(); toggle()
      return visible === initialVisible
    }
  ), { numRuns: 100 })
})
```

### Unit Tests (Example-Based)

Key example-based tests to complement the property tests:

- `/boids`, `/voronoi`, `/aurora` routes return HTTP 200 with correct `data-page` markers
- `PAGES` list has exactly 8 entries
- `initBoids()` creates between 80 and 200 boids
- `initRibbons()` creates ≥ 5 ribbons with evenly spaced `baseY` values
- `drawBoid()` with mocked canvas context produces correct triangle geometry
- Control panel slider input event updates `CFG` synchronously
- Key sequence buffer resets after 3-second timeout
- `handleTransition(url)` sets `window.location.href` to the target URL

### Performance Testing

Performance requirements (2.7, 3.6, 4.6) are not covered by unit tests. They should be validated manually in a desktop browser with the DevTools Performance panel, or via a Playwright test that measures `requestAnimationFrame` timing over 5 seconds and asserts average frame time ≤ 33ms.

---

## ASCII Page Easter Egg System

The five existing ASCII pages (page1–page5) each get a small inline `<script>` block added directly to their template. No changes to `base.html` are needed — each page manages its own easter egg independently. All effects are purely DOM/CSS manipulations on the `<pre>` element and surrounding page; no canvas is involved.

### Shared Infrastructure

A tiny shared utility is inlined at the top of each ASCII page's script block:

```javascript
// Shared key sequence buffer (per-page, not shared across pages)
const _buf = []
let _bufTimer = null
function _onKey(e) {
  _buf.push(e.key)
  if (_buf.length > 20) _buf.shift()
  clearTimeout(_bufTimer)
  _bufTimer = setTimeout(() => _buf.length = 0, 3000)
  _checkTriggers(e)
}
document.addEventListener('keydown', _onKey)
```

Each page then defines its own `_checkTriggers(e)` function and click/hover handlers.

### Approach: Character-Level Manipulation

For transformation effects, the ASCII art `<pre>` text is split into individual `<span>` elements per character on page load, enabling per-character CSS animations and color changes:

```javascript
function _spanify(pre) {
  const text = pre.textContent
  pre.textContent = ''
  for (const ch of text) {
    const s = document.createElement('span')
    s.textContent = ch
    s.dataset.orig = ch
    pre.appendChild(s)
  }
}
```

This is called once on `DOMContentLoaded` for pages that use character-level effects.

---

### Page 1 — "Hello World" Banner

**ASCII content:** Large block-letter "Hello World" text.

#### Easter Egg A — Glitch Mode
- **Trigger:** Triple-click anywhere on the page
- **Clue:** The letter `W` in "World" has a barely perceptible flicker (CSS animation, opacity 0.85→1.0, 4s cycle) that looks like a bad pixel
- **Effect:** All characters begin randomly swapping to other printable ASCII characters at 60ms intervals, then slowly reform back to the original text over 3 seconds. Color shifts from `#00ff99` to `#ff4444` during the glitch, then fades back.
- **Reset:** Triple-click again, or wait for the auto-reset after 4 seconds

```javascript
function _glitch(pre) {
  const spans = [...pre.querySelectorAll('span')]
  const originals = spans.map(s => s.dataset.orig)
  const glitchChars = '!@#$%^&*<>?/\\|[]{}~`'
  let frame = 0
  const iv = setInterval(() => {
    frame++
    spans.forEach((s, i) => {
      if (Math.random() < 0.3) {
        s.textContent = glitchChars[Math.floor(Math.random() * glitchChars.length)]
        s.style.color = `hsl(${Math.random()*360},100%,60%)`
      } else {
        s.textContent = originals[i]
        s.style.color = ''
      }
    })
    if (frame > 50) {  // ~3s at 60ms
      clearInterval(iv)
      spans.forEach((s, i) => { s.textContent = originals[i]; s.style.color = '' })
    }
  }, 60)
}
```

#### Easter Egg B — Typewriter Reveal
- **Trigger:** Key sequence `h` `e` `l` `l` `o` (within 3s)
- **Clue:** The tagline "Reload for a new greeting ↻" has a faint second line beneath it: `· · ·` rendered at `opacity: 0.15`, suggesting something is waiting
- **Effect:** The entire `<pre>` fades out, then each character types back in left-to-right at 30ms per character with a blinking cursor `_` at the insertion point. When complete, a hidden message appears below the art for 3 seconds: `"you found it"` in dim green, then fades.

#### Easter Egg C — Transition to Boids
- **Trigger:** Key `b` pressed while the page is visible
- **Clue:** None — this one is purely for the determined explorer
- **Effect:** Page fades to black over 400ms, then navigates to `/boids`

---

### Page 2 — Cat

**ASCII content:** ASCII cat with `~ Hello, World! ~` and `( from a cat )`.

#### Easter Egg A — Cat Speaks
- **Trigger:** Click directly on the cat's face (the `o   o` eyes line — detected via a transparent `<div>` overlay positioned over that line)
- **Clue:** The two `o` characters in the eyes line have `cursor: pointer` and a very faint `text-shadow: 0 0 3px #00ff99` (barely visible against the normal glow)
- **Effect:** The `( from a cat )` line cycles through a series of increasingly unhinged cat messages at 1.5s intervals: `( from a cat )` → `( meow? )` → `( MEOW )` → `( I AM THE CAT )` → `( hello world is mine )` → `( ...from a cat )`. After the full cycle it resets.

```javascript
const catLines = ['( from a cat )', '( meow? )', '( MEOW )', '( I AM THE CAT )', '( hello world is mine )', '( ...from a cat )']
let catIdx = 0
eyeOverlay.addEventListener('click', () => {
  catIdx = (catIdx + 1) % catLines.length
  // find and replace the caption span text
  captionSpan.textContent = catLines[catIdx]
})
```

#### Easter Egg B — Nyan Mode
- **Trigger:** Key sequence `n` `y` `a` `n` (within 3s)
- **Clue:** A single pixel-wide `·` character appears at the very end of the last line of the `<pre>`, at `opacity: 0.12`
- **Effect:** The page background cycles through rainbow hues (CSS `animation: hue-rotate 0.5s linear infinite` on `body`), the cat's color shifts to match, and a trail of `*` characters streams out to the right of the cat for 5 seconds, then everything resets.

#### Easter Egg C — Transition to Voronoi
- **Trigger:** Hold mouse still over the cat for 4 seconds
- **Clue:** The `~` characters in `~ Hello, World! ~` pulse very slowly (opacity 0.7→1.0, 3s cycle) — like a purring rhythm
- **Effect:** Fade to black, navigate to `/voronoi`

---

### Page 3 — Robot

**ASCII content:** ASCII robot with `ROBOT SAYS: Hello!`.

#### Easter Egg A — Robot Malfunction
- **Trigger:** Key sequence `e` `r` `r` `o` `r` (within 3s)
- **Clue:** The `[O]  [O]` eyes line has one eye rendered with a barely different character: `[O]  [0]` (zero vs letter O) — almost imperceptible at small font sizes
- **Effect:** The robot's text scrambles into error-code gibberish (`ERR_0x4F: HELLO.EXE NOT FOUND`, `REBOOTING...`, `KERNEL PANIC`, etc.) displayed line by line in red (`#ff4444`), then after 3 seconds the robot "reboots" and the original art fades back in with `ROBOT SAYS: Hello, again!`

#### Easter Egg B — Robot Dance
- **Trigger:** Double-click the robot body (the `|    | |    |` section — overlay div)
- **Clue:** The `|` characters in the arms section have a `title` attribute on their spans: `"..."` — visible on hover as a native browser tooltip
- **Effect:** The robot ASCII art shifts left and right by 8px alternately at 200ms intervals (CSS `transform: translateX`) for 2 seconds, simulating a robot dance. The caption changes to `ROBOT SAYS: 🕺` during the dance.

#### Easter Egg C — Transition to Aurora
- **Trigger:** Key `a` pressed while on this page
- **Clue:** None
- **Effect:** Fade to black, navigate to `/aurora`

---

### Page 4 — Space / Rocket

**ASCII content:** ASCII rocket/tree shape with `~ Hello from space! ~`.

#### Easter Egg A — Launch Sequence
- **Trigger:** Key sequence `3` `2` `1` (within 3s)
- **Clue:** A faint `▼` character sits below the rocket base at `opacity: 0.15`, suggesting thrust
- **Effect:** The rocket ASCII art translates upward via CSS `transform: translateY` animation over 1.5 seconds (moving from center to off the top of the viewport), while the background briefly flashes white then returns to dark. After the rocket exits, it reappears at the bottom and drifts back to center over 1 second.

```javascript
function _launch(pre) {
  pre.style.transition = 'transform 1.5s cubic-bezier(0.2, 0, 0.8, 1)'
  pre.style.transform = `translateY(-${window.innerHeight}px)`
  setTimeout(() => {
    pre.style.transition = 'none'
    pre.style.transform = `translateY(${window.innerHeight * 0.5}px)`
    requestAnimationFrame(() => {
      pre.style.transition = 'transform 1s ease-out'
      pre.style.transform = 'translateY(0)'
    })
  }, 1600)
}
```

#### Easter Egg B — Star Field
- **Trigger:** Click the `*` at the very top of the rocket (the apex character — overlay div)
- **Clue:** The apex `*` has `cursor: crosshair` and a slightly brighter glow than the rest
- **Effect:** 40 `*` characters are injected into the page as absolutely-positioned elements at random positions, each with a slow CSS twinkle animation (`opacity` 0.2→1.0 at random durations 1–4s). They persist until the next click anywhere, which removes them all.

#### Easter Egg C — Transition to Boids
- **Trigger:** Key `b` pressed while on this page
- **Clue:** None
- **Effect:** Fade to black, navigate to `/boids`

---

### Page 5 — Ship at Sea

**ASCII content:** ASCII sailing ship on waves with `Hello from the high seas!`.

#### Easter Egg A — Storm Mode
- **Trigger:** Key sequence `s` `t` `o` `r` `m` (within 3s)
- **Clue:** One of the `~~` wave segments in the bottom rows is rendered as `≈≈` (Unicode approximation sign) at `opacity: 0.6` — slightly different from the rest, like a deeper current
- **Effect:** The `~` wave characters in the bottom rows animate rapidly (each span gets a staggered CSS animation cycling through `~`, `^`, `≈`, `∿` at 150ms intervals). The ship body shifts up and down ±4px at 300ms intervals. The color shifts toward blue-white (`#aaddff`). Lasts 5 seconds then resets.

#### Easter Egg B — Message in a Bottle
- **Trigger:** Triple-click the ship hull (the `\___` bottom section — overlay div)
- **Clue:** The `~` characters in the very last wave row have a `title="..."` on their spans — a native tooltip that reads `"the sea keeps secrets"`
- **Effect:** A small "bottle" message fades in below the ship for 4 seconds: a `<div>` styled as a bordered box containing `📜 "hello from the other side"` in dim green, then fades out.

#### Easter Egg C — Transition to Aurora
- **Trigger:** Key `a` pressed while on this page
- **Clue:** None
- **Effect:** Fade to black, navigate to `/aurora`

---

### Requirements Update for ASCII Easter Eggs

The following requirement is added to cover the ASCII page easter egg system:

**Requirement 10: ASCII Page Easter Eggs**

Each of the five existing ASCII pages SHALL implement at least two easter eggs using inline JavaScript. The easter eggs SHALL include at least one interaction-triggered visual transformation and at least one keyboard-triggered effect per page. At least one clue per page SHALL be embedded in the ASCII art itself (a subtly different character, a faint appended symbol, or a `title` tooltip on a character span). The transition easter eggs on ASCII pages SHALL navigate to one of the three canvas pages.

---

### Implementation Notes

- The `_spanify()` call and event listener setup happen inside a `DOMContentLoaded` listener in each page's `<script>` block
- Overlay `<div>` elements for click targets are `position: absolute` with `pointer-events: all` and `background: transparent`, sized and positioned to cover specific lines of the `<pre>` using `getBoundingClientRect()` after the pre renders
- All CSS transitions and animations use `will-change: transform` or `will-change: opacity` to avoid layout thrashing
- The `base.html` tagline `<p class="tagline">` is left visible on ASCII pages (unlike canvas pages); easter egg clues that use the tagline area add a second `<p>` element below it
- No external libraries are used for ASCII page easter eggs — all vanilla JS and CSS
