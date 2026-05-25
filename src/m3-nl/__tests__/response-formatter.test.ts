/**
 * Unit tests — response-formatter.
 *
 * Asserts the M3 → M4 Agent Response Object shape per CLAUDE.md.
 */

const { formatResponse } = require('../response-formatter');

describe('formatResponse', () => {
  const explainerResult = {
    llm_response: {
      summary_sentence: 'PRS is 52/100 due to low BRUID match.',
      score_breakdown: 'BRUID 8/20, AutoSegment 6/20.',
      top_3_fixes: ['Create segments', 'Enable BRUID', 'Configure A/B'],
      suggested_next_action: 'Create the three segments today.',
    },
    reasoning_trace: [
      {
        tool_name: 'fetchBRUIDMatchRate',
        tool_input: {},
        tool_output_summary: '22% match rate',
      },
    ],
  };

  const context = {
    query: 'Why is my personalisation not working?',
    intent: 'diagnosis',
  };

  test('returns an object with all required keys', () => {
    const out = formatResponse(explainerResult, context);
    expect(out).toEqual(
      expect.objectContaining({
        query: 'Why is my personalisation not working?',
        intent: 'diagnosis',
        reasoning_trace: expect.any(Array),
        llm_response: expect.any(Object),
        timestamp: expect.any(String),
      }),
    );
  });

  test('llm_response has the four required fields', () => {
    const out = formatResponse(explainerResult, context);
    expect(out.llm_response).toEqual({
      summary_sentence: 'PRS is 52/100 due to low BRUID match.',
      score_breakdown: 'BRUID 8/20, AutoSegment 6/20.',
      top_3_fixes: ['Create segments', 'Enable BRUID', 'Configure A/B'],
      suggested_next_action: 'Create the three segments today.',
    });
  });

  test('reasoning_trace preserves tool steps', () => {
    const out = formatResponse(explainerResult, context);
    expect(out.reasoning_trace).toHaveLength(1);
    expect(out.reasoning_trace[0]).toEqual({
      tool_name: 'fetchBRUIDMatchRate',
      tool_input: {},
      tool_output_summary: '22% match rate',
    });
  });

  test('timestamp is ISO8601', () => {
    const out = formatResponse(explainerResult, context);
    expect(out.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('sanitises script tags from llm_response (XSS prevention)', () => {
    const malicious = {
      llm_response: {
        summary_sentence: 'Hello <script>alert(1)</script> world',
        score_breakdown: '<img src=x onerror="alert(1)">',
        top_3_fixes: ["javascript:alert('x')"],
        suggested_next_action: 'fine',
      },
      reasoning_trace: [],
    };
    const out = formatResponse(malicious, context);
    expect(out.llm_response.summary_sentence).not.toContain('<script>');
    expect(out.llm_response.score_breakdown).not.toMatch(/onerror\s*=/i);
    expect(out.llm_response.top_3_fixes[0]).not.toMatch(/^javascript:/i);
  });

  test('handles missing explainerResult fields gracefully', () => {
    const out = formatResponse({}, context);
    expect(out.llm_response.summary_sentence).toBe('');
    expect(out.llm_response.top_3_fixes).toEqual([]);
    expect(out.reasoning_trace).toEqual([]);
  });

  test('matches the M3 → M4 contract shape (snapshot)', () => {
    const out = formatResponse(explainerResult, context);
    // Strip timestamp for snapshot determinism.
    const { timestamp, ...rest } = out;
    expect(typeof timestamp).toBe('string');
    expect(rest).toMatchSnapshot();
  });
});

export {};
