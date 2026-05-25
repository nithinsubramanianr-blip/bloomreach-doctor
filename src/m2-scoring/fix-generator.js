/**
 * fix-generator.js — M2 PRS Scoring Engine
 *
 * Pure function. No async. No side effects.
 *
 * Permitted exception to the "no data/ imports in M2" rule: this file MAY
 * require data/fix_catalogue.json. The catalogue is fixture content (not raw
 * API output) and the architect's ADR explicitly authorises it here.
 *
 * Algorithm (from design-spec):
 *   1. Sort prsResult.dimensions by score ASC, tiebreak by dimension_id ASC.
 *   2. Take the first 3 dimensions.
 *   3. Look up each one in fix_catalogue.json by dimension_linked.
 *   4. Sort the matched fixes by estimated_rpv_lift_pct_max DESC.
 *   5. Assign position 1/2/3.
 *
 * Edge cases:
 *   - If a dimension has no matching catalogue entry, skip it gracefully.
 *   - If all dimensions are healthy (no fixes needed), still returns up to 3
 *     fixes for the lowest-scoring dimensions if they exist in the catalogue.
 *     A perfect 100/100 PRS where no catalogue mapping exists yields [].
 */

const fixCatalogue = require('../../data/fix_catalogue.json');

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

  // Step 2 — take the bottom 3.
  const bottomThree = sorted.slice(0, 3);

  // Step 3 — look up each in the fix catalogue.
  const matched = bottomThree
    .map(d => FIX_BY_DIMENSION[d.dimension_id])
    .filter(Boolean);

  // Step 4 — sort matched fixes by estimated RPV lift max DESC.
  matched.sort((a, b) => b.estimated_rpv_lift_pct_max - a.estimated_rpv_lift_pct_max);

  // Step 5 — assign position and shape to the FixResult contract.
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
