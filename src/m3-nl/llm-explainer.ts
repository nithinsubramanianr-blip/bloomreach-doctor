import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type {
  AgentResponse,
  DemoState,
  FixResult,
  PRSState,
  ReasoningTraceStep,
  ScoredDimension,
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
import { generateFixList } from "@/m2-scoring/fix-generator";

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

/**
 * Builds the Anthropic client with the shared Option A configuration: personal
 * key targets api.anthropic.com directly; an ANTHROPIC_BASE_URL (org gateway)
 * is applied only when set.
 */
function createClient(): Anthropic {
  const baseURL = serverEnv.anthropicBaseUrl();
  return new Anthropic({
    apiKey: serverEnv.anthropicApiKey(),
    ...(baseURL ? { baseURL } : {}),
  });
}

const system = (prs: PRSState, personaContext?: string, findings?: string) =>
  `You are the Personalization Performance Doctor for a Bloomreach Discovery storefront.
Use the tools to inspect the dimensions relevant to the question, then explain the diagnosis in plain English.
GROUND TRUTH — do not recompute, contradict, or invent numbers (show 0 where it is 0):
- Composite score ${prs.composite_score}/100 (${prs.rag_status}).
- Ranked fixes: ${prs.fix_list
    .map((f, i) => `${i + 1}. ${f.fix_title} (${f.revenue_impact})`)
    .join("; ")}.${
    findings
      ? `\nREAL MCP FINDINGS — cite these verbatim, do not soften them:\n${findings}.`
      : ""
  }${
    personaContext
      ? `\nACTIVE SHOPPER CONTEXT — when explaining a segment, cite this real customer's real events:\n${personaContext}`
      : ""
  }
After using tools, reply with ONLY this JSON, no prose:
{"summary_sentence":string,"score_breakdown":string,"top_3_fixes":string[],"suggested_next_action":string}`;

export async function explainWithClaude(
  query: string,
  state: DemoState,
  prs: PRSState,
  personaContext?: string,
  findings?: string
): Promise<{ trace: ReasoningTraceStep[]; llm_response: AgentResponse["llm_response"] }> {
  const client = createClient();
  const trace: ReasoningTraceStep[] = [];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: query }];

  for (let i = 0; i < 6; i++) {
    const res = await client.messages.create({
      model: serverEnv.claudeModel(),
      max_tokens: 1024,
      system: system(prs, personaContext, findings),
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

// ---------------------------------------------------------------------------
// Dynamic recommended-fix list (Claude-generated, scores pinned as ground truth)
// ---------------------------------------------------------------------------

/**
 * Number of ranked fixes to surface — matches the 3-column scorecard layout.
 */
const FIX_COUNT = 3;

/** Per-process memo so before/after each call Claude at most once per server run. */
const fixListCache = new Map<string, FixResult[]>();

/** Cache key from the in-scope dimension scores (the only Claude input). */
function fixCacheKey(inScope: ScoredDimension[]): string {
  return inScope
    .map((d) => `${d.dimension_id}:${d.score}`)
    .sort()
    .join("|");
}

const fixSystem = (inScope: ScoredDimension[]) =>
  `You are the Personalization Performance Doctor for a Bloomreach Discovery storefront.
You are given the FINAL diagnosis: the in-scope dimensions, each already scored out of 20. These scores are GROUND TRUTH — you PRIORITISE and EXPLAIN them, you never recompute, restate, or invent different numbers (show 0 where it is 0).
Diagnosis (dimension_id — name — score/20 — status — raw%):
${inScope
  .map(
    (d) =>
      `- ${d.dimension_id} — ${d.dimension_name} — ${d.score}/20 — ${d.status} — ${Math.round(
        d.raw_value * 100
      )}%`
  )
  .join("\n")}

