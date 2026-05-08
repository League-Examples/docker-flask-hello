# Requirements Document

## Introduction

This feature adds three interactive, algorithmic art pages to the existing Flask "Hello World" app. The app currently serves one of five static ASCII art pages at random on each reload. The new pages replace the static ASCII art with full-screen canvas animations — a Boids flocking simulation, a Voronoi soft-blob stained-glass pattern, and an Aurora Borealis ribbon effect — while preserving the existing dark/green-glow aesthetic and the random-page-on-reload behavior.

Each new page also includes a hidden easter egg system: subtle in-world clues hint at secret mouse/keyboard interactions that trigger visual transformations, page transitions, or a configuration control panel.

## Glossary

- **App**: The Flask web application defined in `hello/__init__.py`
- **Page**: A Jinja2 template that extends `base.html` and is randomly selected on each request to `/`
- **Canvas_Page**: A Page whose content is a full-screen HTML5 `<canvas>` element driven by vanilla JavaScript
- **Boids_Page**: The Canvas_Page implementing the Boids flocking simulation
- **Voronoi_Page**: The Canvas_Page implementing the Voronoi soft-blob stained-glass animation
- **Aurora_Page**: The Canvas_Page implementing the Aurora Borealis ribbon animation
- **Boid**: A single triangular agent in the Boids simulation subject to separation, alignment, and cohesion steering forces
- **Seed_Point**: A moving point in the Voronoi diagram whose nearest-neighbor regions define colored cells
- **Ribbon**: A sinusoidal color band in the Aurora animation
- **Easter_Egg**: A hidden interaction (mouse gesture, key sequence, or click target) that triggers a special effect
- **Transformation_Easter_Egg**: An Easter_Egg that alters colors, physics parameters, or visual behavior on the current page without navigating away
- **Transition_Easter_Egg**: An Easter_Egg that navigates the browser to a different art page
- **Control_Panel_Easter_Egg**: An Easter_Egg that reveals a floating configuration UI with sliders and toggles for the current simulation
- **Clue**: A subtle visual element embedded in a Canvas_Page that hints at the existence of an Easter_Egg without revealing the trigger
- **Control_Panel**: A floating overlay UI containing labeled sliders and toggles that modify live simulation parameters
- **PAGES**: The Python list in `hello/__init__.py` from which the App randomly selects a Page template path

---

## Requirements

### Requirement 1: Canvas Page Integration

**User Story:** As a visitor, I want the new interactive art pages to feel like a natural part of the existing app, so that the experience is seamless whether I land on an ASCII page or an animated canvas page.

#### Acceptance Criteria

1. THE App SHALL include the three Canvas_Pages (Boids_Page, Voronoi_Page, Aurora_Page) in the `PAGES` list alongside the existing five ASCII pages, for a total of 8 entries.
2. WHEN a request is made to `/`, THE App SHALL select one page uniformly at random from the `PAGES` list.
3. THE Boids_Page, Voronoi_Page, and Aurora_Page SHALL each extend `base.html` using the Jinja2 `{% extends %}` mechanism.
4. WHEN a Canvas_Page is rendered, THE Canvas_Page SHALL override the `content` block with a `<canvas>` element whose rendered width equals the viewport width in CSS pixels and whose rendered height equals the viewport height in CSS pixels, plus a `<script>` block containing all animation logic.
5. THE Canvas_Page MAY load JavaScript libraries from a CDN (e.g., p5.js, Three.js, d3-delaunay) via `<script>` tags; any such library SHALL be loaded from a versioned CDN URL so that the page remains reproducible.
6. WHEN a Canvas_Page is rendered, THE canvas element SHALL fill the full viewport with zero margin and zero padding, and the inherited tagline element from `base.html` SHALL NOT be visible.
7. WHEN the browser window is resized, THE Canvas_Page SHALL resize the canvas to match the new viewport dimensions, preserving the count, positions, and velocities of all simulation entities without restarting the simulation from scratch.
8. WHEN a Canvas_Page is rendered, THE Canvas_Page SHALL override the `body` element's flex layout, margin, padding, and overflow styles so that the canvas occupies the full viewport without scrollbars or centering offsets.

