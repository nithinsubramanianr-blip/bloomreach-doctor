/**
 * M1 Bloomreach — Engagement client.
 *
 * Provides persona behavioural profiles and segment activation status from
 * Bloomreach Engagement. Falls back to C5 synthetic data when sandbox
 * credentials are not available.
 *
 * Auth: BLOOMREACH_ENGAGEMENT_API_KEY
 */

'use strict';

const {
  loadPersonasFile,
  loadSegmentsFile,
  loadSyntheticDimension,
  isLiveMode,
} = require('./_synthetic-loader');
const { normaliseDimension } = require('./normaliser');
const { callMcpToolWithRetry } = require('./mcp-bridge');

const CLIENT_NAME = 'engagement-client';

function statusFromScore(score) {
  if (score <= 8) return 'critical';
  if (score <= 14) return 'warning';
  return 'healthy';
}

function projectId() {
  const id = process.env.BLOOMREACH_PROJECT_ID;
  if (!id) throw new Error('BLOOMREACH_PROJECT_ID required');
  return id;
}

function logFallback(reason) {
  const suffix = reason ? ` (${reason})` : '';
  // eslint-disable-next-line no-console
  console.log(`[m1-bloomreach] ${CLIENT_NAME} using synthetic fallback${suffix}`);
}

/**
 * Returns the three persona behavioural profiles (guest, sarah, alex).
 */
async function fetchPersonaProfiles() {
  if (!isLiveMode()) {
    logFallback();
    return readSyntheticPersonas();
  }
  try {
    return await callLivePersonas();
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return readSyntheticPersonas();
  }
}

/**
 * Returns the three segment definitions and their activation state.
 */
async function fetchSegmentStatus() {
  if (!isLiveMode()) {
    logFallback();
    return readSyntheticSegmentStatus();
  }
  try {
    return await callLiveSegmentStatus();
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return readSyntheticSegmentStatus();
  }
}

function readSyntheticPersonas() {
  const file = loadPersonasFile();
  return (file.personas || []).map((p) => ({
    persona_id: p.persona_id,
    display_name: p.display_name,
    segment_name: p.segment_name,
    bruid_present: !!p.bruid_present,
    bruid_value: p.bruid_value || null,
    session_count: p.session_count || 0,
    purchase_count: p.purchase_count || 0,
    aov: p.aov || 0,
    last_signal_date: p.last_signal_date || null,
    is_synthetic: true,
  }));
}

function readSyntheticSegmentStatus() {
  const file = loadSegmentsFile();
  const segments = (file.segments || []).map((s) => ({
    segment_id: s.segment_id,
    segment_name: s.segment_name,
    persona_linked: s.persona_linked,
    linked_boost_rule: s.linked_boost_rule,
    is_active: !!s.is_active,
    member_count: s.member_count_synthetic || 0,
    is_synthetic: true,
  }));
  return {
    total: segments.length,
    segments,
    checked_at: new Date().toISOString(),
    is_synthetic: true,
  };
}

async function callLivePersonas() {
  // Demo personas (Guest / Sarah / Alex) are synthetic constructs with no
  // matching live Engagement customer profiles — keep synthetic path.
  throw new Error('live Engagement personas not available — demo personas are synthetic');
}

