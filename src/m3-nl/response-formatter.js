/**
 * M3 NL Interface — Response Formatter.
 *
 * Shapes the LLMExplainerResult into the M3 → M4 Agent Response Object
 * defined in CLAUDE.md § "M3 → M4: Agent Response Object" and
 * design-spec 004 § "AgentResponse".
 *
 * Also enforces FR-004-16: sanitise LLM-produced strings before they
 * are surfaced to the UI.
 *
 * No SDK import here.
 */

'use strict';

const { sanitiseLLMResponseObject, sanitiseLLMText } = require('./sanitiser');

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {{
 *   llm_response: {
 *     summary_sentence: string,
 *     score_breakdown: string,
 *     top_3_fixes: string[],
 *     suggested_next_action: string
 *   },
 *   reasoning_trace: Array<{tool_name:string, tool_input:object, tool_output_summary:string}>
 * }} explainerResult
 * @param {{ query: string, intent: string }} context
 * @returns {{
 *   query: string,
 *   intent: string,
 *   reasoning_trace: Array<{tool_name:string, tool_input:object, tool_output_summary:string}>,
 *   llm_response: object,
 *   timestamp: string
 * }}
 */
function formatResponse(explainerResult, context) {
  const safeResult = explainerResult || {};
  const safeContext = context || {};

  const llm = sanitiseLLMResponseObject(
    safeResult.llm_response || {
      summary_sentence: '',
      score_breakdown: '',
      top_3_fixes: [],
      suggested_next_action: '',
    },
  );

  const trace = Array.isArray(safeResult.reasoning_trace)
    ? safeResult.reasoning_trace.map((step) => ({
        tool_name: String(step.tool_name || ''),
        tool_input: step.tool_input || {},
        tool_output_summary: sanitiseLLMText(step.tool_output_summary || ''),
      }))
    : [];

  return {
    query: String(safeContext.query || ''),
    intent: String(safeContext.intent || ''),
    reasoning_trace: trace,
    llm_response: {
      summary_sentence: llm.summary_sentence || '',
      score_breakdown: llm.score_breakdown || '',
      top_3_fixes: Array.isArray(llm.top_3_fixes) ? llm.top_3_fixes : [],
      suggested_next_action: llm.suggested_next_action || '',
    },
    timestamp: nowIso(),
  };
}

module.exports = {
  formatResponse,
};
