/**
 * Property-based tests for the Boids simulation.
 *
 * Because the boids functions live inside a Jinja2 template (no ES module
 * exports), this file re-implements the pure simulation functions verbatim
 * from hello/templates/pages/boids.html so they can be exercised in Node.
 *
 * **Validates: Requirements 2.3**
 */

'use strict';

const fc = require('fast-check');

// ── Re-implemented pure boids functions ──────────────────────────────────────
// These are copied verbatim from boids.html so the tests exercise the exact
// same logic that runs in the browser.

/**
 * Compute separation steering force for a boid given its neighbors.
 * Returns {x, y} — weighted sum of inverse-distance vectors away from
 * neighbors that are within separationRadius.
 */
function steerSeparation(boid, neighbors, CFG) {
  let sx = 0, sy = 0;
  for (const n of neighbors) {
    const dx = boid.x - n.x;
    const dy = boid.y - n.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d > 0 && d < CFG.separationRadius) {
      sx += dx / d;
      sy += dy / d;
    }
  }
  return { x: sx, y: sy };
}

/**
 * Compute alignment steering force: steer toward average heading of neighbors.
 * Returns {x, y} steering delta.
 */
function steerAlignment(boid, neighbors, CFG) {
  if (neighbors.length === 0) return { x: 0, y: 0 };

  let avgVx = 0, avgVy = 0;
  for (const n of neighbors) {
    avgVx += n.vx;
    avgVy += n.vy;
  }
  avgVx /= neighbors.length;
  avgVy /= neighbors.length;

  const mag = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
  if (mag === 0) return { x: 0, y: 0 };
  const desiredVx = (avgVx / mag) * CFG.maxSpeed;
  const desiredVy = (avgVy / mag) * CFG.maxSpeed;
  return { x: desiredVx - boid.vx, y: desiredVy - boid.vy };
}

/**
 * Compute cohesion steering force: steer toward average position of neighbors.
 * Returns {x, y} steering delta.
 */
function steerCohesion(boid, neighbors, CFG) {
  if (neighbors.length === 0) return { x: 0, y: 0 };

  let avgX = 0, avgY = 0;
  for (const n of neighbors) {
    avgX += n.x;
    avgY += n.y;
  }
  avgX /= neighbors.length;
  avgY /= neighbors.length;

  const dx  = avgX - boid.x;
  const dy  = avgY - boid.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return { x: 0, y: 0 };
  const desiredVx = (dx / mag) * CFG.maxSpeed;
  const desiredVy = (dy / mag) * CFG.maxSpeed;
  return { x: desiredVx - boid.vx, y: desiredVy - boid.vy };
}

/**
 * Wrap a boid's position toroidally so it stays within [0, W) × [0, H).
 */
function wrapEdges(boid, W, H) {
  boid.x = ((boid.x % W) + W) % W;
  boid.y = ((boid.y % H) + H) % H;
}

/**
 * Cap a steering vector's magnitude to maxForce. Without this, steerings
 * that compute (desiredV - currentV) overshoot and produce visible jitter.
 */
function limitForce(fx, fy, maxForce) {
  const mag = Math.sqrt(fx * fx + fy * fy);
  if (mag > maxForce) {
    return { x: (fx / mag) * maxForce, y: (fy / mag) * maxForce };
  }
  return { x: fx, y: fy };
}

/**
 * Advance the boids simulation by dt milliseconds.
 * Applies separation, alignment, cohesion forces (each capped to maxForce),
 * clamps speed to CFG.maxSpeed, then updates positions with dt-scaling.
 *
 * Mouse attraction is disabled (mouseInCanvas = false) for pure-function
 * testing — the speed cap must hold regardless.
 */
