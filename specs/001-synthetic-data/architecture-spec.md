---
feature: Synthetic Data Layer
spec_id: "001"
phase: architecture
owner: Architect
status: approved
version: "1.0"
---

# Architecture Spec — Synthetic Data Layer (001 / C5)

## Role in the System

C5 is the foundation that every other module depends on. It provides:
1. **Demo-state JSON files** — locked PRS states that drive Module A
2. **Persona definitions** — BRUID values and segment assignments consumed by M1, M4, M5
3. **Product catalogue** — 50 products consumed by Discovery import and M5 PLP
4. **Cached Discovery results** — per-persona per-state fallback consumed by M4 Module B and M5
5. **Fix catalogue** — ranked fixes consumed by M2 fix-generator and M4 Module A

## Key Architectural Decisions

### ADR-001-1: JSON files are consumed via the M1 normaliser only
All modules that need PRS data read `prs_pre_fix.json` / `prs_post_fix.json` through `src/m1-bloomreach/prs-data-fetcher.js`. No module imports these JSON files directly. This ensures the live→synthetic swap is a single-file change.

### ADR-001-2: `is_synthetic` flag is mandatory in every dimension object
Every normalised dimension object MUST carry `is_synthetic: true` when sourced from C5. This flag propagates to M4 so the UI can show a "demo data" indicator if needed.

### ADR-001-3: Cached results use `{persona_id}-{state}` key format
Cache files are named `guest-before.json`, `sarah-after.json`, etc. This matches the cache key format in `lib/resultCache.ts` (M5) and the fallback logic in `ShopperSimulator.tsx` (M4). No other format is acceptable.

### ADR-001-4: products.csv mirrors products.json exactly
The CSV is generated from the JSON. The canonical source of truth is `products.json`. If a product field changes, regenerate the CSV. Dev does not maintain both independently.

## Data Flow

```
data/prs_pre_fix.json ──────► prs-data-fetcher.js (M1) ──► M2 scoring ──► M4 Module A
data/prs_post_fix.json ─────►                 ↑
data/personas.json ─────────► engagement-client.js (M1) ──► M4 Module B / M5 persona switcher
data/fix_catalogue.json ────► fix-generator.js (M2) ──────► M4 Module A fix list
data/products.json ─────────► Discovery import (TA1 manual) ── live C2
data/cached-results/*.json ─► ShopperSimulator.tsx (M4) / resultCache.ts (M5) — fallback only
data/segments.json ─────────► TA1 reference doc (manual segment creation in Engagement)
```

## Schema Decisions

All dimension objects conform to the M1→M2 contract (defined in CLAUDE.md). No field may be omitted — the normaliser will throw `NormaliserError` on any missing field.

Products follow the Discovery catalogue import schema. The `image_url` field uses `/images/{product_id}.jpg` placeholder paths — M4 and M5 components must handle broken image URLs gracefully (grey placeholder).
