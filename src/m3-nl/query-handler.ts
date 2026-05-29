import "server-only";

import type {
  AgentResponse,
  DemoState,
  DimensionId,
  PersonaId,
  PRSState,
  ReasoningTraceStep,
  ScoredDimension,
} from "@/lib/contracts";
import { serverEnv } from "@/lib/env";
import { fetchAllDimensions } from "@/m1-bloomreach/prs-data-fetcher";
import {
  loomiFindings,
  loomiPersonaContext,
} from "@/m1-bloomreach/synthetic-loader";
import { calculatePRS } from "@/m2-scoring/prs-calculator";
import { buildFixList, explainWithClaude } from "./llm-explainer";

/**
 * M3 entry point — the sole public API of the NL interface (FR-004-1).
 *
 * Intent classification is local (regex, no LLM call — FR-004-3). The reasoning
 * trace is built from REAL M1 tool calls, so it reflects live synthetic data
 * rather than canned text. The plain-English answer is currently composed
 * deterministically from the PRS state.
 *
 * OPTION A (mandatory for the Agent Behaviour criterion) is wired later in
 * llm-explainer.ts: when ANTHROPIC_API_KEY is present, the answer composition
 * should be delegated to Claude with native tool use (`tool_choice: auto`).
 */

export type Intent =
  | "diagnosis"
  | "fix-request"
  | "dimension-drill"
  | "archetype-compare";

const INTENT_PATTERNS: Record<Intent, RegExp[]> = {
  diagnosis: [/why.*not working/i, /what.*wrong/i, /personalisation.*broken/i, /diagnos/i],
  "fix-request": [/what.*fix/i, /how.*improve/i, /what.*do first/i, /recommend/i],
  "dimension-drill": [
    /bruid/i,
    /autosegment/i,
    /signal freshness/i,
    /rule conflict/i,
    /a\/b test/i,
    /segment.*(quality|definition)/i,
    /profile.*(complet|enrich)/i,
    /behaviou?ral.*(signal|richness)/i,
    /event types?/i,
  ],
  "archetype-compare": [/customer type/i, /persona/i, /segment/i, /shopper/i, /archetype/i],
};

export function classifyIntent(query: string): Intent {
  for (const intent of Object.keys(INTENT_PATTERNS) as Intent[]) {
    if (INTENT_PATTERNS[intent].some((re) => re.test(query))) return intent;
  }
  return "diagnosis"; // default
}

const FETCHER_NAME: Record<DimensionId, string> = {
  bruid_match_rate: "fetchBRUIDMatchRate",
  autosegment_coverage: "fetchAutoSegmentCoverage",
  signal_freshness: "fetchSignalFreshness",
  rule_conflicts: "fetchRuleConflicts",
  ab_test_coverage: "fetchABTestCoverage",
  segment_definition_quality: "fetchSegmentDefinitionQuality",
  profile_completeness: "fetchProfileCompleteness",
  behavioral_signal_richness: "fetchBehavioralSignalRichness",
};

function traceStep(dimension: ScoredDimension): ReasoningTraceStep {
  return {
    tool_name: FETCHER_NAME[dimension.dimension_id],
    tool_input: {},
    tool_output_summary: dimension.raw_label ?? dimension.explanation,
  };
}

/** Picks which dimensions feed the reasoning trace, given the intent. */
function selectDimensions(
  intent: Intent,
  query: string,
  dimensions: ScoredDimension[]
): ScoredDimension[] {
  switch (intent) {
    case "dimension-drill": {
      const match = dimensions.find((d) =>
        new RegExp(d.dimension_id.replace(/_/g, ".?"), "i").test(query) ||
        new RegExp(d.dimension_name.split(" ")[0], "i").test(query)
      );
      return match ? [match] : dimensions;
    }
    case "fix-request": {
      // bottom 2 dimensions by score
      return [...dimensions].sort((a, b) => a.score - b.score).slice(0, 2);
    }
    case "archetype-compare":
      return dimensions.filter((d) =>
        d.dimension_id === "autosegment_coverage" ||
        d.dimension_id === "signal_freshness"
      );
    case "diagnosis":
    default:
      return dimensions;
  }
}

function composeAnswer(
  intent: Intent,
  prs: PRSState,
  findings?: string,
  personaContext?: string
): AgentResponse["llm_response"] {
  const sorted = [...prs.dimensions].sort((a, b) => a.score - b.score);
  const weakest = sorted.slice(0, 3);

  const summary_sentence =
    intent === "fix-request"
      ? `Your highest-impact fix is "${prs.fix_list[0]?.fix_title}" — your score is ${prs.composite_score}/100 (${prs.rag_status}).`
      : `Your personalisation is scoring ${prs.composite_score}/100 (${prs.rag_status}) — driven mainly by ${weakest
          .slice(0, 2)
          .map((d) => d.dimension_name)
          .join(" and ")}.`;

  // Ground the explanation in the real MCP findings (and the active shopper's
  // real events, when a persona is selected) so the Doctor cites them verbatim.
  const score_breakdown = [
    weakest.map((d) => d.explanation).join(" "),
    findings ? `Live Bloomreach check: ${findings}.` : "",
    personaContext ? `Active shopper — ${personaContext}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const top_3_fixes = prs.fix_list.map(
    (f) => `${f.fix_title} (${f.revenue_impact})`
  );

  const suggested_next_action = prs.fix_list[0]
    ? `Start with "${prs.fix_list[0].fix_title}" — ${prs.fix_list[0].revenue_impact}.`
    : "All dimensions are healthy — no immediate action required.";

  return { summary_sentence, score_breakdown, top_3_fixes, suggested_next_action };
}

/**
 * Public API. M4 calls this and nothing else.
 * @param queryText raw user input
 * @param state     which PRS state to ground the answer in (before/after)
 */
export async function handleQuery(
  queryText: string,
  state: DemoState = "before",
  personaId?: PersonaId
): Promise<AgentResponse> {
  const intent = classifyIntent(queryText);

  // Real tool calls: fetch dimensions through M1, score through M2.
  const dimensions = await fetchAllDimensions(state);
  const prs = calculatePRS(dimensions);
  prs.fix_list = await buildFixList(prs);

  // Real MCP findings + active-shopper context (both harvested, never invented).
  // Only cite live findings against the real pre-fix state.
  const findings = state === "before" ? await loomiFindings() : undefined;
  const personaContext = personaId
    ? await loomiPersonaContext(personaId)
    : undefined;

  // Option A: when ANTHROPIC_API_KEY is present, delegate answer composition to
  // Claude with native tool use. Any failure (incl. a malformed reply) falls
  // through to the deterministic path below — the route never 500s.
  if (serverEnv.anthropicApiKey()) {
    try {
      const { trace, llm_response } = await explainWithClaude(
        queryText,
        state,
        prs,
        personaContext,
        findings
      );
      return {
        query: queryText,
        intent,
        reasoning_trace: trace,
        llm_response,
        timestamp: new Date().toISOString(),
      };
    } catch (e) {
      console.error("[m3] Claude path failed — falling back to deterministic:", e);
    }
  }

  // Fallback: deterministic, data-driven composition — still cites the real
  // findings and the active shopper's real events.
  const selected = selectDimensions(intent, queryText, prs.dimensions);
  const reasoning_trace = selected.map(traceStep);

  return {
    query: queryText,
    intent,
    reasoning_trace,
    llm_response: composeAnswer(intent, prs, findings, personaContext),
    timestamp: new Date().toISOString(),
  };
}