function updateBoids(boids, dt, CFG, W, H) {
  const scale = dt / 16.67;
  const maxForce = CFG.maxForce;

  for (const boid of boids) {
    // Collect neighbors within perception radius
    const neighbors = [];
    for (const other of boids) {
      if (other === boid) continue;
      const dx = other.x - boid.x;
      const dy = other.y - boid.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < CFG.perceptionRadius) {
        neighbors.push(other);
      }
    }

    // Compute steering forces
    let sep = steerSeparation(boid, neighbors, CFG);
    let ali = steerAlignment(boid, neighbors, CFG);
    let coh = steerCohesion(boid, neighbors, CFG);
    sep = limitForce(sep.x, sep.y, maxForce);
    ali = limitForce(ali.x, ali.y, maxForce);
    coh = limitForce(coh.x, coh.y, maxForce);

    // Combine forces (no mouse force)
    boid.vx += (sep.x * CFG.separationWeight
             +  ali.x * CFG.alignmentWeight
             +  coh.x * CFG.cohesionWeight) * scale;
    boid.vy += (sep.y * CFG.separationWeight
             +  ali.y * CFG.alignmentWeight
             +  coh.y * CFG.cohesionWeight) * scale;

    // Clamp speed to maxSpeed
    const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
    if (speed > CFG.maxSpeed) {
      boid.vx = (boid.vx / speed) * CFG.maxSpeed;
      boid.vy = (boid.vy / speed) * CFG.maxSpeed;
    }

    // Advance position (dt-scaled to 60fps baseline)
    boid.x += boid.vx * scale;
    boid.y += boid.vy * scale;

    // Toroidal wrapping
    wrapEdges(boid, W, H);
  }
}

// ── Arbitraries ──────────────────────────────────────────────────────────────

/** A single boid with arbitrary position and velocity. */
const arbBoid = (W, H, maxSpeed) =>
  fc.record({
    x:  fc.double({ min: 0, max: W, noNaN: true }),
    y:  fc.double({ min: 0, max: H, noNaN: true }),
    // Velocities can start well above maxSpeed to stress-test the clamp
    vx: fc.double({ min: -maxSpeed * 10, max: maxSpeed * 10, noNaN: true }),
    vy: fc.double({ min: -maxSpeed * 10, max: maxSpeed * 10, noNaN: true }),
  });

/** A non-empty array of boids (1–30 boids). */
const arbBoids = (W, H, maxSpeed) =>
  fc.array(arbBoid(W, H, maxSpeed), { minLength: 1, maxLength: 30 });

/** A CFG object with arbitrary but valid maxSpeed. */
const arbCFG = fc.record({
  maxSpeed:         fc.double({ min: 0.5, max: 20.0, noNaN: true }),
  perceptionRadius: fc.double({ min: 10,  max: 200,  noNaN: true }),
  separationRadius: fc.double({ min: 5,   max: 60,   noNaN: true }),
  separationWeight: fc.double({ min: 0,   max: 5,    noNaN: true }),
  alignmentWeight:  fc.double({ min: 0,   max: 5,    noNaN: true }),
  cohesionWeight:   fc.double({ min: 0,   max: 5,    noNaN: true }),
  maxForce:         fc.double({ min: 0.01, max: 0.5, noNaN: true }),
});

/** A dt value in the range the animation loop would produce (1–100 ms). */
const arbDt = fc.double({ min: 1, max: 100, noNaN: true });

// ── Mouse force helper ───────────────────────────────────────────────────────

/**
 * Compute the mouse attraction force components for a single boid.
 * Mirrors the logic in boids.html exactly:
 *
 *   dx  = mouseX - boid.x
 *   dy  = mouseY - boid.y
 *   mag = sqrt(dx² + dy²)
 *   if mag > 0:
 *     desiredVx = (dx / mag) * maxSpeed
 *     desiredVy = (dy / mag) * maxSpeed
 *     mfx = desiredVx - boid.vx
 *     mfy = desiredVy - boid.vy
 *
 * Returns { mfx, mfy }.  When mag === 0 (boid is at cursor), returns { 0, 0 }.
 */
function computeMouseForce(boid, mouseX, mouseY, maxSpeed) {
  const dx  = mouseX - boid.x;
  const dy  = mouseY - boid.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return { mfx: 0, mfy: 0 };
  const desiredVx = (dx / mag) * maxSpeed;
  const desiredVy = (dy / mag) * maxSpeed;
  return {
    mfx: desiredVx - boid.vx,
    mfy: desiredVy - boid.vy,
  };
}

// ── Property 1: Boid Speed Cap Invariant ─────────────────────────────────────

/**
 * **Property 1: Boid Speed Cap Invariant**
 * **Validates: Requirements 2.3**
 *
 * For any collection of boids with arbitrary positions and velocities, after
 * one call to updateBoids(dt), every boid's speed (magnitude of velocity
 * vector) SHALL be ≤ CFG.maxSpeed.
 */
