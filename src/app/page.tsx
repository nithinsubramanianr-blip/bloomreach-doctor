import { cookies } from "next/headers";

import { RULES_FLAG_COOKIE, parseRulesActive } from "@/lib/rules-flag";
import { fetchAllDimensions } from "@/m1-bloomreach/prs-data-fetcher";
import { calculatePRS } from "@/m2-scoring/prs-calculator";
import { buildFixList } from "@/m3-nl/llm-explainer";
import { Dashboard } from "@/m4-dashboard/Dashboard";

/**
 * Home route (/) — the PPD dashboard (Component C4). Server Component:
 * reads the `rulesActive` flag from the cookie (single source of truth, exactly
 * like the PLP route) and assembles the matching PRS on the server, so a return
 * navigation to "/" reflects the actual cookie state instead of always starting
 * "before". Then hands off to the client Dashboard for tab navigation (Scorecard /
 * Ask the doctor) and the Option X refresh. The Live PLP is its own route (/plp).
 */
export default async function Home() {
  const jar = await cookies();
  const rulesActive = parseRulesActive(jar.get(RULES_FLAG_COOKIE)?.value);
  const state = rulesActive ? "after" : "before";

  const dimensions = await fetchAllDimensions(state);

  const prs = calculatePRS(dimensions);
  prs.fix_list = await buildFixList(prs);
  prs.boost_rules_state = rulesActive ? "all_active" : "all_inactive";

  return <Dashboard initialPRS={prs} />;
}
