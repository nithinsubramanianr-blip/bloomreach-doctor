/**
 * Unit tests — llm-explainer (with the Anthropic SDK mocked).
 *
 * Tests:
 *  - Reasoning trace extraction from multi-block response.
 *  - Agent loop: tool_use → tool_result → final text.
 *  - tool_choice: { type: 'auto' } is set on the API call.
 *  - JSON parsing of Claude's final text.
 *
 * No real network calls. The SDK is mocked via jest.mock(...).
 */

// Mock the Anthropic SDK BEFORE requiring llm-explainer.
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
);

// Also mock the M1 fetchers via tools-registry so we don't trip the
// synthetic-loader on disk read while testing the agent loop.
jest.mock('../tools-registry', () => {
  const fakeTool = jest.fn(async (input: object) => ({
    ok: true,
    received: input,
    dimension: 'mock',
  }));
  return {
    getToolDefinitions: () => [
      {
        name: 'fetchBRUIDMatchRate',
        description: 'mock',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'fetchAutoSegmentCoverage',
        description: 'mock',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'fetchSignalFreshness',
        description: 'mock',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'fetchRuleConflicts',
        description: 'mock',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'fetchABTestCoverage',
        description: 'mock',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
    ],
    getToolImplementation: () => fakeTool,
    getToolNames: () => [
      'fetchBRUIDMatchRate',
      'fetchAutoSegmentCoverage',
      'fetchSignalFreshness',
      'fetchRuleConflicts',
      'fetchABTestCoverage',
    ],
  };
});

const { explainWithClaude, _internal } = require('../llm-explainer');

beforeEach(() => {
  mockCreate.mockReset();
});

describe('llm-explainer — internal helpers', () => {
  test('extractTraceAndText pairs tool_use with provided outputs', () => {
    const response = {
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'fetchBRUIDMatchRate',
          input: {},
        },
        { type: 'text', text: 'hello world' },
      ],
    };
    const { trace, finalText } = _internal.extractTraceAndText(response, {
      tu_1: '22% match rate',
    });
    expect(trace).toEqual([
      {
        tool_name: 'fetchBRUIDMatchRate',
        tool_input: {},
        tool_output_summary: '22% match rate',
      },
    ]);
    expect(finalText).toBe('hello world');
  });

  test('truncateForTrace caps at 200 chars', () => {
    const long = 'x'.repeat(500);
    const truncated = _internal.truncateForTrace(long);
    expect(truncated.length).toBeLessThanOrEqual(200);
    expect(truncated.endsWith('…')).toBe(true);
  });

  test('parseLLMJson handles fenced JSON', () => {
    const fenced =
      '```json\n{"summary_sentence":"s","top_3_fixes":["a","b","c"]}\n```';
    const parsed = _internal.parseLLMJson(fenced);
    expect(parsed.summary_sentence).toBe('s');
    expect(parsed.top_3_fixes).toEqual(['a', 'b', 'c']);
  });

  test('parseLLMJson returns null for unparseable text', () => {
    expect(_internal.parseLLMJson('this is not json')).toBeNull();
  });
});

describe('llm-explainer — agent loop with mocked SDK', () => {
  const context = {
    query: 'Why is my BRUID score so low?',
    intent: 'dimension-drill',
    prs_snapshot: { composite_score: 52, rag_status: 'amber' },
    tool_hint: 'drill into dimension',
  };

  test('one round of tool_use, then final text — returns shaped result', async () => {
    // Turn 1: Claude requests a tool.
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tu_1',
          name: 'fetchBRUIDMatchRate',
          input: {},
        },
      ],
    });
    // Turn 2: Claude returns the final JSON.
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text:
            '{"summary_sentence":"BRUID is low.","score_breakdown":"22%","top_3_fixes":["a","b","c"],"suggested_next_action":"Fix BRUID."}',
        },
      ],
    });

    const result = await explainWithClaude(context);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.llm_response.summary_sentence).toBe('BRUID is low.');
    expect(result.llm_response.top_3_fixes).toEqual(['a', 'b', 'c']);
    expect(result.reasoning_trace).toHaveLength(1);
    expect(result.reasoning_trace[0]).toEqual(
      expect.objectContaining({
        tool_name: 'fetchBRUIDMatchRate',
        tool_input: {},
      }),
    );
  });

  test('tool_choice is auto on every call (Option A invariant)', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{}' }],
    });

    await explainWithClaude(context);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: 'auto' });
    expect(callArgs.max_tokens).toBe(1500);
    expect(callArgs.model).toBeDefined();
    expect(Array.isArray(callArgs.tools)).toBe(true);
    expect(callArgs.tools).toHaveLength(5);
  });

  test('multiple tool_use blocks in a single turn are all executed', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'tu_a',
          name: 'fetchBRUIDMatchRate',
          input: {},
        },
        {
          type: 'tool_use',
          id: 'tu_b',
          name: 'fetchAutoSegmentCoverage',
          input: {},
        },
      ],
    });
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"summary_sentence":"done"}' }],
    });

    const result = await explainWithClaude(context);
    expect(result.reasoning_trace.length).toBe(2);
    expect(result.reasoning_trace.map((s: any) => s.tool_name)).toEqual([
      'fetchBRUIDMatchRate',
      'fetchAutoSegmentCoverage',
    ]);
  });

  test('uses CLAUDE_MODEL env override if set, otherwise default', async () => {
    const original = process.env.CLAUDE_MODEL;
    process.env.CLAUDE_MODEL = 'claude-test-override';
    try {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '{}' }],
      });
      await explainWithClaude(context);
      expect(mockCreate.mock.calls[0][0].model).toBe('claude-test-override');
    } finally {
      if (original === undefined) {
        delete process.env.CLAUDE_MODEL;
      } else {
        process.env.CLAUDE_MODEL = original;
      }
    }

    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{}' }],
    });
    await explainWithClaude(context);
    expect(mockCreate.mock.calls[1][0].model).toBe(_internal.DEFAULT_MODEL);
    expect(_internal.DEFAULT_MODEL).toBe('claude-sonnet-4-20250514');
  });
});

export {};
