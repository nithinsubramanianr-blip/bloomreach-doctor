/**
 * M3 NL Interface — Loomi-only explainer.
 *
 * REPLACES the previous Anthropic SDK orchestration. The Ask the Doctor chat
 * now runs entirely against:
 *   1) the live PRS state (already harvested via M1 MCP fetchers)
 *   2) the Bloomreach Loomi Conversations Server for catalog questions
 *
 * No Anthropic SDK calls. The reasoning trace surfaces the actual MCP calls
 * we make (currently the Loomi Conversations Server when the query mentions
 * products / catalog terms).
 *
 * Contract preserved:
 *   {
 *     llm_response: { summary_sentence, score_breakdown, top_3_fixes,
 *                     suggested_next_action },
 *     reasoning_trace: [{ tool_name, tool_input, tool_output_summary }],
 *     raw_tool_calls: []
 *   }
 */

'use strict';

const { askLoomiConversations } = require('./loomi-conversations-client');

const TRACE_SUMMARY_MAX = 200;

const STATUS_RANK = { critical: 0, warning: 1, healthy: 2 };

const DIM_DISPLAY_NAME = {
  bruid_match_rate: 'BRUID Match Rate',
  autosegment_coverage: 'AutoSegment Coverage',
  signal_freshness: 'Signal Freshness',
  rule_conflicts: 'Rule Conflicts',
  ab_test_coverage: 'A/B Test Coverage',
  segment_definition_quality: 'Segment Definition Quality',
  profile_completeness: 'Profile Completeness',
  behavioral_signal_richness: 'Behavioral Signal Richness',
};

const CATALOG_KEYWORDS = [
  'product', 'products', 'necklace', 'ring', 'earring', 'bracelet',
  'jewellery', 'jewelry', 'price', 'collection', 'gift', 'item', 'sku',
  'show me', 'find me', 'recommend',
];