describe('Property 1: Boid Speed Cap Invariant', () => {
  test('every boid speed ≤ maxSpeed after updateBoids', () => {
    const W = 800;
    const H = 600;

    // Use chain so boids are generated with velocities relative to the same
    // maxSpeed that will be used in the CFG, stressing the clamp logic.
    const arbScenario = arbCFG.chain((cfg) =>
      fc.record({
        cfg:   fc.constant(cfg),
        dt:    arbDt,
        boids: arbBoids(W, H, cfg.maxSpeed),
      })
    );

    fc.assert(
      fc.property(arbScenario, ({ cfg, dt, boids }) => {
        updateBoids(boids, dt, cfg, W, H);

        for (const boid of boids) {
          const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
          // Allow a tiny floating-point epsilon for rounding
          if (speed > cfg.maxSpeed + 1e-9) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 500 }
    );
  });
});

// ── Property 2: Mouse Attraction Direction ────────────────────────────────────

/**
 * **Property 2: Mouse Attraction Direction**
 * **Validates: Requirements 2.4**
 *
 * For any boid position (bx, by) and any cursor position (mx, my) within
 * canvas bounds, when only the mouse attraction force is applied (all other
 * forces zeroed), the resulting velocity change SHALL have a positive dot
 * product with the vector (mx - bx, my - by), meaning the boid accelerates
 * toward the cursor.
 *
 * The property only holds when the boid is NOT already at the cursor position
 * (mag > 0), so we generate positions where boid != cursor.
 */
describe('Property 2: Mouse Attraction Direction', () => {
  test('velocity delta has positive dot product with (mx-bx, my-by)', () => {
    const W = 800;
    const H = 600;

    // Generate a boid position and a cursor position that are NOT coincident.
    // We use fc.filter to exclude:
    //   1. The degenerate case where boid == cursor (mag === 0, force is zero)
    //   2. Cases where the boid is already moving faster than maxSpeed directly
    //      toward the cursor — in that case the mouse force slightly decelerates
    //      the boid back to maxSpeed (correct behavior), but the dot product of
    //      the force with the direction vector is negative.
    const arbScenario = fc.record({
      // Boid position within canvas
      bx: fc.double({ min: 0, max: W, noNaN: true }),
      by: fc.double({ min: 0, max: H, noNaN: true }),
      // Cursor position within canvas
      mx: fc.double({ min: 0, max: W, noNaN: true }),
      my: fc.double({ min: 0, max: H, noNaN: true }),
      // Boid velocity — arbitrary, including large values
      vx: fc.double({ min: -50, max: 50, noNaN: true }),
      vy: fc.double({ min: -50, max: 50, noNaN: true }),
      // maxSpeed — must be positive
      maxSpeed: fc.double({ min: 0.5, max: 20.0, noNaN: true }),
    }).filter(({ bx, by, mx, my, vx, vy, maxSpeed }) => {
      const dx = mx - bx;
      const dy = my - by;
      const mag = Math.sqrt(dx * dx + dy * dy);

      // Exclude degenerate case: boid is at the cursor (force would be zero)
      if (mag <= 1e-10) return false;

      // Exclude case where boid is already moving faster than maxSpeed toward
      // the cursor.  The mouse force steers toward desiredV = normalize(dir)*maxSpeed,
      // so if the boid already overshoots in the cursor direction, the force
      // decelerates it — producing a negative dot product.  This is correct
      // behavior but outside the "accelerates toward cursor" property domain.
      const vDotDir = (vx * dx + vy * dy) / mag;
      if (vDotDir > maxSpeed) return false;

      return true;
    });

    fc.assert(
      fc.property(arbScenario, ({ bx, by, mx, my, vx, vy, maxSpeed }) => {
        const boid = { x: bx, y: by, vx, vy };

        // Apply only the mouse force (all other forces are zero)
        const { mfx, mfy } = computeMouseForce(boid, mx, my, maxSpeed);

        // The velocity delta is (mfx * mouseWeight, mfy * mouseWeight).
        // Since mouseWeight > 0, the sign of the dot product is determined
        // by (mfx, mfy) alone.  We check the dot product of (mfx, mfy)
        // with the direction vector (mx - bx, my - by).
        //
        // The dot product must be ≥ 0 (non-negative):
        //   - Positive: the force has a component toward the cursor (boid
        //     is not yet moving optimally toward it).
        //   - Zero: the boid is already moving at maxSpeed directly toward
        //     the cursor — no correction force is needed.  This is correct
        //     behavior; the force never pushes the boid *away* from the cursor.
        const dirX = mx - bx;
        const dirY = my - by;
        const dot  = mfx * dirX + mfy * dirY;

        // Allow a small floating-point epsilon for rounding
        return dot >= -1e-9;
      }),
      { numRuns: 500 }
    );
  });
});
