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
import {
  fetchBehavioralSignalRichness,
  fetchProfileCompleteness,
  fetchSegmentDefinitionQuality,
} from "./engagement-client";

/**
 * The M1 -> M2 handoff boundary (ADR-002-4). M2 calls only this function and
 * never imports individual clients.
 *
 * Calls all eight dimension fetchers in parallel and returns 8 normalised
 * DimensionObjects in canonical order:
 *   [bruid_match_rate, autosegment_coverage, signal_freshness,
 *    rule_conflicts, ab_test_coverage,
 *    segment_definition_quality, profile_completeness,
 *    behavioral_signal_richness]
 *
 * BRUID + Rule Conflicts (Discovery) are marked out_of_scope and excluded from
 * the composite. The 6 Engagement-measured dimensions feed the composite.
 *
 * @param state before (pre-fix) / after (post-fix)
 */
export async function fetchAllDimensions(
  state: DemoState = "before"
): Promise<DimensionObject[]> {
  const [
    bruid,
    autosegment,
    signalFreshness,
    ruleConflicts,
    abTest,
    segmentDefinitionQuality,
    profileCompleteness,
    behavioralSignalRichness,
  ] = await Promise.all([
    fetchBRUIDMatchRate(state),
    fetchAutoSegmentCoverage(state),
    fetchSignalFreshness(state),
    fetchRuleConflicts(state),
    fetchABTestCoverage(state),
    fetchSegmentDefinitionQuality(state),
    fetchProfileCompleteness(state),
    fetchBehavioralSignalRichness(state),
  ]);

  return [
    bruid,
    autosegment,
    signalFreshness,
    ruleConflicts,
    abTest,
    segmentDefinitionQuality,
    profileCompleteness,
    behavioralSignalRichness,
  ];
}
