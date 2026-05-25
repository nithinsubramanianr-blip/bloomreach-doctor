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
  isLiveMode,
} = require('./_synthetic-loader');

const CLIENT_NAME = 'engagement-client';

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
  throw new Error('live Engagement not configured — sandbox credentials unavailable');
}

async function callLiveSegmentStatus() {
  throw new Error('live Engagement not configured — sandbox credentials unavailable');
}

module.exports = {
  fetchPersonaProfiles,
  fetchSegmentStatus,
};
