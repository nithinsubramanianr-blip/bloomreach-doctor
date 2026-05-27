/**
 * M1 Bloomreach — Analytics MCP client.
 *
 * Sources the A/B Test Coverage PRS dimension over HTTP MCP transport.
 *
 * Endpoint: BLOOMREACH_MCP_ANALYTICS_URL
 * Falls back to C5 synthetic data when not in live mode or live call fails.
 */

'use strict';

const { loadSyntheticDimension, isLiveMode } = require('./_synthetic-loader');
const { normaliseDimension } = require('./normaliser');
const { callMcpToolWithRetry } = require('./mcp-bridge');

const CLIENT_NAME = 'analytics-mcp-client';

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
  const running = all.filter((e) => e.status === 'running').length;
  const total = all.length;

  const raw_value = total > 0 ? running / total : 0;
  const normalised_score = Math.min(20, Math.round(raw_value * 20));
  const status = normalised_score <= 8 ? 'critical' : normalised_score <= 14 ? 'warning' : 'healthy';

  return {
    dimension_id: 'ab_test_coverage',
    raw_value,
    normalised_score,
    status,
    data_source: 'analytics_mcp',
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  fetchABTestCoverage,
};
