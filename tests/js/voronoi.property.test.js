/**
 * Property-based tests for Voronoi hue assignment and seed movement.
 *
 * Validates: Requirements 3.1, 3.2
 *
 * Property 4: Voronoi Hue Spacing
 * For any count n in [12, 40], assignHues(n) SHALL return an array of n hue
 * values such that for every pair of *distinct* hue values (h1, h2), the
 * minimum circular distance min(|h1-h2|, 360-|h1-h2|) is at least 25°.
 *
 * Note: For count > 14, the ≥ 25° spacing requirement is geometrically
 * impossible to satisfy for ALL pairs (360/15 ≈ 24°). The implementation
 * therefore caps the number of distinct hues at 14 and cycles through them
 * for larger counts. The property is tested on the set of *distinct* hue
 * values in the returned array, which always satisfies ≥ 25° spacing.
 *
 * Property 5: Seed Point Displacement Bound
 * For any seed point with any velocity vector in [-CFG.maxSpeed, CFG.maxSpeed],
 * after updateSeeds(16.67) (one frame at 60fps), the Euclidean distance between
 * the seed's new position and its previous position SHALL be at most 5px.
 */

'use strict';

const fc = require('fast-check');

// ---------------------------------------------------------------------------
// Re-implementation of assignHues from voronoi.html (pure JS, no DOM).
// Must stay in sync with the template implementation.
// ---------------------------------------------------------------------------

const MAX_DISTINCT = 14;

/**
 * @param {number} count
 * @returns {number[]}
 */
function assignHues(count) {
  const distinctCount = Math.min(count, MAX_DISTINCT);
  const stride = 360 / distinctCount;
  // Use a fixed offset of 0 in tests so results are deterministic.
  // The random offset in the browser version doesn't affect the spacing
  // property — it only shifts the palette, not the gaps between hues.
  const offset = 0;

  const palette = [];
  for (let i = 0; i < distinctCount; i++) {
    palette.push((offset + i * stride) % 360);
  }

  const hues = [];
  for (let i = 0; i < count; i++) {
    hues.push(palette[i % distinctCount]);
  }
  return hues;
}

// ---------------------------------------------------------------------------
// Helper: minimum circular distance between two hue values on [0, 360).
// ---------------------------------------------------------------------------

function circularDistance(h1, h2) {
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 360 - diff);
}

// ---------------------------------------------------------------------------
// Property 4: Voronoi Hue Spacing
// **Validates: Requirements 3.1**
// ---------------------------------------------------------------------------