Produce a ranked list of exactly ${FIX_COUNT} recommended fixes, best first. Target the weakest dimensions that a marketer can actually act on. Each fix targets ONE dimension (use its dimension_id verbatim). "expected_impact" is a concise revenue/performance phrase (e.g. "+12–18% RPV"). "why" is ONE plain-English sentence tying the fix to the score.
Reply with ONLY this JSON, no prose:
{"fixes":[{"dimension":string,"fix_title":string,"expected_impact":string,"why":string}]}`;

/**
 * Asks Claude to rank and explain the fixes for the current diagnosis. The
 * dimension scores are pinned in the prompt as ground truth — Claude prioritises
 * and writes copy, it never changes the numbers. Throws on a malformed reply so
 * the caller falls back to the deterministic catalogue fix list.
 */
export async function generateFixListWithClaude(
  prs: PRSState
): Promise<FixResult[]> {
  const inScope = prs.dimensions.filter((d) => !d.out_of_scope);
  const validDimensions = new Set(inScope.map((d) => d.dimension_id));

  const client = createClient();
  const res = await client.messages.create({
    model: serverEnv.claudeModel(),
    max_tokens: 1024,
    system: fixSystem(inScope),
    messages: [
      {
        role: "user",
        content:
          "Generate the ranked recommended-fix list for this diagnosis.",
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseFixList(text, validDimensions);
}

/** Parses + validates Claude's fix JSON, mapping it onto the FixResult shape. */
function parseFixList(
  text: string,
  validDimensions: Set<string>
): FixResult[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    throw new Error(`Claude fix reply was not valid JSON: ${text.slice(0, 200)}`);
  }
  const raw = (parsed as { fixes?: unknown })?.fixes;
  if (!Array.isArray(raw)) {
    throw new Error("Claude fix reply missing a fixes array");
  }

  const fixes: FixResult[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const f = item as Record<string, unknown>;
    const dimension = typeof f.dimension === "string" ? f.dimension : "";
    const fix_title = typeof f.fix_title === "string" ? f.fix_title.trim() : "";
    const expected_impact =
      typeof f.expected_impact === "string" ? f.expected_impact.trim() : "";
    const why = typeof f.why === "string" ? f.why.trim() : "";
    // Only accept fixes that target a real in-scope dimension and carry a title.
    if (!validDimensions.has(dimension) || fix_title === "") continue;

    const position = (fixes.length + 1) as 1 | 2 | 3;
    fixes.push({
      position,
      fix_id: `llm-fix-${position}`,
      dimension,
      fix_title,
      description: why,
      effort: "Medium",
      revenue_impact: expected_impact,
      action_label: "Review & approve",
      risk_level: "Low",
      steps: why ? [why] : [],
    });
    if (fixes.length === FIX_COUNT) break;
  }

  if (fixes.length === 0) {
    throw new Error("Claude fix reply contained no valid fixes");
  }
  return fixes;
}

/**
 * Resolves the recommended-fix list for a PRS diagnosis. When ANTHROPIC_API_KEY
 * is present, Claude ranks and explains the fixes (scores pinned as ground
 * truth); otherwise — or on any Claude/parse failure — it falls back to the
 * deterministic catalogue fix list (generateFixList). Memoised per diagnosis so
 * a server run calls Claude at most once per before/after state.
 */
export async function buildFixList(prs: PRSState): Promise<FixResult[]> {
  if (!serverEnv.anthropicApiKey()) {
    return generateFixList(prs);
  }

  const inScope = prs.dimensions.filter((d) => !d.out_of_scope);
  const key = fixCacheKey(inScope);
  const cached = fixListCache.get(key);
  if (cached) return cached;

  try {
    const fixes = await generateFixListWithClaude(prs);
    fixListCache.set(key, fixes);
    return fixes;
  } catch (error) {
    console.log(
      "[m3-nl] llm fix-list generation failed, using deterministic fallback:",
      error instanceof Error ? error.message : error
    );
    return generateFixList(prs);
  }
}
