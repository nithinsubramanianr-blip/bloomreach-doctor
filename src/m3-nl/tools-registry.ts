/**
 * Claude tool definitions for the 5 M1 dimension fetchers (FR-004-4/5).
 *
 * These are the tool schemas that will be passed to the Anthropic API with
 * `tool_choice: { type: "auto" }` once Module C's Option A is wired in
 * llm-explainer.ts. Tool `name` maps 1:1 to the M1 export name.
 *
 * Pure data — no SDK import, no LLM call.
 */

export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const NO_INPUT = { type: "object", properties: {} } as const;

export function getToolDefinitions(): ClaudeToolDefinition[] {
  return [
    {
      name: "fetchBRUIDMatchRate",
      description: "Get current BRUID match rate from Discovery API",
      input_schema: NO_INPUT,
    },
    {
      name: "fetchAutoSegmentCoverage",
      description: "Get AutoSegment coverage from Marketing MCP",
      input_schema: NO_INPUT,
    },
    {
      name: "fetchSignalFreshness",
      description: "Get signal freshness score from Marketing MCP",
      input_schema: NO_INPUT,
    },
    {
      name: "fetchRuleConflicts",
      description: "Get rule conflict analysis from Discovery API",
      input_schema: NO_INPUT,
    },
    {
      name: "fetchABTestCoverage",
      description: "Get A/B test coverage from Analytics MCP",
      input_schema: NO_INPUT,
    },
  ];
}
