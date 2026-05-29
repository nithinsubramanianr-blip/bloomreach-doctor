/**
 * prs-calculator.js — M2 PRS Scoring Engine
 *
 * Pure function. No async. No side effects. No imports from data/.
 *
 * Accepts an array of 5 dimension results (either raw M1 dimension objects
 * with locked normalised_score baked in, or scorer outputs from
 * dimension-scorers.js). Sums the scores into a composite (0–100), assigns
 * RAG status, and emits the M2→M4 PRS State Object.
 *
 * RAG thresholds:
 *   composite_score < 50         → 'red'
 *   composite_score 50–74        → 'amber'
 *   composite_score >= 75        → 'green'
 *
 * The returned object follows the M2→M4 PRS State Object contract from
 * CLAUDE.md:
 *   {
 *     composite_score: number,
 *     rag_status: 'red' | 'amber' | 'green',
 *     dimensions: array,
 *     fix_list: array (empty here — populated by fix-generator.js),
 *     generated_at: ISO8601 string
 *   }
 */

const {
  scoreBRUID,
  scoreAutoSegment,
  scoreSignalFreshness,
  scoreRuleConflicts,
  scoreABCoverage,
  scoreSegmentDefinitionQuality,
  scoreProfileCompleteness,
  scoreBehavioralSignalRichness,
} = require('./dimension-scorers');

const SCORER_BY_DIMENSION = {
  bruid_match_rate: scoreBRUID,
  autosegment_coverage: scoreAutoSegment,
  signal_freshness: scoreSignalFreshness,
  rule_conflicts: scoreRuleConflicts,
  ab_test_coverage: scoreABCoverage,
  segment_definition_quality: scoreSegmentDefinitionQuality,
  profile_completeness: scoreProfileCompleteness,
  behavioral_signal_richness: scoreBehavioralSignalRichness,
};

const MAX_SCORE_PER_DIMENSION = 20;

function ragFromComposite(composite) {
  if (composite < 50) return 'red';
  if (composite < 75) return 'amber';
  return 'green';
}

/**
 * Normalise an input dimension into a scorer result. If the dimension was
 * already produced by dimension-scorers.js (has a `score` field) it is
 * returned as-is. Otherwise the matching scorer is applied.
 */
function ensureScored(dimension) {
  if (dimension && typeof dimension.score === 'number' && typeof dimension.status === 'string') {
    return dimension;
  }
  const scorer = SCORER_BY_DIMENSION[dimension && dimension.dimension_id];
  if (!scorer) {
    throw new Error(
      `calculatePRS: unknown dimension_id "${dimension && dimension.dimension_id}"`,
    );
  }
  return scorer(dimension);
}

function calculatePRS(dimensionResults) {
  if (!Array.isArray(dimensionResults)) {
    throw new TypeError('calculatePRS expects an array of dimension results');
  }

  const scored = dimensionResults.map(ensureScored);
  // Composite normalised to a 0–100 scale: works for any dimension count.
  const totalPoints = scored.reduce((acc, d) => acc + d.score, 0);
  const maxPoints = scored.length * MAX_SCORE_PER_DIMENSION;
  const composite = maxPoints > 0
    ? Math.round((totalPoints / maxPoints) * 100)
    : 0;
  const rag = ragFromComposite(composite);

  return {
    composite_score: composite,
    rag_status: rag,
    dimensions: scored,
    fix_list: [],
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  calculatePRS,
};
