/**
 * M1 Bloomreach — PRS Data Fetcher (M1 → M2 handoff boundary).
 *
 * Consolidates the eight PRS dimension fetchers across the four clients into
 * one entry point. M2 calls this and ONLY this. Individual clients must not
 * be imported by M2 directly (ADR-002-4).
 *
 * Canonical dimension order returned:
 *   [bruid_match_rate, autosegment_coverage, signal_freshness,
 *    rule_conflicts, ab_test_coverage,
 *    segment_definition_quality, profile_completeness,
 *    behavioral_signal_richness]
 */

'use strict';

const { fetchBRUIDMatchRate, fetchRuleConflicts } = require('./discovery-client');
const {
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
} = require('./marketing-mcp-client');
const { fetchABTestCoverage } = require('./analytics-mcp-client');
const {
  fetchSegmentDefinitionQuality,
  fetchProfileCompleteness,
  fetchBehavioralSignalRichness,
} = require('./engagement-client');

/**
 * Calls all eight dimension fetchers in parallel.
 * Returns array of exactly 8 normalised DimensionObjects.
 *
 * Per design-spec error handling: NormaliserError propagates (do not silence).
 * Live API errors are absorbed inside each client (synthetic fallback).
 *
 * In-flight dedup: React 18 StrictMode invokes effects twice in dev, and our
 * dashboard's mount + persona-change effects can race. We share the inflight
 * promise so concurrent callers receive the same response instead of firing
 * 16+ MCP calls per page load.
 */
let _inflight = null;

async function fetchAllDimensions() {
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const [
        bruid,
        autoSegment,
        signal,
        ruleConflicts,
        abTest,
        segmentDefinitionQuality,
        profileCompleteness,
        behavioralSignalRichness,
      ] = await Promise.all([
        fetchBRUIDMatchRate(),
        fetchAutoSegmentCoverage(),
        fetchSignalFreshness(),
        fetchRuleConflicts(),
        fetchABTestCoverage(),
        fetchSegmentDefinitionQuality(),
        fetchProfileCompleteness(),
        fetchBehavioralSignalRichness(),
      ]);
      return [
        bruid,
        autoSegment,
        signal,
        ruleConflicts,
        abTest,
        segmentDefinitionQuality,
        profileCompleteness,
        behavioralSignalRichness,
      ];
    } finally {
      // Clear AFTER resolution so genuine subsequent reloads (e.g. user
      // clicking Refresh) actually re-fetch.
      _inflight = null;
    }
  })();

  return _inflight;
}

/**
 * Force a clean slate before the next fetchAllDimensions call. Useful when
 * runtime state changes (e.g. toggling boost rules) and we must not return
 * the previous state's in-flight promise.
 */
function resetInflight() { _inflight = null; }

module.exports = {
  fetchAllDimensions,
  resetInflight,
  // Exposed for tests — lets a suite reset the dedup state.
  _resetInflightForTests: resetInflight,
};
