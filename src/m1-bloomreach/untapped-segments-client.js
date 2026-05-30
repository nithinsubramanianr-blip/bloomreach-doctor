/**
 * M1 Bloomreach — Untapped Segments client (FEATURE_SEGMENT_OPPORTUNITIES).
 *
 * Lists segments that exist in the live Engagement project but are NOT bound
 * to any of the three demo personas (Guest / Sarah / Alex). Surfaces these
 * as opportunities the Doctor can recommend "promoting" into a Discovery
 * boost rule.
 *
 * Falls back to a synthetic shape if MCP calls fail.
 */

'use strict';

const { callMcpToolWithRetry } = require('./mcp-bridge');
const { isLiveMode } = require('./_synthetic-loader');

const CLIENT_NAME = 'untapped-segments-client';

// Segmentation IDs already bound to the three demo personas — exclude these.
// Keep in sync with engagement-client.js PERSONA_SEGMENTATION_MAP.
const BOUND_SEGMENTATION_IDS = new Set([
  '6a19d01e94eee2e514a3ff6a', // Guest → New Prospecting
  '6a1996af3054c4016b9623dc', // Sarah → Gifting Intent
  '6a199ab780eea5f4246f7429', // Alex  → High Value Returning
]);

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

function buildSyntheticUntapped() {
  // Mirrors the wobbly-donkey sandbox state observed at build time.
  return {
    bound_count: BOUND_SEGMENTATION_IDS.size,
    untapped: [
      {
        segmentation_id: 'synthetic-active-cart-abandoner',
        name: 'Active Cart Abandoner',
        rationale: 'High-intent users who left items in cart — boost recently viewed items.',
        suggested_rule: 'boost where last_event = cart_update AND days_since_visit < 7',
        estimated_rpv_lift_pct_min: 4,
        estimated_rpv_lift_pct_max: 9,
      },
      {
        segmentation_id: 'synthetic-omni-loyalist',
        name: 'True Omnichannel Loyalist',
        rationale: 'Engaged across online + retail — promote loyalty-tier products.',
        suggested_rule: 'boost where loyalty_tier IN (gold, platinum)',
        estimated_rpv_lift_pct_min: 3,
        estimated_rpv_lift_pct_max: 6,
      },
      {
        segmentation_id: 'synthetic-high-spenders',
        name: 'Customers purchased amount > $150',
        rationale: 'Proven high-value buyers — surface premium price-band items first.',
        suggested_rule: 'boost where price_band = premium',
        estimated_rpv_lift_pct_min: 5,
        estimated_rpv_lift_pct_max: 10,
      },
    ],
    is_synthetic: true,
    timestamp: new Date().toISOString(),
  };
}

// Heuristic rule suggestion based on segment name keywords.
function suggestRuleForSegment(name) {
  const n = (name || '').toLowerCase();
  if (/cart\s*abandon/.test(n)) {
    return {
      rationale: 'High-intent users who left items in cart — boost recently viewed items.',
      suggested_rule: 'boost where last_event = cart_update AND days_since_visit < 7',
      min: 4, max: 9,
    };
  }
  if (/loyal|omni|vip/.test(n)) {
    return {
      rationale: 'Engaged across online + retail — promote loyalty-tier products.',
      suggested_rule: 'boost where loyalty_tier IN (gold, platinum)',
      min: 3, max: 6,
    };
  }
  if (/\$\s*\d|amount|spend|high\s*value/.test(n)) {
    return {
      rationale: 'Proven high-value buyers — surface premium price-band items first.',
      suggested_rule: 'boost where price_band = premium',
      min: 5, max: 10,
    };
  }
  return {
    rationale: 'Live segment exists but is not bound to any Discovery rule.',
    suggested_rule: 'create boost rule targeting this segment',
    min: 2, max: 6,
  };
}

async function fetchUntappedSegments() {
  if (!isLiveMode()) {
    logFallback('synthetic mode');
    return buildSyntheticUntapped();
  }

  try {
    const payload = await callMcpToolWithRetry('list_segmentations', { project_id: projectId() });
    const all = (payload.data || []).filter((s) => !s.archived);

    const untapped = all
      .filter((s) => !BOUND_SEGMENTATION_IDS.has(s._id))
      .map((s) => {
        const meta = suggestRuleForSegment(s.name);
        return {
          segmentation_id: s._id,
          name: s.name,
          rationale: meta.rationale,
          suggested_rule: meta.suggested_rule,
          estimated_rpv_lift_pct_min: meta.min,
          estimated_rpv_lift_pct_max: meta.max,
        };
      });

    return {
      bound_count: BOUND_SEGMENTATION_IDS.size,
      untapped,
      is_synthetic: false,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return buildSyntheticUntapped();
  }
}

module.exports = {
  fetchUntappedSegments,
  BOUND_SEGMENTATION_IDS,
};
