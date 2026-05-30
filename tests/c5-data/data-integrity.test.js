/**
 * C5 — Synthetic Data Layer integrity tests.
 *
 * Spec: specs/001-synthetic-data/
 * Handoff: handoffs/001-synthetic-data-architect-to-dev.md
 *
 * These tests validate the locked demo data files. They do NOT compute scores
 * from raw values — the locked values in CLAUDE.md take precedence over the
 * formula (see CLAUDE.md "Note for Architect"). We only assert the file
 * contents match the locked demo states.
 */

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const personas = require(path.join(DATA_DIR, 'personas.json'));
const prsPre = require(path.join(DATA_DIR, 'prs_pre_fix.json'));
const prsPost = require(path.join(DATA_DIR, 'prs_post_fix.json'));
const fixCatalogue = require(path.join(DATA_DIR, 'fix_catalogue.json'));
const products = require(path.join(DATA_DIR, 'products.json'));
const segments = require(path.join(DATA_DIR, 'segments.json'));

describe('C5 — PRS demo states', () => {
  // 8-dimension contract: 5 originals + 3 Engagement MCP dims.
  // Composite = round(sum / (20 × dim_count) × 100).
  // Pre-fix: 43/160 → 27 (red). Post-fix: 109/160 → 68 (amber).

  test('prs_pre_fix.json composite_score === 27', () => {
    expect(prsPre.composite_score).toBe(27);
  });

  test('prs_pre_fix.json rag_status === "red"', () => {
    expect(prsPre.rag_status).toBe('red');
  });

  test('prs_pre_fix.json boost_rules_state === "all_inactive"', () => {
    expect(prsPre.boost_rules_state).toBe('all_inactive');
  });

  test('prs_pre_fix.json has exactly 8 dimensions', () => {
    expect(Array.isArray(prsPre.dimensions)).toBe(true);
    expect(prsPre.dimensions).toHaveLength(8);
  });

  test('prs_pre_fix.json BRUID and AutoSegment status === "critical"', () => {
    const bruid = prsPre.dimensions.find((d) => d.dimension_id === 'bruid_match_rate');
    const autoseg = prsPre.dimensions.find((d) => d.dimension_id === 'autosegment_coverage');
    expect(bruid).toBeDefined();
    expect(autoseg).toBeDefined();
    expect(bruid.status).toBe('critical');
    expect(autoseg.status).toBe('critical');
  });

  test('prs_pre_fix.json normalised scores sum to 43 (out of 160 max)', () => {
    const sum = prsPre.dimensions.reduce((acc, d) => acc + d.normalised_score, 0);
    expect(sum).toBe(43);
  });

  test('prs_post_fix.json composite_score === 68', () => {
    expect(prsPost.composite_score).toBe(68);
  });

  test('prs_post_fix.json boost_rules_state === "all_active"', () => {
    expect(prsPost.boost_rules_state).toBe('all_active');
  });

  test('prs_post_fix.json ABTest and SegmentDefinitionQuality status === "healthy"', () => {
    const ab = prsPost.dimensions.find((d) => d.dimension_id === 'ab_test_coverage');
    const sdq = prsPost.dimensions.find((d) => d.dimension_id === 'segment_definition_quality');
    expect(ab).toBeDefined();
    expect(sdq).toBeDefined();
    expect(ab.status).toBe('healthy');
    expect(sdq.status).toBe('healthy');
  });

  test('prs_post_fix.json normalised scores sum to 109 (out of 160 max)', () => {
    const sum = prsPost.dimensions.reduce((acc, d) => acc + d.normalised_score, 0);
    expect(sum).toBe(109);
  });

  test('every dimension object carries is_synthetic === true (ADR-001-2)', () => {
    for (const d of [...prsPre.dimensions, ...prsPost.dimensions]) {
      expect(d.is_synthetic).toBe(true);
    }
  });
});

