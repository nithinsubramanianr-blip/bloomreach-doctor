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
// Live API helpers
// ---------------------------------------------------------------------------

async function callLiveBRUID() {
  // Discovery REST API for BRUID match rate — credentials not yet configured.
  throw new Error('live Discovery not configured — sandbox credentials unavailable');
}

async function callLiveRuleConflicts() {
  // Discovery REST API for rule conflict analysis — credentials not yet configured.
  throw new Error('live Discovery not configured — sandbox credentials unavailable');
}

async function callLiveSearch(query, bruid) {
  const base = process.env.BLOOMREACH_ENGAGEMENT_BASE_URL;
  const projectId = process.env.BLOOMREACH_PROJECT_ID;
  const catalogId = process.env.BLOOMREACH_CATALOG_ID;
  const apiKey = process.env.BLOOMREACH_ENGAGEMENT_API_KEY;

  if (!base || !projectId || !catalogId || !apiKey) {
    throw new Error(
      'live search: BLOOMREACH_ENGAGEMENT_BASE_URL, BLOOMREACH_PROJECT_ID, '
      + 'BLOOMREACH_CATALOG_ID, BLOOMREACH_ENGAGEMENT_API_KEY required',
    );
  }

  const persona = personaSlugFromBruid(bruid);
  // eslint-disable-next-line no-console
  console.log(`[ppd:discovery-client] → callLiveSearch q="${query}" persona="${persona}" bruid="${bruid ?? 'none'}"`);

  const url = `${base}/api/v2/catalogs/${encodeURIComponent(catalogId)}/items`
    + `?company_id=${encodeURIComponent(projectId)}`
    + `&query=${encodeURIComponent(query)}`
    + '&count=50';

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);

  let data;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`catalog API ${res.status}`);
    data = await res.json();
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }

  const items = data.data || [];
  if (items.length === 0) throw new Error('empty catalog response');

  const products = items.map((item) => ({
    product_id: item._id,
    name: item.properties.name,
    price: item.properties.price,
    currency: item.properties.currency,
    category: item.properties.category,
    description: item.properties.description || '',
    gift_eligible: !!item.properties.gift_eligible,
    is_bestseller: !!item.properties.is_bestseller,
    is_new_arrival: !!item.properties.is_new_arrival,
    price_band: item.properties.price_band,
    review_count: item.properties.review_count || 0,
    image_url: item.properties.image_url || '',
  }));

  const state = demoState();
  const ranked = applyDemoBoost(products, persona, state);

  const result = {
    query,
    total: ranked.length,
    products: ranked.map((p, idx) => ({
      ...p,
      rank_position: idx + 1,
      is_personalised: state === 'after' && persona !== 'guest',
    })),
    cached: false,
    cache_key: `${persona}-${state}`,
  };
  // eslint-disable-next-line no-console
  console.log(`[ppd:discovery-client] ← callLiveSearch ${result.total} products persona="${persona}" state="${state}"`);
  return result;
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
  return process.env.DEMO_STATE === 'post_fix' ? 'after' : 'before';
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

  const result = {
    query,
    total: products.length,
    products,
    cached: true,
    cache_key: cacheKey,
  };
  // eslint-disable-next-line no-console
  console.log(`[ppd:discovery-client] ← synthetic ${result.total} products cache_key="${cacheKey}"`);
  return result;
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
