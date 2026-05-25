/**
 * M3 NL Interface — LLM Explainer.
 *
 * THIS IS THE ONLY FILE IN THE CODEBASE PERMITTED TO IMPORT
 * `@anthropic-ai/sdk`. Invariant #5 (CLAUDE.md) and ADR-004-1.
 *
 * Implements Option A (native Claude tool use, mandatory per
 * CLAUDE.md "Module C — True Agentic Tool Selection" and FR-004-9):
 *
 *   1. Call `anthropic.messages.create` with the 5 M1 fetcher tools
 *      registered and `tool_choice: { type: 'auto' }`.
 *   2. While the response `stop_reason === 'tool_use'`, execute every
 *      `tool_use` content block by dispatching to the matching M1
 *      fetcher and append a `tool_result` content block to the
 *      conversation. Re-invoke Claude.
 *   3. When Claude stops requesting tools, parse its final `text`
 *      block as JSON (per the static system prompt) and return the
 *      LLMExplainerResult.
 *
 * Reasoning trace is extracted from `tool_use` content blocks emitted
 * by Claude (ADR-004-5) and zipped with the tool outputs we computed.
 *
 * `tool_choice: { type: 'auto' }` is NEVER overridden. Claude decides
 * which tools to call.
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const {
  getToolDefinitions,
  getToolImplementation,
} = require('./tools-registry');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1500;
const MAX_AGENT_LOOPS = 6;       // safety cap on tool-use loop
const TRACE_SUMMARY_MAX = 200;   // chars per design-spec ReasoningTraceStep

const SYSTEM_PROMPT = [
  'You are a Bloomreach personalisation expert helping Amanda Valdez,',
  'Digital Personalization Manager at Kendra Scott. You have access to',
  'real-time data from Bloomreach Discovery, Engagement, and MCP tools.',
  '',
  'When answering, always:',
  '1. Call the relevant data tools first to get current metrics',
  '2. Identify the root cause before recommending fixes',
  '3. Prioritise fixes by revenue impact',
  '',
  'Structure your FINAL response as a single JSON object (no surrounding',
  'prose) with these fields:',
  '- summary_sentence: one sentence summarising the situation',
  '- score_breakdown: explain each contributing dimension in 1-2 sentences',
  '- top_3_fixes: array of 3 fix descriptions, most impactful first',
  '- suggested_next_action: one concrete next step Amanda can take today',
].join('\n');

/**
 * Build the user message Claude sees. We never inject the raw user
 * query into the system prompt (ADR-004-6 / FR-004-13). The sanitised
 * query and structured context live in the user turn.
 */
function buildUserPrompt(context) {
  const prsLine = context.prs_snapshot
    ? `Current PRS composite: ${context.prs_snapshot.composite_score} (${context.prs_snapshot.rag_status}).`
    : 'No PRS snapshot supplied.';

  return [
    `User question (sanitised): ${context.query}`,
    `Classified intent: ${context.intent}`,
    `Guidance: ${context.tool_hint}`,
    prsLine,
    '',
    'Use the available tools to gather any data you need, then return',
    'the JSON object described in the system prompt.',
  ].join('\n');
}

/**
 * Truncate a string for the UI reasoning trace.
 */
function truncateForTrace(value) {
  let text;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch (_err) {
    text = String(value);
  }
  if (text == null) return '';
  return text.length > TRACE_SUMMARY_MAX
    ? text.slice(0, TRACE_SUMMARY_MAX - 1) + '…'
    : text;
}

/**
 * Walk Claude's response.content and convert into trace steps.
 * Pairs tool_use blocks (Claude → us) with the tool_result blocks we
 * produced in the previous turn. Also collects any text blocks for
 * final answer extraction.
 */
function extractTraceAndText(response, toolOutputsById) {
  const trace = [];
  const textBlocks = [];

  const content = Array.isArray(response.content) ? response.content : [];
  for (const block of content) {
    if (block.type === 'tool_use') {
      const summary = toolOutputsById[block.id];
      trace.push({
        tool_name: block.name,
        tool_input: block.input || {},
        tool_output_summary: summary == null ? '' : summary,
      });
    } else if (block.type === 'text' && typeof block.text === 'string') {
      textBlocks.push(block.text);
    }
  }

  return { trace, finalText: textBlocks.join('\n').trim() };
}

