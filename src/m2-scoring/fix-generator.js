/**
 * fix-generator.js — M2 PRS Scoring Engine
 *
 * Pure function. No async. No side effects.
 *
 * Permitted exception to the "no data/ imports in M2" rule: this file MAY
 * require data/fix_catalogue.json. The catalogue is fixture content (not raw
 * API output) and the architect's ADR explicitly authorises it here.
 *
 * Algorithm:
 *   1. Sort dimensions by score ASC, tiebreak by dimension_id ASC.
 *   2. Walk that order and collect the first MAX_FIXES dimensions that have a
 *      matching fix in the catalogue. (Not every dimension has a fix — e.g.
 *      signal_freshness and rule_conflicts deliberately don't.)
 *   3. Sort the matched fixes by estimated_rpv_lift_pct_max DESC.
 *   4. Assign position 1..N.
 */

const fixCatalogue = require('../../data/fix_catalogue.json');

const MAX_FIXES = 3;

const FIX_BY_DIMENSION = (() => {
  const map = {};
  for (const fix of fixCatalogue.fixes) {
    map[fix.dimension_linked] = fix;
  }
  return map;
})();

function generateFixList(prsResult) {
  if (!prsResult || !Array.isArray(prsResult.dimensions)) {
    throw new TypeError('generateFixList expects a PRS state object with a dimensions array');
  }

  // Step 1 — sort dimensions by score ASC, tiebreak by dimension_id ASC.
  const sorted = [...prsResult.dimensions].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return String(a.dimension_id).localeCompare(String(b.dimension_id));
  });

  // Step 2 — walk that order, collect the first MAX_FIXES with a catalogue
  // match. Lets dimensions without a fix (signal_freshness, rule_conflicts)
  // fall through without starving the list.
  const matched = [];
  for (const dim of sorted) {
    const fix = FIX_BY_DIMENSION[dim.dimension_id];
    if (fix) matched.push(fix);
    if (matched.length >= MAX_FIXES) break;
  }

  // Step 3 — sort matched fixes by estimated RPV lift max DESC.
  matched.sort((a, b) => b.estimated_rpv_lift_pct_max - a.estimated_rpv_lift_pct_max);

  // Step 4 — assign position and shape to the FixResult contract.
  return matched.map((fix, idx) => ({
    position: idx + 1,
    dimension: fix.dimension_linked,
    fix_id: fix.fix_id,
    fix_title: fix.fix_title,
    description: fix.plain_english_description,
    effort: fix.effort_level,
    revenue_impact: fix.estimated_revenue_impact,
    estimated_rpv_lift_pct_min: fix.estimated_rpv_lift_pct_min,
    estimated_rpv_lift_pct_max: fix.estimated_rpv_lift_pct_max,
    action_label: fix.action_label,
    risk_level: fix.risk_level,
    steps: fix.steps,
  }));
}

module.exports = {
  generateFixList,
};
