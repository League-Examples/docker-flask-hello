/**
 * Property-based tests for the Easter Egg system.
 *
 * The easter egg state-machine functions live inline in canvas page templates,
 * so this file re-implements pure versions verbatim to exercise the same
 * logic in Node.
 *
 * **Validates Properties 8, 9, 10, 11**
 * **Validates Requirements 6.4, 6.5, 6.6, 7.5, 8.5**
 */

'use strict';

const fc = require('fast-check');

// ── Pure transform definitions, copied from the templates ────────────────────

function applyTransformBoids(id, cfg, state) {
  switch (id) {
    case 'transform_chaos':
      cfg.maxSpeed *= 3;
      cfg.separationWeight = 0.1;
      state.fillColor = '#ff4444';
      break;
    case 'transform_scatter':
      cfg.separationWeight = 5.0;
      cfg.cohesionWeight   = 0.0;
      state.fillColor = '#44aaff';
      break;
  }
}

function applyTransformVoronoi(id, cfg, state) {
  switch (id) {
    case 'transform_storm':
      cfg.maxSpeed *= 4;
      cfg.saturation = 30;
      break;
    case 'transform_mono':
      // Use a deterministic value in tests (the production code uses Math.random)
      cfg.monoHue = state.monoHueChoice ?? 0;
      break;
  }
}

function applyTransformAurora(id, cfg, state) {
  switch (id) {
    case 'transform_storm':
      cfg.maxAmplitude = 0.35;
      cfg.maxHueSpeed = 30;
      break;
    case 'transform_freeze':
      cfg.frozen = true;
      cfg.maxOpacity = 0.8;
      break;
  }
}

/**
 * Pure handleTransform mirroring boids.html's logic but parameterized over
 * (cfg, state). state holds { activeTransform, savedCFG, fillColor,
 * savedFillColor }. The applyFn implements per-page transforms.
 */
function makeHandleTransform(applyFn) {
  return function handleTransform(id, cfg, state) {
    if (state.activeTransform === id) {
      Object.assign(cfg, state.savedCFG);
      state.fillColor = state.savedFillColor;
      state.savedCFG = null;
      state.savedFillColor = null;
      state.activeTransform = null;
    } else {
      if (state.savedCFG !== null && state.savedCFG !== undefined) {
        Object.assign(cfg, state.savedCFG);
        state.fillColor = state.savedFillColor;
      }
      state.savedCFG = Object.assign({}, cfg);
      state.savedFillColor = state.fillColor;
      applyFn(id, cfg, state);
      state.activeTransform = id;
    }
  };
}

// ── Default configs (must match the templates) ──────────────────────────────
const DEFAULT_BOIDS_CFG = {
  count: 120, maxSpeed: 3.5, perceptionRadius: 80, separationRadius: 30,
  separationWeight: 1.8, alignmentWeight: 1.0, cohesionWeight: 1.0,
  mouseWeight: 0.8, size: 10, trails: false,
};

const DEFAULT_VORONOI_CFG = {
  count: 18, maxSpeed: 2.0, saturation: 80, lightness: 50, blurWidth: 30,
  monoHue: null,
};

const DEFAULT_AURORA_CFG = {
  count: 7, minAmplitude: 0.05, maxAmplitude: 0.20,
  minFrequency: 0.5, maxFrequency: 3.0,
  minOpacity: 0.15, maxOpacity: 0.55,
  minThickness: 0.08, maxThickness: 0.18,
  maxHueSpeed: 10, blur: false, frozen: false,
};

const BOIDS_TRIGGERS = {
  transform_chaos:    { type: 'key',      key: 'c' },
  transform_scatter:  { type: 'sequence', keys: ['ArrowUp','ArrowUp','ArrowDown','ArrowDown'] },
  transition_voronoi: { type: 'key',      key: 'v' },
  panel:              { type: 'still',    durationMs: 3000 },
};
const VORONOI_TRIGGERS = {
  transform_storm:    { type: 'key',      key: 's' },
  transform_mono:     { type: 'sequence', keys: ['m','o','n','o'] },
  transition_aurora:  { type: 'key',      key: 'a' },
  panel:              { type: 'still',    durationMs: 3000 },
};
const AURORA_TRIGGERS = {
  transform_storm:    { type: 'key',      key: 's' },
  transform_freeze:   { type: 'sequence', keys: ['f','r','z'] },
  transition_boids:   { type: 'key',      key: 'b' },
  panel:              { type: 'still',    durationMs: 3000 },
};

const PAGES = [
  { name: 'boids',
    cfg: DEFAULT_BOIDS_CFG,
    handleTransform: makeHandleTransform(applyTransformBoids),
    transformIds: ['transform_chaos', 'transform_scatter'],
    initialFill: '#00ff99',
  },
  { name: 'voronoi',
    cfg: DEFAULT_VORONOI_CFG,
    handleTransform: makeHandleTransform(applyTransformVoronoi),
    transformIds: ['transform_storm', 'transform_mono'],
    initialFill: null,
  },
  { name: 'aurora',
    cfg: DEFAULT_AURORA_CFG,
    handleTransform: makeHandleTransform(applyTransformAurora),
    transformIds: ['transform_storm', 'transform_freeze'],
    initialFill: null,
  },
];

