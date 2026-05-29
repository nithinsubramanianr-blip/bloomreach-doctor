/**
 * Unit tests — tools-registry.
 *
 * Confirms the PRS dimension tools + Loomi Conversations tool are registered
 * per CLAUDE.md "Module C — True Agentic Tool Selection" and the 8-dimension
 * scope expansion (Engagement MCP).
 */

const {
  getToolDefinitions,
  getToolImplementation,
  getToolNames,
} = require('../tools-registry');

const EXPECTED_TOOL_NAMES = [
  'fetchBRUIDMatchRate',
  'fetchAutoSegmentCoverage',
  'fetchSignalFreshness',
  'fetchRuleConflicts',
  'fetchABTestCoverage',
  'fetchSegmentDefinitionQuality',
  'fetchProfileCompleteness',
  'fetchBehavioralSignalRichness',
  'askLoomiConversations',
];

describe('tools-registry', () => {
  test('getToolDefinitions returns the expected number of tools', () => {
    const defs = getToolDefinitions();
    expect(defs).toHaveLength(EXPECTED_TOOL_NAMES.length);
  });

  test('tools have the exact expected names and order', () => {
    const names = getToolDefinitions().map((d: { name: string }) => d.name);
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
    expect(getToolNames()).toEqual(EXPECTED_TOOL_NAMES);
  });

  test('every tool has a description and an input_schema', () => {
    for (const def of getToolDefinitions()) {
      expect(typeof def.description).toBe('string');
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.input_schema).toBeDefined();
      expect(def.input_schema.type).toBe('object');
    }
  });

  test('getToolImplementation returns a function for known tools', () => {
    for (const name of EXPECTED_TOOL_NAMES) {
      expect(typeof getToolImplementation(name)).toBe('function');
    }
  });

  test('getToolImplementation returns null for unknown tools', () => {
    expect(getToolImplementation('fetchMagicBeans')).toBeNull();
  });

  test('getToolDefinitions returns deep clones (cannot mutate registry)', () => {
    const a = getToolDefinitions();
    a[0].name = 'mutated';
    const b = getToolDefinitions();
    expect(b[0].name).toBe('fetchBRUIDMatchRate');
  });
});

export {};
