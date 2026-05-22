---
feature: Natural Language Interface
spec_id: "004"
phase: architecture
owner: Architect
status: approved
version: "1.0"
---

# Architecture Spec — Natural Language Interface (004 / M3)

## Role in the System

M3 is the agent brain. It receives a plain-English question from M4, decides which Bloomreach data sources to consult, calls them via registered tools, and returns a structured explanation with reasoning trace.

```
M4 NLChat.tsx
      │  handleQuery(queryText, currentPRSState)
      ▼
query-handler.js ──► classify intent (no LLM call)
      │
      ▼
reasoning-chain.js ──► assemble context object
      │
      ▼
llm-explainer.js ──► Anthropic API (claude-sonnet-4-20250514)
      │                   │ tool_choice: auto
      │               [Claude calls M1 tools at runtime]
      │                   │
      │               tools-registry.js registers M1 fetchers
      │
      ▼
response-formatter.js ──► M3→M4 Agent Response Object
      │
      ▼
M4 NLChat.tsx (reasoning trace panel + plain-English answer)
```

## Key Architectural Decisions

### ADR-004-1: `llm-explainer.js` is the ONLY Anthropic SDK import
All other files in M3 (and the entire codebase) are forbidden from importing `@anthropic-ai/sdk`. This is enforced by a grep check in the acceptance criteria.

### ADR-004-2: Claude selects tools at runtime (Option A — mandatory)
`tool_choice: { type: "auto" }` is non-negotiable for the judging criterion "Agent Behaviour & Intelligence". Claude decides which M1 fetchers to call based on the query context. Dev MUST NOT pre-select tools.

### ADR-004-3: Intent classification is local, not LLM-based
`query-handler.js` classifies the query via keyword/regex pattern matching. No API call for classification. This keeps latency low and cost zero for the classification step.

### ADR-004-4: Tool definitions wrap M1 fetchers exactly
`tools-registry.js` registers the 5 M1 dimension fetchers as Claude tool definitions. The tool `name` field maps 1:1 to the M1 function name. When Claude calls a tool, `llm-explainer.js` executes the corresponding M1 function and returns the result.

### ADR-004-5: Reasoning trace is extracted, not synthesised
The reasoning trace shown in the UI is extracted directly from `tool_use` and `tool_result` content blocks in the raw Claude API response. It is not generated text — it is the actual tool call log.

### ADR-004-6: User input is never injected raw into the system prompt
The system prompt is static. User query text flows through intent classification → structured context assembly. Only structured data (PRS state, tool outputs) reaches the LLM prompt.

## File Responsibilities

| File | Responsibility | LLM calls |
|---|---|---|
| query-handler.js | Entry point, intent classification, orchestration | None |
| tools-registry.js | Claude tool definitions for 5 M1 fetchers | None |
| reasoning-chain.js | Assembles structured context from intent + PRS state | None |
| llm-explainer.js | Calls Anthropic API, executes tool calls, extracts trace | Yes (sole file) |
| response-formatter.js | Shapes Claude response into M3→M4 contract | None |
