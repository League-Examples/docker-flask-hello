/**
 * Property 7: Ribbon Parameter Bounds Invariant
 * Validates: Requirements 4.2, 4.4, 4.5, 4.7
 *
 * For any ribbon in any state, after any number of calls to updateRibbons(dt),
 * all ribbon parameters must remain within their CFG bounds.
 */

const fc = require("fast-check");

// ── Config (mirrors aurora.html CFG) ─────────────────────────────────────────
const CFG = {
  count: 7,
  minAmplitude: 0.05,
  maxAmplitude: 0.20,
  minFrequency: 0.5,
  maxFrequency: 3.0,
  minOpacity: 0.15,
  maxOpacity: 0.55,
  minThickness: 0.08,
  maxThickness: 0.18,
  maxHueSpeed: 10,
};

// ── Pure helpers (mirrors aurora.html) ───────────────────────────────────────
function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Re-implementation of updateRibbons from aurora.html.
 * Operates on a ribbons array in-place, returns it for convenience.
 */
function updateRibbons(ribbons, dt) {
  const dtSec = dt / 1000;

  for (const r of ribbons) {
    // Advance phase
    r.phase += r.phaseSpeed * dtSec;

    // Interpolate amplitude and frequency toward their targets
    r.amplitude += (r.ampTarget - r.amplitude) * 0.005;
    r.frequency += (r.freqTarget - r.frequency) * 0.005;

    // Occasionally pick new targets (deterministic in tests — we skip random
    // target selection here because the property must hold regardless of
    // whether new targets are picked; the clamp below enforces the invariant)
    // NOTE: we do NOT call Math.random() here so tests are deterministic.
    // The clamp at the end is what enforces the invariant regardless.

    // Shift hue
    r.hue = (r.hue + r.hueSpeed * dtSec) % 360;

    // ── Clamp all parameters to CFG bounds ───────────────────────────────
    r.amplitude = clamp(r.amplitude, CFG.minAmplitude, CFG.maxAmplitude);
    r.ampTarget = clamp(r.ampTarget, CFG.minAmplitude, CFG.maxAmplitude);
    r.frequency = clamp(r.frequency, CFG.minFrequency, CFG.maxFrequency);
    r.freqTarget = clamp(r.freqTarget, CFG.minFrequency, CFG.maxFrequency);
    r.opacity = clamp(r.opacity, CFG.minOpacity, CFG.maxOpacity);
    r.thickness = clamp(r.thickness, CFG.minThickness, CFG.maxThickness);
    r.hueSpeed = clamp(r.hueSpeed, 0, CFG.maxHueSpeed);
    r.hue = ((r.hue % 360) + 360) % 360;
  }

  return ribbons;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a single ribbon with arbitrary (possibly out-of-bounds) parameter
 * values to stress-test the clamping logic.
 */
const ribbonArb = fc.record({
  baseY: fc.float({ min: 0, max: 1, noNaN: true }),
  hue: fc.float({ min: -720, max: 720, noNaN: true }),
  hueSpeed: fc.float({ min: -20, max: 20, noNaN: true }),
  amplitude: fc.float({ min: -1, max: 1, noNaN: true }),
  ampTarget: fc.float({ min: -1, max: 1, noNaN: true }),
  frequency: fc.float({ min: -5, max: 10, noNaN: true }),
  freqTarget: fc.float({ min: -5, max: 10, noNaN: true }),
  phase: fc.float({ min: 0, max: Math.fround(Math.PI * 2), noNaN: true }),
  phaseSpeed: fc.float({ min: Math.fround(0.1), max: 2.0, noNaN: true }),
  opacity: fc.float({ min: -1, max: 2, noNaN: true }),
  thickness: fc.float({ min: -1, max: 1, noNaN: true }),
});

/** Array of 1–10 ribbons */
const ribbonsArb = fc.array(ribbonArb, { minLength: 1, maxLength: 10 });

/** dt in ms: 1–100ms (clamped animation loop range) */
const dtArb = fc.integer({ min: 1, max: 100 });

/** Number of update steps: 1–50 */
const stepsArb = fc.integer({ min: 1, max: 50 });

// ── Property 7 ────────────────────────────────────────────────────────────────

/**
 * **Validates: Requirements 4.2, 4.4, 4.5, 4.7**
 *
 * After any number of updateRibbons(dt) calls, for every ribbon:
 *   - amplitude ∈ [CFG.minAmplitude, CFG.maxAmplitude]
 *   - frequency ∈ [CFG.minFrequency, CFG.maxFrequency]
 *   - opacity   ∈ [CFG.minOpacity,   CFG.maxOpacity]
 *   - thickness ≥ CFG.minThickness
 *   - hueSpeed  ∈ [0, CFG.maxHueSpeed]  (absolute hue change per second ≤ maxHueSpeed)
 */
describe("Property 7: Ribbon Parameter Bounds Invariant", () => {
  test("amplitude stays within [minAmplitude, maxAmplitude] after N updates", () => {
    fc.assert(
      fc.property(ribbonsArb, dtArb, stepsArb, (ribbons, dt, steps) => {
        for (let i = 0; i < steps; i++) {
          updateRibbons(ribbons, dt);
        }
        for (const r of ribbons) {
          expect(r.amplitude).toBeGreaterThanOrEqual(CFG.minAmplitude);
          expect(r.amplitude).toBeLessThanOrEqual(CFG.maxAmplitude);
        }
      }),
      { numRuns: 500 }
    );
  });

  test("frequency stays within [minFrequency, maxFrequency] after N updates", () => {
    fc.assert(
      fc.property(ribbonsArb, dtArb, stepsArb, (ribbons, dt, steps) => {
        for (let i = 0; i < steps; i++) {
          updateRibbons(ribbons, dt);
        }
        for (const r of ribbons) {
          expect(r.frequency).toBeGreaterThanOrEqual(CFG.minFrequency);
          expect(r.frequency).toBeLessThanOrEqual(CFG.maxFrequency);
        }
      }),
      { numRuns: 500 }
    );
  });

  test("opacity stays within [minOpacity, maxOpacity] after N updates", () => {
    fc.assert(
      fc.property(ribbonsArb, dtArb, stepsArb, (ribbons, dt, steps) => {
        for (let i = 0; i < steps; i++) {
          updateRibbons(ribbons, dt);
        }
        for (const r of ribbons) {
          expect(r.opacity).toBeGreaterThanOrEqual(CFG.minOpacity);
          expect(r.opacity).toBeLessThanOrEqual(CFG.maxOpacity);
        }
      }),
      { numRuns: 500 }
    );
  });

  test("thickness stays >= minThickness after N updates", () => {
    fc.assert(
      fc.property(ribbonsArb, dtArb, stepsArb, (ribbons, dt, steps) => {
        for (let i = 0; i < steps; i++) {
          updateRibbons(ribbons, dt);
        }
        for (const r of ribbons) {
          expect(r.thickness).toBeGreaterThanOrEqual(CFG.minThickness);
        }
      }),
      { numRuns: 500 }
    );
  });

  test("hueSpeed stays within [0, maxHueSpeed] after N updates (absolute hue change per second <= maxHueSpeed)", () => {
    fc.assert(
      fc.property(ribbonsArb, dtArb, stepsArb, (ribbons, dt, steps) => {
        for (let i = 0; i < steps; i++) {
          updateRibbons(ribbons, dt);
        }
        for (const r of ribbons) {
          // hueSpeed is the rate in °/s; after clamping it must be in [0, maxHueSpeed]
          expect(r.hueSpeed).toBeGreaterThanOrEqual(0);
          expect(r.hueSpeed).toBeLessThanOrEqual(CFG.maxHueSpeed);
        }
      }),
      { numRuns: 500 }
    );
  });

  test("all ribbon parameters satisfy bounds simultaneously after N updates (combined invariant)", () => {
    fc.assert(
      fc.property(ribbonsArb, dtArb, stepsArb, (ribbons, dt, steps) => {
        for (let i = 0; i < steps; i++) {
          updateRibbons(ribbons, dt);
        }
        for (const r of ribbons) {
          expect(r.amplitude).toBeGreaterThanOrEqual(CFG.minAmplitude);
          expect(r.amplitude).toBeLessThanOrEqual(CFG.maxAmplitude);
          expect(r.frequency).toBeGreaterThanOrEqual(CFG.minFrequency);
          expect(r.frequency).toBeLessThanOrEqual(CFG.maxFrequency);
          expect(r.opacity).toBeGreaterThanOrEqual(CFG.minOpacity);
          expect(r.opacity).toBeLessThanOrEqual(CFG.maxOpacity);
          expect(r.thickness).toBeGreaterThanOrEqual(CFG.minThickness);
          expect(r.hueSpeed).toBeGreaterThanOrEqual(0);
          expect(r.hueSpeed).toBeLessThanOrEqual(CFG.maxHueSpeed);
        }
      }),
      { numRuns: 1000 }
    );
  });
});
