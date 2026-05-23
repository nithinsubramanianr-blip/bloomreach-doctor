import "server-only";

import type { DemoState, DimensionObject } from "@/lib/contracts";
import {
  fetchBRUIDMatchRate,
  fetchRuleConflicts,
} from "./discovery-client";
import { fetchABTestCoverage } from "./analytics-mcp-client";
import {
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
} from "./marketing-mcp-client";

/**
 * The M1 -> M2 handoff boundary (ADR-002-4). M2 calls only this function and
 * never imports individual clients.
 *
 * Calls all five dimension fetchers in parallel and returns exactly 5
 * normalised DimensionObjects in canonical order:
 *   [bruid_match_rate, autosegment_coverage, signal_freshness,
 *    rule_conflicts, ab_test_coverage]
 *
 * @param state before (pre-fix, 52) / after (post-fix, 70)
 */
export async function fetchAllDimensions(
  state: DemoState = "before"
): Promise<DimensionObject[]> {
  const [bruid, autosegment, signalFreshness, ruleConflicts, abTest] =
    await Promise.all([
      fetchBRUIDMatchRate(state),
      fetchAutoSegmentCoverage(state),
      fetchSignalFreshness(state),
      fetchRuleConflicts(state),
      fetchABTestCoverage(state),
    ]);

  return [bruid, autosegment, signalFreshness, ruleConflicts, abTest];
}
