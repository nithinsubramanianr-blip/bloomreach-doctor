/**
 * dimension-scorers.js — M2 PRS Scoring Engine
 *
 * Pure functions. No async. No side effects. No imports from data/.
 *
 * Formula: score = Math.min(20, Math.round(raw_value * 20))
 * Status thresholds:
 *   0–8   → 'critical'
 *   9–14  → 'warning'
 *   15–20 → 'healthy'
 *
 * Live-data path: caller passes { raw_value }. Scorer computes score from formula.
 * Synthetic path: M1 has already baked locked normalised_score/status into the
 *   dimension object (per ADR-003-3). When such an object is passed in,
 *   the scorer passes those locked values through unchanged.
 *
 * All five scorers return the same ScorerResult shape:
 *   {
 *     dimension_id: string,
 *     score: number,            // 0–20
 *     max_score: 20,
 *     status: 'critical' | 'warning' | 'healthy',
 *     explanation: string
 *   }
 */

const MAX_SCORE = 20;

/**
 * Compute status from a normalised score.
 * Boundaries belong to the lower bucket: 8 = critical, 9 = warning,
 * 14 = warning, 15 = healthy.
 */
function statusFromScore(score) {
  if (score <= 8) return 'critical';
  if (score <= 14) return 'warning';
  return 'healthy';
}

/**
 * Normalise an arbitrary scorer input into a canonical shape.
 * Accepts either:
 *   - { raw_value: number }  (live data — formula applied)
 *   - a dimension object with raw_value AND normalised_score (synthetic
 *     pass-through; locked values take precedence per design-spec).
 */
function resolveScore(input) {
  if (input == null || typeof input !== 'object') {
    throw new TypeError('Scorer input must be an object');
  }
  const rawValue = typeof input.raw_value === 'number' ? input.raw_value : null;

  // Synthetic pass-through: M1 has pre-applied the locked score.
  if (typeof input.normalised_score === 'number') {
    const score = Math.min(MAX_SCORE, input.normalised_score);
    const status = typeof input.status === 'string' ? input.status : statusFromScore(score);
    return { rawValue, score, status };
  }

  // Live-data path: apply the canonical formula.
  if (rawValue === null) {
    throw new TypeError('Scorer input must include raw_value (number) or normalised_score (number)');
  }
  const score = Math.min(MAX_SCORE, Math.round(rawValue * MAX_SCORE));
  return { rawValue, score, status: statusFromScore(score) };
}

function buildResult(dimensionId, rawValue, score, status, explanation) {
  return {
    dimension_id: dimensionId,
    raw_value: rawValue,
    score,
    max_score: MAX_SCORE,
    status,
    explanation,
  };
}

function explain(dimensionName, rawValue, score, status, extra = '') {
  const pct = rawValue !== null && rawValue !== undefined
    ? `${Math.round(rawValue * 100)}%`
    : 'n/a';
  const tail = extra ? ` ${extra}` : '';
  return `${dimensionName} at ${pct} → score ${score}/${MAX_SCORE} (${status}).${tail}`;
}

function scoreBRUID(input) {
  const { rawValue, score, status } = resolveScore(input);
  return buildResult(
    'bruid_match_rate',
    rawValue,
    score,
    status,
    explain('BRUID match rate', rawValue, score, status),
  );
}

function scoreAutoSegment(input) {
  const { rawValue, score, status } = resolveScore(input);
  return buildResult(
    'autosegment_coverage',
    rawValue,
    score,
    status,
    explain('AutoSegment coverage', rawValue, score, status),
  );
}

function scoreSignalFreshness(input) {
  const { rawValue, score, status } = resolveScore(input);
  return buildResult(
    'signal_freshness',
    rawValue,
    score,
    status,
    explain('Signal freshness', rawValue, score, status),
  );
}

function scoreRuleConflicts(input) {
  // raw_value is the conflict-FREE percentage — higher = healthier.
  const { rawValue, score, status } = resolveScore(input);
  return buildResult(
    'rule_conflicts',
    rawValue,
    score,
    status,
    explain('Rule conflict-free rate', rawValue, score, status),
  );
}

function scoreABCoverage(input) {
  const { rawValue, score, status } = resolveScore(input);
  return buildResult(
    'ab_test_coverage',
    rawValue,
    score,
    status,
    explain('A/B test coverage', rawValue, score, status),
  );
}

module.exports = {
  scoreBRUID,
  scoreAutoSegment,
  scoreSignalFreshness,
  scoreRuleConflicts,
  scoreABCoverage,
  // Exported for unit testing only — not part of the M2→M4 contract.
  _statusFromScore: statusFromScore,
};
