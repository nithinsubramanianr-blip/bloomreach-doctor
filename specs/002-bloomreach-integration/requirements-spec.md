---
feature: Bloomreach Integration Layer
spec_id: "002"
module: M1
phase: requirements
owner: PM
status: approved
version: "2.0"
entry_criteria:
  - 001-synthetic-data requirements-spec.md is approved
  - Synthetic data files and normaliser schema confirmed
exit_criteria:
  - Four client interfaces fully specified
  - Fallback behaviour per client specified
  - Normalised M1→M2 schema documented
  - rule-manager interface specified
  - Acceptance criteria are testable
  - Human has set status to approved
---

# Requirements Spec — Bloomreach Integration Layer (002 / M1)

## Problem
Four separate Bloomreach data surfaces need unified clients: Discovery REST API (BRUID + rule conflicts), Engagement API (persona profiles + segment management), Marketing MCP (AutoSegments + signal freshness), Analytics MCP (A/B test coverage). Each has different auth, base URLs, and response shapes. The normaliser converts all four into the same schema before M2 consumes them.

## Functional Requirements

### Four Clients

- **FR-002-1:** `discovery-client.js` SHALL export `fetchBRUIDMatchRate()` and `fetchRuleConflicts()`. Auth: `BLOOMREACH_DISCOVERY_API_KEY` env var.
- **FR-002-2:** `engagement-client.js` SHALL export `fetchPersonaProfiles()` and `fetchSegmentStatus()`. Auth: `BLOOMREACH_ENGAGEMENT_API_KEY` env var.
- **FR-002-3:** `marketing-mcp-client.js` SHALL export `fetchAutoSegmentCoverage()` and `fetchSignalFreshness()`. Endpoint: `BLOOMREACH_MCP_MARKETING_URL` env var.
- **FR-002-4:** `analytics-mcp-client.js` SHALL export `fetchABTestCoverage()`. Endpoint: `BLOOMREACH_MCP_ANALYTICS_URL` env var.
- **FR-002-5:** All five PRS dimension fetchers SHALL return a pre-normalised object: `{ dimension_id, raw_value, normalised_score, status, data_source, timestamp, is_synthetic }`.

### Rule Manager

- **FR-002-6:** `rule-manager.js` SHALL export `getRuleActivationState()` returning the current state (active/inactive) of the three demo boost rules. Reads from Discovery API. Used by Module B and Option X demo mechanic.
- **FR-002-7:** `rule-manager.js` SHALL NOT write or modify rule state — read-only.

### Fallback Behaviour

- **FR-002-8:** Each client SHALL check `DATA_SOURCE` env var. If not `'live'`, or if the live call throws or returns empty, fall back to the corresponding synthetic data from `C5`.
- **FR-002-9:** Fallback MUST produce the same schema. Callers cannot detect live vs synthetic.
- **FR-002-10:** Fallback activation SHALL log: `[m1-bloomreach] <client-name> using synthetic fallback`.

### Normaliser

- **FR-002-11:** `normaliser.js` SHALL validate each client output against the M1→M2 contract schema. Invalid output SHALL throw `NormaliserError` with field name and expected type.
- **FR-002-12:** `is_synthetic: true` when data came from fallback; `is_synthetic: false` when from live.

### prs-data-fetcher.js

- **FR-002-13:** `prs-data-fetcher.js` SHALL consolidate all five dimension fetchers into one exported function: `fetchAllDimensions()` returning an array of 5 normalised dimension objects. This is the M1→M2 handoff function.

## Acceptance Criteria
- [ ] All five dimension fetchers return correct schema from synthetic adapters
- [ ] All clients fall back to synthetic when `DATA_SOURCE !== 'live'`
- [ ] Fallback logged with correct message
- [ ] `normaliser.js` throws `NormaliserError` on malformed input
- [ ] `rule-manager.js` returns correct rule states (read-only confirmed)
- [ ] No API keys in any source file (grep check)
- [ ] `fetchAllDimensions()` returns array of exactly 5 normalised dimension objects

## Out of Scope
- Writing or modifying Discovery rules (approval modal is UI-only, TA1 activates rules manually)
- Caching or polling live data
- Webhooks or push notifications
