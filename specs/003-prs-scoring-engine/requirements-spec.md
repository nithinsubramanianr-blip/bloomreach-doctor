---
feature: PRS Scoring Engine
spec_id: "003"
module: M2
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - 001-synthetic-data requirements-spec.md is approved
  - 002-mcp-integration requirements-spec.md is approved
  - prs_demo_state.json locked scores are confirmed (52/100)
exit_criteria:
  - All 5 scoring formulas specified with exact thresholds
  - Fix generator logic specified
  - Acceptance criteria include deterministic output check against locked demo scores
  - Human has set status to approved
---

# Requirements Spec — PRS Scoring Engine (003 / M2)

## Problem

The PRS (Personalization Readiness Score) needs to be computed from data returned by the three MCP/API clients. The scoring must be deterministic, pure, and independently testable — it must not depend on UI state, API calls, or React rendering. Every scoring function must produce exactly the locked demo values from `prs_demo_state.json`.

## User stories

- **US-003-1:** As Amanda Valdez (the demo user), I want to see a single 0–100 score so I can understand my personalization health at a glance.
- **US-003-2:** As Amanda, I want to see which dimension is hurting my score most so I know where to focus first.
- **US-003-3:** As Amanda, I want to see ranked fix recommendations with estimated revenue impact so I can justify the work to my VP.

## Functional requirements

### Scorers (all pure functions — no side effects, no async)

- **FR-003-1 (BRUID):** `bruid-scorer.js` SHALL accept `{ bruid_match_rate }` and return a sub-score 0–20. Formula: `Math.round((bruid_match_rate / 0.70) * 20)`, capped at 20. Demo input: `0.40` → output: `8`.
- **FR-003-2 (AutoSegment):** `autosegment-scorer.js` SHALL accept `{ autosegment_coverage_rate }` and return a sub-score 0–20. Formula: `Math.round((autosegment_coverage_rate / 0.75) * 20)`, capped at 20. Demo input: `0.45` → output: `12`.
- **FR-003-3 (Signal Freshness):** `signal-freshness-scorer.js` SHALL accept `{ signal_freshness_band }` and return a stepped sub-score. Bands: `lt_24h` → 20, `24h_to_72h` → 14 (demo value: `14`), `3d_to_7d` → 8, `gt_7d` → 0. Demo input: `'24h_to_72h'` → output: `14`.
- **FR-003-4 (Rule Conflicts):** `rule-conflict-scorer.js` SHALL accept `{ detected_conflicts }` and return a stepped sub-score. 0 conflicts → 20, 1 → 14, 2 → 10 (demo value: `10`), 3+ → 0. Demo input: `2` → output: `10`.
- **FR-003-5 (A/B Test Coverage):** `ab-test-scorer.js` SHALL accept `{ ab_test_coverage_rate }` and return a sub-score 0–20. Formula: `Math.round((ab_test_coverage_rate / 0.60) * 20)`, capped at 20. Demo input: `0.4286` → output: `8` (note: `Math.round(0.4286/0.60 * 20) = Math.round(14.29) = 14` — **OVERRIDE: use locked value 8 from prs_demo_state.json**).

  > **Note for Architect:** The A/B Test Coverage raw rate (0.4286) with the above formula produces 14, not 8. The locked demo value of 8 implies either a different formula or a different raw input. Resolve in architecture-spec.md before Dev implements. Possible resolution: use `rules_with_test / total_rules_including_inactive` instead of active-only.

- **FR-003-6 (PRS Calculator):** `prs-calculator.js` SHALL accept the five sub-scores and return their sum. Demo: `8 + 12 + 14 + 10 + 8 = 52`.
- **FR-003-7:** All scorers SHALL be tested with the exact demo input/output pairs listed in FR-003-1 through FR-003-5. Any scorer that does not produce the locked demo value MUST be flagged to the human before shipping.

### Fix generator

- **FR-003-8:** `fix-generator.js` SHALL accept the five sub-scores and return a ranked array of fix recommendations, sorted by estimated revenue impact (highest first).
- **FR-003-9:** Each fix object SHALL contain: `dimension`, `current_score`, `max_score`, `gap`, `one_line_issue`, `estimated_rpv_lift_pct`, `fix_action`, `risk_level`.
- **FR-003-10:** BRUID Match Rate SHALL always rank #1 in the demo scenario (gap of 12 points, largest single gap).
- **FR-003-11:** Revenue impact estimates SHALL be labelled as estimates in the UI. Stated assumption: "Based on Bloomreach benchmarks — 1 point of BRUID match rate improvement ≈ 0.5% RPV lift."

## Acceptance criteria

- [ ] All 5 scorer functions are pure (no imports from react, no async, no global state)
- [ ] Scorer unit tests pass for all demo input/output pairs: 8, 12, 14, 10, 8
- [ ] PRS calculator returns exactly 52 given those five sub-scores
- [ ] Fix generator returns BRUID Match Rate as the #1 ranked fix for the demo state
- [ ] Each fix object contains all required fields
- [ ] No imports from `data/` or `src/m1-mcp/` inside any scorer — data is passed in as arguments

## Out of scope for this feature

- NL generation of fix explanations (that is M3 — 004-nl-interface)
- UI rendering (that is M4 — 005-dashboard-ui)
- Storing or persisting scores
- Historical score trending
