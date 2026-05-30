/**
 * M1 Bloomreach — Foundation Gap client (FEATURE_FOUNDATION_GAP).
 *
 * Audits the live Engagement project for three structural foundations:
 *   1) Predictions (churn / LTV / propensity models)
 *   2) Recommendation engines
 *   3) Scenarios (automation flows)
 *
 * A project with 1M+ events but zero predictions / recommendations / scenarios
 * has no personalization foundation regardless of how well its segments or
 * rules are configured. Surfaces that gap as a complementary diagnostic to
 * the PRS Scorecard.
 *
 * Falls back to a synthetic shape if any MCP call fails.
 */

'use strict';

const { callMcpToolWithRetry } = require('./mcp-bridge');
const { isLiveMode } = require('./_synthetic-loader');

const CLIENT_NAME = 'foundation-gap-client';

function projectId() {
  const id = process.env.BLOOMREACH_PROJECT_ID;
  if (!id) throw new Error('BLOOMREACH_PROJECT_ID required');
  return id;
}

function logFallback(reason) {
  const suffix = reason ? ` (${reason})` : '';
  // eslint-disable-next-line no-console
  console.log(`[m1-bloomreach] ${CLIENT_NAME} using synthetic fallback${suffix}`);
}

function buildSyntheticFoundation() {
  // Mirrors the live wobbly-donkey sandbox state observed at build time:
  // 123K customers, 1M+ events, zero predictions/recommendations/scenarios.
  return {
    predictions:    { count: 0, present: false, samples: [] },
    recommendations:{ count: 0, present: false, samples: [] },
    scenarios:      { count: 0, present: false, samples: [] },
    total_customers: 123165,
    total_events:    1097601,
    foundation_score: 0,
    is_synthetic: true,
    timestamp: new Date().toISOString(),
  };
}

function safeCount(payload) {
  const data = payload && payload.data;
  return Array.isArray(data) ? data.length : 0;
}

function sampleNames(payload, max = 3) {
  const data = payload && payload.data;
  if (!Array.isArray(data)) return [];
  return data.slice(0, max).map((r) => r && r.name).filter(Boolean);
}

/**
 * Score: 0–100. Each of the three foundations is worth ~33 points if
 * present. We require at least 1 instance to count as "present" — a hackathon
 * sandbox could have many models in development, that's still progress.
 */
function computeFoundationScore(predCount, recCount, scnCount) {
  let score = 0;
  if (predCount > 0) score += 34;
  if (recCount > 0)  score += 33;
  if (scnCount > 0)  score += 33;
  return score;
}

async function fetchFoundationGap() {
  if (!isLiveMode()) {
    logFallback('synthetic mode');
    return buildSyntheticFoundation();
  }

  try {
    const project_id = projectId();
    // Run sequentially (NOT parallel) to respect Loomi's 1 req/sec rate limit.
    const predictions    = await callMcpToolWithRetry('list_predictions',    { project_id });
    const recommendations= await callMcpToolWithRetry('list_recommendations',{ project_id });
    const scenarios      = await callMcpToolWithRetry('list_scenarios',      { project_id });
    const overview       = await callMcpToolWithRetry('get_project_overview',{ project_id });

    const ov = (overview && overview.data) || overview || {};
    const predCount = safeCount(predictions);
    const recCount  = safeCount(recommendations);
    const scnCount  = safeCount(scenarios);

    return {
      predictions:     { count: predCount, present: predCount > 0, samples: sampleNames(predictions) },
      recommendations: { count: recCount,  present: recCount  > 0, samples: sampleNames(recommendations) },
      scenarios:       { count: scnCount,  present: scnCount  > 0, samples: sampleNames(scenarios) },
      total_customers: ov.total_customers || ov.identified_customers || 0,
      total_events:    ov.events || 0,
      foundation_score: computeFoundationScore(predCount, recCount, scnCount),
      is_synthetic: false,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return buildSyntheticFoundation();
  }
}

module.exports = {
  fetchFoundationGap,
};
