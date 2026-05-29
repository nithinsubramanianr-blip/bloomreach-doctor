/**
 * Unit tests for explainDimensionWithClaude (Module A "Explain" panel).
 * Mocks the Anthropic SDK so no network call happens; asserts the response
 * shape on the live (mocked) path and the deterministic fallback path.
 */

// next/jest maps `server-only` to an empty module; guard explicitly anyway.
jest.mock("server-only", () => ({}));

const mockCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: class {
    messages = { create: mockCreate };
  },
}));

import type { PRSState, ScoredDimension } from "@/lib/contracts";
import {
  deterministicDimensionExplanation,
  explainDimensionWithClaude,
} from "../llm-explainer";

const dimension: ScoredDimension = {
  dimension_id: "autosegment_coverage",
  dimension_name: "AutoSegment Coverage",
  raw_value: 0.14,
  score: 0,
  max_score: 20,
  status: "critical",
  data_source: "marketing_mcp",
  explanation: "",
};

const prs: PRSState = {
  composite_score: 14,
  rag_status: "red",
  boost_rules_state: "all_inactive",
  dimensions: [dimension],
  fix_list: [
    {
      position: 1,
      fix_id: "fix_autosegment",
      dimension: "autosegment_coverage",
      fix_title: "Create 3 manual audience segments",
      description: "",
      effort: "Medium",
      revenue_impact: "+12–18% RPV",
      action_label: "Review & approve",
      risk_level: "Low",
      steps: [],
    },
  ],
  generated_at: new Date().toISOString(),
};

describe("explainDimensionWithClaude", () => {
  const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    mockCreate.mockReset();
  });

  afterAll(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  });

  it("returns Claude's prose + a trace array when the model answers without tools", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate.mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: "AutoSegment Coverage scored 0/20 because almost no sessions are assigned to a segment. The most impactful next step is to create three manual audience segments.",
        },
      ],
    });

    const result = await explainDimensionWithClaude(prs, dimension);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(typeof result.explanation).toBe("string");
    expect(result.explanation).toMatch(/AutoSegment Coverage/);
    expect(Array.isArray(result.reasoning_trace)).toBe(true);
    expect(result.reasoning_trace).toHaveLength(0);
  });

  it("falls back to a deterministic explanation when no API key is set (no Claude call)", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await explainDimensionWithClaude(prs, dimension);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.reasoning_trace).toEqual([]);
    expect(result.explanation).toBe(
      deterministicDimensionExplanation(prs, dimension)
    );
    // Grounded in the pinned score — never a fabricated number.
    expect(result.explanation).toMatch(/0\/20/);
    expect(result.explanation).toMatch(/critical/);
  });
});
