/**
 * M3 NL Interface — Constants.
 *
 * Houses the PRE_LOADED_EXCHANGE demo exchange object referenced by
 * design-spec 004 § "Pre-loaded Demo Exchange". M4 NLChat.tsx imports this
 * and renders it immediately on mount — no API call on page load
 * (FR-004-18). The object shape MUST match the M3→M4 Agent Response Object
 * contract in CLAUDE.md so it slots into the same UI renderer as live
 * agent responses.
 *
 * Also exports INTENT_LABELS for downstream UI use.
 */

'use strict';

/** @type {readonly ['diagnosis','fix-request','dimension-drill','archetype-compare']} */
const INTENT_LABELS = Object.freeze([
  'diagnosis',
  'fix-request',
  'dimension-drill',
  'archetype-compare',
]);

/** Default intent when no regex pattern matches a query. */
const DEFAULT_INTENT = 'diagnosis';

/**
 * Static demo exchange rendered on page load of Module C.
 * Matches the M3→M4 AgentResponse contract.
 */
const PRE_LOADED_EXCHANGE = Object.freeze({
  query: 'Why is my personalisation not working?',
  intent: 'diagnosis',
  reasoning_trace: [
    {
      tool_name: 'fetchBRUIDMatchRate',
      tool_input: {},
      tool_output_summary:
        '22% match rate — only 1 in 5 sessions identified',
    },
    {
      tool_name: 'fetchAutoSegmentCoverage',
      tool_input: {},
      tool_output_summary:
        '14% coverage — most sessions have no audience segment',
    },
    {
      tool_name: 'fetchSignalFreshness',
      tool_input: {},
      tool_output_summary:
        '58% freshness — signals are 3–7 days old',
    },
    {
      tool_name: 'fetchRuleConflicts',
      tool_input: {},
      tool_output_summary:
        '95% conflict-free — rules are clean',
    },
    {
      tool_name: 'fetchABTestCoverage',
      tool_input: {},
      tool_output_summary:
        '14% coverage — most queries have no A/B test',
    },
  ],
  llm_response: {
    summary_sentence:
      "Your personalisation is scoring 52/100 because most sessions can't be identified or assigned to a segment.",
    score_breakdown:
      'BRUID match is only 22% — guest sessions have no persistent identity. AutoSegment coverage is 14% — segments haven’t been created yet. Signal freshness is acceptable at 58% but will degrade without BRUID improvement.',
    top_3_fixes: [
      'Create 3 manual audience segments in Bloomreach Engagement (12–18% RPV lift)',
      'Enable BRUID persistence for guest sessions (8–15% RPV lift)',
      'Configure A/B tests for personalised search queries (5–10% RPV lift)',
    ],
    suggested_next_action:
      'Start with audience segments — they unlock personalisation for 68% of your traffic with no code change required.',
  },
  timestamp: '2026-05-22T00:00:00Z',
});

module.exports = {
  INTENT_LABELS,
  DEFAULT_INTENT,
  PRE_LOADED_EXCHANGE,
};
