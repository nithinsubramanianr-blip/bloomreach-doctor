---
feature: PRS Scoring Engine
spec_id: "003"
module: M2
phase: implementation
owner: Dev
status: approved
version: "1.0"
implemented_on: 2026-05-25
entry_criteria:
  - requirements-spec.md approved
  - architecture-spec.md approved
  - design-spec.md approved
  - data files prs_pre_fix.json, prs_post_fix.json, fix_catalogue.json locked
exit_criteria:
  - All 3 mandatory Jest tests pass (FR-003-15, -16, -17)
  - At least 3 unit tests per scorer pass (FR-003-18)
  - 31 existing C5 tests still pass
  - No imports from react / next / vite / @anthropic-ai/sdk / M1 clients
  - fix_catalogue.json is the only data/ import in M2
  - All scoring functions are pure (no async, no side effects)
---

# Implementation Spec — PRS Scoring Engine (003 / M2)

## What was built

Three pure-function source files plus a Jest test suite, all under
`/src/m2-scoring/`. Implementation faithfully follows the architecture and
design specs; no scope deviations.

### Files created

| File | Purpose | Exports |
|---|---|---|
| `src/m2-scoring/dimension-scorers.js` | Maps a raw value (0–1) to a normalised 0–20 sub-score plus status. Five exports, one per PRS dimension. | `scoreBRUID`, `scoreAutoSegment`, `scoreSignalFreshness`, `scoreRuleConflicts`, `scoreABCoverage` |
| `src/m2-scoring/prs-calculator.js` | Sums the 5 sub-scores into a composite (0–100), assigns RAG, emits the M2→M4 PRS State Object. | `calculatePRS` |
| `src/m2-scoring/fix-generator.js` | Reads `data/fix_catalogue.json`. Sorts dimensions ASC by score (tiebreak: dimension_id ASC), takes the bottom 3, maps to catalogue, sorts by RPV lift max DESC, assigns position 1/2/3. | `generateFixList` |
| `src/m2-scoring/__tests__/prs.test.js` | Jest suite covering the 3 mandatory tests, locked I/O pairs for every scorer, threshold boundaries (status + RAG), shape contract, edge cases, and input validation. | — |

### Scoring rules implemented

- **Formula:** `score = Math.min(20, Math.round(raw_value * 20))`.
- **Status:** `0–8 critical`, `9–14 warning`, `15–20 healthy` — boundaries belong to the lower bucket (e.g. 8 = critical, 9 = warning).
- **RAG:** `< 50 red`, `50–74 amber`, `≥ 75 green`.
- **Live vs synthetic (ADR-003-3):** the scorer accepts either `{ raw_value }` (live path — formula applied) or a full M1 dimension object that already carries `normalised_score` + `status` (synthetic pass-through, locked values delivered verbatim). One scorer, two code paths, no special-casing per environment.

### Fix-generator algorithm

Implemented exactly as ADR-003-4 specifies:

1. Sort `prsResult.dimensions` by `score` ASC, tiebreak by `dimension_id` ASC (`localeCompare`).
2. Take the first 3.
3. Look each up in `data/fix_catalogue.json` by `dimension_linked`.
4. Drop any dimension without a catalogue entry (edge case: missing mapping).
5. Sort the surviving fixes by `estimated_rpv_lift_pct_max` DESC.
6. Assign `position` 1/2/3 and shape to the FixResult contract.

From the pre-fix state, the bottom 3 by score-asc + dim-id-asc are `ab_test_coverage` (6), `autosegment_coverage` (6), `bruid_match_rate` (8). After mapping + RPV-max sort:

| Position | Dimension | RPV max |
|---|---|---|
| 1 | autosegment_coverage | 18% |
| 2 | bruid_match_rate | 15% |
| 3 | ab_test_coverage | 10% |

Matches CLAUDE.md and FR-003-13 exactly.

## Test summary

`npm test` → **Test Suites: 2 passed, 2 total. Tests: 61 passed, 61 total.**

