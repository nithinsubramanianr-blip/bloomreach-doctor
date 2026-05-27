import { fetchAllDimensions } from "@/m1-bloomreach/prs-data-fetcher";
import { generateFixList } from "@/m2-scoring/fix-generator";
import { calculatePRS } from "@/m2-scoring/prs-calculator";
import { Dashboard } from "@/m4-dashboard/Dashboard";

/**
 * Home route (/) — the PPD dashboard (Component C4). Server Component:
 * assembles the initial pre-fix PRS (28 Red — real MCP-harvested values) on the
 * server, then hands off to the client Dashboard for tab navigation (Scorecard /
 * Ask the doctor) and the Option X refresh. The Live PLP is its own route (/plp).
 */
export default async function Home() {
  const dimensions = await fetchAllDimensions("before");

  const prs = calculatePRS(dimensions);
  prs.fix_list = generateFixList(prs);
  prs.boost_rules_state = "all_inactive";

  return <Dashboard initialPRS={prs} />;
}
