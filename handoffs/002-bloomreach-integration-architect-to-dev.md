# Handoff: 002 Bloomreach Integration Layer — Architect → Dev

**Date:** 2026-05-22
**From:** Architect
**To:** Dev
**Spec:** specs/002-bloomreach-integration/

## What was designed

Four-client pattern with transparent synthetic fallback. `prs-data-fetcher.js` is the M1→M2 boundary. Normaliser validates all output with typed errors.

## What Dev needs to implement

### Files to create (all in `src/m1-bloomreach/`)

| File | Key exports | Notes |
|---|---|---|
| `discovery-client.js` | `fetchBRUIDMatchRate`, `fetchRuleConflicts`, `searchProducts` | Auth: BLOOMREACH_DISCOVERY_API_KEY |
| `engagement-client.js` | `fetchPersonaProfiles`, `fetchSegmentStatus` | Auth: BLOOMREACH_ENGAGEMENT_API_KEY |
| `marketing-mcp-client.js` | `fetchAutoSegmentCoverage`, `fetchSignalFreshness` | Endpoint: BLOOMREACH_MCP_MARKETING_URL |
| `analytics-mcp-client.js` | `fetchABTestCoverage` | Endpoint: BLOOMREACH_MCP_ANALYTICS_URL |
| `normaliser.js` | `normaliseDimension`, `NormaliserError` | Pure — no async |
| `rule-manager.js` | `getRuleActivationState` | Read-only |
| `prs-data-fetcher.js` | `fetchAllDimensions` | Calls all 4 clients in parallel |

### Synthetic fallback pattern
Every client follows the same pattern (see design-spec.md for code template):
- `DATA_SOURCE !== 'live'` → load from `data/prs_pre_fix.json` or `data/prs_post_fix.json`
- Log: `[m1-bloomreach] <client-name> using synthetic fallback`
- Same schema both paths

### Tests to write (`src/m2-scoring/__tests__/` or `tests/m1-bloomreach/`)
- All 5 dimension fetchers return correct schema from synthetic path
- `NormaliserError` thrown on missing `dimension_id` field
- `fetchAllDimensions()` returns array of exactly 5 items

## Critical constraints
- NEVER import `@anthropic-ai/sdk` in any M1 file
- NEVER write to Discovery API in any M1 file
- `rule-manager.js` is READ-ONLY

## Dependency check
- 001 ✅ approved (data files exist)
- 002 requirements-spec ✅ approved
- 002 architecture-spec ✅ approved
- 002 design-spec ✅ approved
