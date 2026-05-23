import { searchProducts } from "@/m1-bloomreach/discovery-client";
import { loadPersonas } from "@/m1-bloomreach/synthetic-loader";
import { fetchAllDimensions } from "@/m1-bloomreach/prs-data-fetcher";
import { generateFixList } from "@/m2-scoring/fix-generator";
import { calculatePRS } from "@/m2-scoring/prs-calculator";
import { Dashboard } from "@/m4-dashboard/Dashboard";

/**
 * Home route (/) — the PPD dashboard (Component C4). Server Component:
 * assembles the initial pre-fix PRS (52 Amber) and the Guest Before/After
 * product sets for Module B on the server, then hands off to the client
 * Dashboard for tab navigation and the Option X refresh.
 */
export default async function Home() {
  const [personas, dimensions, guestBefore, guestAfter] = await Promise.all([
    loadPersonas(),
    fetchAllDimensions("before"),
    searchProducts("necklace", "guest", "before"),
    searchProducts("necklace", "guest", "after"),
  ]);

  const prs = calculatePRS(dimensions);
  prs.fix_list = generateFixList(prs);
  prs.boost_rules_state = "all_inactive";

  return (
    <Dashboard
      initialPRS={prs}
      personas={personas}
      initialBefore={guestBefore.products}
      initialAfter={guestAfter.products}
    />
  );
}