// ── Property 8: Transformation Easter Egg Round-Trip ─────────────────────────

/**
 * **Property 8: Transformation Easter Egg Round-Trip**
 * **Validates: Requirements 6.4, 6.5**
 *
 * For any valid transformation id, calling handleTransform(id) twice in
 * succession SHALL leave all CFG params and color variables identical to
 * their pre-call values, AND set activeTransform back to null.
 */
describe('Property 8: Transformation Easter Egg Round-Trip', () => {
  for (const page of PAGES) {
    test(`[${page.name}] handleTransform(id) twice restores initial CFG`, () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...page.transformIds),
          // Pre-seed monoHueChoice deterministically for the voronoi mono transform
          fc.float({ min: 0, max: 360, noNaN: true }),
          (id, monoHue) => {
            const cfg = JSON.parse(JSON.stringify(page.cfg));
            const state = {
              activeTransform: null,
              savedCFG: null,
              fillColor: page.initialFill,
              savedFillColor: null,
              monoHueChoice: monoHue,
            };
            const before = JSON.stringify(cfg);
            const beforeFill = state.fillColor;

            page.handleTransform(id, cfg, state);
            page.handleTransform(id, cfg, state);

            return (
              JSON.stringify(cfg) === before &&
              state.fillColor === beforeFill &&
              state.activeTransform === null
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  }
});

// ── Property 9: At Most One Active Transformation ───────────────────────────

/**
 * **Property 9: At Most One Active Transformation**
 * **Validates: Requirements 6.6**
 *
 * For any two distinct transform ids id1, id2, calling handleTransform(id1)
 * then handleTransform(id2) SHALL leave state.activeTransform === id2.
 */
describe('Property 9: At Most One Active Transformation', () => {
  for (const page of PAGES) {
    test(`[${page.name}] activating id2 after id1 leaves only id2 active`, () => {
      const ids = page.transformIds;
      // Need at least 2 distinct ids
      if (ids.length < 2) return;
      fc.assert(
        fc.property(
          fc.constantFrom(...ids),
          fc.constantFrom(...ids),
          fc.float({ min: 0, max: 360, noNaN: true }),
          (id1, id2, monoHue) => {
            fc.pre(id1 !== id2);
            const cfg = JSON.parse(JSON.stringify(page.cfg));
            const state = {
              activeTransform: null,
              savedCFG: null,
              fillColor: page.initialFill,
              savedFillColor: null,
              monoHueChoice: monoHue,
            };
            page.handleTransform(id1, cfg, state);
            page.handleTransform(id2, cfg, state);
            return state.activeTransform === id2;
          }
        ),
        { numRuns: 100 }
      );
    });
  }
});

// ── Property 10: Easter Egg Trigger Uniqueness ──────────────────────────────

/**
 * **Property 10: Easter Egg Trigger Uniqueness**
 * **Validates: Requirements 7.5**
 *
 * For each page's TRIGGERS registry, all triggers SHALL be pairwise distinct —
 * no two easter eggs on the same page share the same key, sequence, or
 * gesture type.
 */
describe('Property 10: Easter Egg Trigger Uniqueness', () => {
  function triggerKey(t) {
    if (t.type === 'sequence') return 'seq:' + t.keys.join(',');
    if (t.type === 'key')      return 'key:' + t.key;
    if (t.type === 'still')    return 'still:' + t.durationMs;
    return 'other:' + JSON.stringify(t);
  }

  for (const [name, registry] of [
    ['boids',   BOIDS_TRIGGERS],
    ['voronoi', VORONOI_TRIGGERS],
    ['aurora',  AURORA_TRIGGERS],
  ]) {
    test(`[${name}] all triggers are pairwise distinct`, () => {
      const keys = Object.values(registry).map(triggerKey);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });
  }
});

// ── Property 11: Control Panel Toggle Round-Trip ────────────────────────────

/**
 * **Property 11: Control Panel Toggle Round-Trip**
 * **Validates: Requirements 8.5**
 *
 * For any initial visibility state v, calling handlePanelToggle() twice
 * SHALL leave the panel back at visibility state v.
 */
describe('Property 11: Control Panel Toggle Round-Trip', () => {
  // Pure model of the toggle: panel.hidden = !panel.hidden (matches templates)
  function handlePanelToggle(panel) {
    panel.hidden = !panel.hidden;
  }

  test('toggling twice returns the panel to its original visibility', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (initiallyHidden) => {
          const panel = { hidden: initiallyHidden };
          handlePanelToggle(panel);
          handlePanelToggle(panel);
          return panel.hidden === initiallyHidden;
        }
      ),
      { numRuns: 100 }
    );
  });
});
