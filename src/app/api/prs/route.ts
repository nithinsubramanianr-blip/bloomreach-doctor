import { NextResponse, type NextRequest } from "next/server";

import type { DemoState } from "@/lib/contracts";
import { fetchAllDimensions } from "@/m1-bloomreach/prs-data-fetcher";
import { getRuleActivationState } from "@/m1-bloomreach/rule-manager";
import { generateFixList } from "@/m2-scoring/fix-generator";
import { calculatePRS } from "@/m2-scoring/prs-calculator";

/**
 * GET /api/prs?state=before|after
 *
 * The M1 -> M2 -> M4 assembly point. Server-only: fetches the 5 normalised
 * dimensions, computes the composite PRS, attaches the ranked fix list, and
 * stamps the boost-rule state. The composite uses only the 3 live MCP
 * dimensions; BRUID Match Rate and Rule Conflicts are out of scope (Discovery
 * not enabled for this sandbox) and excluded. `before` -> 3 Red, `after` -> 77 Green.
 */
export async function GET(request: NextRequest) {
  const state: DemoState =
    request.nextUrl.searchParams.get("state") === "after" ? "after" : "before";

  const dimensions = await fetchAllDimensions(state);
  const prs = calculatePRS(dimensions);
  prs.fix_list = generateFixList(prs);

  const rules = await getRuleActivationState(state);
  prs.boost_rules_state = rules.all_active ? "all_active" : "all_inactive";

  return NextResponse.json(prs);
}