describe('C5 — personas', () => {
  test('personas.json contains exactly 3 personas', () => {
    expect(Array.isArray(personas.personas)).toBe(true);
    expect(personas.personas).toHaveLength(3);
  });

  test('persona ids are exactly guest, sarah, alex', () => {
    const ids = personas.personas.map((p) => p.persona_id).sort();
    expect(ids).toEqual(['alex', 'guest', 'sarah']);
  });

  test('all personas have demo_query === "necklace"', () => {
    for (const p of personas.personas) {
      expect(p.demo_query).toBe('necklace');
    }
  });

  test('guest persona has no BRUID (bruid_value === null)', () => {
    const guest = personas.personas.find((p) => p.persona_id === 'guest');
    expect(guest.bruid_present).toBe(false);
    expect(guest.bruid_value).toBeNull();
  });

  test('sarah and alex have BRUID present', () => {
    const sarah = personas.personas.find((p) => p.persona_id === 'sarah');
    const alex = personas.personas.find((p) => p.persona_id === 'alex');
    expect(sarah.bruid_present).toBe(true);
    expect(typeof sarah.bruid_value).toBe('string');
    expect(alex.bruid_present).toBe(true);
    expect(typeof alex.bruid_value).toBe('string');
  });
});

describe('C5 — products catalogue', () => {
  test('products.json has exactly 50 entries', () => {
    expect(Array.isArray(products.products)).toBe(true);
    expect(products.products).toHaveLength(50);
  });

  test('all products use currency === "GBP" (invariant 9)', () => {
    for (const p of products.products) {
      expect(p.currency).toBe('GBP');
    }
  });

  test('no product name contains real brand "Kendra Scott" (invariant 12)', () => {
    for (const p of products.products) {
      expect(p.name.toLowerCase()).not.toContain('kendra scott');
    }
  });

  test('products.csv exists and contains the header row', () => {
    const csvPath = path.join(DATA_DIR, 'products.csv');
    expect(fs.existsSync(csvPath)).toBe(true);
    const content = fs.readFileSync(csvPath, 'utf8');
    // header should at minimum include product_id and currency
    const firstLine = content.split(/\r?\n/, 1)[0];
    expect(firstLine).toMatch(/product_id/);
    expect(firstLine).toMatch(/currency/);
  });
});

describe('C5 — fix catalogue', () => {
  // 6-fix catalogue: one fix per dimension that has a remediation path.
  // signal_freshness and rule_conflicts deliberately do not have catalogue
  // entries (no operational fix available to a single PM).

  test('exactly 6 fixes', () => {
    expect(Array.isArray(fixCatalogue.fixes)).toBe(true);
    expect(fixCatalogue.fixes).toHaveLength(6);
  });

  test('catalogue covers all 6 remediable dimensions', () => {
    // The `rank` field is an authoring hint; the real top-3 is computed
    // dynamically by fix-generator from the live PRS state. So we only
    // assert that the full set of remediable dimensions is covered.
    const dims = new Set(fixCatalogue.fixes.map((f) => f.dimension_linked));
    expect(dims.size).toBe(6);
  });

  test('catalogue includes fixes for all three new Engagement MCP dimensions', () => {
    const dims = fixCatalogue.fixes.map((f) => f.dimension_linked);
    expect(dims).toEqual(expect.arrayContaining([
      'segment_definition_quality',
      'profile_completeness',
      'behavioral_signal_richness',
    ]));
  });

  test('catalogue still covers bruid_match_rate and ab_test_coverage', () => {
    const dims = fixCatalogue.fixes.map((f) => f.dimension_linked);
    expect(dims).toEqual(expect.arrayContaining([
      'bruid_match_rate',
      'ab_test_coverage',
    ]));
  });
});

describe('C5 — segments', () => {
  test('segments.json defines 3 segments', () => {
    const segs = segments.segments || segments;
    const arr = Array.isArray(segs) ? segs : Object.values(segs).filter(Array.isArray)[0];
    expect(arr).toBeDefined();
    expect(arr).toHaveLength(3);
  });
});

describe('C5 — cached results', () => {
  const CACHE_DIR = path.join(DATA_DIR, 'cached-results');
  const EXPECTED = [
    'guest-before.json',
    'guest-after.json',
    'sarah-before.json',
    'sarah-after.json',
    'alex-before.json',
    'alex-after.json',
  ];

  test.each(EXPECTED)('cached-results/%s exists', (filename) => {
    expect(fs.existsSync(path.join(CACHE_DIR, filename))).toBe(true);
  });
});
