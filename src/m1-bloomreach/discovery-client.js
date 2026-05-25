/**
 * M1 Bloomreach — Discovery client.
 *
 * Talks to the Bloomreach Discovery REST API for:
 *   - BRUID Match Rate dimension
 *   - Rule Conflicts dimension
 *   - Product search (used by Module B and M5 PLP)
 *
 * Synthetic fallback active when DATA_SOURCE !== 'live' OR live call fails.
 * Auth: BLOOMREACH_DISCOVERY_API_KEY
 *
 * IMPORTANT: This file does NOT write to Discovery. Rule activation is a
 * manual TA1 action in the merchandising UI (Option X demo mechanic).
 */

'use strict';

const {
  loadSyntheticDimension,
  loadProductsCatalogue,
  loadCachedSearchResult,
  isLiveMode,
} = require('./_synthetic-loader');
const { normaliseDimension } = require('./normaliser');

const CLIENT_NAME = 'discovery-client';
const LIVE_TIMEOUT_MS = 2000;

function logFallback(reason) {
  const suffix = reason ? ` (${reason})` : '';
  // eslint-disable-next-line no-console
  console.log(`[m1-bloomreach] ${CLIENT_NAME} using synthetic fallback${suffix}`);
}

/**
 * GET /api/v1/bruid/match-rate — returns BRUID match rate dimension object.
 */
async function fetchBRUIDMatchRate() {
  if (!isLiveMode()) {
    logFallback();
    return normaliseDimension(loadSyntheticDimension('bruid_match_rate'), true);
  }
  try {
    const raw = await callLiveBRUID();
    return normaliseDimension(raw, false);
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return normaliseDimension(loadSyntheticDimension('bruid_match_rate'), true);
  }
}

/**
 * GET /api/v1/rules/conflict-analysis — returns rule conflicts dimension object.
 */
async function fetchRuleConflicts() {
  if (!isLiveMode()) {
    logFallback();
    return normaliseDimension(loadSyntheticDimension('rule_conflicts'), true);
  }
  try {
    const raw = await callLiveRuleConflicts();
    return normaliseDimension(raw, false);
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return normaliseDimension(loadSyntheticDimension('rule_conflicts'), true);
  }
}

/**
 * Executes a Discovery product search with BRUID context.
 * @param {string} query - search term (always "necklace" in demo)
 * @param {string|null} bruid - _br_uid_2 cookie value, or null for guest
 * @returns {Promise<DiscoverySearchResult>}
 */
async function searchProducts(query, bruid) {
  if (typeof query !== 'string' || query.length === 0) {
    throw new Error('[m1-bloomreach] searchProducts: query must be a non-empty string');
  }
  if (bruid !== null && typeof bruid !== 'string') {
    throw new Error('[m1-bloomreach] searchProducts: bruid must be a string or null');
  }

  if (!isLiveMode()) {
    logFallback();
    return buildSyntheticSearchResult(query, bruid);
  }
  try {
    const raw = await callLiveSearch(query, bruid);
    if (!raw || !Array.isArray(raw.products) || raw.products.length === 0) {
      throw new Error('empty live search response');
    }
    return raw;
  } catch (err) {
    logFallback(err && err.message ? err.message : 'live call failed');
    return buildSyntheticSearchResult(query, bruid);
  }
}

// ---------------------------------------------------------------------------
// Live API helpers (stubbed — synthetic fallback is the only tested path in
// this build because sandbox credentials are not available).
// ---------------------------------------------------------------------------

async function callLiveBRUID() {
  throw new Error('live Discovery not configured — sandbox credentials unavailable');
}

async function callLiveRuleConflicts() {
  throw new Error('live Discovery not configured — sandbox credentials unavailable');
}

async function callLiveSearch(/* query, bruid */) {
  throw new Error('live Discovery not configured — sandbox credentials unavailable');
}

// ---------------------------------------------------------------------------
// Synthetic search result assembly.
// ---------------------------------------------------------------------------

function personaSlugFromBruid(bruid) {
  if (!bruid) return 'guest';
  if (bruid.includes('sarah')) return 'sarah';
  if (bruid.includes('alex')) return 'alex';
  return 'guest';
}

function demoState() {
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  return env.DEMO_STATE === 'post_fix' ? 'after' : 'before';
}

function buildSyntheticSearchResult(query, bruid) {
  const persona = personaSlugFromBruid(bruid);
  const state = demoState();
  const cacheKey = `${persona}-${state}`;

  // Prefer the persona-specific cached result if it carries product data.
  const cached = loadCachedSearchResult(cacheKey);
  if (cached && Array.isArray(cached.products) && cached.products.length > 0) {
    return {
      query: cached.query || query,
      total: cached.total || cached.products.length,
      products: cached.products,
      cached: true,
      cache_key: cacheKey,
    };
  }

  // Otherwise synthesise from the 50-product catalogue, applying the demo
  // boost rules per persona+state.
  const catalogue = loadProductsCatalogue();
  const queryLower = query.toLowerCase();
  const matching = (catalogue.products || []).filter(
    (p) => p && (p.category || '').toLowerCase().includes(queryLower)
      || (p.name || '').toLowerCase().includes(queryLower),
  );

  const ranked = applyDemoBoost(matching, persona, state);
  const products = ranked.map((p, idx) => ({
    product_id: p.product_id,
    name: p.name,
    price: p.price,
    currency: p.currency || 'GBP',
    category: p.category,
    rank_position: idx + 1,
    is_personalised: state === 'after' && persona !== 'guest',
  }));

  return {
    query,
    total: products.length,
    products,
    cached: true,
    cache_key: cacheKey,
  };
}

function applyDemoBoost(products, persona, state) {
  // Before state — generic ranking (review_count desc, stable).
  if (state !== 'after') {
    return [...products].sort(
      (a, b) => (b.review_count || 0) - (a.review_count || 0),
    );
  }

  // After state — boost rules active per persona.
  return [...products].sort((a, b) => boostScore(b, persona) - boostScore(a, persona));
}

function boostScore(product, persona) {
  // Higher score = ranks higher.
  let score = (product.review_count || 0) / 10000; // baseline tiebreaker
  if (persona === 'sarah' && product.gift_eligible) score += 100;
  if (persona === 'alex' && (product.is_new_arrival || product.price_band === 'premium')) score += 100;
  if (persona === 'guest' && product.is_bestseller) score += 100;
  return score;
}

module.exports = {
  fetchBRUIDMatchRate,
  fetchRuleConflicts,
  searchProducts,
};
