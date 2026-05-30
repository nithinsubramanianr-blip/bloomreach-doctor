/**
 * M1 Bloomreach — Analytics MCP client.
 *
 * Sources the A/B Test Coverage PRS dimension over HTTP MCP transport.
 *
 * Endpoint: BLOOMREACH_MCP_ANALYTICS_URL
 * Falls back to C5 synthetic data when not in live mode or live call fails.
 */

'use strict';

const { loadSyntheticDimension, isLiveMode, selectedState } = require('./_synthetic-loader');
const { normaliseDimension } = require('./normaliser');
const { callMcpToolWithRetry } = require('./mcp-bridge');

const CLIENT_NAME = 'analytics-mcp-client';

// Demo narrative: activating boost rules also schedules 3 A/B tests (one per
// rule) to measure the lift. Surfaced in the AFTER overlay.
const ADDED_AB_TESTS_AFTER = 3;

function logFallback(reason) {
  const suffix = reason ? ` (${reason})` : '';
  // eslint-disable-next-line no-console
  console.log(`[m1-bloomreach] ${CLIENT_NAME} using synthetic fallback${suffix}`);
}

async function fetchABTestCoverage() {
  if (!isLiveMode()) {
    logFallback();
    return normaliseDimension(loadSyntheticDimension('ab_test_coverage'), true);
  }
  try {
    const raw = await callLiveABTestCoverage();
    return normaliseDimension(raw, false);
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return normaliseDimension(loadSyntheticDimension('ab_test_coverage'), true);
  }
}

async function callLiveABTestCoverage() {
  const projectId = process.env.BLOOMREACH_PROJECT_ID;
  if (!projectId) throw new Error('BLOOMREACH_PROJECT_ID required');

  // MCP: list_experiments — running vs total experiments in the project.
  const payload = await callMcpToolWithRetry('list_experiments', { project_id: projectId });

  const all = (payload.data || []).filter((e) => !e.archived);
  const liveRunning = all.filter((e) => e.status === 'running').length;
  const liveTotal = all.length;

  // AFTER overlay: assume 3 A/B tests were configured for the activated rules.
  const state = selectedState();
  const running = state === 'post_fix' ? liveRunning + ADDED_AB_TESTS_AFTER : liveRunning;
  const total = state === 'post_fix' ? liveTotal + ADDED_AB_TESTS_AFTER : liveTotal;

  const raw_value = total > 0 ? running / total : 0;
  const normalised_score = Math.min(20, Math.round(raw_value * 20));
  const status = normalised_score <= 8 ? 'critical' : normalised_score <= 14 ? 'warning' : 'healthy';

  const result = {
    dimension_id: 'ab_test_coverage',
    raw_value,
    normalised_score,
    status,
    data_source: 'analytics_mcp',
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(`[ppd:analytics-mcp] ← ab_test_coverage state=${state} live=${liveRunning}/${liveTotal} effective=${running}/${total} raw=${raw_value.toFixed(2)} score=${normalised_score} status=${status}`);
  return result;
}

module.exports = {
  fetchABTestCoverage,
};
