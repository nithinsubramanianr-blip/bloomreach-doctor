# Handoff: 001 Synthetic Data Layer — Architect → Dev

**Date:** 2026-05-22
**From:** Architect
**To:** Dev
**Spec:** specs/001-synthetic-data/

## What was designed

C5 data files are already created. The Architect pass locked the schemas and access patterns.

## What Dev needs to do

C5 has no source code to write — the data files are the deliverable. Dev's job for spec 001:

1. **Verify** all 6 data files exist and pass schema validation:
   - `data/personas.json` — 3 personas, all fields, demo_query="necklace"
   - `data/prs_pre_fix.json` — composite=52
   - `data/prs_post_fix.json` — composite=70
   - `data/fix_catalogue.json` — rank 1 = autosegment_coverage
   - `data/products.json` — 50 products, all GBP
   - `data/segments.json` — 3 segment definitions

2. **Verify** `data/cached-results/` has 6 files (placeholders acceptable for now)

3. **Write a Jest test** in `tests/` that imports these files and validates:
   - prs_pre_fix.json composite_score === 52
   - prs_post_fix.json composite_score === 70
   - All 3 personas have demo_query === "necklace"
   - products.json has exactly 50 entries, all currency === "GBP"

## Files to touch
- `tests/c5-data/data-integrity.test.js` (create)

## Dependency check
- 001 requirements-spec: ✅ approved
- 001 architecture-spec: ✅ approved
- 001 design-spec: ✅ approved
