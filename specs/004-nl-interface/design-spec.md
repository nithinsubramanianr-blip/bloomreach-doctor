---
feature: Natural Language Interface
spec_id: "004"
phase: design
owner: Architect
status: approved
version: "1.0"
---

# Design Spec — Natural Language Interface (004 / M3)

## Function Signatures

### query-handler.js
```javascript
/**
 * Public API of M3. M4 calls this and nothing else.
 * @param queryText - raw user input (will be sanitised internally)
 * @param currentPRSState - current M2→M4 PRS state object
 */
async function handleQuery(queryText: string, currentPRSState: PRSState): Promise<AgentResponse>
```

### tools-registry.js
```javascript
// Returns array of Claude tool definitions for the 5 M1 fetchers
function getToolDefinitions(): ClaudeToolDefinition[]

// Tool names (must match M1 export names exactly):
// fetchBRUIDMatchRate, fetchAutoSegmentCoverage, fetchSignalFreshness,
// fetchRuleConflicts, fetchABTestCoverage
```

### reasoning-chain.js
```javascript
interface ReasoningContext {
  query: string;
  intent: 'diagnosis' | 'fix-request' | 'dimension-drill' | 'archetype-compare';
  prs_snapshot: PRSState;
  tool_hint: string;  // guidance sentence for the LLM system prompt
}

function runReasoningChain(intent: string, queryText: string, prsState: PRSState): ReasoningContext
```

### llm-explainer.js
```javascript
interface LLMExplainerResult {
  llm_response: {
    summary_sentence: string;
    score_breakdown: string;
    top_3_fixes: string[];
    suggested_next_action: string;
  };
  reasoning_trace: ReasoningTraceStep[];
  raw_tool_calls: object[];  // for debugging only, not surfaced to M4
}

interface ReasoningTraceStep {
  tool_name: string;
  tool_input: object;
  tool_output_summary: string;  // truncated to 200 chars for UI display
}

async function explainWithClaude(context: ReasoningContext): Promise<LLMExplainerResult>
```

### response-formatter.js
```javascript
// M3→M4 Agent Response Object (matches CLAUDE.md contract exactly)
interface AgentResponse {
  query: string;
  intent: string;
  reasoning_trace: ReasoningTraceStep[];
  llm_response: {
    summary_sentence: string;
    score_breakdown: string;
    top_3_fixes: string[];
    suggested_next_action: string;
  };
  timestamp: string;  // ISO8601
}

function formatResponse(explainerResult: LLMExplainerResult, context: ReasoningContext): AgentResponse
```

## Claude API Call Structure

```javascript
// In llm-explainer.js only
const response = await anthropic.messages.create({
  model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  max_tokens: 1500,
  tools: getToolDefinitions(),
  tool_choice: { type: 'auto' },
  system: SYSTEM_PROMPT,  // static — see below
  messages: [
    { role: 'user', content: buildUserPrompt(context) }
  ]
});
```

## System Prompt (static)
```
You are a Bloomreach personalisation expert helping Amanda Valdez, Digital
Personalization Manager at Kendra Scott. You have access to real-time data
from Bloomreach Discovery, Engagement, and MCP tools.

When answering, always:
1. Call the relevant data tools first to get current metrics
2. Identify the root cause before recommending fixes
3. Prioritise fixes by revenue impact

Structure your final response as JSON with these fields:
- summary_sentence: one sentence summarising the situation
- score_breakdown: explain each contributing dimension in 1–2 sentences
- top_3_fixes: array of 3 fix descriptions, most impactful first
- suggested_next_action: one concrete next step Amanda can take today
```

## Intent Classification Rules (query-handler.js)

```javascript
const INTENT_PATTERNS = {
  'diagnosis': [/why.*not working/i, /what.*wrong/i, /personalisation.*broken/i, /diagnos/i],
  'fix-request': [/what.*fix/i, /how.*improve/i, /what.*do first/i, /recommend/i],
  'dimension-drill': [/bruid/i, /autosegment/i, /signal freshness/i, /rule conflict/i, /a\/b test/i],
  'archetype-compare': [/customer type/i, /persona/i, /segment/i, /shopper/i, /archetype/i]
};
// Default intent if no pattern matches: 'diagnosis'
```

## Pre-loaded Demo Exchange (stored as static object in NLChat.tsx)

```javascript
// This is rendered on page load — no API call
const PRE_LOADED_EXCHANGE = {
  query: "Why is my personalisation not working?",
  intent: "diagnosis",
  reasoning_trace: [
    { tool_name: "fetchBRUIDMatchRate", tool_input: {}, tool_output_summary: "22% match rate — only 1 in 5 sessions identified" },
    { tool_name: "fetchAutoSegmentCoverage", tool_input: {}, tool_output_summary: "14% coverage — most sessions have no audience segment" },
    { tool_name: "fetchSignalFreshness", tool_input: {}, tool_output_summary: "58% freshness — signals are 3–7 days old" },
    { tool_name: "fetchRuleConflicts", tool_input: {}, tool_output_summary: "95% conflict-free — rules are clean" },
    { tool_name: "fetchABTestCoverage", tool_input: {}, tool_output_summary: "14% coverage — most queries have no A/B test" }
  ],
  llm_response: {
    summary_sentence: "Your personalisation is scoring 52/100 because most sessions can't be identified or assigned to a segment.",
    score_breakdown: "BRUID match is only 22% — guest sessions have no persistent identity. AutoSegment coverage is 14% — segments haven't been created yet. Signal freshness is acceptable at 58% but will degrade without BRUID improvement.",
    top_3_fixes: [
      "Create 3 manual audience segments in Bloomreach Engagement (12–18% RPV lift)",
      "Enable BRUID persistence for guest sessions (8–15% RPV lift)",
      "Configure A/B tests for personalised search queries (5–10% RPV lift)"
    ],
    suggested_next_action: "Start with audience segments — they unlock personalisation for 68% of your traffic with no code change required."
  },
  timestamp: "2026-05-22T00:00:00Z"
};
```

## Edge Cases

- **Anthropic API timeout:** Return error state with `{ error: true, message: "..." }`. M4 shows retry button.
- **Tool call returns NormaliserError:** Catch in `llm-explainer.js`, return synthetic fallback data for that tool, continue.
- **Claude returns no tool calls:** Proceed with context-only response. Log warning.
- **`max_tokens` exceeded mid-response:** Claude truncates — formatter handles partial `llm_response` gracefully.