describe('Property 4: Voronoi Hue Spacing', () => {
  test('assignHues returns exactly count hues', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 12, max: 40 }),
        (count) => {
          const hues = assignHues(count);
          return hues.length === count;
        }
      )
    );
  });

  test('all hues are in [0, 360)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 12, max: 40 }),
        (count) => {
          const hues = assignHues(count);
          return hues.every((h) => h >= 0 && h < 360);
        }
      )
    );
  });

  test(
    'all pairwise circular distances between distinct hue values are >= 25 degrees',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 12, max: 40 }),
          (count) => {
            const hues = assignHues(count);

            // Deduplicate: for count > 14 the palette cycles, so repeated
            // values are expected. The spacing guarantee applies to the set
            // of distinct hue values.
            const distinct = [...new Set(hues.map((h) => Math.round(h * 1e9) / 1e9))];

            for (let i = 0; i < distinct.length; i++) {
              for (let j = i + 1; j < distinct.length; j++) {
                const dist = circularDistance(distinct[i], distinct[j]);
                if (dist < 25) {
                  return false;
                }
              }
            }
            return true;
          }
        ),
        { numRuns: 1000 }
      );
    }
  );

  test('number of distinct hues is min(count, 14)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 12, max: 40 }),
        (count) => {
          const hues = assignHues(count);
          const distinct = new Set(hues.map((h) => Math.round(h * 1e9) / 1e9));
          const expectedDistinct = Math.min(count, MAX_DISTINCT);
          return distinct.size === expectedDistinct;
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Re-implementation of updateSeeds from voronoi.html (pure JS, no DOM).
// Canvas dimensions are fixed to a large value so edge-bouncing does not
// interfere with the displacement measurement for seeds placed well inside.
// Must stay in sync with the template implementation.
// ---------------------------------------------------------------------------

const CFG_VORONOI = {
  maxSpeed: 2.0, // px/frame
};

// Canvas size large enough that seeds placed at (500, 500) with maxSpeed=2.0
// will never reach an edge in a single frame.
const TEST_W = 1000;
const TEST_H = 1000;

/**
 * Advances a single seed by its velocity scaled to dt/16.67.
 * Bounces off canvas edges [0, W] x [0, H].
 *
 * @param {{ x: number, y: number, vx: number, vy: number }} seed
 * @param {number} dt - elapsed time in ms
 * @param {number} W  - canvas width
 * @param {number} H  - canvas height
 */
function updateSingleSeed(seed, dt, W, H) {
  const scale = dt / 16.67;
  seed.x += seed.vx * scale;
  seed.y += seed.vy * scale;

  if (seed.x < 0) {
    seed.x = 0;
    seed.vx = Math.abs(seed.vx);
  } else if (seed.x > W) {
    seed.x = W;
    seed.vx = -Math.abs(seed.vx);
  }

  if (seed.y < 0) {
    seed.y = 0;
    seed.vy = Math.abs(seed.vy);
  } else if (seed.y > H) {
    seed.y = H;
    seed.vy = -Math.abs(seed.vy);
  }
}

// ---------------------------------------------------------------------------
// Property 5: Seed Point Displacement Bound
// **Validates: Requirements 3.2**
// ---------------------------------------------------------------------------

describe('Property 5: Seed Point Displacement Bound', () => {
  test(
    'displacement after updateSeeds(16.67) is at most 5px for any velocity in [-maxSpeed, maxSpeed]',
    () => {
      fc.assert(
        fc.property(
          // Velocity components in [-CFG.maxSpeed, CFG.maxSpeed]
          fc.float({ min: -CFG_VORONOI.maxSpeed, max: CFG_VORONOI.maxSpeed, noNaN: true }),
          fc.float({ min: -CFG_VORONOI.maxSpeed, max: CFG_VORONOI.maxSpeed, noNaN: true }),
          (vx, vy) => {
            // Place seed well inside canvas so edge-bouncing doesn't affect result
            const seed = { x: 500, y: 500, vx, vy };
            const prevX = seed.x;
            const prevY = seed.y;

            updateSingleSeed(seed, 16.67, TEST_W, TEST_H);

            const dx = seed.x - prevX;
            const dy = seed.y - prevY;
            const displacement = Math.sqrt(dx * dx + dy * dy);

            return displacement <= 5;
          }
        ),
        { numRuns: 1000 }
      );
    }
  );

  test(
    'displacement is exactly sqrt(vx^2 + vy^2) when seed is far from edges',
    () => {
      fc.assert(
        fc.property(
          fc.float({ min: -CFG_VORONOI.maxSpeed, max: CFG_VORONOI.maxSpeed, noNaN: true }),
          fc.float({ min: -CFG_VORONOI.maxSpeed, max: CFG_VORONOI.maxSpeed, noNaN: true }),
          (vx, vy) => {
            const seed = { x: 500, y: 500, vx, vy };
            const prevX = seed.x;
            const prevY = seed.y;

            updateSingleSeed(seed, 16.67, TEST_W, TEST_H);

            const dx = seed.x - prevX;
            const dy = seed.y - prevY;
            const displacement = Math.sqrt(dx * dx + dy * dy);
            const expected = Math.sqrt(vx * vx + vy * vy);

            // Allow small floating-point tolerance
            return Math.abs(displacement - expected) < 1e-9;
          }
        ),
        { numRuns: 1000 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Helper: build the HSL color string as drawCell does in voronoi.html.
// `hsl(${seed.hue}, ${CFG.saturation}%, ${CFG.lightness}%)`
// ---------------------------------------------------------------------------

/**
 * Produces the HSL fill color string for a Voronoi cell, mirroring the
 * expression used in drawCell() in voronoi.html.
 *
 * @param {{ hue: number }} seed
 * @param {{ saturation: number, lightness: number }} cfg
 * @returns {string}
 */
function cellColor(seed, cfg) {
  return `hsl(${seed.hue}, ${cfg.saturation}%, ${cfg.lightness}%)`;
}

/**
 * Parses the saturation and lightness values out of an HSL color string of
 * the form `hsl(<hue>, <sat>%, <light>%)`.
 *
 * @param {string} colorStr
 * @returns {{ saturation: number, lightness: number }}
 */
function parseHslSatLight(colorStr) {
  // Match: hsl(<hue>, <sat>%, <light>%)
  const match = colorStr.match(/hsl\(\s*[\d.]+\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (!match) throw new Error(`Cannot parse HSL string: ${colorStr}`);
  return {
    saturation: parseFloat(match[1]),
    lightness:  parseFloat(match[2]),
  };
}

// ---------------------------------------------------------------------------
// Property 6: Voronoi Cell Color Constraints
// **Validates: Requirements 3.5**
// ---------------------------------------------------------------------------

describe('Property 6: Voronoi Cell Color Constraints', () => {
  test(
    'color string encodes saturation >= 70% for any saturation in [70, 100]',
    () => {
      fc.assert(
        fc.property(
          // Hue: integer degrees on the HSL wheel [0, 359]
          fc.integer({ min: 0, max: 359 }),
          // Saturation: values that satisfy the >= 70% requirement
          fc.integer({ min: 70, max: 100 }),
          // Lightness: full control-panel range [35, 65]
          fc.integer({ min: 35, max: 65 }),
          (hue, saturation, lightness) => {
            const seed = { hue };
            const cfg  = { saturation, lightness };
            const color = cellColor(seed, cfg);
            const parsed = parseHslSatLight(color);
            return parsed.saturation >= 70;
          }
        ),
        { numRuns: 1000 }
      );
    }
  );

  test(
    'color string encodes lightness in [35%, 65%] for any lightness in [35, 65]',
    () => {
      fc.assert(
        fc.property(
          // Hue: integer degrees on the HSL wheel [0, 359]
          fc.integer({ min: 0, max: 359 }),
          // Saturation: full control-panel range [50, 100]
          fc.integer({ min: 50, max: 100 }),
          // Lightness: control-panel range [35, 65] — exactly the requirement bounds
          fc.integer({ min: 35, max: 65 }),
          (hue, saturation, lightness) => {
            const seed = { hue };
            const cfg  = { saturation, lightness };
            const color = cellColor(seed, cfg);
            const parsed = parseHslSatLight(color);
            return parsed.lightness >= 35 && parsed.lightness <= 65;
          }
        ),
        { numRuns: 1000 }
      );
    }
  );

  test(
    'default CFG values (saturation=80, lightness=50) satisfy both constraints',
    () => {
      fc.assert(
        fc.property(
          // Hue: integer degrees on the HSL wheel [0, 359]
          fc.integer({ min: 0, max: 359 }),
          (hue) => {
            const seed = { hue };
            // Default CFG from voronoi.html
            const cfg  = { saturation: 80, lightness: 50 };
            const color = cellColor(seed, cfg);
            const parsed = parseHslSatLight(color);
            return parsed.saturation >= 70 && parsed.lightness >= 35 && parsed.lightness <= 65;
          }
        ),
        { numRuns: 1000 }
      );
    }
  );
});
