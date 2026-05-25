---
feature: Bloomreach Integration Layer
spec_id: "002"
module: M1
phase: implementation
owner: Dev
status: approved
version: "1.0"
implemented_on: "2026-05-25"
branch: feature/react-app
---

# Implementation Spec — Bloomreach Integration Layer (002 / M1)

## What was built

Seven CommonJS files in `src/m1-bloomreach/`, plus one internal loader and a Jest suite under `tests/m1-bloomreach/`.

### Source files

| File | Exports | Purpose |
|---|---|---|
| `src/m1-bloomreach/normaliser.js` | `normaliseDimension`, `NormaliserError` | Pure, sync. Validates M1→M2 contract. Throws `NormaliserError` with `field`, `expected`, `received`. |
| `src/m1-bloomreach/discovery-client.js` | `fetchBRUIDMatchRate`, `fetchRuleConflicts`, `searchProducts` | Discovery REST surface. Synthetic-only path (no Discovery write). |
| `src/m1-bloomreach/engagement-client.js` | `fetchPersonaProfiles`, `fetchSegmentStatus` | Engagement REST surface. Reads from `data/personas.json` and `data/segments.json` in synthetic mode. |
| `src/m1-bloomreach/marketing-mcp-client.js` | `fetchAutoSegmentCoverage`, `fetchSignalFreshness` | Marketing MCP over HTTP. |
| `src/m1-bloomreach/analytics-mcp-client.js` | `fetchABTestCoverage` | Analytics MCP over HTTP. |
| `src/m1-bloomreach/rule-manager.js` | `getRuleActivationState` | READ-ONLY. No write path exists. |
| `src/m1-bloomreach/prs-data-fetcher.js` | `fetchAllDimensions` | M1→M2 boundary. `Promise.all` over the four clients, returns five dimensions in canonical order. |
| `src/m1-bloomreach/_synthetic-loader.js` | internal helpers | Centralised `require` of `data/prs_pre_fix.json` / `prs_post_fix.json` selected by `DEMO_STATE`. |

### Test file

| File | Cases |
|---|---|
| `tests/m1-bloomreach/m1-bloomreach.test.js` | 19 tests across normaliser, all 5 dimension fetchers, `searchProducts`, `engagement-client`, `rule-manager`, and `prs-data-fetcher`. |

## Contract conformance

- M1→M2 dimension object emits all 7 required fields: `dimension_id`, `raw_value` (0–1), `normalised_score` (0–20 int), `status` (critical|warning|healthy), `data_source`, `timestamp` (ISO8601), `is_synthetic`.
- Locked demo values from `prs_pre_fix.json` / `prs_post_fix.json` are passed through verbatim — never recomputed (per CLAUDE.md "locked demo scores take precedence over the formula output").
- `fetchAllDimensions()` returns dimensions in the canonical order: `[bruid_match_rate, autosegment_coverage, signal_freshness, rule_conflicts, ab_test_coverage]`.

## Synthetic fallback pattern

Each fetcher follows the same shape:

```js
if (process.env.DATA_SOURCE !== 'live') {
  console.log('[m1-bloomreach] <client-name> using synthetic fallback');
  return normaliseDimension(loadSyntheticDimension('<id>'), true);
}
try {
  return normaliseDimension(await callLiveAPI(), false);
} catch (err) {
  console.log('[m1-bloomreach] <client-name> using synthetic fallback (' + err.message + ')');
  return normaliseDimension(loadSyntheticDimension('<id>'), true);
}
```

State selection via `DEMO_STATE` env: `pre_fix` (default) or `post_fix`. `rule-manager.js` returns `all_active=false` on `pre_fix` and `all_active=true` on `post_fix` — matching the Option X demo mechanic.

## Test command and summary

```
npm test
```

Multi-project Jest run.

```
Test Suites: 7 passed, 7 total
Tests:       100 passed, 100 total
```

New M1 tests: 19 (all passing). Pre-existing C5 + M2 + M5 tests: 81 (all passing). No regression.

## Constraint compliance

- No `@anthropic-ai/sdk` import in any M1 file (`grep -rn '@anthropic-ai/sdk' src/m1-bloomreach/` returns no matches).
- No `react`, `next`, or `vite` imports in M1.
- No ESM (`import`/`export`) in M1; all files use `require` / `module.exports`.
- `rule-manager.js` is read-only — no write code path exists, even on the live branch (which is stubbed to throw).
- No API keys or secrets in source.
- Currency is GBP throughout the search response synthesiser.
- Three personas only (guest, sarah, alex); demo query "necklace" produces a non-empty product list.
- `normaliser.js` is pure (sync) — no `async` and no I/O.

## Caveats

- **Synthetic-only path tested.** Sandbox credentials are unavailable (`BLOOMREACH_DISCOVERY_API_KEY`, `BLOOMREACH_ENGAGEMENT_API_KEY`, `BLOOMREACH_MCP_MARKETING_URL`, `BLOOMREACH_MCP_ANALYTICS_URL`). All `callLive*` functions are stubs that throw with `"<surface> not configured — sandbox credentials unavailable"`. When live credentials arrive, only those stubs need to be replaced; the fallback wiring, normaliser, and tests stay as-is.
- `searchProducts` falls back to synthesising results from `data/products.json` because `data/cached-results/*.json` currently contain empty product arrays (TA1 to populate before demo). The synthesiser applies the persona+state boost contract documented in `personas.json` (gift_eligible for Sarah, premium/new for Alex, bestseller for guest).
- `searchProducts` reads `bruid` and infers persona by substring match (`sarah`, `alex`, else `guest`) consistent with the cookie values in `data/personas.json`.
- `discovery-client.js` does not contain `node-fetch` / `axios` imports because no live HTTP call is made in this build; the stubs document the intended endpoints.

## Files NOT modified (per scope guard)

- `CLAUDE.md` — Orchestrator updates pipeline row after parallel Devs return.
- `package.json`, `jest.config.js`, `jest.setup.js`, `jest.styleMock.js` — pre-conditions established.
- `data/*` — read-only.
- Other modules (`src/m2-scoring/`, `src/m3-nl/`, `src/m4-dashboard/`, `src/m5-plp/`).
