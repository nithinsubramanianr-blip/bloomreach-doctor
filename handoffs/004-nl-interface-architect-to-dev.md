# Handoff: 004 Natural Language Interface — Architect → Dev

**Date:** 2026-05-22
**From:** Architect
**To:** Dev
**Spec:** specs/004-nl-interface/

## What was designed

Five-file M3 module. Option A (native Claude tool use) is mandatory. `llm-explainer.js` is the only Anthropic SDK import. The pre-loaded demo exchange is a static object in `NLChat.tsx` — no API call on page load.

## What Dev needs to implement

### Files to create (all in `src/m3-nl/`)

| File | Key responsibility |
|---|---|
| `query-handler.js` | Entry point — `handleQuery()`. Intent classification via regex. |
| `tools-registry.js` | `getToolDefinitions()` — 5 Claude tool defs wrapping M1 fetchers |
| `reasoning-chain.js` | `runReasoningChain()` — assembles structured context |
| `llm-explainer.js` | `explainWithClaude()` — ONLY file importing `@anthropic-ai/sdk` |
| `response-formatter.js` | `formatResponse()` — emits M3→M4 Agent Response Object |

### Tool definitions (tools-registry.js)
Register these 5 tools pointing to M1 exports:
```
fetchBRUIDMatchRate     — "Get current BRUID match rate from Discovery API"
fetchAutoSegmentCoverage — "Get AutoSegment coverage from Marketing MCP"
fetchSignalFreshness    — "Get signal freshness score from Marketing MCP"
fetchRuleConflicts      — "Get rule conflict analysis from Discovery API"
fetchABTestCoverage     — "Get A/B test coverage from Analytics MCP"
```

### Claude API call (llm-explainer.js)
```javascript
tool_choice: { type: 'auto' }   // mandatory — Claude selects tools
max_tokens: 1500
model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'
```

### Reasoning trace extraction
After Claude responds, loop through `response.content`:
- `type === 'tool_use'` → add `{ tool_name, tool_input }` to trace
- `type === 'tool_result'` → add `tool_output_summary` (truncate to 200 chars)

### Pre-loaded exchange
The static `PRE_LOADED_EXCHANGE` object (defined in 004 design-spec.md) goes in `NLChat.tsx` as a module constant. Renders immediately on mount, no API call.

### Tests to write
- Intent classifier: 4 unit tests, one per intent type
- Grep test: confirm `@anthropic-ai/sdk` appears ONLY in `llm-explainer.js`
- `formatResponse` shapes output correctly (snapshot test)

## Critical constraints
- `@anthropic-ai/sdk` import ONLY in `llm-explainer.js`
- `tool_choice: { type: 'auto' }` — never hardcode tool selection
- Sanitise user input before including in prompts (XSS prevention)
- Option B (manual orchestration) — do NOT implement unless Option A fails by Day 3

## Dependency check
- 001 ✅, 002 ✅, 003 ✅ approved
- 004 requirements-spec ✅, architecture-spec ✅, design-spec ✅ approved
