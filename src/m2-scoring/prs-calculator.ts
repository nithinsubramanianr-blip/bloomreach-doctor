import type {
  DimensionObject,
  PRSState,
  RagStatus,
  ScoredDimension,
} from "@/lib/contracts";
import { scoreDimension } from "./dimension-scorers";

/**
 * Folds the dimension sub-scores into the composite PRS and applies RAG status.
 * Pure function (FR-003-9/10/11).
 *
 * Accepts the normalised DimensionObjects from M1 (fetchAllDimensions). The
 * fix_list is populated separately by fix-generator at the M4 boundary.
 *
 * OUT-OF-SCOPE dimensions (the two Discovery dimensions, BRUID Match Rate and
 * Rule Conflicts — Discovery is not enabled for this hackathon sandbox) are
 * marked with status "out_of_scope" and EXCLUDED from the composite, so their
 * placeholder values can no longer inflate or contradict the score. The
 * composite is the share of available points earned across the *in-scope*
 * (Engagement MCP) dimensions only, rescaled to 0–100 so the dial and RAG
 * thresholds stay on the familiar scale:
 *     composite = round( sum(inScope.score) / sum(inScope.max_score) * 100 )
 *
 * RAG thresholds: red < 50, amber 50–74, green 75+.
 */

export function ragFromScore(composite: number): RagStatus {
  if (composite < 50) return "red";
  if (composite < 75) return "amber";
  return "green";
}

export function calculatePRS(dimensions: DimensionObject[]): PRSState {
  const scored: ScoredDimension[] = dimensions.map((d) => {
    const result = scoreDimension(d.dimension_id, {
      raw_value: d.raw_value,
      normalised_score: d.normalised_score,
    });
    const outOfScope = d.out_of_scope === true;
    return {
      dimension_id: d.dimension_id,
      dimension_name: d.dimension_name,
      raw_value: d.raw_value,
      score: result.score,
      max_score: 20,
      // An out-of-scope dimension is shown as such, never as a RAG status it hasn't earned.
      status: outOfScope ? "out_of_scope" : result.status,
      data_source: d.data_source,
      explanation: result.explanation,
      out_of_scope: outOfScope || undefined,
      raw_label: d.raw_label,
      target_value: d.target_value,
      target_label: d.target_label,
      change_from_pre_fix: d.change_from_pre_fix,
      change_driver: d.change_driver,
      is_synthetic: d.is_synthetic,
    };
  });

  // Composite is computed from the in-scope (Engagement MCP) dimensions only,
  // rescaled to 0–100 over the points actually available.
  const counted = scored.filter((d) => !d.out_of_scope);
  const earned = counted.reduce((sum, d) => sum + d.score, 0);
  const available = counted.reduce((sum, d) => sum + d.max_score, 0);
  const composite = available > 0 ? Math.round((earned / available) * 100) : 0;

  return {
    composite_score: composite,
    rag_status: ragFromScore(composite),
    dimensions: scored,
    fix_list: [],
    generated_at: new Date().toISOString(),
  };
}
