/**
 * M3 NL Interface — Query Handler (PUBLIC API of M3).
 *
 * M4 calls this and nothing else (FR-004-1). Pipeline:
 *
 *   sanitise → classifyIntent → runReasoningChain → explainWithClaude → formatResponse
 *
 * Per ADR-004-3 intent classification is local (no LLM call here).
 * Per ADR-004-1 the only file that imports the Anthropic SDK is
 * `llm-explainer.js` — this file never touches it directly.
 *
 * Returns the M3→M4 Agent Response Object on success. On unexpected
 * failure returns an error-shaped AgentResponse so M4 can render a
 * retry button instead of crashing.
 */

'use strict';

const { sanitiseUserQuery } = require('./sanitiser');
const { classifyIntent } = require('./intent-classifier');
const { runReasoningChain } = require('./reasoning-chain');
const { explainWithClaude } = require('./llm-explainer');
const { formatResponse } = require('./response-formatter');

/**
 * @param {string} queryText  raw user input (sanitised inside)
 * @param {object} [currentPRSState]  current M2→M4 PRS state object
 * @returns {Promise<object>}  Agent Response Object
 */
async function handleQuery(queryText, currentPRSState) {
  const sanitisedQuery = sanitiseUserQuery(queryText);
  const intent = classifyIntent(sanitisedQuery);
  const context = runReasoningChain(intent, sanitisedQuery, currentPRSState);

  try {
    const explainerResult = await explainWithClaude(context);
    return formatResponse(explainerResult, context);
  } catch (err) {
    // Edge case from design-spec § "Anthropic API timeout".
    // M4 inspects `error: true` to render a retry button.
    return {
      query: sanitisedQuery,
      intent,
      reasoning_trace: [],
      llm_response: {
        summary_sentence:
          'Agent is temporarily unavailable. Please try again.',
        score_breakdown: '',
        top_3_fixes: [],
        suggested_next_action: '',
      },
      timestamp: new Date().toISOString(),
      error: true,
      error_message: err && err.message ? err.message : String(err),
    };
  }
}

module.exports = {
  handleQuery,
};
