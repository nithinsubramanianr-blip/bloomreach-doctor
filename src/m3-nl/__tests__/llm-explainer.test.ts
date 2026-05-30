/**
 * Unit tests — llm-explainer (Loomi-only path, no Anthropic SDK).
 *
 * The chat now runs deterministically over the live PRS state, with optional
 * Loomi Conversations calls for catalog-flavoured queries.
 */

// Loomi Conversations is mocked so tests never hit the network.
const mockAsk = jest.fn();
jest.mock('../loomi-conversations-client', () => ({
  askLoomiConversations: (...args: unknown[]) => mockAsk(...args),
}));

const { explainWithClaude, explainWithLoomi, _internal } = require('../llm-explainer');

const SAMPLE_PRS = {
  composite_score: 27,
  rag_status: 'red',
  dimensions: [
    { dimension_id: 'bruid_match_rate',           raw_value: 0.22,  normalised_score: 8,  score: 8,  status: 'critical', data_source: 'discovery_api' },
    { dimension_id: 'autosegment_coverage',       raw_value: 0,     normalised_score: 0,  score: 0,  status: 'critical', data_source: 'marketing_mcp' },
    { dimension_id: 'signal_freshness',           raw_value: 0.1056, normalised_score: 2, score: 2,  status: 'critical', data_source: 'marketing_mcp' },
    { dimension_id: 'rule_conflicts',             raw_value: 0.95,  normalised_score: 18, score: 18, status: 'healthy',  data_source: 'discovery_api' },
    { dimension_id: 'ab_test_coverage',           raw_value: 0,     normalised_score: 0,  score: 0,  status: 'critical', data_source: 'analytics_mcp' },
    { dimension_id: 'segment_definition_quality', raw_value: 0.167, normalised_score: 3,  score: 3,  status: 'critical', data_source: 'engagement_mcp' },
    { dimension_id: 'profile_completeness',       raw_value: 0.2045, normalised_score: 4, score: 4,  status: 'critical', data_source: 'engagement_mcp' },
    { dimension_id: 'behavioral_signal_richness', raw_value: 0.40,  normalised_score: 8,  score: 8,  status: 'critical', data_source: 'engagement_mcp' },
  ],
  fix_list: [
    { position: 1, fix_id: 'fix_autosegment', fix_title: 'Create 3 manual audience segments',
      dimension: 'autosegment_coverage', revenue_impact: '12–18% RPV lift', effort: 'Low',
      estimated_rpv_lift_pct_min: 12, estimated_rpv_lift_pct_max: 18 },
    { position: 2, fix_id: 'fix_segment_definition_quality', fix_title: 'Rebuild segments',
      dimension: 'segment_definition_quality', revenue_impact: '10–16% RPV lift', effort: 'Medium',
      estimated_rpv_lift_pct_min: 10, estimated_rpv_lift_pct_max: 16 },
    { position: 3, fix_id: 'fix_rules', fix_title: 'Configure boost rules',
      dimension: 'ab_test_coverage', revenue_impact: '5–10% RPV lift', effort: 'Low',
      estimated_rpv_lift_pct_min: 5, estimated_rpv_lift_pct_max: 10 },
  ],
};

beforeEach(() => {
  mockAsk.mockReset();
});

describe('llm-explainer — pure helpers', () => {
  test('isCatalogQuery flags product-flavoured queries', () => {
    expect(_internal.isCatalogQuery('show me necklaces under £50')).toBe(true);
    expect(_internal.isCatalogQuery('find me gift rings')).toBe(true);
    expect(_internal.isCatalogQuery('why is my PRS score low')).toBe(false);
  });

  test('truncate caps long strings with an ellipsis', () => {
    const long = 'x'.repeat(500);
    const out = _internal.truncate(long);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('…')).toBe(true);
  });

  test('buildDiagnosisResponse summarises the PRS state', () => {
    const r = _internal.buildDiagnosisResponse(SAMPLE_PRS);
    expect(r.summary_sentence).toMatch(/27\/100/);
    expect(r.summary_sentence).toMatch(/red/);
    expect(r.top_3_fixes.length).toBeGreaterThan(0);
  });

  test('buildFixRequestResponse leads with the highest-RPV fix', () => {
    const r = _internal.buildFixRequestResponse(SAMPLE_PRS);
    expect(r.summary_sentence).toContain('Create 3 manual audience segments');
  });

  test('buildDimensionDrillResponse routes BRUID queries to bruid_match_rate', () => {
    const r = _internal.buildDimensionDrillResponse(SAMPLE_PRS, 'why is my BRUID so low?');
    expect(r.summary_sentence).toContain('BRUID Match Rate');
  });
});

describe('explainWithLoomi — Loomi-only path', () => {
  test('returns the M3→M4 contract shape for a diagnosis query', async () => {
    const result = await explainWithLoomi({
      query: 'Why is my personalisation not working?',
      intent: 'diagnosis',
      prs_snapshot: SAMPLE_PRS,
    });
    expect(result.llm_response).toEqual(expect.objectContaining({
      summary_sentence: expect.any(String),
      score_breakdown: expect.any(String),
      top_3_fixes: expect.any(Array),
      suggested_next_action: expect.any(String),
    }));
    expect(Array.isArray(result.reasoning_trace)).toBe(true);
    expect(result.reasoning_trace.length).toBe(SAMPLE_PRS.dimensions.length);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  test('catalog-flavoured queries also call the Loomi Conversations Server', async () => {
    mockAsk.mockResolvedValueOnce({ data: [
      { _id: 'p1', properties: { name: 'Gold Necklace' } },
      { _id: 'p2', properties: { name: 'Pearl Studs' } },
    ] });

    const result = await explainWithLoomi({
      query: 'show me necklaces for sarah',
      intent: 'archetype-compare',
      prs_snapshot: SAMPLE_PRS,
    });

    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAsk.mock.calls[0][0]).toEqual(expect.objectContaining({ query: expect.any(String) }));
    expect(result.reasoning_trace.some((s: any) => s.tool_name === 'askLoomiConversations')).toBe(true);
  });

  test('explainWithClaude routes to Loomi when FEATURE_NATIVE_CLAUDE_TOOLS is off (default)', async () => {
    delete process.env.FEATURE_NATIVE_CLAUDE_TOOLS;
    const r1 = await explainWithLoomi({ query: 'what to fix', intent: 'fix-request', prs_snapshot: SAMPLE_PRS });
    const r2 = await explainWithClaude({ query: 'what to fix', intent: 'fix-request', prs_snapshot: SAMPLE_PRS });
    expect(r1.llm_response.summary_sentence).toBe(r2.llm_response.summary_sentence);
  });

  test('extractJSONFromText pulls the JSON object out of mixed text', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { _internal } = require('../llm-explainer');
    expect(_internal.extractJSONFromText('{"a":1}')).toEqual({ a: 1 });
    expect(_internal.extractJSONFromText('preamble {"a":1, "b":"x"} trailing')).toEqual({ a: 1, b: 'x' });
    expect(_internal.extractJSONFromText('no json here')).toBeNull();
    expect(_internal.extractJSONFromText('')).toBeNull();
  });
});

export {};
