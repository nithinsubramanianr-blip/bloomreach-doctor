import "server-only";

import type { AgentResponse, DemoState } from "@/lib/contracts";

/**
 * llm-explainer — RESERVED as the ONLY file permitted to import
 * `@anthropic-ai/sdk` (CLAUDE.md invariant #5 / ADR-004-1).
 *
 * NOT YET WIRED. Module C currently runs the synthetic, data-driven path in
 * query-handler.ts. When the developer adds their Anthropic setup:
 *
 *   1. `npm install @anthropic-ai/sdk`
 *   2. import Anthropic HERE (and nowhere else).
 *   3. Call messages.create({
 *        model: serverEnv.claudeModel(),
 *        max_tokens: 1500,
 *        tools: getToolDefinitions(),          // from tools-registry.ts
 *        tool_choice: { type: "auto" },        // Option A — Claude picks tools
 *        system: SYSTEM_PROMPT,
 *        messages: [{ role: "user", content: buildUserPrompt(...) }],
 *      })
 *   4. Execute each tool_use block by calling the matching M1 fetcher, feed
 *      tool_result blocks back, and extract the reasoning trace from the
 *      tool_use / tool_result content blocks.
 *
 * Until then, query-handler.handleQuery() is the active implementation and this
 * export is intentionally unused.
 */

export const LLM_EXPLAINER_WIRED = false;

export async function explainWithClaude(
  _queryText: string,
  _state: DemoState
): Promise<AgentResponse> {
  throw new Error(
    "llm-explainer not wired yet — add @anthropic-ai/sdk and the Claude call. " +
      "Module C uses the synthetic path in query-handler.ts in the meantime."
  );
}
