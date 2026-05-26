import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type {
  AgentResponse,
  DemoState,
  PRSState,
  ReasoningTraceStep,
} from "@/lib/contracts";
import { serverEnv } from "@/lib/env";
import {
  fetchBRUIDMatchRate,
  fetchRuleConflicts,
} from "@/m1-bloomreach/discovery-client";
import {
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
} from "@/m1-bloomreach/marketing-mcp-client";
import { fetchABTestCoverage } from "@/m1-bloomreach/analytics-mcp-client";

/**
 * llm-explainer — Option A. The ONLY file permitted to import `@anthropic-ai/sdk`
 * (CLAUDE.md invariant #5 / ADR-004-1).
 *
 * Module C delegates answer composition to Claude with native tool use
 * (`tool_choice: auto`). Claude decides which of the five M1 dimension fetchers
 * to call; we execute the matching fetcher, feed `tool_result` blocks back, and
 * extract the reasoning trace from the `tool_use` blocks. The PRS ground truth
 * (composite score + ranked fixes) is pinned in the system prompt so Claude
 * explains — but never recomputes — the deterministic M2 result.
 *
 * Wired into query-handler.handleQuery(): when ANTHROPIC_API_KEY is present the
 * Claude path runs; any failure falls back to the deterministic composeAnswer().
 */

// Claude tool definitions — one per M1 dimension fetcher. `name` maps 1:1 to the
// M1 export. No inputs: each fetcher is parameterised only by the demo state,
// which we hold server-side rather than letting Claude pass it.
const TOOLS = [
  { name: "fetchBRUIDMatchRate", description: "Share of sessions with a persistent BRUID identity." },
  { name: "fetchAutoSegmentCoverage", description: "Share of sessions assigned to an audience segment." },
  { name: "fetchSignalFreshness", description: "How recent the behavioural signals are." },
  { name: "fetchRuleConflicts", description: "Whether merchandising/boost rules conflict." },
  { name: "fetchABTestCoverage", description: "Share of queries covered by an A/B test." },
].map((t) => ({
  ...t,
  input_schema: { type: "object" as const, properties: {} },
}));

const FETCHERS = {
  fetchBRUIDMatchRate,
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
  fetchRuleConflicts,
  fetchABTestCoverage,
};

type FetcherName = keyof typeof FETCHERS;

const system = (prs: PRSState, personaContext?: string) =>
  `You are the Personalization Performance Doctor for a Bloomreach Discovery storefront.
Use the tools to inspect the dimensions relevant to the question, then explain the diagnosis in plain English.
GROUND TRUTH — do not recompute or contradict:
- Composite score ${prs.composite_score}/100 (${prs.rag_status}).
- Ranked fixes: ${prs.fix_list
    .map((f, i) => `${i + 1}. ${f.fix_title} (${f.revenue_impact})`)
    .join("; ")}.${
    personaContext
      ? `\nACTIVE SHOPPER CONTEXT — when explaining a segment, cite these specific events:\n${personaContext}`
      : ""
  }
After using tools, reply with ONLY this JSON, no prose:
{"summary_sentence":string,"score_breakdown":string,"top_3_fixes":string[],"suggested_next_action":string}`;

export async function explainWithClaude(
  query: string,
  state: DemoState,
  prs: PRSState,
  personaContext?: string
): Promise<{ trace: ReasoningTraceStep[]; llm_response: AgentResponse["llm_response"] }> {
  const baseURL = serverEnv.anthropicBaseUrl();
  const client = new Anthropic({
    apiKey: serverEnv.anthropicApiKey(),
    // Only override when set — otherwise the SDK targets api.anthropic.com.
    ...(baseURL ? { baseURL } : {}),
  });
  const trace: ReasoningTraceStep[] = [];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: query }];

  for (let i = 0; i < 6; i++) {
    const res = await client.messages.create({
      model: serverEnv.claudeModel(),
      max_tokens: 1024,
      system: system(prs, personaContext),
      tools: TOOLS,
      tool_choice: { type: "auto" },
      messages,
    });

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { trace, llm_response: parseAnswer(text) };
    }

    messages.push({ role: "assistant", content: res.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const dim = await FETCHERS[tu.name as FetcherName](state);
      const summary =
        dim.raw_label ??
        `${dim.dimension_name}: ${dim.normalised_score}/${dim.max_score}`;
      trace.push({
        tool_name: tu.name,
        tool_input: tu.input as Record<string, unknown>,
        tool_output_summary: summary,
      });
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(dim),
      });
    }
    messages.push({ role: "user", content: results });
  }

  throw new Error("tool loop exceeded");
}

/**
 * Parses Claude's final JSON answer. Throws on a malformed or shape-invalid
 * reply so the caller (query-handler) falls through to the deterministic
 * fallback — the agent route never 500s on a bad model response.
 */
function parseAnswer(text: string): AgentResponse["llm_response"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    throw new Error(
      `Claude reply was not valid JSON: ${text.slice(0, 200)}`
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Claude reply JSON was not an object");
  }
  const j = parsed as Record<string, unknown>;
  if (typeof j.summary_sentence !== "string" || j.summary_sentence.trim() === "") {
    throw new Error("Claude reply missing summary_sentence");
  }
  return {
    summary_sentence: j.summary_sentence,
    score_breakdown: typeof j.score_breakdown === "string" ? j.score_breakdown : "",
    top_3_fixes: Array.isArray(j.top_3_fixes) ? j.top_3_fixes.map(String) : [],
    suggested_next_action:
      typeof j.suggested_next_action === "string" ? j.suggested_next_action : "",
  };
}
