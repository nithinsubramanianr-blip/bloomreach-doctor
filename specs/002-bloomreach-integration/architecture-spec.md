---
feature: Bloomreach Integration Layer
spec_id: "002"
phase: architecture
owner: Architect
status: approved
version: "1.0"
---

# Architecture Spec — Bloomreach Integration Layer (002 / M1)

## Role in the System

M1 is the **only layer that talks to external data sources**. Every other module (M2, M3, M4, M5) must go through M1 to get Bloomreach data. M1 returns normalised dimension objects — callers never see raw API responses.

```
External World                  M1                          Internal Modules
─────────────────────────────   ─────────────────────────   ──────────────────
Discovery REST API ──────────► discovery-client.js   ──┐
Engagement REST API ─────────► engagement-client.js  ──┤
Marketing MCP ───────────────► marketing-mcp-client  ──┤─► normaliser.js ──► M2, M3, M4
Analytics MCP ───────────────► analytics-mcp-client  ──┘
                                rule-manager.js ──────────► M4 Module B
C5 synthetic data ───────────► [all clients, as fallback]
```

## Key Architectural Decisions

### ADR-002-1: Four clients, never merged
Each Bloomreach surface has its own auth, base URL, and response shape. Merging them would create a monolith that breaks when one surface changes auth. Four files, four auth patterns, one normaliser boundary.

### ADR-002-2: The normaliser is the only validation point
Clients return raw parsed objects. The normaliser validates structure and types, attaches `is_synthetic`, and emits `DimensionObject`. If validation fails it throws `NormaliserError` — callers catch this, not silence it.

### ADR-002-3: Synthetic fallback is transparent
`DATA_SOURCE` env var controls the path. `'live'` → attempt real API call, fall back to synthetic on error. Any other value → go straight to synthetic. The fallback returns the **same schema** as live — callers cannot detect which path was taken (except via `is_synthetic` flag).

### ADR-002-4: `prs-data-fetcher.js` is the M1→M2 handoff boundary
M2 calls only `fetchAllDimensions()`. M2 never imports individual clients. This means M1 internals can be refactored without touching M2.

### ADR-002-5: `rule-manager.js` is read-only and separate
Rule state reads are a different concern from dimension scoring. `rule-manager.js` is called by M4 Module B to decide which "state" the Before/After toggle represents. It MUST NOT write or mutate rule state.

### ADR-002-6: MCP clients use HTTP transport
Until official Bloomreach MCP SDK is confirmed, `marketing-mcp-client.js` and `analytics-mcp-client.js` call the MCP endpoint over HTTP (`BLOOMREACH_MCP_MARKETING_URL`, `BLOOMREACH_MCP_ANALYTICS_URL`). The function signatures are stable regardless of transport.

## Module Boundaries

| File | Imports | Exports | Must NOT import |
|---|---|---|---|
| discovery-client.js | node-fetch / axios, .env | fetchBRUIDMatchRate, fetchRuleConflicts | @anthropic-ai/sdk, react |
| engagement-client.js | node-fetch / axios, .env | fetchPersonaProfiles, fetchSegmentStatus | @anthropic-ai/sdk, react |
| marketing-mcp-client.js | node-fetch / axios, .env | fetchAutoSegmentCoverage, fetchSignalFreshness | @anthropic-ai/sdk, react |
| analytics-mcp-client.js | node-fetch / axios, .env | fetchABTestCoverage | @anthropic-ai/sdk, react |
| normaliser.js | — (pure functions) | normaliseDimension, NormaliserError | anything async |
| rule-manager.js | discovery-client.js | getRuleActivationState | write operations |
| prs-data-fetcher.js | all 4 clients, normaliser | fetchAllDimensions | react, M2, M3, M4 |
