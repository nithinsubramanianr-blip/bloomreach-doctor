# MCP Tool Map — Loomi AI MCP Servers

**Status:** Placeholder — to be completed once Loomi AI MCP endpoint docs are received.

This document maps Loomi AI MCP tools to PRS dimensions. Until sandbox credentials and MCP docs arrive, all clients fall back to synthetic data.

---

## Expected Integration Model

```
Claude (M3 — llm-explainer.js)
    ↓ tool_choice: auto
Loomi AI MCP Servers
    ├── Marketing MCP  →  AutoSegment Coverage + Signal Freshness
    └── Analytics MCP  →  A/B Test Coverage
```

The two MCP clients (`marketing-mcp-client.js`, `analytics-mcp-client.js`) in M1 call these servers and return normalised dimension objects to M2.

---

## Marketing MCP

**Env var:** `BLOOMREACH_MCP_MARKETING_URL`
**Client:** `src/m1-bloomreach/marketing-mcp-client.js`

| Tool (expected) | PRS Dimension | Raw Value Type | Notes |
|---|---|---|---|
| TBD — pending Loomi docs | AutoSegment Coverage | float 0.0–1.0 | % of sessions matched to a segment |
| TBD — pending Loomi docs | Signal Freshness | float 0.0–1.0 | Recency of behavioural signals |

**What we need from Loomi docs:**
- Exact tool/endpoint names
- Request schema (auth headers, query params)
- Response schema (where is the coverage %, where is the freshness timestamp)

---

## Analytics MCP

**Env var:** `BLOOMREACH_MCP_ANALYTICS_URL`
**Client:** `src/m1-bloomreach/analytics-mcp-client.js`

| Tool (expected) | PRS Dimension | Raw Value Type | Notes |
|---|---|---|---|
| TBD — pending Loomi docs | A/B Test Coverage | float 0.0–1.0 | % of search traffic in an active A/B test |

**What we need from Loomi docs:**
- Exact tool/endpoint names
- Request schema
- Response schema (active experiment count, traffic split)

---

## Dimensions NOT sourced from MCP

These two dimensions come from Bloomreach Discovery REST API directly — not MCP:

| Dimension | Source | Client |
|---|---|---|
| BRUID Match Rate | Discovery REST API | `discovery-client.js` |
| Rule Conflicts | Discovery REST API | `rule-manager.js` |

Engagement persona data also comes from Engagement REST API (`engagement-client.js`), not MCP.

---

## When Loomi MCP Docs Arrive — Checklist

- [ ] Fill in tool names for Marketing MCP (AutoSegment Coverage, Signal Freshness)
- [ ] Fill in tool names for Analytics MCP (A/B Test Coverage)
- [ ] Confirm auth method (API key header, OAuth, or MCP session token)
- [ ] Confirm response schema for each tool
- [ ] Update `marketing-mcp-client.js` and `analytics-mcp-client.js` with real endpoints
- [ ] Set `BLOOMREACH_MCP_MARKETING_URL` and `BLOOMREACH_MCP_ANALYTICS_URL` in `.env`
- [ ] Update CLAUDE.md to replace "Marketing MCP" / "Analytics MCP" with actual Loomi tool names
- [ ] Remove `is_synthetic: true` flags from these dimensions
