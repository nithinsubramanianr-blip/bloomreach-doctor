/**
 * M1 Bloomreach Integration Layer — Jest tests (node project).
 *
 * Coverage:
 *   1. All 5 dimension fetchers return correct schema from the synthetic path
 *   2. NormaliserError thrown when normaliseDimension called with missing
 *      dimension_id (or wrong-type)
 *   3. fetchAllDimensions() returns array of exactly 5 items in canonical order
 *   4. searchProducts returns a non-empty list for query "necklace" (synthetic)
 *   5. rule-manager returns read-only activation state
 *
 * Spec: specs/002-bloomreach-integration/
 * Synthetic fallback is the only tested path — sandbox credentials unavailable.
 */

'use strict';

const path = require('path');

const M1_DIR = path.join(__dirname, '..', '..', 'src', 'm1-bloomreach');

const { normaliseDimension, NormaliserError } = require(path.join(M1_DIR, 'normaliser'));
const {
  fetchBRUIDMatchRate,
  fetchRuleConflicts,
  searchProducts,
} = require(path.join(M1_DIR, 'discovery-client'));
const {
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
} = require(path.join(M1_DIR, 'marketing-mcp-client'));
const { fetchABTestCoverage } = require(path.join(M1_DIR, 'analytics-mcp-client'));
const { fetchAllDimensions } = require(path.join(M1_DIR, 'prs-data-fetcher'));
const { getRuleActivationState } = require(path.join(M1_DIR, 'rule-manager'));
const {
  fetchPersonaProfiles,
  fetchSegmentStatus,
} = require(path.join(M1_DIR, 'engagement-client'));

const REQUIRED_DIM_FIELDS = [
  'dimension_id',
  'raw_value',
  'normalised_score',
  'status',
  'data_source',
  'timestamp',
  'is_synthetic',
];
const VALID_STATUSES = ['critical', 'warning', 'healthy'];
const VALID_DATA_SOURCES = ['discovery_api', 'engagement_api', 'marketing_mcp', 'analytics_mcp'];

function assertDimensionShape(dim) {
  REQUIRED_DIM_FIELDS.forEach((f) => expect(dim).toHaveProperty(f));
  expect(typeof dim.dimension_id).toBe('string');
  expect(dim.dimension_id.length).toBeGreaterThan(0);
  expect(typeof dim.raw_value).toBe('number');
  expect(dim.raw_value).toBeGreaterThanOrEqual(0);
  expect(dim.raw_value).toBeLessThanOrEqual(1);
  expect(Number.isInteger(dim.normalised_score)).toBe(true);
  expect(dim.normalised_score).toBeGreaterThanOrEqual(0);
  expect(dim.normalised_score).toBeLessThanOrEqual(20);
  expect(VALID_STATUSES).toContain(dim.status);
  expect(VALID_DATA_SOURCES).toContain(dim.data_source);
  expect(typeof dim.timestamp).toBe('string');
  expect(typeof dim.is_synthetic).toBe('boolean');
}

// Silence the synthetic-fallback logs during the test run.
let consoleLogSpy;
beforeAll(() => {
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  if (consoleLogSpy) consoleLogSpy.mockRestore();
});

// Force synthetic path regardless of ambient env.
const ORIGINAL_DATA_SOURCE = process.env.DATA_SOURCE;
const ORIGINAL_DEMO_STATE = process.env.DEMO_STATE;
beforeEach(() => {
  delete process.env.DATA_SOURCE;
  delete process.env.DEMO_STATE;
});
afterAll(() => {
  if (ORIGINAL_DATA_SOURCE !== undefined) process.env.DATA_SOURCE = ORIGINAL_DATA_SOURCE;
  if (ORIGINAL_DEMO_STATE !== undefined) process.env.DEMO_STATE = ORIGINAL_DEMO_STATE;
});

describe('M1 — normaliser', () => {
  test('throws NormaliserError when dimension_id is missing', () => {
    const raw = {
      raw_value: 0.5,
      normalised_score: 10,
      status: 'warning',
      data_source: 'discovery_api',
      timestamp: '2026-05-25T00:00:00Z',
    };
    expect(() => normaliseDimension(raw, true)).toThrow(NormaliserError);
    try {
      normaliseDimension(raw, true);
    } catch (err) {
      expect(err).toBeInstanceOf(NormaliserError);
      expect(err.field).toBe('dimension_id');
    }
  });

  test('throws NormaliserError when raw_value is out of [0,1]', () => {
    const raw = {
      dimension_id: 'bruid_match_rate',
      raw_value: 1.5,
      normalised_score: 10,
      status: 'warning',
      data_source: 'discovery_api',
      timestamp: '2026-05-25T00:00:00Z',
    };
    expect(() => normaliseDimension(raw, true)).toThrow(NormaliserError);
  });

  test('passes through valid raw object and sets is_synthetic flag', () => {
    const raw = {
      dimension_id: 'bruid_match_rate',
      raw_value: 0.22,
      normalised_score: 8,
      status: 'critical',
      data_source: 'discovery_api',
      timestamp: '2026-05-22T00:00:00Z',
    };
    const out = normaliseDimension(raw, true);
    expect(out.is_synthetic).toBe(true);
    expect(out.dimension_id).toBe('bruid_match_rate');
    expect(out.normalised_score).toBe(8);
  });
});

