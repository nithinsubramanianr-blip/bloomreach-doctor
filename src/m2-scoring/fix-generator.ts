import fixCatalogueData from "../../data/fix_catalogue.json";
import type { FixObject, FixResult, PRSState } from "@/lib/contracts";

/**
 * Generates the ranked fix list (FR-003-12/13/14).
 *
 * Algorithm:
 *   1. Sort dimensions by score ASC, tiebreak by dimension_id ASC.
 *   2. Walk that order and collect the dimensions that (a) still have room to
 *      improve (score < 20) AND (b) have a fix in fix_catalogue.json, until we
 *      have up to 3. A worst-scoring dimension with no catalogue remediation
 *      (e.g. signal_freshness) is skipped so it does not crowd out an
 *      actionable fix — the list always surfaces the worst *fixable* gaps.
 *   3. Sort the mapped fixes by estimated_rpv_lift_pct_max DESC.
 *   4. Assign position 1/2/3.
 *
 * fix_catalogue.json is the one permitted data/ import in M2 (it is fixture
 * data, not a raw API response). Imported statically to keep this pure & sync.
 */

const CATALOGUE: FixObject[] = (fixCatalogueData as { fixes: FixObject[] }).fixes;

export function generateFixList(prs: PRSState): FixResult[] {
  const ranked = prs.dimensions
    .filter((d) => d.score < d.max_score)
    .sort(
      (a, b) =>
        a.score - b.score || a.dimension_id.localeCompare(b.dimension_id)
    );

  const mapped: FixObject[] = [];
  for (const d of ranked) {
    if (mapped.length === 3) break;
    const fix = CATALOGUE.find((f) => f.dimension_linked === d.dimension_id);
    if (fix) mapped.push(fix);
  }

  mapped.sort(
    (a, b) => b.estimated_rpv_lift_pct_max - a.estimated_rpv_lift_pct_max
  );

  return mapped.map((f, index) => ({
    position: (index + 1) as 1 | 2 | 3,
    fix_id: f.fix_id,
    dimension: f.dimension_linked,
    fix_title: f.fix_title,
    description: f.plain_english_description,
    effort: f.effort_level,
    revenue_impact: f.estimated_revenue_impact,
    action_label: f.action_label,
    risk_level: f.risk_level,
    steps: f.steps,
  }));
}