### Requirement 2: Boids Flocking Simulation

**User Story:** As a visitor, I want to watch a flock of triangular agents steer, separate, and align in real time, so that the page feels alive and responsive to my presence.

#### Acceptance Criteria

1. WHEN the Boids_Page is loaded, THE Boids_Page SHALL initialize a flock of between 80 and 200 Boid agents distributed randomly across the canvas.
2. WHEN the Boids_Page renders a Boid, THE Boids_Page SHALL draw it as a filled isosceles triangle at least 8px in length, oriented so that the apex points in the direction of the Boid's current velocity vector.
3. WHILE the Boids_Page is active, THE Boids_Page SHALL update each Boid's velocity each animation frame by applying separation (avoid neighbors within a perception radius of at most 50px), alignment (match average heading of neighbors), and cohesion (steer toward average position of neighbors) steering forces, each capped so that the resulting speed does not exceed a configurable maximum speed of at most 4px per frame at 60fps.
4. WHILE the Boids_Page is active AND the mouse cursor is within the canvas bounds, THE Boids_Page SHALL attract each Boid toward the current mouse cursor position using a cohesion-like force; IF the cursor is outside the canvas bounds, THE Boids_Page SHALL apply no mouse-attraction force.
5. WHEN a Boid's position coordinate exceeds a canvas edge, THE Boids_Page SHALL wrap that coordinate to the opposite edge so that the Boid re-enters the canvas without any discontinuity in velocity.
6. WHILE the Boids_Page is active, THE Boids_Page SHALL render each Boid triangle with a green fill color and a canvas `shadowBlur` glow effect using the same green hue, consistent with the app's green-glow aesthetic.
7. WHILE the Boids_Page is active, THE Boids_Page SHALL target 60 frames per second and SHALL NOT drop below 30 frames per second on a desktop browser with a hardware-accelerated GPU.

### Requirement 3: Voronoi Soft-Blob Stained-Glass Animation

**User Story:** As a visitor, I want to see a living stained-glass pattern of shifting colored regions, so that the page feels organic and meditative.

#### Acceptance Criteria

1. WHEN the Voronoi_Page is loaded, THE Voronoi_Page SHALL initialize at least 12 Seed_Points at random positions, each assigned a hue value such that no two Seed_Points share a hue within 25° of each other on the HSL color wheel.
2. WHILE the Voronoi_Page is active, THE Voronoi_Page SHALL move each Seed_Point along a smooth continuous path such that the Seed_Point's displacement per animation frame does not exceed 5px at a 60fps equivalent rate.
3. WHILE the Voronoi_Page is active, THE Voronoi_Page SHALL recompute and redraw the Voronoi diagram each animation frame so that region boundaries update continuously.
4. WHEN the Voronoi_Page renders a cell boundary, THE Voronoi_Page SHALL render a gradient transition zone of at least 20px width between adjacent cells, producing a soft blob-like appearance rather than a hard edge.
5. THE Voronoi_Page SHALL assign each cell a color with HSL saturation ≥ 70% and HSL lightness between 35% and 65%, producing saturated jewel tones that remain visible against the dark background.
6. WHILE the Voronoi_Page is active, THE Voronoi_Page SHALL target 60 frames per second and SHALL NOT drop below 30 frames per second on a desktop browser with a hardware-accelerated GPU.

### Requirement 4: Aurora Borealis Ribbon Animation

**User Story:** As a visitor, I want to watch shimmering ribbons of color ripple across the screen like a real aurora, so that the page evokes a sense of natural wonder.

#### Acceptance Criteria

