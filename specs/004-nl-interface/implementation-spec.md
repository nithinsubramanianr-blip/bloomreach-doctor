---
feature: Natural Language Interface
spec_id: "004"
module: M3
phase: implementation
owner: Dev
status: approved
version: "1.0"
implemented_on: "2026-05-25"
branch: feature/react-app
---

# Implementation Spec — Natural Language Interface (004 / M3)

## What was built

Module C of the Personalization Performance Doctor — the NL agent. Eight
CommonJS source files in `src/m3-nl/` and six Jest test suites under
`src/m3-nl/__tests__/`. Option A (native Claude tool use) is implemented.
`@anthropic-ai/sdk` was added as a runtime dependency.

### Source files

| File | Exports | Purpose |
|---|---|---|
| `src/m3-nl/query-handler.js` | `handleQuery` | M3 public entry point. Pipeline: sanitise → classifyIntent → runReasoningChain → explainWithClaude → formatResponse. Returns error-shaped AgentResponse on failure. |
| `src/m3-nl/intent-classifier.js` | `classifyIntent`, `INTENT_PATTERNS` | Pure, sync regex classifier. Default intent = `diagnosis`. Order: dimension-drill → fix-request → archetype-compare → diagnosis. |
| `src/m3-nl/tools-registry.js` | `getToolDefinitions`, `getToolImplementation`, `getToolNames` | Registers the 5 M1 fetchers as Claude tool definitions (`name`, `description`, `input_schema`). |
| `src/m3-nl/reasoning-chain.js` | `runReasoningChain`, `TOOL_HINTS` | Pure assembly of the `ReasoningContext` object passed to the LLM. No API call. |
| `src/m3-nl/llm-explainer.js` | `explainWithClaude`, `_internal` | **Sole importer of `@anthropic-ai/sdk`.** Implements the Claude agent loop with `tool_choice: { type: 'auto' }`, executes `tool_use` blocks via `tools-registry`, returns `LLMExplainerResult`. Safety cap = 6 agent turns. `max_tokens: 1500`. Default model `claude-sonnet-4-20250514`, overridable via `CLAUDE_MODEL`. |
| `src/m3-nl/response-formatter.js` | `formatResponse` | Shapes the LLMExplainerResult into the M3→M4 Agent Response Object. Applies XSS sanitisation to LLM text. |
| `src/m3-nl/sanitiser.js` | `sanitiseUserQuery`, `sanitiseLLMText`, `sanitiseLLMResponseObject`, `MAX_QUERY_LENGTH` | Input/output sanitisation layer. |
| `src/m3-nl/constants.js` | `PRE_LOADED_EXCHANGE`, `INTENT_LABELS`, `DEFAULT_INTENT` | Static demo exchange (FR-004-18). M4 NLChat.tsx will import this. |

### Test files (`.test.ts` — routed through the existing `react` Jest project via ts-jest)

| File | Tests |
|---|---|
| `src/m3-nl/__tests__/intent-classifier.test.ts` | 5 — one per intent + default fallback |
| `src/m3-nl/__tests__/sdk-isolation.test.ts` | 2 — confirms M3 source set, asserts only `llm-explainer.js` references `@anthropic-ai/sdk` |
| `src/m3-nl/__tests__/tools-registry.test.ts` | 6 — exactly 5 tools, exact names, schema shape, implementation resolution, deep-clone safety |
| `src/m3-nl/__tests__/response-formatter.test.ts` | 7 — contract shape, llm_response fields, trace passthrough, ISO timestamp, XSS sanitisation, missing-field tolerance, snapshot |
| `src/m3-nl/__tests__/llm-explainer.test.ts` | 7 — trace extraction, JSON parsing (incl. fenced), truncation, `tool_choice: auto` invariant, multi-tool-use turn, `CLAUDE_MODEL` env override, default model literal |
| `src/m3-nl/__tests__/query-handler.test.ts` | 3 — end-to-end happy path with mocked SDK, prompt-injection sanitisation, SDK-throws error path |

Total new M3 tests: **31**. Snapshot: 1.

## Architecture Decision Compliance

| Decision | Implementation |
|---|---|
| ADR-004-1: SDK import isolation | `src/m3-nl/llm-explainer.js` is the only file with `require('@anthropic-ai/sdk')`. Other M3 files no longer reference the SDK string at all — the `sdk-isolation.test.ts` Jest test enforces this on every CI run. |
| ADR-004-2: Claude selects tools | `tool_choice: { type: 'auto' }` is hard-coded in `llm-explainer.js`. Verified by `llm-explainer.test.ts` ("tool_choice is auto on every call (Option A invariant)"). |
| ADR-004-3: Local intent classification | `intent-classifier.js` is pure regex; no API call. Tested. |
| ADR-004-4: Tools wrap M1 fetchers 1:1 | Tool `name` ≡ M1 export name. `tools-registry.js` imports the M1 functions directly. |
| ADR-004-5: Trace extracted, not synthesised | `extractTraceAndText` walks `response.content` and emits a step per `tool_use` block, pairing it with the executed tool output. Tested with mocked multi-block responses. |
| ADR-004-6: No raw user text in system prompt | System prompt is a static template literal. The sanitised user query is placed in the *user* message only. Sanitiser strips control chars, caps length, replaces backticks and triple-quotes, and redacts prompt-injection phrases. |

## M3 → M4 Contract Conformance

`formatResponse(...)` emits exactly the keys mandated by CLAUDE.md:

```
{
  query: string,
  intent: string,
  reasoning_trace: Array<{ tool_name, tool_input, tool_output_summary }>,
  llm_response: {
    summary_sentence: string,
    score_breakdown: string,
    top_3_fixes: string[],
    suggested_next_action: string
  },
  timestamp: string  // ISO8601
}
```

Snapshot test (`response-formatter.test.ts`) pins this shape.

## Sanitisation approach

User input passes through `sanitiseUserQuery` before any concatenation:
strip ASCII control chars (preserving `\n`/`\t`), cap length at 500, replace
backticks and triple-quotes so the LLM prompt cannot be terminated by user
input, and redact known prompt-injection phrases ("ignore previous
instructions", "disregard the system", "you are now …", "system:") to
`[redacted]`. LLM-produced strings pass through `sanitiseLLMText` before
being surfaced to M4: `<script>` blocks, inline event handlers (`onerror=…`
etc.), and `javascript:` URIs are stripped. This is a deliberately simple
deny-list — it is not a full XSS/prompt-injection defence, but it closes
the obvious vectors for a demo build.

## Option A confirmation

Option A (Claude native tool use, `tool_choice: { type: 'auto' }`) is the
implemented path. Option B (manual orchestration) was **not** implemented
and is not present in the codebase. The agent loop in
`llm-explainer.explainWithClaude`:

1. Calls `anthropic.messages.create` with the 5-tool registry and
   `tool_choice: { type: 'auto' }`.
2. If `stop_reason === 'tool_use'`, executes every `tool_use` content
   block in parallel via `tools-registry.getToolImplementation(name)`.
3. Appends the assistant turn + `tool_result` blocks to the conversation
   and re-invokes Claude.
4. Terminates when Claude stops requesting tools (`stop_reason` ≠
   `'tool_use'`) or after `MAX_AGENT_LOOPS = 6` (safety cap).
5. Parses the final text block as JSON (tolerates ``` fences) and shapes
   the `llm_response` payload.

## Constraint compliance

- `@anthropic-ai/sdk` is required only in `llm-explainer.js`. Verified by
  `grep -rln "@anthropic-ai/sdk" src/m3-nl/` (returns only that file plus
  the two test files that `jest.mock(...)` the SDK).
- `tool_choice: { type: 'auto' }` is set on every Claude call. Tested.
- No imports from `react`, `next`, or `vite` in M3.
- All M3 source files are CommonJS (`require`/`module.exports`); test
  files are `.ts` only because the existing Jest config routes M3 test
  paths through the `react` (ts-jest) project — they still use CommonJS
  `require` semantics internally.
- No real network calls in tests; the SDK is `jest.mock`-ed.
- No secrets in source. `ANTHROPIC_API_KEY` is read from `process.env`
  inside `buildClient()` only.

## Tests run

```
npm test
```

```
Test Suites: 13 passed, 13 total
Tests:       131 passed, 131 total
Snapshots:   1 passed, 1 total
```

100 pre-existing tests (C5 + M1 + M2 + M5) still pass. 31 new M3 tests
added — all green. No regressions.

## Decisions made outside the brief

1. **Test file extension is `.ts`, not `.js`.** The existing `jest.config.js`
   "node" project does not match `tests/m3-nl/**` or
   `src/m3-nl/__tests__/**`; only the "react" project does, and that
   project requires `.test.ts`/`.test.tsx`. The orchestrator brief said
   we may not touch `jest.config.js`, so tests were written as `.test.ts`
   files that are still CommonJS-style (`require(...)`) under the hood
   via ts-jest's `isolatedModules: true` + `module: 'commonjs'` settings.
2. **Extra `sanitiser.js` and `intent-classifier.js` files.** Both were
   extracted from `query-handler.js` for testability and single-
   responsibility. They count as M3 internal helpers — `query-handler.js`
   is still the public entry point.
3. **Safety cap on agent loop.** Added `MAX_AGENT_LOOPS = 6` to prevent
   runaway loops if Claude misbehaves. Not in the spec but defensive.
4. **`raw_tool_calls` exposed via `LLMExplainerResult` for debugging.**
   Per design-spec it is "for debugging only, not surfaced to M4"; the
   formatter drops it.

## Files NOT modified (per scope guard)

- `CLAUDE.md` — Orchestrator updates pipeline row after this Dev returns.
- `jest.config.js`, `jest.setup.js`, `jest.styleMock.js` — pre-conditions.
- `src/m1-bloomreach/`, `src/m2-scoring/`, `src/m4-dashboard/`,
  `src/m5-plp/` — untouched.
- `data/*` — read-only.
- Other spec folders.

## Open issues

- `@anthropic-ai/sdk@0.98.0` was installed. No live Claude call has been
  exercised (no `ANTHROPIC_API_KEY` available in this sandbox); the
  contract was verified entirely via mocked-SDK tests. First live call
  must be smoke-tested by QA before the demo.
- The CommonJS interop branch in `buildClient()` handles both
  `Anthropic` as a constructor and `Anthropic.default` as a constructor.
  If the SDK packaging changes in a future version we may need to revisit.
- `PRE_LOADED_EXCHANGE` is currently exported from `src/m3-nl/constants.js`
  for the M4 NLChat.tsx import. Spec 005 (Dashboard UI) will need to
  resolve the cross-project import (CommonJS module → TSX file). One
  option is a re-export shim in M4; the cleanest is for NLChat.tsx to
  `import { PRE_LOADED_EXCHANGE } from '../../m3-nl/constants'`. Flagged
  for the M4 Dev.
