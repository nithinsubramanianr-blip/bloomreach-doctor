import type {
  DimensionObject,
  PRSState,
  RagStatus,
  ScoredDimension,
} from "@/lib/contracts";
import { scoreDimension } from "./dimension-scorers";

/**
 * Sums the five dimension sub-scores into the composite PRS and applies RAG
 * status. Pure function (FR-003-9/10/11).
 *
 * Accepts the normalised DimensionObjects from M1 (fetchAllDimensions). The
 * fix_list is populated separately by fix-generator at the M4 boundary.
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
    return {
      dimension_id: d.dimension_id,
      dimension_name: d.dimension_name,
      raw_value: d.raw_value,
      score: result.score,
      max_score: 20,
      status: result.status,
      data_source: d.data_source,
      explanation: result.explanation,
      raw_label: d.raw_label,
      target_value: d.target_value,
      target_label: d.target_label,
      change_from_pre_fix: d.change_from_pre_fix,
      change_driver: d.change_driver,
      is_synthetic: d.is_synthetic,
    };
  });

  const composite = scored.reduce((sum, d) => sum + d.score, 0);

  return {
    composite_score: composite,
    rag_status: ragFromScore(composite),
    dimensions: scored,
    fix_list: [],
    generated_at: new Date().toISOString(),
  };
}