1. WHEN the Aurora_Page is loaded, THE Aurora_Page SHALL initialize at least 5 Ribbons distributed at evenly spaced vertical positions across the canvas height.
2. WHILE the Aurora_Page is active, THE Aurora_Page SHALL animate each Ribbon as a sinusoidal wave whose amplitude varies between 5% and 20% of the canvas height and whose frequency varies between 0.5 and 3 full cycles across the canvas width, with both amplitude and frequency shifting continuously over time.
3. WHILE the Aurora_Page is active, THE Aurora_Page SHALL render each Ribbon with a vertical color gradient spanning aurora hues (greens, teals, purples, blues) using the canvas `createLinearGradient` API.
4. WHEN the Aurora_Page renders a Ribbon, THE Aurora_Page SHALL set the Ribbon's fill opacity to a value between 0.15 and 0.55 so that overlapping ribbons blend together naturally.
5. WHILE the Aurora_Page is active, THE Aurora_Page SHALL shift each Ribbon's base hue at a rate of no more than 10° per second on the HSL color wheel, producing a slowly evolving color palette.
6. WHILE the Aurora_Page is active, THE Aurora_Page SHALL target 60 frames per second and SHALL NOT drop below 30 frames per second on a desktop browser with a hardware-accelerated GPU.
7. WHEN the Aurora_Page renders a Ribbon, THE Aurora_Page SHALL draw the Ribbon as a filled polygon with a vertical extent of at least 8% of the canvas height so that each ribbon is visually distinct.

### Requirement 5: Easter Egg System — Clues

**User Story:** As a curious visitor, I want to notice subtle hints embedded in each art page, so that I feel rewarded for paying close attention without being told what to do.

#### Acceptance Criteria

1. THE Boids_Page SHALL render at least two Clues as canvas-drawn visual elements with a `globalAlpha` of at most 0.25 (e.g., a faintly different-colored Boid, a barely visible symbol drawn in a corner).
2. THE Voronoi_Page SHALL render at least two Clues as canvas-drawn visual elements with a `globalAlpha` of at most 0.25 (e.g., a cell that pulses at a different rhythm, a faint glyph near a Seed_Point).
3. THE Aurora_Page SHALL render at least two Clues as canvas-drawn visual elements with a `globalAlpha` of at most 0.25 (e.g., a dim star pattern that flickers in a recognizable shape, a ribbon segment with a slightly anomalous color).
4. WHEN a visitor hovers over a Clue element that is implemented as an HTML overlay (not drawn on canvas), THE Canvas_Page SHALL display a tooltip whose text describes a sensory or behavioral observation related to the Easter_Egg trigger without naming the trigger input directly (e.g., "something stirs when the flock is still" rather than "hold the mouse still for 5 seconds").
5. THE Clues SHALL be rendered at a `globalAlpha` of at most 0.25 or equivalent CSS opacity, ensuring they are not immediately apparent during normal viewing but are discoverable upon deliberate inspection.

### Requirement 6: Easter Egg System — Transformation Easter Eggs

**User Story:** As an explorer, I want secret interactions to visually transform the current art page, so that I feel like I've unlocked a hidden mode.

#### Acceptance Criteria

1. THE Boids_Page SHALL implement at least two Transformation_Easter_Eggs, each triggered by a distinct mouse or keyboard interaction that is not used by any other Easter_Egg on the same page.
2. THE Voronoi_Page SHALL implement at least two Transformation_Easter_Eggs, each triggered by a distinct mouse or keyboard interaction that is not used by any other Easter_Egg on the same page.
3. THE Aurora_Page SHALL implement at least two Transformation_Easter_Eggs, each triggered by a distinct mouse or keyboard interaction that is not used by any other Easter_Egg on the same page.
4. WHEN a Transformation_Easter_Egg is triggered, THE Canvas_Page SHALL produce an observable change in at least one of the following within 500ms: the rendered fill or stroke color of simulation entities, a physics parameter (e.g., speed cap, force weight, count), or the rendering style (e.g., shape, trail, blend mode).
5. WHEN a Transformation_Easter_Egg that is currently active is triggered again by the same input, THE Canvas_Page SHALL restore all altered parameters and colors to the values they held at initial page load.
6. WHEN a second Transformation_Easter_Egg is triggered while a different Transformation_Easter_Egg is already active on the same page, THE Canvas_Page SHALL deactivate the first and apply the second, so that at most one Transformation_Easter_Egg is active at any time.
7. IF a Transformation_Easter_Egg trigger is a key sequence, THEN THE Canvas_Page SHALL accept the complete sequence only if all keys are pressed within a 3-second rolling window; IF the window expires before the sequence is complete, THE Canvas_Page SHALL reset the input buffer.

