---
feature: PRS Scoring Engine
spec_id: "003"
phase: design
owner: Architect
status: approved
version: "1.0"
---

# Design Spec — PRS Scoring Engine (003 / M2)

## Function Signatures

### dimension-scorers.js
```javascript
// All five scorers share this return shape
interface ScorerResult {
  dimension_id: string;
  score: number;       // 0–20
  max_score: 20;
  status: 'critical' | 'warning' | 'healthy';
  explanation: string; // one sentence for reasoning trace
}

// Status thresholds (apply to all scorers)
// 0–8  → 'critical'
// 9–14 → 'warning'
// 15–20 → 'healthy'

function scoreBRUID({ raw_value }): ScorerResult
  // score = Math.min(20, Math.round(raw_value * 20))
  // Locked demo: raw=0.22 → score=8, status='critical'

function scoreAutoSegment({ raw_value }): ScorerResult
  // Locked demo: raw=0.14 → score=6, status='critical'  (pre-fix)
  // Locked demo: raw=0.68 → score=16, status='healthy'  (post-fix)

function scoreSignalFreshness({ raw_value }): ScorerResult
  // Locked demo: raw=0.58 → score=14, status='warning'

function scoreRuleConflicts({ raw_value }): ScorerResult
  // raw_value = conflict-FREE percentage (higher = healthier)
  // Locked demo: raw=0.95 → score=18, status='healthy' (pre-fix)
  // Locked demo: raw=0.90 → score=16, status='healthy' (post-fix)

function scoreABCoverage({ raw_value }): ScorerResult
  // Locked demo: raw=0.14 → score=6,  status='critical' (pre-fix)
  // Locked demo: raw=0.80 → score=16, status='healthy'  (post-fix)
```

### prs-calculator.js
```javascript
interface PRSStateOutput {
  composite_score: number;    // sum of 5 scores
  rag_status: 'red' | 'amber' | 'green';
  dimensions: DimensionResult[];
  fix_list: FixResult[];      // populated by fix-generator
  generated_at: string;       // ISO8601
}

// RAG thresholds: red < 50, amber 50–74, green 75+
function calculatePRS(dimensionResults: ScorerResult[]): PRSStateOutput
```

### fix-generator.js
```javascript
interface FixResult {
  position: 1 | 2 | 3;
  dimension: string;          // dimension_id
  fix_title: string;
  description: string;
  effort: string;
  revenue_impact: string;
  action_label: string;
  risk_level: string;
}

function generateFixList(prsResult: PRSStateOutput): FixResult[]
// Algorithm:
// 1. Sort prsResult.dimensions by score ASC, tiebreak by dimension_id ASC
// 2. Take first 3
// 3. Load fix_catalogue.json, find fix where dimension_linked === dimension_id
// 4. Sort matched fixes by estimated_rpv_lift_pct_max DESC
// 5. Assign position 1/2/3
```

## Locked Demo I/O Pairs (canonical — these MUST pass in Jest)

| Scorer | raw_value | score | status |
|---|---|---|---|
| scoreBRUID | 0.22 | 8 | critical |
| scoreAutoSegment | 0.14 | 6 | critical |
| scoreAutoSegment | 0.68 | 16 | healthy |
| scoreSignalFreshness | 0.58 | 14 | warning |
| scoreRuleConflicts | 0.95 | 18 | healthy |
| scoreRuleConflicts | 0.90 | 16 | healthy |
| scoreABCoverage | 0.14 | 6 | critical |
| scoreABCoverage | 0.80 | 16 | healthy |

## Jest Test Structure (tests/m2-scoring/)

```javascript
// Test 1 — pre-fix state
it('calculates pre-fix PRS correctly', () => {
  const result = calculatePRS(loadPreFixDimensions());
  expect(result.composite_score).toBe(52);
  expect(result.rag_status).toBe('amber');
  expect(result.dimensions.find(d => d.dimension_id === 'bruid_match_rate').status).toBe('critical');
  expect(result.dimensions.find(d => d.dimension_id === 'autosegment_coverage').status).toBe('critical');
});

// Test 2 — post-fix state
it('calculates post-fix PRS correctly', () => {
  const result = calculatePRS(loadPostFixDimensions());
  expect(result.composite_score).toBe(70);
  expect(result.rag_status).toBe('amber');
  expect(result.dimensions.find(d => d.dimension_id === 'autosegment_coverage').status).toBe('healthy');
  expect(result.dimensions.find(d => d.dimension_id === 'ab_test_coverage').status).toBe('healthy');
});

// Test 3 — fix list ranking
it('generates correct fix list from pre-fix state', () => {
  const prs = calculatePRS(loadPreFixDimensions());
  const fixes = generateFixList(prs);
  expect(fixes[0].dimension).toBe('autosegment_coverage');
  expect(fixes[1].dimension).toBe('bruid_match_rate');
  expect(fixes[2].dimension).toBe('ab_test_coverage');
});
```

## Edge Cases

- **All 5 scores 20/20 (perfect):** fix list returns empty array `[]`, not crash.
- **fix_catalogue.json missing a dimension entry:** `generateFixList` skips that dimension gracefully.
- **Score exactly at threshold boundary (8 → critical, 9 → warning):** boundary belongs to the lower bucket. 8 = critical, 9 = warning.
