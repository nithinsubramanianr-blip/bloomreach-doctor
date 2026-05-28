import type {
  DimensionId,
  DimensionStatus,
  ScorerInput,
  ScorerResult,
} from "@/lib/contracts";

/**
 * M2 dimension scorers — pure functions (no async, no side effects, no imports
 * from data/, no react).
 *
 * RECONCILIATION (see review note flagged before the build): the CLAUDE.md
 * formula `round(raw_value * 20)` does NOT reproduce the locked demo scores for
 * most dimensions (e.g. round(0.22*20)=4, but BRUID is locked at 8). To honour
 * BOTH the locked synthetic values AND a live formula path, each scorer:
 *   - uses `normalised_score` when provided (the locked / live-normalised value),
 *   - otherwise applies the formula `min(20, round(raw_value * 20))`.
 * This keeps the scorers pure: the real pre-fix dimensions carry their derived
 * normalised_score (round(raw*20)) and the synthetic post-fix state carries its
 * locked values, while a live integration can pass raw values only.
 */

const MAX_SCORE = 20 as const;

/** Status thresholds (FR-003-6): 0–8 critical, 9–14 warning, 15–20 healthy. */
export function statusFromScore(score: number): DimensionStatus {
  if (score <= 8) return "critical";
  if (score <= 14) return "warning";
  return "healthy";
}

/** Score = locked normalised_score if present, else round(raw_value*20), capped 20. */
export function computeScore({ raw_value, normalised_score }: ScorerInput): number {
  if (typeof normalised_score === "number") {
    return Math.max(0, Math.min(MAX_SCORE, normalised_score));
  }
  return Math.min(MAX_SCORE, Math.round(raw_value * 20));
}

function build(
  dimensionId: DimensionId,
  input: ScorerInput,
  explain: (score: number, status: DimensionStatus) => string
): ScorerResult {
  const score = computeScore(input);
  const status = statusFromScore(score);
  return {
    dimension_id: dimensionId,
    score,
    max_score: MAX_SCORE,
    status,
    explanation: explain(score, status),
  };
}

const pct = (raw: number) => `${Math.round(raw * 100)}%`;

export function scoreBRUID(input: ScorerInput): ScorerResult {
  return build("bruid_match_rate", input, (score, status) =>
    `BRUID match rate is ${pct(input.raw_value)} (${score}/20, ${status}) — sessions Bloomreach can recognise across visits.`
  );
}

export function scoreAutoSegment(input: ScorerInput): ScorerResult {
  return build("autosegment_coverage", input, (score, status) =>
    `AutoSegment coverage is ${pct(input.raw_value)} (${score}/20, ${status}) — sessions assigned to a named segment.`
  );
}

export function scoreSignalFreshness(input: ScorerInput): ScorerResult {
  return build("signal_freshness", input, (score, status) =>
    `Signal freshness is ${pct(input.raw_value)} (${score}/20, ${status}) — behavioural signals within the freshness threshold.`
  );
}

export function scoreRuleConflicts(input: ScorerInput): ScorerResult {
  // raw_value is the conflict-FREE percentage (higher = healthier).
  return build("rule_conflicts", input, (score, status) =>
    `Rule conflicts: ${pct(input.raw_value)} conflict-free (${score}/20, ${status}).`
  );
}

export function scoreABCoverage(input: ScorerInput): ScorerResult {
  return build("ab_test_coverage", input, (score, status) =>
    `A/B test coverage is ${pct(input.raw_value)} (${score}/20, ${status}) — personalisation decisions under an active test.`
  );
}

export function scoreSegmentDefinitionQuality(input: ScorerInput): ScorerResult {
  return build("segment_definition_quality", input, (score, status) =>
    `Segment definition quality is ${pct(input.raw_value)} (${score}/20, ${status}) — conditions-per-segment depth weighted by Discovery exposure.`
  );
}

export function scoreProfileCompleteness(input: ScorerInput): ScorerResult {
  return build("profile_completeness", input, (score, status) =>
    `Profile completeness is ${pct(input.raw_value)} (${score}/20, ${status}) — share of customers with an enriched (identified) profile.`
  );
}

export function scoreBehavioralSignalRichness(input: ScorerInput): ScorerResult {
  return build("behavioral_signal_richness", input, (score, status) =>
    `Behavioral signal richness is ${pct(input.raw_value)} (${score}/20, ${status}) — avg distinct event types captured per active user vs target.`
  );
}

const SCORERS: Record<DimensionId, (input: ScorerInput) => ScorerResult> = {
  bruid_match_rate: scoreBRUID,
  autosegment_coverage: scoreAutoSegment,
  signal_freshness: scoreSignalFreshness,
  rule_conflicts: scoreRuleConflicts,
  ab_test_coverage: scoreABCoverage,
  segment_definition_quality: scoreSegmentDefinitionQuality,
  profile_completeness: scoreProfileCompleteness,
  behavioral_signal_richness: scoreBehavioralSignalRichness,
};

/** Dispatches to the correct scorer for a dimension id. */
export function scoreDimension(
  dimensionId: DimensionId,
  input: ScorerInput
): ScorerResult {
  return SCORERS[dimensionId](input);
}
