---
feature: Natural Language Interface
spec_id: "004"
module: M3
phase: requirements
owner: PM
status: draft
version: "2.0"
entry_criteria:
  - 001, 002, 003 requirements-spec.md approved
  - ANTHROPIC_API_KEY available
exit_criteria:
  - True agentic tool use (Option A) fully specified
  - Option B fallback specified
  - Pre-loaded demo queries specified
  - Acceptance criteria testable
  - Human has set status to approved
---

# Requirements Spec — Natural Language Interface (004 / M3)

## Problem
A dashboard that shows a score is not an agent. Module C is where the "Agent Behaviour & Intelligence" judging criterion (20% of score) is won or lost. The NL interface must demonstrate: **understand → decide → recommend**, with Claude selecting tools at runtime and the reasoning trace visible in the UI.

## User
**Amanda Valdez**, Digital Personalization Manager, Kendra Scott. She types plain-English questions and expects expert answers, not generic AI output.

## Functional Requirements

### query-handler.js (entry point)

- **FR-004-1:** `handleQuery(queryText, currentPRSState)` SHALL be the sole public API of M3. M4 calls this function only.
- **FR-004-2:** SHALL classify intent into: `diagnosis`, `fix-request`, `dimension-drill`, `archetype-compare`. Classification via keyword/pattern matching — no separate LLM call.
- **FR-004-3:** SHALL pass classified intent + PRS state to `reasoning-chain.js`, then pass the assembled context to `llm-explainer.js`, then format via `response-formatter.js`.

### tools-registry.js

- **FR-004-4:** SHALL register the five M1 data fetchers as Claude tool definitions in the format required by the Anthropic API (`name`, `description`, `input_schema`).
- **FR-004-5:** SHALL export `getToolDefinitions()` returning the array of tool definitions for injection into the Claude API call.

### reasoning-chain.js

- **FR-004-6:** `runReasoningChain(intent, currentPRSState)` SHALL assemble the context object: `{ query, intent, prs_snapshot, mcp_evidence, fix_list }`. This is passed to the LLM as structured context.
- **FR-004-7:** SHALL log each step to a structured array that feeds the reasoning trace UI panel.

### llm-explainer.js (the ONLY file that may import @anthropic-ai/sdk)

- **FR-004-8:** SHALL use Claude `claude-sonnet-4-20250514` (configurable via `CLAUDE_MODEL` env var).
- **FR-004-9:** SHALL use **native tool use with `tool_choice: { type: "auto" }`**. Claude selects which tools to call at runtime. This is Option A — the canonical implementation.
- **FR-004-10:** SHALL extract the reasoning trace from `tool_use` and `tool_result` content blocks in the Claude API response.
- **FR-004-11:** `max_tokens` SHALL be capped at 1500.
- **FR-004-12:** System prompt SHALL establish Claude as a Bloomreach personalisation expert helping Amanda Valdez. SHALL specify output structure: `summary_sentence`, `score_breakdown`, `top_3_fixes`, `suggested_next_action`.
- **FR-004-13:** The user prompt SHALL be constructed from structured data only (PRS state, tool outputs). No raw user-typed text injected without sanitisation.
- **FR-004-14:** **Option B fallback** (activate ONLY if Option A not working by end of Day 3): code calls all five fetchers manually, builds log object, passes to Claude for explanation only. Scores lower on Agent Behaviour criterion.

### Intent → Tool Selection

| Intent | Tools Claude Should Select |
|---|---|
| `diagnosis` | All 5 tools (full sweep) |
| `fix-request` | Bottom 2 dimension tools + fix catalogue |
| `dimension-drill` | Only the tool for the named dimension |
| `archetype-compare` | `fetchAutoSegmentCoverage` + `fetchSignalFreshness` + persona data |

### response-formatter.js

- **FR-004-15:** `formatResponse(claudeResponse, reasoningTrace)` SHALL return the M3→M4 Agent Response Object: `{ query, intent, reasoning_trace, llm_response, timestamp }`.
- **FR-004-16:** SHALL sanitise Claude output before returning (XSS prevention — treat LLM output as untrusted).

### Pre-loaded Demo Exchanges

- **FR-004-17:** Three quick-action chip queries SHALL be pre-seeded in the M4 Module C UI (chips above input box):
  1. "Why is my personalisation not working?"
  2. "What should I fix first?"
  3. "Show me what good personalisation looks like for my top 3 customer types"
- **FR-004-18:** On initial load, Module C SHALL show a pre-loaded exchange for query 1 with a full agent response including reasoning trace.

## Acceptance Criteria
- [ ] Intent classifier correctly categorises all 4 intent types (unit tests)
- [ ] `llm-explainer.js` is the only file importing `@anthropic-ai/sdk` (grep check)
- [ ] `tool_choice: { type: "auto" }` is set in all API calls (Option A)
- [ ] Reasoning trace extracted from `tool_use` / `tool_result` blocks
- [ ] `max_tokens` capped at 1500
- [ ] Pre-loaded exchange renders on page load without API call
- [ ] Response sanitised before return (XSS check)
- [ ] No raw user text injected into prompt without sanitisation

## Out of Scope
- Streaming responses
- Persistent chat history across sessions
- Multi-turn memory
- More than 4 intent types
