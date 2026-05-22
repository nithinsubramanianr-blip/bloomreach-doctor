---
feature: MCP Integration Layer
spec_id: "002"
module: M1
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - 001-synthetic-data requirements-spec.md is approved
  - Synthetic adapter files and normalised schema are defined
exit_criteria:
  - Three client interfaces fully specified
  - Fallback behaviour specified per client
  - Normalised schema documented
  - Acceptance criteria are testable
  - Human has set status to approved
---

# Requirements Spec — MCP Integration Layer (002 / M1)

## Problem

Bloomreach exposes data through two different surfaces: the Loomi Connect MCP server (two logical channels — Marketing and Analytics) and the Discovery REST API (separate auth, separate base URL). A single data-access abstraction would collapse these differences and make the synthetic ↔ live swap harder. Three separate clients with a shared normaliser gives each surface the right adapter while keeping the scoring and NL layers completely decoupled from transport details.

## User stories

- **US-002-1:** As a developer, I want to call a single `getMarketingData()` function that returns AutoSegment coverage and signal freshness regardless of whether the source is live MCP or synthetic JSON.
- **US-002-2:** As a developer, I want the same interface for `getAnalyticsData()` (A/B test coverage, revenue) and `getDiscoveryData()` (BRUID match rate, rule conflicts).
- **US-002-3:** As an ops engineer, I want each client to fail gracefully to synthetic data if the live endpoint is unreachable, so the demo never crashes mid-presentation.

## Functional requirements

### Client interfaces

- **FR-002-1:** `src/m1-mcp/marketing-client.js` SHALL export `getMarketingData()` returning: `{ autosegment_coverage_rate, sessions_assigned, total_sessions, signal_freshness_band, hours_since_most_recent_event }`.
- **FR-002-2:** `src/m1-mcp/analytics-client.js` SHALL export `getAnalyticsData()` returning: `{ ab_test_coverage_rate, active_rules, rules_with_test, active_tests }`.
- **FR-002-3:** `src/m1-mcp/discovery-client.js` SHALL export `getDiscoveryData()` returning: `{ bruid_match_rate, sessions_with_bruid, total_sessions, detected_conflicts, conflict_pairs }`.

### Fallback behaviour

- **FR-002-4:** Each client SHALL check the `DATA_SOURCE` environment variable. If `DATA_SOURCE !== 'live'`, or if the live call throws or returns an empty response, the client SHALL call the corresponding synthetic adapter from `src/m5-data/`.
- **FR-002-5:** The fallback MUST be transparent — callers cannot detect whether they received live or synthetic data. Both paths produce the same schema.
- **FR-002-6:** Fallback activation SHALL be logged to the console with the message: `[m1-mcp] <client-name> falling back to synthetic data`.

### Normaliser

- **FR-002-7:** `src/m1-mcp/normaliser.js` SHALL validate the output of each client against the schema defined in `src/m5-data/schema.md`. Invalid output SHALL throw a typed `NormaliserError` with the field name and expected type.
- **FR-002-8:** The normaliser SHALL be called by each client before returning data — not by callers.

### Discovery REST auth

- **FR-002-9:** `discovery-client.js` SHALL read auth credentials from `BLOOMREACH_DISCOVERY_API_KEY` environment variable. The key SHALL never appear in source code.
- **FR-002-10:** Marketing and Analytics clients SHALL use `LOOMI_CONNECT_MARKETING_URL` and `LOOMI_CONNECT_ANALYTICS_URL` respectively. When URLs are absent, fall back to synthetic immediately without attempting a network call.

## Acceptance criteria

- [ ] `getMarketingData()` returns correct schema from synthetic adapter
- [ ] `getAnalyticsData()` returns correct schema from synthetic adapter
- [ ] `getDiscoveryData()` returns correct schema from synthetic adapter
- [ ] All three clients fall back to synthetic when `DATA_SOURCE !== 'live'`
- [ ] Fallback is logged with the correct message string
- [ ] `normaliser.js` throws `NormaliserError` when given a malformed object
- [ ] No API keys or URLs appear in any source file (grep check in tests)
- [ ] Unit tests cover: happy path (synthetic), fallback trigger, normaliser validation

## Out of scope for this feature

- MCP server URL configuration (provided by Bloomreach — stub until available)
- Write/mutation calls to any Bloomreach surface
- Caching or polling of live data
- Webhooks or push notifications from Bloomreach
