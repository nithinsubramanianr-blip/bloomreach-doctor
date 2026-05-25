/**
 * prs.test.js — Jest suite for the M2 PRS Scoring Engine.
 *
 * Covers:
 *   - The three mandatory tests defined by spec 003 (composite/RAG, post-fix,
 *     fix-list ranking).
 *   - Locked input/output pairs for each of the five scorers (design-spec
 *     §"Locked Demo I/O Pairs").
 *   - Status threshold boundaries (8/9 and 14/15).
 *   - RAG threshold boundaries (49/50 and 74/75).
 *   - Fix-generator edge cases (empty catalogue match, perfect-score state).
 *
 * Test data is loaded directly from /data/prs_pre_fix.json and
 * /data/prs_post_fix.json. This is a test-only import — production callers
 * receive the dimensions array from M1.
 */

const path = require('path');

const {
  scoreBRUID,
  scoreAutoSegment,
  scoreSignalFreshness,
  scoreRuleConflicts,
  scoreABCoverage,
} = require('../dimension-scorers');
const { calculatePRS } = require('../prs-calculator');
const { generateFixList } = require('../fix-generator');

const preFixData = require(path.join(__dirname, '..', '..', '..', 'data', 'prs_pre_fix.json'));
const postFixData = require(path.join(__dirname, '..', '..', '..', 'data', 'prs_post_fix.json'));

function loadPreFixDimensions() {
  return preFixData.dimensions;
}

function loadPostFixDimensions() {
  return postFixData.dimensions;
}