describe('M1 — dimension fetchers (synthetic path)', () => {
  test('fetchBRUIDMatchRate returns correct schema', async () => {
    const dim = await fetchBRUIDMatchRate();
    assertDimensionShape(dim);
    expect(dim.dimension_id).toBe('bruid_match_rate');
    expect(dim.data_source).toBe('discovery_api');
    expect(dim.is_synthetic).toBe(true);
  });

  test('fetchAutoSegmentCoverage returns correct schema', async () => {
    const dim = await fetchAutoSegmentCoverage();
    assertDimensionShape(dim);
    expect(dim.dimension_id).toBe('autosegment_coverage');
    expect(dim.data_source).toBe('marketing_mcp');
  });

  test('fetchSignalFreshness returns correct schema', async () => {
    const dim = await fetchSignalFreshness();
    assertDimensionShape(dim);
    expect(dim.dimension_id).toBe('signal_freshness');
    expect(dim.data_source).toBe('marketing_mcp');
  });

  test('fetchRuleConflicts returns correct schema', async () => {
    const dim = await fetchRuleConflicts();
    assertDimensionShape(dim);
    expect(dim.dimension_id).toBe('rule_conflicts');
    expect(dim.data_source).toBe('discovery_api');
  });

  test('fetchABTestCoverage returns correct schema', async () => {
    const dim = await fetchABTestCoverage();
    assertDimensionShape(dim);
    expect(dim.dimension_id).toBe('ab_test_coverage');
    expect(dim.data_source).toBe('analytics_mcp');
  });

  test('pre-fix demo values match locked CLAUDE.md scores', async () => {
    process.env.DEMO_STATE = 'pre_fix';
    const bruid = await fetchBRUIDMatchRate();
    const autoSeg = await fetchAutoSegmentCoverage();
    const ab = await fetchABTestCoverage();
    expect(bruid.normalised_score).toBe(8);
    expect(autoSeg.normalised_score).toBe(6);
    expect(ab.normalised_score).toBe(6);
  });

  test('post-fix demo values match locked CLAUDE.md scores', async () => {
    process.env.DEMO_STATE = 'post_fix';
    // Reset module cache so the loader picks up the new DEMO_STATE.
    jest.resetModules();
    // eslint-disable-next-line global-require
    const ms = require(path.join(M1_DIR, 'marketing-mcp-client'));
    // eslint-disable-next-line global-require
    const an = require(path.join(M1_DIR, 'analytics-mcp-client'));
    const autoSeg = await ms.fetchAutoSegmentCoverage();
    const ab = await an.fetchABTestCoverage();
    expect(autoSeg.normalised_score).toBe(16);
    expect(ab.normalised_score).toBe(16);
  });
});

describe('M1 — prs-data-fetcher', () => {
  test('fetchAllDimensions returns array of exactly 5 items', async () => {
    const dims = await fetchAllDimensions();
    expect(Array.isArray(dims)).toBe(true);
    expect(dims).toHaveLength(5);
    dims.forEach(assertDimensionShape);
  });

  test('fetchAllDimensions returns dimensions in canonical order', async () => {
    const dims = await fetchAllDimensions();
    expect(dims.map((d) => d.dimension_id)).toEqual([
      'bruid_match_rate',
      'autosegment_coverage',
      'signal_freshness',
      'rule_conflicts',
      'ab_test_coverage',
    ]);
  });
});

describe('M1 — discovery-client.searchProducts', () => {
  test('returns a non-empty product list for query "necklace" (guest)', async () => {
    const result = await searchProducts('necklace', null);
    expect(result).toHaveProperty('query', 'necklace');
    expect(Array.isArray(result.products)).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
    result.products.forEach((p, idx) => {
      expect(typeof p.product_id).toBe('string');
      expect(p.currency).toBe('GBP');
      expect(p.rank_position).toBe(idx + 1);
    });
  });

  test('returns personalised flag false for guest (before)', async () => {
    process.env.DEMO_STATE = 'pre_fix';
    const result = await searchProducts('necklace', null);
    expect(result.products[0].is_personalised).toBe(false);
  });

  test('throws on empty query', async () => {
    await expect(searchProducts('', null)).rejects.toThrow(/non-empty/);
  });
});

describe('M1 — engagement-client', () => {
  test('fetchPersonaProfiles returns 3 personas with required fields', async () => {
    const personas = await fetchPersonaProfiles();
    expect(personas).toHaveLength(3);
    const ids = personas.map((p) => p.persona_id).sort();
    expect(ids).toEqual(['alex', 'guest', 'sarah']);
    personas.forEach((p) => {
      expect(p).toHaveProperty('persona_id');
      expect(p).toHaveProperty('segment_name');
      expect(p).toHaveProperty('bruid_present');
      expect(p.is_synthetic).toBe(true);
    });
  });

  test('fetchSegmentStatus returns 3 segments', async () => {
    const status = await fetchSegmentStatus();
    expect(status.total).toBe(3);
    expect(status.segments).toHaveLength(3);
    expect(status.is_synthetic).toBe(true);
  });
});

describe('M1 — rule-manager (read-only)', () => {
  test('default (pre_fix) returns all rules inactive', async () => {
    process.env.DEMO_STATE = 'pre_fix';
    const state = await getRuleActivationState();
    expect(state.rule_1_gifting).toBe('inactive');
    expect(state.rule_2_high_value).toBe('inactive');
    expect(state.rule_3_new_prospecting).toBe('inactive');
    expect(state.all_active).toBe(false);
    expect(typeof state.checked_at).toBe('string');
  });

  test('post_fix returns all rules active', async () => {
    process.env.DEMO_STATE = 'post_fix';
    const state = await getRuleActivationState();
    expect(state.all_active).toBe(true);
    expect(state.rule_1_gifting).toBe('active');
    expect(state.rule_2_high_value).toBe('active');
    expect(state.rule_3_new_prospecting).toBe('active');
  });
});