function truncate(value, max = TRACE_SUMMARY_MAX) {
  let text;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch (_err) {
    text = String(value);
  }
  if (text == null) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function isCatalogQuery(query) {
  const q = (query || '').toLowerCase();
  return CATALOG_KEYWORDS.some((kw) => q.includes(kw));
}

function sortByScoreAsc(dimensions) {
  return [...dimensions].sort((a, b) => {
    const sa = typeof a.score === 'number' ? a.score : a.normalised_score || 0;
    const sb = typeof b.score === 'number' ? b.score : b.normalised_score || 0;
    if (sa !== sb) return sa - sb;
    return String(a.dimension_id).localeCompare(String(b.dimension_id));
  });
}

function formatScore(dim) {
  const score = typeof dim.score === 'number' ? dim.score : dim.normalised_score;
  const pct = dim.raw_value != null ? Math.round(dim.raw_value * 100) + '%' : '—';
  const name = DIM_DISPLAY_NAME[dim.dimension_id] || dim.dimension_id;
  return `${name} ${pct} (${score}/20, ${dim.status})`;
}

function buildDiagnosisResponse(prs) {
  const sorted = sortByScoreAsc(prs.dimensions || []);
  const critical = sorted.filter((d) => d.status === 'critical');
  const warning = sorted.filter((d) => d.status === 'warning');
  const fixes = (prs.fix_list || []).slice(0, 3);

  const summary =
    `Your personalisation is scoring ${prs.composite_score}/100 (${prs.rag_status}) — `
    + (critical.length > 0
      ? `${critical.length} dimension${critical.length > 1 ? 's are' : ' is'} critical and ${warning.length} need monitoring.`
      : warning.length > 0
        ? `${warning.length} dimension${warning.length > 1 ? 's' : ''} need monitoring.`
        : 'all dimensions are healthy.');

  const breakdown = sorted
    .slice(0, 6)
    .map((d) => formatScore(d))
    .join('. ') + '.';

  const top3 = fixes.length > 0
    ? fixes.map((f) => `${f.fix_title} — ${f.revenue_impact}`)
    : sorted
        .filter((d) => d.status !== 'healthy')
        .slice(0, 3)
        .map((d) => `Raise ${DIM_DISPLAY_NAME[d.dimension_id] || d.dimension_id} — it's currently ${d.status}.`);

  const nextAction = fixes[0]
    ? `Start with: ${fixes[0].fix_title}.`
    : 'Activate the dimension with the lowest score first.';

  return {
    summary_sentence: summary,
    score_breakdown: breakdown,
    top_3_fixes: top3,
    suggested_next_action: nextAction,
  };
}

function buildFixRequestResponse(prs) {
  const fixes = (prs.fix_list || []).slice(0, 3);
  const sorted = sortByScoreAsc(prs.dimensions || []);
  const headline = fixes[0] ? fixes[0].fix_title : 'No fixes available — all dimensions look healthy.';

  return {
    summary_sentence:
      fixes.length > 0
        ? `The highest-impact fix right now is "${headline}" — projected ${fixes[0].revenue_impact}.`
        : 'No remediation fixes are queued — your PRS is in a healthy state.',
    score_breakdown:
      'Fixes are ranked by the live PRS dimension scores: '
      + sorted.slice(0, 3).map((d) => formatScore(d)).join(', ') + '.',
    top_3_fixes: fixes.map((f, i) =>
      `Step ${i + 1} — ${f.fix_title}. Effort: ${f.effort}. Impact: ${f.revenue_impact}.`),
    suggested_next_action: fixes[0] ? `Approve "${fixes[0].fix_title}" in the Scorecard.` : 'Re-run the diagnosis next week.',
  };
}

function buildDimensionDrillResponse(prs, query) {
  const q = (query || '').toLowerCase();
  const dims = prs.dimensions || [];

  // Match by keyword to dimension_id.
  const KEYWORD_MAP = [
    [/\bbruid|cookie|match\b/, 'bruid_match_rate'],
    [/\bautosegment|segment coverage\b/, 'autosegment_coverage'],
    [/\bsignal|fresh|stale\b/, 'signal_freshness'],
    [/\brule|conflict\b/, 'rule_conflicts'],
    [/\ba\/b|ab test|experiment\b/, 'ab_test_coverage'],
    [/\bsegment definition|condition\b/, 'segment_definition_quality'],
    [/\bprofile|email|identified\b/, 'profile_completeness'],
    [/\bbehavioral|behaviour|event\b/, 'behavioral_signal_richness'],
  ];

  let matchedId = null;
  for (const [re, id] of KEYWORD_MAP) {
    if (re.test(q)) { matchedId = id; break; }
  }

  const target = matchedId
    ? dims.find((d) => d.dimension_id === matchedId)
    : sortByScoreAsc(dims)[0];

  if (!target) {
    return {
      summary_sentence: 'Could not locate that dimension in the current PRS state.',
      score_breakdown: '',
      top_3_fixes: [],
      suggested_next_action: 'Open the Scorecard tab for a full breakdown.',
    };
  }

  const name = DIM_DISPLAY_NAME[target.dimension_id] || target.dimension_id;
  return {
    summary_sentence: `${name} is currently ${formatScore(target)}.`,
    score_breakdown: target.raw_label
      || `Raw value ${target.raw_value} (live from ${target.data_source}).`,
    top_3_fixes: (prs.fix_list || [])
      .filter((f) => f.dimension === target.dimension_id)
      .slice(0, 3)
      .map((f) => `${f.fix_title} — ${f.revenue_impact}`),
    suggested_next_action: target.status === 'healthy'
      ? `${name} is healthy — focus on the next lowest dimension.`
      : `Open the ${name} card in the Scorecard for remediation steps.`,
  };
}

function buildArchetypeCompareResponse(prs) {
  const autoseg = (prs.dimensions || []).find((d) => d.dimension_id === 'autosegment_coverage');
  const signal = (prs.dimensions || []).find((d) => d.dimension_id === 'signal_freshness');
  const sdq = (prs.dimensions || []).find((d) => d.dimension_id === 'segment_definition_quality');

  return {
    summary_sentence:
      'Across the three demo archetypes (Guest / Sarah / Alex), personalisation quality is gated by '
      + 'segment coverage and signal freshness — both visible in the current PRS dimensions.',
    score_breakdown:
      [
        autoseg ? formatScore(autoseg) : null,
        signal ? formatScore(signal) : null,
        sdq ? formatScore(sdq) : null,
      ].filter(Boolean).join('. ') + '.',
    top_3_fixes: [
      'New Prospecting (Guest) — boost is_bestseller items so first-time shoppers see high-conversion products.',
      'Gifting Intent (Sarah) — boost gift_eligible products to surface curated gift sets.',
      'High Value Returning (Alex) — boost is_new_arrival OR price_band=premium for loyalty shoppers.',
    ],
    suggested_next_action: 'Activate all three Discovery boost rules to see per-archetype lift.',
  };
}

function buildLoomiTraceStep(toolName, query, payload, error) {
  if (error) {
    return {
      tool_name: toolName,
      tool_input: { query },
      tool_output_summary: truncate(`error: ${error.message || error}`),
    };
  }
  const itemCount = Array.isArray(payload && payload.data) ? payload.data.length : 0;
  return {
    tool_name: toolName,
    tool_input: { query },
    tool_output_summary: truncate(
      `Loomi Conversations returned ${itemCount} item${itemCount === 1 ? '' : 's'}.`,
    ),
  };
}

function buildPRSReasoningTrace(prs) {
  // Surface the M1 fetchers that produced the current dimensions so the user
  // can see what data the answer is built from.
  return (prs && prs.dimensions || []).map((d) => ({
    tool_name: `fetch:${d.data_source || 'm1'}:${d.dimension_id}`,
    tool_input: {},
    tool_output_summary: truncate(
      JSON.stringify({
        raw_value: d.raw_value,
        normalised_score: d.normalised_score,
        status: d.status,
        data_source: d.data_source,
      }),
    ),
  }));
}

/**
 * Public entry. Reads `context.prs_snapshot`, optionally calls the Loomi
 * Conversations Server for catalog questions, and returns the M3→M4 contract
 * shape. Never invokes the Anthropic SDK.
 */
async function explainWithClaude(context) {
  // Keep the function name for backwards-compat with query-handler.js;
  // the implementation no longer talks to Claude.
  return explainWithLoomi(context);
}

async function explainWithLoomi(context) {
  const prs = (context && context.prs_snapshot) || {
    composite_score: 0,
    rag_status: 'red',
    dimensions: [],
    fix_list: [],
  };
  const intent = (context && context.intent) || 'diagnosis';
  const query = (context && context.query) || '';

  let llm_response;
  switch (intent) {
    case 'fix-request':       llm_response = buildFixRequestResponse(prs); break;
    case 'dimension-drill':   llm_response = buildDimensionDrillResponse(prs, query); break;
    case 'archetype-compare': llm_response = buildArchetypeCompareResponse(prs); break;
    case 'diagnosis':
    default:                  llm_response = buildDiagnosisResponse(prs);
  }

  // Reasoning trace = the M1 fetchers that produced the data backing this
  // answer. This is the live, real-data trace.
  const reasoning_trace = buildPRSReasoningTrace(prs);

  // For catalog-flavoured questions, additionally surface a Loomi
  // Conversations call so the user sees the integration is live.
  if (isCatalogQuery(query)) {
    try {
      const payload = await askLoomiConversations({ query, kind: 'product' });
      reasoning_trace.push(buildLoomiTraceStep('askLoomiConversations', query, payload, null));

      const items = Array.isArray(payload && payload.data) ? payload.data : [];
      if (items.length > 0) {
        const sample = items.slice(0, 3).map((i) => i.properties && i.properties.name).filter(Boolean);
        llm_response = {
          ...llm_response,
          suggested_next_action:
            sample.length > 0
              ? `Loomi Conversations found ${items.length} matches — top hits: ${sample.join(', ')}.`
              : llm_response.suggested_next_action,
        };
      }
    } catch (err) {
      reasoning_trace.push(buildLoomiTraceStep('askLoomiConversations', query, null, err));
    }
  }

  return {
    llm_response,
    reasoning_trace,
    raw_tool_calls: [],
  };
}

module.exports = {
  explainWithClaude,   // legacy name kept for query-handler.js
  explainWithLoomi,
  // Exported for unit testing only.
  _internal: {
    buildDiagnosisResponse,
    buildFixRequestResponse,
    buildDimensionDrillResponse,
    buildArchetypeCompareResponse,
    isCatalogQuery,
    truncate,
  },
};