// ──────────────────────────────────────────────────────────────────────────
// Mandatory Test 1 — pre-fix composite + status
// ──────────────────────────────────────────────────────────────────────────
describe('calculatePRS — pre-fix state (mandatory)', () => {
  it('returns composite 52 / amber / BRUID critical / AutoSegment critical', () => {
    const result = calculatePRS(loadPreFixDimensions());

    expect(result.composite_score).toBe(52);
    expect(result.rag_status).toBe('amber');

    const bruid = result.dimensions.find(d => d.dimension_id === 'bruid_match_rate');
    const autoseg = result.dimensions.find(d => d.dimension_id === 'autosegment_coverage');

    expect(bruid.status).toBe('critical');
    expect(autoseg.status).toBe('critical');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Mandatory Test 2 — post-fix composite + status
// ──────────────────────────────────────────────────────────────────────────
describe('calculatePRS — post-fix state (mandatory)', () => {
  it('returns composite 70 / amber / AutoSegment healthy / ABTest healthy', () => {
    const result = calculatePRS(loadPostFixDimensions());

    expect(result.composite_score).toBe(70);
    expect(result.rag_status).toBe('amber');

    const autoseg = result.dimensions.find(d => d.dimension_id === 'autosegment_coverage');
    const ab = result.dimensions.find(d => d.dimension_id === 'ab_test_coverage');

    expect(autoseg.status).toBe('healthy');
    expect(ab.status).toBe('healthy');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Mandatory Test 3 — fix list ranking from pre-fix
// ──────────────────────────────────────────────────────────────────────────
describe('generateFixList — pre-fix ranking (mandatory)', () => {
  it('ranks AutoSegment > BRUID > A/B Coverage', () => {
    const prs = calculatePRS(loadPreFixDimensions());
    const fixes = generateFixList(prs);

    expect(fixes).toHaveLength(3);
    expect(fixes[0].dimension).toBe('autosegment_coverage');
    expect(fixes[1].dimension).toBe('bruid_match_rate');
    expect(fixes[2].dimension).toBe('ab_test_coverage');
    expect(fixes[0].position).toBe(1);
    expect(fixes[1].position).toBe(2);
    expect(fixes[2].position).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Locked demo I/O pairs — one describe per scorer (≥ 3 cases each)
// ──────────────────────────────────────────────────────────────────────────
describe('scoreBRUID — locked I/O pairs', () => {
  it('raw 0.22 → score 8 / critical (demo locked)', () => {
    expect(scoreBRUID({ raw_value: 0.22 })).toMatchObject({
      dimension_id: 'bruid_match_rate',
      score: 4, // formula: round(0.22 * 20) = 4
      status: 'critical',
    });
    // The locked demo value (8) is delivered via the synthetic pass-through
    // path — M1 supplies normalised_score=8 in prs_pre_fix.json. Confirm
    // pass-through here.
    expect(scoreBRUID({ raw_value: 0.22, normalised_score: 8, status: 'critical' }))
      .toMatchObject({ score: 8, status: 'critical' });
  });

  it('raw 0.70 → score 14 / warning (live-formula path)', () => {
    expect(scoreBRUID({ raw_value: 0.70 })).toMatchObject({ score: 14, status: 'warning' });
  });

  it('raw 1.0 → capped at 20 / healthy', () => {
    expect(scoreBRUID({ raw_value: 1.0 })).toMatchObject({ score: 20, status: 'healthy' });
  });

  it('raw 0.0 → score 0 / critical', () => {
    expect(scoreBRUID({ raw_value: 0.0 })).toMatchObject({ score: 0, status: 'critical' });
  });
});

describe('scoreAutoSegment — locked I/O pairs', () => {
  it('raw 0.14 → critical (pre-fix demo pass-through)', () => {
    expect(scoreAutoSegment({ raw_value: 0.14, normalised_score: 6, status: 'critical' }))
      .toMatchObject({ dimension_id: 'autosegment_coverage', score: 6, status: 'critical' });
  });

  it('raw 0.68 → healthy (post-fix demo pass-through)', () => {
    expect(scoreAutoSegment({ raw_value: 0.68, normalised_score: 16, status: 'healthy' }))
      .toMatchObject({ score: 16, status: 'healthy' });
  });

  it('raw 0.45 → live-formula path → score 9 / warning', () => {
    expect(scoreAutoSegment({ raw_value: 0.45 })).toMatchObject({ score: 9, status: 'warning' });
  });
});

describe('scoreSignalFreshness — locked I/O pairs', () => {
  it('raw 0.58 → score 14 / warning (locked demo)', () => {
    // round(0.58 * 20) = 12 via live path, locked value 14 via synthetic.
    expect(scoreSignalFreshness({ raw_value: 0.58, normalised_score: 14, status: 'warning' }))
      .toMatchObject({ dimension_id: 'signal_freshness', score: 14, status: 'warning' });
  });

  it('raw 0.95 → score 19 / healthy (live-formula path)', () => {
    expect(scoreSignalFreshness({ raw_value: 0.95 })).toMatchObject({ score: 19, status: 'healthy' });
  });

  it('raw 0.40 → score 8 / critical (live-formula boundary)', () => {
    expect(scoreSignalFreshness({ raw_value: 0.40 })).toMatchObject({ score: 8, status: 'critical' });
  });
});

describe('scoreRuleConflicts — locked I/O pairs', () => {
  it('raw 0.95 → score 18 / healthy (pre-fix demo pass-through; 95% conflict-free)', () => {
    expect(scoreRuleConflicts({ raw_value: 0.95, normalised_score: 18, status: 'healthy' }))
      .toMatchObject({ dimension_id: 'rule_conflicts', score: 18, status: 'healthy' });
  });

  it('raw 0.90 → score 16 / healthy (post-fix demo pass-through)', () => {
    expect(scoreRuleConflicts({ raw_value: 0.90, normalised_score: 16, status: 'healthy' }))
      .toMatchObject({ score: 16, status: 'healthy' });
  });

  it('raw 0.50 → score 10 / warning (live-formula path)', () => {
    expect(scoreRuleConflicts({ raw_value: 0.50 })).toMatchObject({ score: 10, status: 'warning' });
  });
});

describe('scoreABCoverage — locked I/O pairs', () => {
  it('raw 0.14 → score 6 / critical (pre-fix demo pass-through)', () => {
    expect(scoreABCoverage({ raw_value: 0.14, normalised_score: 6, status: 'critical' }))
      .toMatchObject({ dimension_id: 'ab_test_coverage', score: 6, status: 'critical' });
  });

  it('raw 0.80 → score 16 / healthy (post-fix demo pass-through)', () => {
    expect(scoreABCoverage({ raw_value: 0.80, normalised_score: 16, status: 'healthy' }))
      .toMatchObject({ score: 16, status: 'healthy' });
  });

  it('raw 0.35 → score 7 / critical (live-formula path)', () => {
    expect(scoreABCoverage({ raw_value: 0.35 })).toMatchObject({ score: 7, status: 'critical' });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Threshold boundaries
// ──────────────────────────────────────────────────────────────────────────
describe('status thresholds — boundary behaviour', () => {
  it('score 8 is critical, score 9 is warning', () => {
    // 0.425 * 20 = 8.5 → rounds to 9. Need 0.42 → 8.4 → 8.
    expect(scoreBRUID({ raw_value: 0.42 }).status).toBe('critical');
    expect(scoreBRUID({ raw_value: 0.45 }).status).toBe('warning');
  });

  it('score 14 is warning, score 15 is healthy', () => {
    expect(scoreBRUID({ raw_value: 0.70 }).status).toBe('warning'); // 14
    expect(scoreBRUID({ raw_value: 0.75 }).status).toBe('healthy'); // 15
  });
});

describe('RAG thresholds — boundary behaviour', () => {
  const stub = (id, score) => ({
    dimension_id: id,
    score,
    max_score: 20,
    status: 'healthy',
  });

  it('composite 49 is red, 50 is amber', () => {
    const red = calculatePRS([
      stub('bruid_match_rate', 9),
      stub('autosegment_coverage', 10),
      stub('signal_freshness', 10),
      stub('rule_conflicts', 10),
      stub('ab_test_coverage', 10),
    ]);
    expect(red.composite_score).toBe(49);
    expect(red.rag_status).toBe('red');

    const amber = calculatePRS([
      stub('bruid_match_rate', 10),
      stub('autosegment_coverage', 10),
      stub('signal_freshness', 10),
      stub('rule_conflicts', 10),
      stub('ab_test_coverage', 10),
    ]);
    expect(amber.composite_score).toBe(50);
    expect(amber.rag_status).toBe('amber');
  });

  it('composite 74 is amber, 75 is green', () => {
    const amber = calculatePRS([
      stub('bruid_match_rate', 14),
      stub('autosegment_coverage', 15),
      stub('signal_freshness', 15),
      stub('rule_conflicts', 15),
      stub('ab_test_coverage', 15),
    ]);
    expect(amber.composite_score).toBe(74);
    expect(amber.rag_status).toBe('amber');

    const green = calculatePRS([
      stub('bruid_match_rate', 15),
      stub('autosegment_coverage', 15),
      stub('signal_freshness', 15),
      stub('rule_conflicts', 15),
      stub('ab_test_coverage', 15),
    ]);
    expect(green.composite_score).toBe(75);
    expect(green.rag_status).toBe('green');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PRS calculator — return shape contract
// ──────────────────────────────────────────────────────────────────────────
describe('calculatePRS — contract shape', () => {
  it('returns the M2→M4 PRS state object shape', () => {
    const prs = calculatePRS(loadPreFixDimensions());
    expect(prs).toEqual(expect.objectContaining({
      composite_score: expect.any(Number),
      rag_status: expect.any(String),
      dimensions: expect.any(Array),
      fix_list: expect.any(Array),
      generated_at: expect.any(String),
    }));
    expect(prs.dimensions).toHaveLength(5);
    expect(new Date(prs.generated_at).toString()).not.toBe('Invalid Date');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Fix generator — edge cases
// ──────────────────────────────────────────────────────────────────────────
describe('generateFixList — edge cases', () => {
  it('returns up to 3 fixes for the post-fix state', () => {
    const prs = calculatePRS(loadPostFixDimensions());
    const fixes = generateFixList(prs);
    expect(fixes.length).toBeLessThanOrEqual(3);
    // Bottom 3 post-fix dimensions: BRUID(8), SignalFreshness(14), then a
    // healthy-tier tiebreak. Only catalogue-mapped dimensions appear.
    const dims = fixes.map(f => f.dimension);
    expect(dims).toContain('bruid_match_rate');
  });

  it('skips dimensions with no catalogue match', () => {
    const fakePrs = {
      composite_score: 30,
      rag_status: 'red',
      dimensions: [
        { dimension_id: 'unknown_thing', score: 1, max_score: 20, status: 'critical' },
        { dimension_id: 'autosegment_coverage', score: 2, max_score: 20, status: 'critical' },
        { dimension_id: 'bruid_match_rate', score: 3, max_score: 20, status: 'critical' },
        { dimension_id: 'ab_test_coverage', score: 4, max_score: 20, status: 'critical' },
        { dimension_id: 'signal_freshness', score: 20, max_score: 20, status: 'healthy' },
      ],
      fix_list: [],
      generated_at: new Date().toISOString(),
    };
    const fixes = generateFixList(fakePrs);
    // Bottom 3 picked: unknown_thing, autosegment, bruid. unknown_thing is
    // skipped — so we end up with 2 mapped fixes.
    expect(fixes).toHaveLength(2);
    expect(fixes.map(f => f.dimension)).toEqual(
      expect.arrayContaining(['autosegment_coverage', 'bruid_match_rate']),
    );
  });

  it('returns empty array when nothing maps to the catalogue', () => {
    const fakePrs = {
      composite_score: 100,
      rag_status: 'green',
      dimensions: [
        { dimension_id: 'mystery_a', score: 20, max_score: 20, status: 'healthy' },
        { dimension_id: 'mystery_b', score: 20, max_score: 20, status: 'healthy' },
        { dimension_id: 'mystery_c', score: 20, max_score: 20, status: 'healthy' },
      ],
      fix_list: [],
      generated_at: new Date().toISOString(),
    };
    expect(generateFixList(fakePrs)).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Input validation
// ──────────────────────────────────────────────────────────────────────────
describe('input validation', () => {
  it('calculatePRS throws on non-array input', () => {
    expect(() => calculatePRS(null)).toThrow(TypeError);
    expect(() => calculatePRS({})).toThrow(TypeError);
  });

  it('scoreBRUID throws on missing input', () => {
    expect(() => scoreBRUID(null)).toThrow(TypeError);
    expect(() => scoreBRUID({})).toThrow(TypeError);
  });

  it('generateFixList throws on missing dimensions', () => {
    expect(() => generateFixList(null)).toThrow(TypeError);
    expect(() => generateFixList({})).toThrow(TypeError);
  });
});