- 30 new tests in `src/m2-scoring/__tests__/prs.test.js`
- 31 pre-existing C5 tests still pass

### The 3 mandatory tests (all green)

1. `calculatePRS(loadPreFixDimensions())` → `composite_score: 52`, `rag_status: "amber"`, BRUID + AutoSegment `status === "critical"` ✓
2. `calculatePRS(loadPostFixDimensions())` → `composite_score: 70`, `rag_status: "amber"`, AutoSegment + ABTest `status === "healthy"` ✓
3. `generateFixList(preFixPRS)` → `[autosegment_coverage, bruid_match_rate, ab_test_coverage]` in positions 1, 2, 3 ✓

### Coverage per scorer (locked I/O pairs)

| Scorer | Cases |
|---|---|
| scoreBRUID | 4 (0.22 synthetic + live, 0.70 live, 1.0 cap, 0.0 floor) |
| scoreAutoSegment | 3 (0.14, 0.68, 0.45) |
| scoreSignalFreshness | 3 (0.58, 0.95, 0.40) |
| scoreRuleConflicts | 3 (0.95, 0.90, 0.50) |
| scoreABCoverage | 3 (0.14, 0.80, 0.35) |

Plus 6 boundary tests, 1 shape contract test, 3 fix-generator edge cases, 3 input validation tests.

## Invariant compliance

| Invariant | Status |
|---|---|
| M1 folder name (`/src/m1-bloomreach/`) | n/a — no M1 imports |
| `llm-explainer.js` is only `@anthropic-ai/sdk` importer | ✓ — no SDK imports in M2 |
| M2 scoring functions are pure (#4) | ✓ — no async, no side effects, no global state |
| Currency GBP | n/a — M2 emits scores, not money |
| Three personas only | n/a |
| Demo query "necklace" hardcoded | n/a |
| No secrets in source | ✓ |
| Specs before code | ✓ — all three 003 specs approved before implementation |

### Imports

- `dimension-scorers.js` — no imports.
- `prs-calculator.js` — imports `./dimension-scorers` only.
- `fix-generator.js` — imports `../../data/fix_catalogue.json` (the single permitted `data/` import in M2, per ADR-003-4 and handoff).
- Test file — imports the three M2 modules plus `data/prs_pre_fix.json` and `data/prs_post_fix.json` (test-only fixtures; not used by production source files).

## Decisions made that weren't pre-specified

1. **Scorer input flexibility (resolveScore helper).** The design-spec function signatures show `{ raw_value }`. The architect's ADR-003-3 specifies the synthetic path passes pre-locked `normalised_score` values straight through. To honour both, each scorer accepts either form: when `normalised_score` is present on the input, the locked value is passed through unchanged; otherwise the formula is applied to `raw_value`. This is the only way the mandatory Test 1 (composite 52) can be satisfied while keeping the formula honest, because `round(0.22 × 20) = 4`, not 8. The pass-through path matches the data-meta note in `prs_pre_fix.json` flagging the formula-vs-locked mismatch.
2. **FixResult shape extension.** The design-spec lists `position, dimension, fix_title, description, effort, revenue_impact, action_label, risk_level`. The catalogue carries richer fields (`fix_id`, `steps`, `estimated_rpv_lift_pct_min/max`). I include those extra fields in the emitted FixResult so downstream M4/M3 consumers don't need to re-read the catalogue. The required fields are all present; extras are additive.
3. **Status-boundary helper exported under `_statusFromScore`.** Internal helper exposed (underscore-prefixed) for white-box tests if needed later. Not part of the M2→M4 contract.
4. **`raw_value` included on the ScorerResult.** The design-spec ScorerResult shape doesn't list it, but including it makes downstream NL explanations (M3) much easier and never causes harm. Additive only.

## Open issues

None blocking. The known formula-vs-locked-value mismatch documented in `prs_pre_fix.json._meta` is addressed by the dual-path scorer described in decision #1 above.