### Requirement 7: Easter Egg System — Transition Easter Eggs

**User Story:** As an explorer, I want a secret interaction to whisk me to a completely different art page, so that discovery feels like teleportation.

#### Acceptance Criteria

1. THE Boids_Page SHALL implement at least one Transition_Easter_Egg triggered by a mouse or keyboard interaction that is distinct from all other Easter_Egg triggers on the Boids_Page.
2. THE Voronoi_Page SHALL implement at least one Transition_Easter_Egg triggered by a mouse or keyboard interaction that is distinct from all other Easter_Egg triggers on the Voronoi_Page.
3. THE Aurora_Page SHALL implement at least one Transition_Easter_Egg triggered by a mouse or keyboard interaction that is distinct from all other Easter_Egg triggers on the Aurora_Page.
4. WHEN a Transition_Easter_Egg is triggered, THE Canvas_Page SHALL navigate the browser to a dedicated URL for a Canvas_Page that is different from the currently displayed page within 500ms of the trigger event.
5. THE trigger interaction for each Transition_Easter_Egg SHALL be distinct from all Transformation_Easter_Egg and Control_Panel_Easter_Egg triggers on the same page.

### Requirement 8: Easter Egg System — Control Panel Easter Eggs

**User Story:** As a tinkerer, I want a secret interaction to reveal a configuration panel, so that I can tune the simulation to my liking.

#### Acceptance Criteria

1. THE Boids_Page SHALL implement at least one Control_Panel_Easter_Egg triggered by a mouse or keyboard interaction distinct from all other Easter_Egg triggers on the Boids_Page.
2. THE Voronoi_Page SHALL implement at least one Control_Panel_Easter_Egg triggered by a mouse or keyboard interaction distinct from all other Easter_Egg triggers on the Voronoi_Page.
3. THE Aurora_Page SHALL implement at least one Control_Panel_Easter_Egg triggered by a mouse or keyboard interaction distinct from all other Easter_Egg triggers on the Aurora_Page.
4. WHEN a Control_Panel_Easter_Egg is triggered and the Control_Panel is not currently visible, THE Canvas_Page SHALL make the Control_Panel visible within 300ms.
5. WHEN a Control_Panel_Easter_Egg is triggered and the Control_Panel is already visible, THE Canvas_Page SHALL hide the Control_Panel (toggle behavior).
6. THE Control_Panel SHALL contain at least three controls, each consisting of a visible text label and either a range slider or a toggle, where each control maps to a distinct live simulation parameter.
7. WHEN a Control_Panel slider or toggle value changes, THE Canvas_Page SHALL apply the new parameter value to the running simulation within one animation frame (≤ 16ms at 60fps).
8. THE Control_Panel SHALL include a visible close button; WHEN the close button is clicked, THE Canvas_Page SHALL hide the Control_Panel.
9. THE Control_Panel SHALL have a background color of `#1a1a2e` or darker, text and border colors in the green hue family (`#00ff99` or similar), and SHALL NOT use any external CSS framework.

### Requirement 9: Dedicated Routes for Canvas Pages

**User Story:** As a developer or returning visitor, I want stable URLs for each interactive art page, so that I can link directly to a specific animation.

#### Acceptance Criteria

1. THE App SHALL register a `/boids` route whose response body contains a unique string marker (e.g., `data-page="boids"`) that identifies it as the Boids_Page.
2. THE App SHALL register a `/voronoi` route whose response body contains a unique string marker (e.g., `data-page="voronoi"`) that identifies it as the Voronoi_Page.
3. THE App SHALL register a `/aurora` route whose response body contains a unique string marker (e.g., `data-page="aurora"`) that identifies it as the Aurora_Page.
4. WHEN any of the dedicated Canvas_Page routes is requested, THE App SHALL return an HTTP 200 response.
5. THE existing `/` route SHALL continue to select a page uniformly at random from the full `PAGES` list of 8 entries.
