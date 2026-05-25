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
  throw new Error('live Analytics MCP not configured — endpoint unavailable');
}

module.exports = {
  fetchABTestCoverage,
};
