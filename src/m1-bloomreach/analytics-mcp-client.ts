import "server-only";

import type { DemoState, DimensionObject } from "@/lib/contracts";
import { normaliseDimension } from "./normaliser";
import { loadRawDimension, loomiRawDimension } from "./synthetic-loader";

/**
 * Analytics MCP client — A/B test coverage.
 *
 * The pre-fix ("before") state is the REAL diagnosis: sourced from
 * loomi-snapshot.json (0 experiments configured → 0% coverage), normalised with
 * is_synthetic=false. The post-fix ("after") state remains the synthetic
 * projected target from prs_post_fix.json.
 */

export async function fetchABTestCoverage(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (state === "before") {
    return normaliseDimension(await loomiRawDimension("ab_test_coverage"), false);
  }
  return normaliseDimension(
    await loadRawDimension(state, "ab_test_coverage"),
    true
  );
}
