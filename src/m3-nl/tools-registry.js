/**
 * M3 NL Interface — Tools Registry.
 *
 * Registers the five M1 dimension fetchers as Claude native tool
 * definitions per design-spec 004 § "Function Signatures" and ADR-004-4.
 * Tool names map 1:1 to M1 exports so llm-explainer.js can dispatch
 * `tool_use` blocks back to the correct fetcher.
 *
 * Per architecture-spec ADR-004-2 the registry never *selects* tools —
 * it only declares them. Claude picks at runtime via tool_choice: auto.
 *
 * No Anthropic SDK import here. Invariant #5: only llm-explainer.js
 * may depend on the SDK.
 */

'use strict';

const {
  fetchBRUIDMatchRate,
  fetchRuleConflicts,
} = require('../m1-bloomreach/discovery-client');
const {
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
} = require('../m1-bloomreach/marketing-mcp-client');
const {
  fetchABTestCoverage,
} = require('../m1-bloomreach/analytics-mcp-client');
const {
  fetchSegmentDefinitionQuality,
  fetchProfileCompleteness,
  fetchBehavioralSignalRichness,
} = require('../m1-bloomreach/engagement-client');
const { askLoomiConversations } = require('./loomi-conversations-client');

/**
 * Claude tool definitions. Input schemas are empty objects because the
 * underlying M1 fetchers take no parameters in the synthetic-only path.
 * Per FR-004-4 the shape conforms to Anthropic's `tools` array contract:
 *   { name, description, input_schema }
 */
const TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'fetchBRUIDMatchRate',
    description: 'Get current BRUID match rate from Discovery API',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetchAutoSegmentCoverage',
    description: 'Get AutoSegment coverage from Marketing MCP',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetchSignalFreshness',
    description: 'Get signal freshness score from Marketing MCP',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetchRuleConflicts',
    description: 'Get rule conflict analysis from Discovery API',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetchABTestCoverage',
    description: 'Get A/B test coverage from Analytics MCP',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetchSegmentDefinitionQuality',
    description: 'Get segment definition quality from Engagement MCP — conditions-per-segment depth weighted by Discovery exposure',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetchProfileCompleteness',
    description: 'Get profile completeness from Engagement MCP — share of customers with an enriched identified profile (email populated)',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetchBehavioralSignalRichness',
    description: 'Get behavioural signal richness from Engagement MCP — avg distinct event types captured per active user vs target',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'askLoomiConversations',
    description:
      'Ask the Bloomreach Loomi Conversations Server a catalog-aware shopper question '
      + '(e.g. "premium necklaces under £100", "gift sets for mothers day"). Returns matching '
      + 'product or collection items. Use this when the user asks about specific products, '
      + 'collections, or shopper-facing catalog questions — NOT for diagnostic / PRS questions.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Shopper-facing query string',
        },
        kind: {
          type: 'string',
          enum: ['product', 'collection', 'seeker'],
          description: 'Optional routing hint. Defaults to product search.',
        },
      },
      required: ['query'],
    },
  },
]);

/** Map of tool name → underlying M1 fetcher function. */
const TOOL_IMPLEMENTATIONS = Object.freeze({
  fetchBRUIDMatchRate,
  fetchAutoSegmentCoverage,
  fetchSignalFreshness,
  fetchRuleConflicts,
  fetchABTestCoverage,
  fetchSegmentDefinitionQuality,
  fetchProfileCompleteness,
  fetchBehavioralSignalRichness,
  askLoomiConversations,
});

/**
 * Return the array of Claude tool definitions for the Anthropic API call.
 * Returned objects are deep-cloned so callers can't mutate the canonical set.
 */
function getToolDefinitions() {
  // Deep-clone via JSON so nested schema fields (enum, items, etc.) survive.
  return TOOL_DEFINITIONS.map((tool) => JSON.parse(JSON.stringify(tool)));
}

/**
 * Resolve a tool name to its M1 fetcher. Returns `null` if Claude
 * hallucinates an unknown tool name (defensive — should never happen
 * since the registry is the only source of tool definitions).
 */
function getToolImplementation(name) {
  return Object.prototype.hasOwnProperty.call(TOOL_IMPLEMENTATIONS, name)
    ? TOOL_IMPLEMENTATIONS[name]
    : null;
}

/** Convenience: ordered list of registered tool names. */
function getToolNames() {
  return TOOL_DEFINITIONS.map((t) => t.name);
}

module.exports = {
  getToolDefinitions,
  getToolImplementation,
  getToolNames,
};
