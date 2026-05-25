/**
 * M3 NL Interface — Reasoning Chain.
 *
 * Pure, sync helper that assembles the structured ReasoningContext
 * object passed to `llm-explainer.js`. No LLM call here per
 * architecture-spec § "File Responsibilities".
 *
 * Per ADR-004-6, the user query is *already sanitised* by `query-handler.js`
 * before reaching this function. We embed the sanitised query as
 * structured context — never injecting raw text into the system prompt.
 *
 * Per FR-004-6 the context object carries:
 *   { query, intent, prs_snapshot, tool_hint }
 *
 * `tool_hint` is a deterministic guidance string the LLM sees in the
 * user message (NOT the system prompt). It hints at the *kind* of
 * answer the user wants — Claude still chooses which tools to call.
 */

'use strict';

const TOOL_HINTS = Object.freeze({
  'diagnosis':
    'Amanda is asking for a full diagnosis. Inspect every PRS dimension before answering.',
  'fix-request':
    'Amanda is asking what to fix first. Focus on the lowest-scoring dimensions and recommend the highest-impact remediations.',
  'dimension-drill':
    'Amanda is drilling into a single dimension. Fetch the relevant dimension data and explain its root cause.',
  'archetype-compare':
    'Amanda wants to compare personalisation quality across customer archetypes (Guest, Sarah, Alex). Use coverage and freshness signals.',
});

/**
 * Assemble the ReasoningContext object.
 *
 * @param {string} intent  one of the four intent labels
 * @param {string} sanitisedQuery  user query, already sanitised
 * @param {object} prsState  M2→M4 PRS state object (read-only)
 * @returns {{
 *   query: string,
 *   intent: string,
 *   prs_snapshot: object,
 *   tool_hint: string
 * }}
 */
function runReasoningChain(intent, sanitisedQuery, prsState) {
  return {
    query: sanitisedQuery,
    intent,
    prs_snapshot: prsState == null ? null : prsState,
    tool_hint: TOOL_HINTS[intent] || TOOL_HINTS['diagnosis'],
  };
}

module.exports = {
  runReasoningChain,
  TOOL_HINTS,
};
