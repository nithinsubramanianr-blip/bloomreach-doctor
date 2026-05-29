import { NextResponse, type NextRequest } from "next/server";

import type { DemoState, ReasoningTraceStep } from "@/lib/contracts";
import { fetchAllDimensions } from "@/m1-bloomreach/prs-data-fetcher";
import { calculatePRS } from "@/m2-scoring/prs-calculator";
import { explainDimensionWithClaude } from "@/m3-nl/llm-explainer";

/**
 * GET /api/explain-dimension?dimension_id=...&state=before|after
 *
 * Powers the scorecard's per-dimension "Explain" panel. Reads the current PRS
 * for the requested state (same fetchAllDimensions + calculatePRS pattern as
 * /api/prs), finds the dimension, and:
 *   - OUT-OF-SCOPE dims (BRUID, Rule Conflicts) → returns the dimension's static
 *     scope note, no Claude call.
 *   - in-scope dims → explainDimensionWithClaude (shared Claude tool-use loop),
 *     memoised per (dimension_id, state) so repeated clicks don't re-hit Claude.
 */

interface ExplainResult {
  explanation: string;
  reasoning_trace: ReasoningTraceStep[];
}

// Per-process memo: `${dimension_id}:${state}` -> explanation. A click already
// explained this server run is served from here without touching Claude.
const explanationCache = new Map<string, ExplainResult>();

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dimensionId = params.get("dimension_id");
  const state: DemoState = params.get("state") === "after" ? "after" : "before";

  if (!dimensionId) {
    return NextResponse.json(
      { error: "dimension_id is required" },
      { status: 400 }
    );
  }

  const dimensions = await fetchAllDimensions(state);
  const prs = calculatePRS(dimensions);
  const dimension = prs.dimensions.find((d) => d.dimension_id === dimensionId);
  const raw = dimensions.find((d) => d.dimension_id === dimensionId);

  if (!dimension || !raw) {
    return NextResponse.json(
      { error: `Unknown dimension_id: ${dimensionId}` },
      { status: 404 }
    );
  }

  // Out of scope → static scope note straight from the dimension. No Claude.
  if (dimension.out_of_scope) {
    const explanation =
      raw.note ??
      raw.raw_label ??
      "This dimension is out of scope for the hackathon sandbox (Discovery not enabled) and is excluded from the score.";
    return NextResponse.json({
      dimension_id: dimensionId,
      explanation,
      reasoning_trace: [],
    });
  }

  const key = `${dimensionId}:${state}`;
  const cached = explanationCache.get(key);
  if (cached) {
    return NextResponse.json({ dimension_id: dimensionId, ...cached });
  }

  const result = await explainDimensionWithClaude(prs, dimension);
  explanationCache.set(key, result);
  return NextResponse.json({ dimension_id: dimensionId, ...result });
}
