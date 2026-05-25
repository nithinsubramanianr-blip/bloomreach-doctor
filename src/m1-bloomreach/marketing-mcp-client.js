/**
 * M1 Bloomreach — Marketing MCP client.
 *
 * Sources two PRS dimensions over HTTP MCP transport:
 *   - AutoSegment Coverage  (% sessions assigned to a named AutoSegment)
 *   - Signal Freshness      (% behavioural signals within freshness threshold)
 *
 * Endpoint: BLOOMREACH_MCP_MARKETING_URL
 * Falls back to C5 synthetic data when not in live mode or live call fails.
 */

'use strict';

const { loadSyntheticDimension, isLiveMode } = require('./_synthetic-loader');
const { normaliseDimension } = require('./normaliser');

const CLIENT_NAME = 'marketing-mcp-client';

function logFallback(reason) {
  const suffix = reason ? ` (${reason})` : '';
  // eslint-disable-next-line no-console
  console.log(`[m1-bloomreach] ${CLIENT_NAME} using synthetic fallback${suffix}`);
}

async function fetchAutoSegmentCoverage() {
  if (!isLiveMode()) {
    logFallback();
    return normaliseDimension(loadSyntheticDimension('autosegment_coverage'), true);
  }
  try {
    const raw = await callLiveAutoSegmentCoverage();
    return normaliseDimension(raw, false);
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return normaliseDimension(loadSyntheticDimension('autosegment_coverage'), true);
  }
}

async function fetchSignalFreshness() {
  if (!isLiveMode()) {
    logFallback();
    return normaliseDimension(loadSyntheticDimension('signal_freshness'), true);
  }
  try {
    const raw = await callLiveSignalFreshness();
    return normaliseDimension(raw, false);
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return normaliseDimension(loadSyntheticDimension('signal_freshness'), true);
  }
}

async function callLiveAutoSegmentCoverage() {
  throw new Error('live Marketing MCP not configured — endpoint unavailable');
}

async function callLiveSignalFreshness() {
  throw new Error('live Marketing MCP not configured — endpoint unavailable');
}

module.exports = {
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
};
