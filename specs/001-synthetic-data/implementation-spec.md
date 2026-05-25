---
feature: Synthetic Data Layer
spec_id: "001"
phase: implementation
owner: Dev
status: approved
version: "1.0"
entry_criteria:
  - requirements-spec.md status approved
  - architecture-spec.md status approved
  - design-spec.md status approved
  - All 6 data files (+ cached-results placeholders) committed to /data
exit_criteria:
  - Workspace bootstrapped (root package.json + Jest)
  - tests/c5-data/data-integrity.test.js exists and all assertions pass
  - npm test green
  - CLAUDE.md Feature Pipeline updated: 001 Impl marked complete
---

# Implementation Spec — Synthetic Data Layer (001 / C5)

## Summary

C5 has no source code to ship — the data files in `/data/` are the deliverable, and they were authored during the Architect phase. Dev's Impl phase was scoped to (1) bootstrap the Node/Jest workspace, (2) verify the data files against the locked schemas and demo values, and (3) write a Jest suite that catches regressions in the synthetic data going forward.

## What was built

### Workspace bootstrap
- `package.json` (repo root) — minimal, single root package. `type` left as default (CommonJS) for Jest simplicity. Only `jest@^29.7.0` added as devDependency. `"test": "jest"` script.
- `jest.config.js` — Node environment, picks up `tests/**/*.test.js`, verbose output.
- `npm install` ran clean; `node_modules/` already covered by `.gitignore`.

### Tests
- `tests/c5-data/data-integrity.test.js` — 31 assertions across 6 describe blocks:
  - **PRS demo states** (11) — locked composite_scores (52, 70), rag_status, boost_rules_state, dimension count, BRUID + AutoSegment criticality in pre-fix, AutoSegment + ABTest healthy in post-fix, dimension sums match composites, every dimension carries `is_synthetic: true` (ADR-001-2).
  - **Personas** (5) — exactly 3 personas; ids are `guest|sarah|alex`; all `demo_query === "necklace"` (invariant 11); guest has `bruid_value === null`; Sarah and Alex have BRUID present.
  - **Products** (4) — exactly 50 entries; all currency `GBP` (invariant 9); no product name contains "Kendra Scott" (invariant 12); products.csv exists with `product_id` + `currency` in header.
  - **Fix catalogue** (4) — exactly 3 fixes; rank 1 → autosegment_coverage; rank 2 → bruid_match_rate; rank 3 → ab_test_coverage.
  - **Segments** (1) — segments.json defines 3 segments.
  - **Cached results** (6) — all 6 placeholder files exist under `data/cached-results/`.

## Files created / modified

| File | Action |
|---|---|
| `package.json` | created |
| `jest.config.js` | created |
| `tests/c5-data/data-integrity.test.js` | created |
| `CLAUDE.md` | updated — Feature Pipeline 001 Impl ✅ |
| `specs/001-synthetic-data/implementation-spec.md` | created (this file) |

No files in `/data/` were modified. No files under `/src/` were created (per handoff — C5 is data-only).

## Test command and output summary

```
$ npm test
PASS tests/c5-data/data-integrity.test.js
Test Suites: 1 passed, 1 total
Tests:       31 passed, 31 total
Time:        0.142 s
```

## Decisions made (not pre-specified)

1. **CommonJS over ESM.** The handoff said to default to CJS for Jest simplicity unless the design-spec said otherwise. Design-spec is TypeScript-flavoured interface notation but does not mandate runtime module format. CJS avoids the experimental ESM loader flag in Jest and keeps the test file dependency-free.
2. **Single root `package.json`** (per Orchestrator instruction). No per-module sub-packages. Other modules (M1–M5) will add their own dependencies to this root manifest as their specs reach Impl.
3. **`tests/c5-data/` subdirectory** rather than flat `tests/` — keeps room for future `tests/c5-data/`, `tests/m1-bloomreach/`, etc. Matches the spec-id-first organisation already used in `specs/`.
4. **31 assertions instead of the 4 mandatory ones.** The handoff listed 4 minimum assertions. I extended to cover all invariants the data files exist to protect (sums, RAG, is_synthetic, persona ids, no KS IP, fix catalogue ranks, cached-result placeholders). All extras read directly from requirements/design specs; nothing speculative.
5. **`segments.json` shape probe** — used a defensive lookup so the test does not depend on whether segments is keyed as `segments.segments` or a top-level array. Current file uses `segments.segments` (3-element array) — passes.

## Data discrepancies / schema issues

None blocking. One observation worth flagging upstream (no action taken — Dev does not modify data per the handoff):

- `data/prs_pre_fix.json._meta.note` contains a self-flag from the Architect phase: *"Formula flag: round(raw×20) does not produce stated scores from stated raw values. e.g. round(0.22×20)=4 not 8."* This is already resolved in CLAUDE.md ("locked demo scores take precedence over the formula output"). The note in the JSON could be removed in a future Architect pass for cleanliness but is not breaking — the tests assert the locked values, not the formula.

## Out of scope (not done in this phase)

- Populating cached-results product arrays from live Discovery (TA1/TA2 task — placeholders ship with `products: []`).
- Writing scorers, normalisers, or any `/src/` code (specs 002–006).
- A `test:e2e` script (will arrive with spec 007 / integration tests).
