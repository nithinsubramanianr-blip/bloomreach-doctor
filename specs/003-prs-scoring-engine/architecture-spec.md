---
feature: PRS Scoring Engine
spec_id: "003"
phase: architecture
owner: Architect
status: approved
version: "1.0"
---

# Architecture Spec — PRS Scoring Engine (003 / M2)

## Role in the System

M2 takes the 5 normalised dimension objects from M1 and produces:
1. A composite PRS score (0–100) with RAG status
2. A ranked fix list (3 items)
3. The complete M2→M4 PRS State Object consumed by Module A

M2 has zero side effects. It is a pure computation layer.

```
M1 fetchAllDimensions()
         │
         ▼
  dimension-scorers.js   (raw_value → score 0–20, status)
         │
         ▼
  prs-calculator.js      (sum 5 scores → composite, RAG)
         │
         ▼
  fix-generator.js       (sort by score asc → map to fix_catalogue → sort by RPV desc)
         │
         ▼
  M2→M4 PRS State Object  (consumed by PRSScorecard.tsx and NLChat.tsx)
```

## Key Architectural Decisions

### ADR-003-1: All three files export pure functions only
No class instances, no module-level state, no async. Input in → output out. This makes the scoring engine trivially testable and means Jest tests run in milliseconds.

### ADR-003-2: Scorers do NOT read from data/ directly
The locked demo values are **baked into the synthetic fallback path in M1**, not hardcoded in the scorers. Scorers apply the formula to whatever `raw_value` they receive. This means the same scorer works for both live data and synthetic data.

### ADR-003-3: Formula vs locked values
`score = Math.round(raw_value * 20)`, capped at 20. For live data this formula applies. For synthetic data, M1 already returns the locked normalised_score — M2 scorers receive it and pass it through. The scorer does NOT need special-casing for demo vs live.

### ADR-003-4: Fix generator algorithm is deterministic
Sort dimensions by `normalised_score` ascending. On ties, sort by `dimension_id` alphabetically (consistent tiebreak). Take bottom 3. Map each to `fix_catalogue.json` by `dimension_linked` field. Sort mapped fixes by estimated RPV lift max descending.

From pre-fix: AutoSegment(6), ABTest(6) tied → alphabetical: `ab_test_coverage` before `autosegment_coverage` — but both map to catalogue; after RPV sort: AutoSegment(18% max) ranks 1, BRUID(15% max) ranks 2, ABTest(10% max) ranks 3. ✓

## File Responsibilities

| File | Input | Output | Side effects |
|---|---|---|---|
| dimension-scorers.js | `{ raw_value: number }` | `{ score, status, explanation }` | None |
| prs-calculator.js | `DimensionResult[]` (5) | `PRSState` | None |
| fix-generator.js | `PRSState` | `FixResult[]` (3) | None |
