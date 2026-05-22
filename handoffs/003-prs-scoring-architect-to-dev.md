# Handoff: 003 PRS Scoring Engine — Architect → Dev

**Date:** 2026-05-22
**From:** Architect
**To:** Dev
**Spec:** specs/003-prs-scoring-engine/

## What was designed

Three pure-function files. No async. No imports from `data/`. The locked demo I/O pairs are canonical — scorers apply `Math.min(20, Math.round(raw_value * 20))` for live data; synthetic path has locked values pre-applied by M1.

## What Dev needs to implement

### Files to create (all in `src/m2-scoring/`)

| File | Exports |
|---|---|
| `dimension-scorers.js` | `scoreBRUID`, `scoreAutoSegment`, `scoreSignalFreshness`, `scoreRuleConflicts`, `scoreABCoverage` |
| `prs-calculator.js` | `calculatePRS` |
| `fix-generator.js` | `generateFixList` |

### Mandatory Jest Tests (`src/m2-scoring/__tests__/prs.test.js`)

**Test 1 (must pass):**
```javascript
calculatePRS(loadPreFixDimensions()) → { composite_score: 52, rag_status: 'amber' }
BRUID status === 'critical', AutoSegment status === 'critical'
```

**Test 2 (must pass):**
```javascript
calculatePRS(loadPostFixDimensions()) → { composite_score: 70, rag_status: 'amber' }
AutoSegment status === 'healthy', ABTest status === 'healthy'
```

**Test 3 (must pass):**
```javascript
generateFixList(preFixPRS) → [
  { dimension: 'autosegment_coverage' },  // rank 1
  { dimension: 'bruid_match_rate' },      // rank 2
  { dimension: 'ab_test_coverage' }       // rank 3
]
```

**Plus:** At least 3 input/output unit tests per scorer using the locked demo pairs from design-spec.md.

### Fix generator reads fix_catalogue.json
`fix-generator.js` reads `data/fix_catalogue.json` at call time. This is the only permitted `data/` import in M2 (it's fixture data, not raw API response). Do NOT inline the fix data.

## Critical constraints
- All functions pure — no async, no side effects, no global state
- No imports from `react`
- `fix-generator.js` may import `fix_catalogue.json` — no other `data/` imports

## Dependency check
- 001 ✅, 002 ✅ approved
- 003 requirements-spec ✅, architecture-spec ✅, design-spec ✅ approved
