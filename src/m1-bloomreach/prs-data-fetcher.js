/**
 * M1 Bloomreach — PRS Data Fetcher (M1 → M2 handoff boundary).
 *
 * Consolidates the five PRS dimension fetchers across the four clients into
 * one entry point. M2 calls this and ONLY this. Individual clients must not
 * be imported by M2 directly (ADR-002-4).
 *
 * Canonical dimension order returned:
 *   [bruid_match_rate, autosegment_coverage, signal_freshness,
 *    rule_conflicts, ab_test_coverage]
 */

'use strict';

const { fetchBRUIDMatchRate, fetchRuleConflicts } = require('./discovery-client');
const {
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
} = require('./marketing-mcp-client');
const { fetchABTestCoverage } = require('./analytics-mcp-client');

/**
 * Calls all five dimension fetchers in parallel.
 * Returns array of exactly 5 normalised DimensionObjects.
 *
 * Per design-spec error handling: NormaliserError propagates (do not silence).
 * Live API errors are absorbed inside each client (synthetic fallback).
 */
async function fetchAllDimensions() {
  const [bruid, autoSegment, signal, ruleConflicts, abTest] = await Promise.all([
    fetchBRUIDMatchRate(),
    fetchAutoSegmentCoverage(),
    fetchSignalFreshness(),
    fetchRuleConflicts(),
    fetchABTestCoverage(),
  ]);

  return [bruid, autoSegment, signal, ruleConflicts, abTest];
}

module.exports = {
  fetchAllDimensions,
};