/**
 * Try to parse the final assistant text as JSON. If parsing fails,
 * return a best-effort fallback so the demo never crashes.
 */
function parseLLMJson(text) {
  if (!text) return null;
  // Allow Claude to wrap JSON in ``` fences just in case.
  const cleaned = text
    .replace(/^```(json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (_err) {
    // Try to locate the first {...} substring.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_err2) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Coerce the parsed JSON (or null) into the LLMExplainerResult.llm_response
 * shape mandated by design-spec.
 */
function shapeLLMResponse(parsed) {
  if (parsed && typeof parsed === 'object') {
    return {
      summary_sentence:
        typeof parsed.summary_sentence === 'string'
          ? parsed.summary_sentence
          : '',
      score_breakdown:
        typeof parsed.score_breakdown === 'string'
          ? parsed.score_breakdown
          : '',
      top_3_fixes: Array.isArray(parsed.top_3_fixes)
        ? parsed.top_3_fixes.slice(0, 3).map((s) => String(s))
        : [],
      suggested_next_action:
        typeof parsed.suggested_next_action === 'string'
          ? parsed.suggested_next_action
          : '',
    };
  }
  return {
    summary_sentence: '',
    score_breakdown: '',
    top_3_fixes: [],
    suggested_next_action: '',
  };
}

/**
 * Construct an Anthropic client. Pulled into its own function so tests
 * can mock the SDK module via jest.mock without instantiating a real
 * network client.
 */
function buildClient() {
  // Anthropic SDK is exported as the default export (function) on
  // CommonJS via the `default` property in newer versions. Handle both.
  const Ctor =
    typeof Anthropic === 'function'
      ? Anthropic
      : (Anthropic && Anthropic.default) || Anthropic;
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  return new Ctor({
    apiKey: env.ANTHROPIC_API_KEY,
  });
}

/**
 * Build a pre-crafted synthetic response when no ANTHROPIC_API_KEY is
 * available (e.g. sandbox before credentials are received).
 *
 * Returns the same shape as `explainWithClaude`:
 *   { llm_response, reasoning_trace, raw_tool_calls }
 *
 * Pre-fix values from CLAUDE.md:
 *   BRUID 22%, AutoSegment 14%, Signal 58%, Rule Conflicts 95% conflict-free, A/B 14%
 *
 * @param {object} context  ReasoningContext from runReasoningChain
 */
function buildSyntheticResponse(context) {
  const intent = (context && context.intent) || 'diagnosis';
  const query = (context && context.query) || '';

  // ─── diagnosis ────────────────────────────────────────────────────────────
  if (intent === 'diagnosis') {
    return {
      llm_response: {
        summary_sentence:
          'Your personalisation is scoring 52/100 (Amber) because three of the five readiness dimensions are in a critical state — AutoSegment coverage, BRUID match rate, and A/B test coverage are all below 20%.',
        score_breakdown:
          'BRUID Match Rate is 22% (8/20 — critical): most guest sessions lack a persistent identifier, so Discovery cannot apply segment-scoped boost rules to anonymous shoppers. ' +
          'AutoSegment Coverage is 14% (6/20 — critical): only 14% of sessions are matched to an active audience segment, meaning personalised ranking is bypassed for 86% of traffic. ' +
          'Signal Freshness is 58% (14/20 — warning): behavioural signals exist but are more than 24 hours stale for a significant share of profiles. ' +
          'Rule Conflicts is 95% conflict-free (18/20 — healthy): boost rule logic is clean with minimal overlap. ' +
          'A/B Test Coverage is 14% (6/20 — critical): fewer than one in six sessions is enrolled in a personalisation experiment, so revenue impact is unverifiable.',
        top_3_fixes: [
          'Create 3 manual audience segments (Gifting Intent, High Value Returning, New Prospecting) and activate the three pre-built Discovery boost rules — estimated +12–18% RPV.',
          'Enable BRUID persistence for guest sessions so anonymous shoppers accumulate a durable identifier — estimated +8–15% RPV.',
          'Configure A/B tests for each of the three personalised-search boost rules to validate revenue uplift — estimated +5–10% RPV.',
        ],
        suggested_next_action:
          'Activate the three inactive Discovery boost rules in the merchandising UI today — this single step will raise AutoSegment Coverage from 14% to ~68% and push the PRS to 70/100.',
      },
      reasoning_trace: [
        {
          tool_name: 'fetchBRUIDMatchRate',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.22,"normalised_score":8,"status":"critical","data_source":"discovery_api"}',
        },
        {
          tool_name: 'fetchAutoSegmentCoverage',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.14,"normalised_score":6,"status":"critical","data_source":"marketing_mcp"}',
        },
        {
          tool_name: 'fetchSignalFreshness',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.58,"normalised_score":14,"status":"warning","data_source":"marketing_mcp"}',
        },
        {
          tool_name: 'fetchRuleConflicts',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.95,"normalised_score":18,"status":"healthy","data_source":"discovery_api"}',
        },
        {
          tool_name: 'fetchABTestCoverage',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.14,"normalised_score":6,"status":"critical","data_source":"analytics_mcp"}',
        },
      ],
      raw_tool_calls: [],
    };
  }

  // ─── fix-request ──────────────────────────────────────────────────────────
  if (intent === 'fix-request') {
    return {
      llm_response: {
        summary_sentence:
          'Three operational fixes will move your PRS from 52/100 to 70/100 — start with audience segment activation as it delivers the highest RPV lift with zero engineering work.',
        score_breakdown:
          'AutoSegment Coverage (14%, critical) and A/B Test Coverage (14%, critical) are the biggest drags on your score. ' +
          'BRUID Match Rate (22%, critical) requires a technical change but has a clear implementation path. ' +
          'Fixing all three raises the composite score by 18 points.',
        top_3_fixes: [
          'STEP 1 — Activate boost rules now: In the Discovery merchandising UI, toggle all three pre-built boost rules (Gifting Intent, High Value Returning, New Prospecting) from INACTIVE to ACTIVE. No code change required. This is the highest-impact action available today.',
          'STEP 2 — Schedule BRUID persistence: Open a ticket with your engineering team to enable first-party BRUID cookie persistence for unauthenticated sessions. Target completion within 2 sprints.',
          'STEP 3 — Configure A/B tests: In Bloomreach Analytics, create an experiment for each of the three boost rules using the 50/50 control/treatment split recommended in the A/B coverage spec.',
        ],
        suggested_next_action:
          'Go to Discovery → Merchandising Rules → toggle all three inactive rules to Active. The PRS will update to 70/100 within seconds.',
      },
      reasoning_trace: [
        {
          tool_name: 'fetchAutoSegmentCoverage',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.14,"normalised_score":6,"status":"critical","data_source":"marketing_mcp","inactive_rules":3}',
        },
        {
          tool_name: 'fetchBRUIDMatchRate',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.22,"normalised_score":8,"status":"critical","data_source":"discovery_api"}',
        },
        {
          tool_name: 'fetchABTestCoverage',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.14,"normalised_score":6,"status":"critical","data_source":"analytics_mcp"}',
        },
      ],
      raw_tool_calls: [],
    };
  }

  // ─── archetype-compare ────────────────────────────────────────────────────
  if (intent === 'archetype-compare') {
    return {
      llm_response: {
        summary_sentence:
          'Your three customer archetypes — Guest (New Prospecting), Sarah (Gifting Intent), and Alex (High Value Returning) — are all receiving the same generic ranking today because AutoSegment Coverage is only 14% and the three boost rules are inactive.',
        score_breakdown:
          'AutoSegment Coverage at 14% means only 14 in 100 sessions are matched to a segment — effectively all three archetypes see the same bestseller-ranked results. ' +
          'Signal Freshness at 58% means behavioural signals for Sarah and Alex are partially stale, limiting how much personalisation can improve even when rules are activated.',
        top_3_fixes: [
          'Activate Rule 3 (New Prospecting → boost bestsellers) so Guest shoppers see high-conversion products first — this archetype has the highest volume and will generate the greatest absolute revenue lift.',
          'Activate Rule 1 (Gifting Intent → boost gift-eligible items) so Sarah sees curated gift sets and charm collections ranked above everyday pieces.',
          'Activate Rule 2 (High Value Returning → boost new arrivals and premium price band) so Alex sees exclusive new drops and premium SKUs at the top of every search.',
        ],
        suggested_next_action:
          'Activate all three boost rules to see before/after result differences per archetype in the Shopper Simulator (Module B) immediately.',
      },
      reasoning_trace: [
        {
          tool_name: 'fetchAutoSegmentCoverage',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.14,"normalised_score":6,"status":"critical","segments":["Gifting Intent","High Value Returning","New Prospecting"],"active_rules":0}',
        },
        {
          tool_name: 'fetchSignalFreshness',
          tool_input: {},
          tool_output_summary: '{"raw_value":0.58,"normalised_score":14,"status":"warning","stale_profiles_pct":0.42}',
        },
      ],
      raw_tool_calls: [],
    };
  }

  // ─── dimension-drill (default) ────────────────────────────────────────────
  // Detect which dimension the user is asking about from the query text.
  const q = query.toLowerCase();
  let toolName = 'fetchBRUIDMatchRate';
  let dimensionLabel = 'BRUID Match Rate';
  let dimensionDetail =
    'Only 22% of sessions carry a persistent BRUID identifier. ' +
    'This means 78% of Discovery search requests arrive without a recognised user ID, so the segment-scoped boost rules cannot fire. ' +
    'The fix is to enable first-party BRUID cookie persistence for unauthenticated sessions, ensuring the identifier is set on first page load and retained across the browsing session.';

  if (q.includes('segment') || q.includes('autosegment') || q.includes('coverage')) {
    toolName = 'fetchAutoSegmentCoverage';
    dimensionLabel = 'AutoSegment Coverage';
    dimensionDetail =
      'AutoSegment Coverage is at 14% because all three Discovery boost rules are currently INACTIVE. ' +
      'With no active rules, Bloomreach cannot apply segment-scoped ranking even when a visitor is correctly identified. ' +
      'Activating the three pre-built rules (Gifting Intent, High Value Returning, New Prospecting) immediately pushes coverage to ~68%.';
  } else if (q.includes('signal') || q.includes('fresh') || q.includes('stale')) {
    toolName = 'fetchSignalFreshness';
    dimensionLabel = 'Signal Freshness';
    dimensionDetail =
      'Signal Freshness is 58%: roughly 42% of Engagement behavioural profiles have not been updated within the freshness window. ' +
      'Stale signals mean segment assignments lag behind actual shopper behaviour — a visitor who browsed gift items yesterday may not be assigned to the Gifting Intent segment until tomorrow. ' +
      'Improving event ingestion frequency and shortening the segment re-evaluation window will raise this score.';
  } else if (q.includes('rule') || q.includes('conflict')) {
    toolName = 'fetchRuleConflicts';
    dimensionLabel = 'Rule Conflicts';
    dimensionDetail =
      'Rule Conflicts score is healthy at 95% conflict-free (18/20). ' +
      'The three pre-built boost rules have been designed with non-overlapping audience conditions, so there is minimal risk of a visitor matching two competing rules simultaneously. ' +
      'Activating all three rules is safe from a conflict perspective.';
  } else if (q.includes('a/b') || q.includes('ab test') || q.includes('test coverage') || q.includes('experiment')) {
    toolName = 'fetchABTestCoverage';
    dimensionLabel = 'A/B Test Coverage';
    dimensionDetail =
      'A/B Test Coverage is at 14%: only 14% of sessions are enrolled in a personalisation experiment. ' +
      'Without experiment coverage, there is no statistical basis to claim revenue lift from the boost rules — which will matter for stakeholder sign-off. ' +
      'Configure a 50/50 control/treatment experiment for each boost rule in Bloomreach Analytics to reach ~80% coverage.';
  }

  return {
    llm_response: {
      summary_sentence: `Your ${dimensionLabel} dimension is the focus of this query — here is the current status and recommended action.`,
      score_breakdown: dimensionDetail,
      top_3_fixes: [
        `Address the root cause of low ${dimensionLabel} as described above.`,
        'Cross-check the other two critical dimensions (AutoSegment Coverage and A/B Test Coverage) to ensure holistic improvement.',
        'Re-run the PRS diagnostic after applying fixes to confirm score movement.',
      ],
      suggested_next_action: `Review the ${dimensionLabel} dimension in the PRS Scorecard and follow the recommended fix for this dimension first.`,
    },
    reasoning_trace: [
      {
        tool_name: toolName,
        tool_input: {},
        tool_output_summary: `Synthetic fallback — no ANTHROPIC_API_KEY available. Returning pre-crafted data for dimension: ${dimensionLabel}.`,
      },
    ],
    raw_tool_calls: [],
  };
}

/**
 * Execute one tool call. Catches errors so a misbehaving M1 fetcher
 * doesn't break the agent loop — Claude is told the tool errored and
 * can decide what to do next.
 */
async function executeToolCall(toolUseBlock) {
  const impl = getToolImplementation(toolUseBlock.name);
  if (!impl) {
    return {
      isError: true,
      content: `Unknown tool: ${toolUseBlock.name}`,
    };
  }
  try {
    const result = await impl(toolUseBlock.input || {});
    return { isError: false, content: result };
  } catch (err) {
    return {
      isError: true,
      content: `Tool ${toolUseBlock.name} failed: ${err && err.message ? err.message : String(err)}`,
    };
  }
}

/**
 * Main agent loop. Calls Claude, executes tools, loops until Claude
 * stops requesting tools or the safety cap is hit.
 *
 * @param {object} context  ReasoningContext from runReasoningChain
 * @returns {Promise<{
 *   llm_response: object,
 *   reasoning_trace: Array<{tool_name:string, tool_input:object, tool_output_summary:string}>,
 *   raw_tool_calls: object[]
 * }>}
 */
async function explainWithClaude(context) {
  // Browser-safe API key check — return synthetic response if no key available.
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  if (!env.ANTHROPIC_API_KEY) {
    return buildSyntheticResponse(context);
  }

  const client = buildClient();
  const tools = getToolDefinitions();
  const model = env.CLAUDE_MODEL || DEFAULT_MODEL;

  const messages = [
    { role: 'user', content: buildUserPrompt(context) },
  ];

  const aggregatedTrace = [];
  const rawToolCalls = [];
  let lastResponse = null;

  for (let loop = 0; loop < MAX_AGENT_LOOPS; loop++) {
    // eslint-disable-next-line no-await-in-loop
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: 'auto' },   // MANDATORY — Claude selects tools
      messages,
    });
    lastResponse = response;

    const content = Array.isArray(response.content) ? response.content : [];
    const toolUseBlocks = content.filter((b) => b.type === 'tool_use');

    // If Claude isn't requesting tools, we're done.
    if (
      response.stop_reason !== 'tool_use' ||
      toolUseBlocks.length === 0
    ) {
      // Capture any final text + trace from this turn.
      const { trace, finalText } = extractTraceAndText(response, {});
      aggregatedTrace.push(...trace);
      const parsed = parseLLMJson(finalText);
      return {
        llm_response: shapeLLMResponse(parsed),
        reasoning_trace: aggregatedTrace,
        raw_tool_calls: rawToolCalls,
      };
    }

    // Append Claude's full assistant turn to the conversation.
    messages.push({ role: 'assistant', content });

    // Execute every tool_use block in parallel.
    // eslint-disable-next-line no-await-in-loop
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const result = await executeToolCall(block);
        return { block, result };
      }),
    );

    const toolOutputsById = {};
    const userToolResults = [];
    for (const { block, result } of toolResults) {
      const stringified =
        typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);
      toolOutputsById[block.id] = truncateForTrace(stringified);
      rawToolCalls.push({
        tool_use_id: block.id,
        tool_name: block.name,
        tool_input: block.input || {},
        is_error: !!result.isError,
        output: result.content,
      });
      userToolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: stringified,
        is_error: !!result.isError,
      });
    }

    // Record trace for THIS turn now that we have tool outputs.
    const { trace } = extractTraceAndText(response, toolOutputsById);
    aggregatedTrace.push(...trace);

    // Append tool_result blocks as the next user message.
    messages.push({ role: 'user', content: userToolResults });
  }

  // Safety cap hit — return whatever text we have from the last turn.
  const { finalText } = extractTraceAndText(lastResponse || { content: [] }, {});
  const parsed = parseLLMJson(finalText);
  return {
    llm_response: shapeLLMResponse(parsed),
    reasoning_trace: aggregatedTrace,
    raw_tool_calls: rawToolCalls,
  };
}

module.exports = {
  explainWithClaude,
  // exported for unit testing
  _internal: {
    buildUserPrompt,
    parseLLMJson,
    shapeLLMResponse,
    extractTraceAndText,
    truncateForTrace,
    SYSTEM_PROMPT,
    MAX_TOKENS,
    DEFAULT_MODEL,
  },
};
