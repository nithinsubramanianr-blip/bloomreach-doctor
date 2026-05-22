---
feature: NL Interface (Ask the Doctor)
spec_id: "004"
module: M3
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - 001-synthetic-data requirements-spec.md is approved
  - 002-mcp-integration requirements-spec.md is approved
  - 003-prs-scoring-engine requirements-spec.md is approved
  - ANTHROPIC_API_KEY available in environment
exit_criteria:
  - Intent classification categories defined
  - Reasoning chain logic specified
  - Claude API usage boundaries defined (model, max_tokens, safety)
  - Pre-loaded demo exchange fully specified
  - Acceptance criteria are testable
  - Human has set status to approved
---

# Requirements Spec — NL Interface / Ask the Doctor (004 / M3)

## Problem

The PRS scorecard tells Amanda *what* is broken. Module C tells her *why* and *what to do about it* — in plain English, with the reasoning visible. This is what makes the product an agent rather than a dashboard. Without Module C, the "Agent Behaviour & Intelligence" judging criterion (20% of score) scores near zero.

## User

**Amanda Valdez** — Digital Personalization Manager at Kendra Scott. She understands e-commerce and Bloomreach but not raw telemetry. She needs an expert she can ask questions to.

## User stories

- **US-004-1:** As Amanda, I want to type "Why is 1:1 personalization not working?" and receive a specific explanation in plain English, not a generic dashboard tooltip.
- **US-004-2:** As Amanda, I want to see which data sources the agent consulted so I can trust its answer.
- **US-004-3:** As Amanda, I want to ask follow-up questions (e.g., "Which archetype is most affected?") and get contextually relevant answers.
- **US-004-4:** As a hackathon judge, I want to see the agent's reasoning chain — which tools it called and why — so I can evaluate the quality of the agentic behaviour.

## Functional requirements

### Intent classification

- **FR-004-1:** `intent-classifier.js` SHALL classify each user query into one of four categories: `diagnosis` (why is something wrong?), `fix-request` (how do I fix X?), `dimension-drill` (tell me more about dimension Y), `archetype-compare` (how does X persona differ from Y?).
- **FR-004-2:** Classification SHALL be based on keyword and pattern matching — no separate LLM call for classification (cost control).

### Reasoning chain

- **FR-004-3:** `reasoning-chain.js` SHALL accept the classified intent and return an ordered list of tool calls to make. Each tool call entry: `{ tool_name, client, rationale }`.
- **FR-004-4:** For `diagnosis` intent: tool calls SHALL include at minimum `getDiscoveryData` (BRUID, rule conflicts) + `getMarketingData` (segments, freshness) + `getAnalyticsData` (A/B tests).
- **FR-004-5:** For `dimension-drill` intent: tool calls SHALL be limited to the client(s) that own that dimension (e.g., "BRUID" → Discovery only).
- **FR-004-6:** For `archetype-compare` intent: tool calls SHALL fetch search results for the specified archetypes from `data/search-results.json` via the synthetic adapter.

### Tool executor

- **FR-004-7:** `tool-executor.js` SHALL execute the tool calls from the reasoning chain in order and return `{ tool_name, data, duration_ms }` per call.
- **FR-004-8:** Tool execution SHALL be logged in real time — the UI shows each tool completing as it happens (reasoning trace panel).

### LLM explainer

- **FR-004-9:** `llm-explainer.js` SHALL be the ONLY file that imports `@anthropic-ai/sdk`. All other files are prohibited.
- **FR-004-10:** The system prompt SHALL establish the agent as "a Bloomreach personalization expert helping Amanda Valdez" and instruct it to be specific, data-driven, and action-oriented.
- **FR-004-11:** The model SHALL be `claude-sonnet-4-20250514` (configurable via `CLAUDE_MODEL` env var).
- **FR-004-12:** `max_tokens` SHALL be capped at 1000.
- **FR-004-13:** The user prompt SHALL be constructed entirely from structured data (scores, labels, tool outputs). No raw user-typed text SHALL be injected into the prompt without sanitisation.
- **FR-004-14:** The response SHALL be structured as: `{ executive_summary, score_breakdown, top_fixes: [{ fix, estimated_impact, next_step }], next_action }`.

### Pre-loaded demo exchange

- **FR-004-15:** On initial load, Module C SHALL display a pre-loaded exchange: Query: "Why is 1:1 personalization not working?" with a full agent response showing:
  - Reasoning trace: 3 tool calls (Discovery, Marketing, Analytics) with rationale
  - Executive summary: 2–3 sentences referencing the 52/100 score
  - Top fixes: BRUID Match Rate #1 (estimated 8–12% RPV lift), Rule Conflicts #2, A/B Test Coverage #3
  - Next action: "Implement BRUID persistence — ask your dev team to verify `_br_uid_2` cookie lifetime is set to 365 days"

### Response rendering

- **FR-004-16:** Responses SHALL be rendered as formatted HTML (markdown → HTML). Not as raw markdown strings.
- **FR-004-17:** Claude output SHALL be sanitised before DOM insertion to prevent XSS.
- **FR-004-18:** The reasoning trace panel SHALL be collapsed by default with a toggle to expand. Expanded state shows each tool call: name, client, rationale, duration_ms.
- **FR-004-19:** A loading state ("Consulting Bloomreach data...") SHALL be shown while tool execution is in progress.
- **FR-004-20:** A graceful error state with a retry button SHALL appear on API failure.

### Copy and share

- **FR-004-21:** The rendered response SHALL have a "Copy to clipboard" button that copies the plain-text version.

## Acceptance criteria

- [ ] Intent classifier correctly categorises all four intent types with test cases
- [ ] Reasoning chain returns correct tool list for each intent type
- [ ] `llm-explainer.js` is the only file importing `@anthropic-ai/sdk` (grep check)
- [ ] `max_tokens` is 1000 in all API calls
- [ ] Pre-loaded exchange renders on page load without a live API call
- [ ] Loading state shown while API call is in flight
- [ ] Error state and retry appear when API key is invalid
- [ ] Response rendered as HTML, not raw markdown
- [ ] Reasoning trace panel toggles open/closed
- [ ] "Copy to clipboard" copies plain text
- [ ] No raw user text injected into prompt without sanitisation

## Out of scope for this feature

- Streaming responses (single response only)
- Persistent chat history across sessions
- Multi-turn memory beyond a single exchange
- Claude tool use / function calling (text generation only, tool simulation in reasoning-chain.js)
- Sending diagnosis output via email or Slack from within the app
