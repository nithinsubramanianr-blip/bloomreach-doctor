import "server-only";

import type { DemoState, DimensionObject } from "@/lib/contracts";
import { normaliseDimension } from "./normaliser";
import { loadRawDimension, loomiRawDimension } from "./synthetic-loader";

/**
 * Marketing MCP client — AutoSegment coverage and signal freshness.
 *
 * The pre-fix ("before") state is the REAL diagnosis: sourced from
 * loomi-snapshot.json (harvested live from the wobbly-donkey Engagement project
 * via the loomi MCP), normalised with is_synthetic=false. The post-fix
 * ("after") state remains the synthetic projected target from prs_post_fix.json.
 */

export async function fetchAutoSegmentCoverage(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (state === "before") {
    return normaliseDimension(await loomiRawDimension("autosegment_coverage"), false);
  }
  return normaliseDimension(
    await loadRawDimension(state, "autosegment_coverage"),
    true
  );
}

export async function fetchSignalFreshness(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (state === "before") {
    return normaliseDimension(await loomiRawDimension("signal_freshness"), false);
  }
  return normaliseDimension(
    await loadRawDimension(state, "signal_freshness"),
    true
  );
}
