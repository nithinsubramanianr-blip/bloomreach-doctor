/**
 * M1 Bloomreach — Rule Manager (READ-ONLY).
 *
 * Reads the activation state of the three demo boost rules from Discovery.
 * Consumed by M4 Module B (Before/After toggle) and the Option X demo
 * mechanic. MUST NOT write or mutate rule state — TA1 toggles rules manually
 * in the Discovery merchandising UI during the demo.
 *
 * Synthetic resolution: DEMO_STATE=pre_fix → all rules inactive.
 *                       DEMO_STATE=post_fix → all rules active.
 */

'use strict';

const { isLiveMode } = require('./_synthetic-loader');

const CLIENT_NAME = 'rule-manager';

function logFallback(reason) {
  const suffix = reason ? ` (${reason})` : '';
  // eslint-disable-next-line no-console
  console.log(`[m1-bloomreach] ${CLIENT_NAME} using synthetic fallback${suffix}`);
}

function syntheticState() {
  const allActive = process.env.DEMO_STATE === 'post_fix';
  const status = allActive ? 'active' : 'inactive';
  return {
    rule_1_gifting: status,
    rule_2_high_value: status,
    rule_3_new_prospecting: status,
    all_active: allActive,
    checked_at: new Date().toISOString(),
  };
}

/**
 * Returns the current activation state of the three boost rules. READ ONLY.
 * Safe default on failure: all_active=false.
 */
async function getRuleActivationState() {
  if (!isLiveMode()) {
    logFallback();
    return syntheticState();
  }
  try {
    return await readLiveRuleState();
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    // Safe default per design-spec error-handling table.
    return {
      rule_1_gifting: 'inactive',
      rule_2_high_value: 'inactive',
      rule_3_new_prospecting: 'inactive',
      all_active: false,
      checked_at: new Date().toISOString(),
    };
  }
}

async function readLiveRuleState() {
  // READ ONLY against Discovery rules endpoint. Not implemented in this
  // build — sandbox credentials unavailable.
  throw new Error('live Discovery rule read not configured — sandbox credentials unavailable');
}

module.exports = {
  getRuleActivationState,
};