async function callLiveSegmentStatus() {
  const base = process.env.BLOOMREACH_ENGAGEMENT_BASE_URL;
  const projectId = process.env.BLOOMREACH_PROJECT_ID;
  const apiKey = process.env.BLOOMREACH_ENGAGEMENT_API_KEY;

  if (!base || !projectId || !apiKey) {
    throw new Error(
      'segment status: BLOOMREACH_ENGAGEMENT_BASE_URL, BLOOMREACH_PROJECT_ID, '
      + 'BLOOMREACH_ENGAGEMENT_API_KEY required',
    );
  }

  // eslint-disable-next-line no-console
  console.log(`[ppd:engagement-client] → fetchSegmentStatus project="${projectId}"`);

  const res = await fetch(
    `${base}/api/segmentations?company_id=${encodeURIComponent(projectId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) throw new Error(`segmentations API ${res.status}`);

  const data = await res.json();
  const segmentations = (data.data || []).filter((s) => !s.archived);

  const segments = segmentations.map((s) => ({
    segment_id: s._id,
    segment_name: s.name,
    persona_linked: null,
    linked_boost_rule: null,
    is_active: !s.archived,
    member_count: 0,
    is_synthetic: false,
  }));

  const result = {
    total: segments.length,
    segments,
    checked_at: new Date().toISOString(),
    is_synthetic: false,
  };
  // eslint-disable-next-line no-console
  console.log(`[ppd:engagement-client] ← fetchSegmentStatus total=${result.total} segments`);
  return result;
}

// ---------------------------------------------------------------------------
// Engagement-MCP-sourced PRS dimensions (3 new):
//   - segment_definition_quality
//   - profile_completeness
//   - behavioral_signal_richness
// Each follows the same pattern as marketing-mcp-client: live MCP call wrapped
// with a synthetic fallback. Live values are computed from MCP tool outputs.
// ---------------------------------------------------------------------------

async function fetchSegmentDefinitionQuality() {
  if (!isLiveMode()) {
    logFallback();
    return normaliseDimension(loadSyntheticDimension('segment_definition_quality'), true);
  }
  try {
    const raw = await callLiveSegmentDefinitionQuality();
    return normaliseDimension(raw, false);
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return normaliseDimension(loadSyntheticDimension('segment_definition_quality'), true);
  }
}

async function fetchProfileCompleteness() {
  if (!isLiveMode()) {
    logFallback();
    return normaliseDimension(loadSyntheticDimension('profile_completeness'), true);
  }
  try {
    const raw = await callLiveProfileCompleteness();
    return normaliseDimension(raw, false);
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return normaliseDimension(loadSyntheticDimension('profile_completeness'), true);
  }
}

async function fetchBehavioralSignalRichness() {
  if (!isLiveMode()) {
    logFallback();
    return normaliseDimension(loadSyntheticDimension('behavioral_signal_richness'), true);
  }
  try {
    const raw = await callLiveBehavioralSignalRichness();
    return normaliseDimension(raw, false);
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return normaliseDimension(loadSyntheticDimension('behavioral_signal_richness'), true);
  }
}

// ---------------------------------------------------------------------------
// Live MCP calls. Mapped from senior's harvested formulas:
//   segment_definition_quality = (avg_conditions / target_conditions) *
//                                exposed_to_discovery_ratio
//   profile_completeness       = customers_with_email / total_customers
//   behavioral_signal_richness = avg_distinct_event_types / target (capped 1.0)
// ---------------------------------------------------------------------------

async function callLiveSegmentDefinitionQuality() {
  // list_segmentations gives us the segments. Each segment has conditions and
  // a state ("used" if exposed to Discovery integration).
  const payload = await callMcpToolWithRetry('list_segmentations', { project_id: projectId() });
  const all = (payload.data || []).filter((s) => !s.archived);
  const total = all.length;
  if (total === 0) {
    return buildDimension('segment_definition_quality', 0, 'engagement_mcp');
  }

  const TARGET_CONDITIONS = 3;
  let conditionSum = 0;
  let exposedCount = 0;
  for (const seg of all) {
    const conds = countConditions(seg);
    conditionSum += conds;
    if (isExposedToDiscovery(seg)) exposedCount += 1;
  }
  const avgConditions = conditionSum / total;
  const exposedRatio = exposedCount / total;
  const raw = Math.min(1, (avgConditions / TARGET_CONDITIONS) * exposedRatio);

  return buildDimension('segment_definition_quality', raw, 'engagement_mcp');
}

async function callLiveProfileCompleteness() {
  // get_project_overview returns total_customers + per-property fill metrics.
  // Senior's harvested formula uses email as the canonical identified-profile
  // marker. Fall back to (1 - anonymous_ratio) if email count not exposed.
  const payload = await callMcpToolWithRetry('get_project_overview', { project_id: projectId() });
  const overview = payload.data || payload || {};
  const totalCustomers = overview.total_customers || 0;
  if (totalCustomers === 0) throw new Error('profile_completeness: total_customers is zero');

  const customerProps = overview.customer_properties_overview
    || overview.customer_properties
    || {};
  const emailFill = customerProps.email
    && (customerProps.email.populated_count || customerProps.email.count);
  const identifiedCount = typeof emailFill === 'number'
    ? emailFill
    : Math.round((overview.identified_customers || 0));

  const raw = Math.min(1, identifiedCount / totalCustomers);
  return buildDimension('profile_completeness', raw, 'engagement_mcp');
}

async function callLiveBehavioralSignalRichness() {
  // get_project_overview gives event_types_overview (defined event types) and
  // event counts; we approximate distinct-event-types-per-active-user as
  // event_types_with_users / total event types defined, capped at 1.
  const payload = await callMcpToolWithRetry('get_project_overview', { project_id: projectId() });
  const overview = payload.data || payload || {};
  const events = overview.event_types_overview || {};
  const eventTypes = Object.keys(events);
  if (eventTypes.length === 0) throw new Error('behavioral_signal_richness: no event types defined');

  const TARGET_DISTINCT_TYPES = 10;
  // Active event types = those with non-zero event_count in the last window.
  const activeTypes = eventTypes.filter((k) => {
    const e = events[k] || {};
    return (e.event_count || 0) > 0;
  });

  // Estimate avg distinct event types per active user via active-event-type
  // density vs target. Senior's harvested formula bakes this estimate in.
  const raw = Math.min(1, activeTypes.length / TARGET_DISTINCT_TYPES);
  return buildDimension('behavioral_signal_richness', raw, 'engagement_mcp');
}

function buildDimension(dimensionId, rawValue, dataSource) {
  const normalised_score = Math.min(20, Math.round(rawValue * 20));
  return {
    dimension_id: dimensionId,
    raw_value: rawValue,
    normalised_score,
    status: statusFromScore(normalised_score),
    data_source: dataSource,
    timestamp: new Date().toISOString(),
  };
}

function countConditions(segment) {
  // Engagement segmentations carry either a `definition.filter` tree (typed)
  // or a flat `conditions` array. Count whichever is present, defaulting to 1
  // for segments with any filter at all.
  if (Array.isArray(segment.conditions)) return segment.conditions.length;
  const filter = segment.definition && segment.definition.filter;
  if (filter && Array.isArray(filter.filters)) return filter.filters.length;
  return segment.definition ? 1 : 0;
}

function isExposedToDiscovery(segment) {
  // Engagement segmentations expose a Discovery integration flag as either
  // `discovery_exposed` or a state of "used" in the integration panel.
  if (segment.discovery_exposed === true) return true;
  if (segment.state === 'used') return true;
  if (Array.isArray(segment.integrations)) {
    return segment.integrations.some((i) => /discovery/i.test(i && i.name || ''));
  }
  return false;
}

module.exports = {
  fetchPersonaProfiles,
  fetchSegmentStatus,
  fetchSegmentDefinitionQuality,
  fetchProfileCompleteness,
  fetchBehavioralSignalRichness,
};
