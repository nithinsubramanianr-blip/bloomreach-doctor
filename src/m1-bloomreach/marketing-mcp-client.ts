import "server-only";

import type { DemoState, DimensionObject } from "@/lib/contracts";
import { isLive } from "@/lib/env";
import { normaliseDimension } from "./normaliser";
import { loadRawDimension } from "./synthetic-loader";

/**
 * Marketing MCP client — AutoSegment coverage and signal freshness.
 * Endpoint (live mode): BLOOMREACH_MCP_MARKETING_URL (HTTP transport, ADR-002-6).
 */

export async function fetchAutoSegmentCoverage(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (!isLive()) {
    console.log("[m1-bloomreach] marketing-mcp-client using synthetic fallback");
    return normaliseDimension(
      await loadRawDimension(state, "autosegment_coverage"),
      true
    );
  }
  try {
    // TODO(live): call Marketing MCP "autosegment coverage" tool.
    return normaliseDimension(
      await loadRawDimension(state, "autosegment_coverage"),
      true
    );
  } catch {
    console.log("[m1-bloomreach] marketing-mcp-client using synthetic fallback");
    return normaliseDimension(
      await loadRawDimension(state, "autosegment_coverage"),
      true
    );
  }
}

export async function fetchSignalFreshness(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (!isLive()) {
    console.log("[m1-bloomreach] marketing-mcp-client using synthetic fallback");
    return normaliseDimension(
      await loadRawDimension(state, "signal_freshness"),
      true
    );
  }
  try {
    // TODO(live): call Marketing MCP "signal freshness" tool.
    return normaliseDimension(
      await loadRawDimension(state, "signal_freshness"),
      true
    );
  } catch {
    console.log("[m1-bloomreach] marketing-mcp-client using synthetic fallback");
    return normaliseDimension(
      await loadRawDimension(state, "signal_freshness"),
      true
    );
  }
}
