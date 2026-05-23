import "server-only";

import type { DemoState, DimensionObject } from "@/lib/contracts";
import { isLive } from "@/lib/env";
import { normaliseDimension } from "./normaliser";
import { loadRawDimension } from "./synthetic-loader";

/**
 * Analytics MCP client — A/B test coverage.
 * Endpoint (live mode): BLOOMREACH_MCP_ANALYTICS_URL (HTTP transport, ADR-002-6).
 */

export async function fetchABTestCoverage(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (!isLive()) {
    console.log("[m1-bloomreach] analytics-mcp-client using synthetic fallback");
    return normaliseDimension(
      await loadRawDimension(state, "ab_test_coverage"),
      true
    );
  }
  try {
    // TODO(live): call Analytics MCP "A/B test coverage" tool.
    return normaliseDimension(
      await loadRawDimension(state, "ab_test_coverage"),
      true
    );
  } catch {
    console.log("[m1-bloomreach] analytics-mcp-client using synthetic fallback");
    return normaliseDimension(
      await loadRawDimension(state, "ab_test_coverage"),
      true
    );
  }
}
