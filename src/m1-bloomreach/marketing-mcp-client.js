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

const { loadSyntheticDimension, isLiveMode, selectedState } = require('./_synthetic-loader');
const { normaliseDimension } = require('./normaliser');
const { callMcpToolWithRetry } = require('./mcp-bridge');

const CLIENT_NAME = 'marketing-mcp-client';

// Demo narrative: activating boost rules adds 3 manual segments to Engagement
// (one per persona) and configures 3 A/B tests for those rules. These constants
// are surfaced in the AFTER overlay so the score actually lifts on toggle.
const ADDED_SEGMENTS_AFTER = 3;

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

function projectId() {
  const id = process.env.BLOOMREACH_PROJECT_ID;
  if (!id) throw new Error('BLOOMREACH_PROJECT_ID required');
  return id;
}

function statusFromScore(score) {
  if (score <= 8) return 'critical';
  if (score <= 14) return 'warning';
  return 'healthy';
}

async function callLiveAutoSegmentCoverage() {
  // Prefer `list_autosegments` (true autosegments). Some sandboxes deny that
  // permission — fall through to `list_segmentations` (manual segments) which
  // satisfies the PRS dimension's coverage intent.
  let payload;
  try {
    payload = await callMcpToolWithRetry('list_autosegments', { project_id: projectId() });
  } catch (err) {
    payload = await callMcpToolWithRetry('list_segmentations', { project_id: projectId() });
  }

  const all = (payload.data || []).filter((s) => !s.archived);
  const liveActive = all.filter((s) => s.status === 'active' || s.is_active === true).length;
  const liveTotal = all.length;

  // AFTER overlay: pretend the 3 demo segments (Gifting / High Value / New
  // Prospecting) were created and linked to active boost rules. This is the
  // demo narrative — toggle reflects "what if we added 3 segments now?".
  const state = selectedState();
  const active = state === 'post_fix' ? liveActive + ADDED_SEGMENTS_AFTER : liveActive;
  const total = state === 'post_fix' ? liveTotal + ADDED_SEGMENTS_AFTER : liveTotal;

  const raw_value = total > 0 ? active / total : 0;
  const normalised_score = Math.min(20, Math.round(raw_value * 20));

  const result = {
    dimension_id: 'autosegment_coverage',
    raw_value,
    normalised_score,
    status: statusFromScore(normalised_score),
    data_source: 'marketing_mcp',
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(`[ppd:marketing-mcp] ← autosegment_coverage state=${state} live=${liveActive}/${liveTotal} effective=${active}/${total} raw=${raw_value.toFixed(2)} score=${normalised_score} status=${result.status}`);
  return result;
}

async function callLiveSignalFreshness() {
  // MCP: get_project_overview — exposes session_start event_count and total_customers.
  const payload = await callMcpToolWithRetry('get_project_overview', { project_id: projectId() });

  const overview = payload.data || payload || {};
  const totalCustomers = overview.total_customers || 0;
  const events = overview.event_types_overview || {};
  const sessionEvents = (events.session_start && events.session_start.event_count) || 0;

  if (totalCustomers === 0) throw new Error('signal_freshness: total_customers is zero');

  const raw_value = Math.min(sessionEvents / totalCustomers, 1.0);
  const normalised_score = Math.min(20, Math.round(raw_value * 20));

  const result = {
    dimension_id: 'signal_freshness',
    raw_value,
    normalised_score,
    status: statusFromScore(normalised_score),
    data_source: 'marketing_mcp',
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(`[ppd:marketing-mcp] ← signal_freshness sessions=${sessionEvents} customers=${totalCustomers} raw=${raw_value.toFixed(2)} score=${normalised_score} status=${result.status}`);
  return result;
}

module.exports = {
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
};
