---
feature: PRS Scoring Engine
spec_id: "003"
module: M2
phase: requirements
owner: PM
status: draft
version: "2.0"
entry_criteria:
  - 001-synthetic-data approved
  - 002-bloomreach-integration approved
  - prs_pre_fix.json locked (52/100) and prs_post_fix.json arithmetic confirmed
exit_criteria:
  - All 5 scoring formulas specified (or formula discrepancy resolved by Architect)
  - Fix generator logic specified
  - Jest test cases defined with exact input/output assertions
  - Human has set status to approved
---

# Requirements Spec — PRS Scoring Engine (003 / M2)

## Problem
The M1 data layer returns normalised dimension objects. M2 translates those into sub-scores (0–20 each), sums them to the composite PRS (0–100), applies RAG status, and generates the ranked fix list. All functions must be pure, deterministic, and produce exactly the locked demo values.

## Functional Requirements

### dimension-scorers.js (all five in one file)

- **FR-003-1:** `scoreBRUID({ raw_value })` SHALL return `{ dimension_id, score, max_score: 20, status, explanation }`. Locked demo: input 0.22 → score 8, status "critical".
- **FR-003-2:** `scoreAutoSegment({ raw_value })` SHALL return same shape. Locked demo: input 0.14 → score 6, status "critical".
- **FR-003-3:** `scoreSignalFreshness({ raw_value })` SHALL return same shape. Locked demo: input 0.58 → score 14, status "warning".
- **FR-003-4:** `scoreRuleConflicts({ raw_value })` SHALL return same shape. Note: higher raw_value = healthier (raw_value is conflict-FREE percentage). Locked demo: input 0.95 → score 18, status "healthy".
- **FR-003-5:** `scoreABCoverage({ raw_value })` SHALL return same shape. Locked demo: input 0.14 → score 6, status "critical".
- **FR-003-6:** Status thresholds: 0–8 = "critical", 9–14 = "warning", 15–20 = "healthy".
- **FR-003-7:** ⚠️ **FORMULA FLAG:** The stated formula `round(raw×20)` does not produce the stated scores (e.g. round(0.22×20)=4 not 8). Architect MUST resolve the correct formula before Dev implements. The locked demo input/output pairs above are canonical regardless of formula.
- **FR-003-8:** All scorer functions SHALL be pure — no imports from react, no async, no global state, no imports from `data/` directory.

### prs-calculator.js

- **FR-003-9:** `calculatePRS(dimensionResults)` SHALL accept array of 5 scorer outputs, sum `score` fields, apply RAG thresholds, and return M2→M4 PRS state object.
- **FR-003-10:** RAG: `composite_score < 50` = "red", `50–74` = "amber", `75+` = "green".
- **FR-003-11:** Pre-fix output: `composite_score: 52, rag_status: "amber"`. Post-fix: `composite_score: [confirmed total], rag_status: "amber"`.

### fix-generator.js

- **FR-003-12:** `generateFixList(prsResult)` SHALL sort dimensions by `score` ascending (lowest first), take bottom 3, map each to its fix object from `fix_catalogue.json`, sort mapped results by `estimated_rpv_lift_pct_max` descending.
- **FR-003-13:** From pre-fix state, rank 1 SHALL be AutoSegment (score 6), rank 2 BRUID (score 8), rank 3 A/B Coverage (score 6 — tiebreak by revenue impact: A/B vs AutoSegment already at rank 1).
- **FR-003-14:** Each returned fix object SHALL include: `position`, `dimension`, `fix_title`, `description`, `effort`, `revenue_impact`, `action_label`.

### Jest Tests (mandatory — tests/m2-scoring/)

- **FR-003-15:** Test 1: `prs_pre_fix.json` input → `composite_score === 52`, `rag_status === "amber"`, BRUID and AutoSegment `status === "critical"`.
- **FR-003-16:** Test 2: `prs_post_fix.json` input → `composite_score === [confirmed total]`, `rag_status === "amber"`, AutoSegment `status === "healthy"`.
- **FR-003-17:** Test 3: fix list from pre-fix state → `fix_list[0].dimension === "autosegment_coverage"`, `fix_list[1].dimension === "bruid_match_rate"`, `fix_list[2].dimension === "ab_test_coverage"`.
- **FR-003-18:** Each scorer function SHALL have at least 3 input/output test cases.

## Acceptance Criteria
- [ ] All 5 scorer functions in one file `dimension-scorers.js`
- [ ] Scorer unit tests pass for all locked demo input/output pairs
- [ ] `calculatePRS` returns `composite_score: 52` from pre-fix input
- [ ] Fix generator returns AutoSegment as rank 1 from pre-fix state
- [ ] All Jest tests pass before Dev hands off to QA
- [ ] No imports from `data/` inside any scorer function

## Out of Scope
- NL generation of explanations (M3)
- UI rendering (M4)
- Storing or persisting scores
