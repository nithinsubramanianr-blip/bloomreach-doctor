---
feature: Bloomreach Integration Layer
spec_id: "002"
phase: design
owner: Architect
status: approved
version: "1.0"
---

# Design Spec — Bloomreach Integration Layer (002 / M1)

## Function Signatures

### discovery-client.js
```javascript
/**
 * Returns BRUID match rate dimension object.
 * Live: GET /api/v1/bruid/match-rate
 * Synthetic fallback: prs_pre_fix.json dimensions[0]
 */
async function fetchBRUIDMatchRate(): Promise<DimensionObject>

/**
 * Returns rule conflicts dimension object.
 * Live: GET /api/v1/rules/conflict-analysis
 * Synthetic fallback: prs_pre_fix.json dimensions[3]
 */
async function fetchRuleConflicts(): Promise<DimensionObject>

/**
 * Executes a Discovery product search with BRUID context.
 * Used by Module B and M5 PLP.
 * @param query - search term (always "necklace" in demo)
 * @param bruid - _br_uid_2 cookie value, or null for guest
 */
async function searchProducts(query: string, bruid: string | null): Promise<DiscoverySearchResult>
```

### engagement-client.js
```javascript
async function fetchPersonaProfiles(): Promise<PersonaProfile[]>
async function fetchSegmentStatus(): Promise<SegmentStatusResult>
```

### marketing-mcp-client.js
```javascript
async function fetchAutoSegmentCoverage(): Promise<DimensionObject>
async function fetchSignalFreshness(): Promise<DimensionObject>
```

### analytics-mcp-client.js
```javascript
async function fetchABTestCoverage(): Promise<DimensionObject>
```

### normaliser.js
```javascript
/**
 * Validates raw client output and emits a typed DimensionObject.
 * Throws NormaliserError if any required field is missing or wrong type.
 */
function normaliseDimension(raw: unknown, isSynthetic: boolean): DimensionObject

class NormaliserError extends Error {
  field: string;
  expected: string;
  received: unknown;
}
```

### rule-manager.js
```javascript
interface RuleActivationState {
  rule_1_gifting: 'active' | 'inactive';
  rule_2_high_value: 'active' | 'inactive';
  rule_3_new_prospecting: 'active' | 'inactive';
  all_active: boolean;
  checked_at: string;  // ISO8601
}

async function getRuleActivationState(): Promise<RuleActivationState>
```

### prs-data-fetcher.js (M1→M2 handoff)
```javascript
/**
 * Calls all five dimension fetchers in parallel, normalises each result.
 * Returns array of exactly 5 DimensionObjects in canonical order:
 * [bruid_match_rate, autosegment_coverage, signal_freshness, rule_conflicts, ab_test_coverage]
 */
async function fetchAllDimensions(): Promise<DimensionObject[]>
```

## Synthetic Fallback Pattern (all clients follow this)
```javascript
async function fetchSomeDimension() {
  if (process.env.DATA_SOURCE !== 'live') {
    console.log('[m1-bloomreach] <client-name> using synthetic fallback');
    return loadSyntheticDimension('dimension_id');
  }
  try {
    const raw = await callLiveAPI();
    return normaliser.normaliseDimension(raw, false);
  } catch (err) {
    console.log('[m1-bloomreach] <client-name> using synthetic fallback');
    return loadSyntheticDimension('dimension_id');
  }
}
```

## Discovery Search Response Schema
```typescript
interface DiscoverySearchResult {
  query: string;
  total: number;
  products: Array<{
    product_id: string;
    name: string;
    price: number;
    currency: 'GBP';
    category: string;
    rank_position: number;
    is_personalised: boolean;
  }>;
  cached: boolean;
  cache_key: string;
}
```

## Error Handling

| Error | Behaviour |
|---|---|
| Live API timeout (>2s) | Log warning, return synthetic fallback |
| Live API 4xx/5xx | Log error, return synthetic fallback |
| Missing env var | Treat as `DATA_SOURCE !== 'live'`, use synthetic |
| `NormaliserError` | Propagate up — do not silence. M2/M3 catch and log. |
| `getRuleActivationState` failure | Return `{ all_active: false, ... }` — safe default |

## Environment Variables Used

| Var | Used By | Behaviour if missing |
|---|---|---|
| `BLOOMREACH_DISCOVERY_API_KEY` | discovery-client | synthetic fallback |
| `BLOOMREACH_ENGAGEMENT_API_KEY` | engagement-client | synthetic fallback |
| `BLOOMREACH_MCP_MARKETING_URL` | marketing-mcp-client | synthetic fallback |
| `BLOOMREACH_MCP_ANALYTICS_URL` | analytics-mcp-client | synthetic fallback |
| `DATA_SOURCE` | all clients | defaults to `'synthetic'` |
