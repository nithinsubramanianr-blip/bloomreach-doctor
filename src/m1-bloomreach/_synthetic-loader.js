'use strict';

let _runtimeState = null;

function setRuntimeState(state) {
  _runtimeState = (state === 'post_fix' || state === 'pre_fix') ? state : null;
}

/**
 * M1 Bloomreach — Synthetic data loader (internal).
 *
 * Uses static require() calls so Rollup/Vite can inline the JSON at build
 * time for the browser SPA. No path/fs built-ins needed — those were
 * Node-only and incompatible with the Vite browser bundle.
 *
 * State selection:
 *   DEMO_STATE=pre_fix  → prs_pre_fix.json  (default)
 *   DEMO_STATE=post_fix → prs_post_fix.json
 */

const PRS_PRE_FIX        = require('../../data/prs_pre_fix.json');
const PRS_POST_FIX       = require('../../data/prs_post_fix.json');
const PRODUCTS_CATALOGUE = require('../../data/products.json');
const PERSONAS_DATA      = require('../../data/personas.json');
const SEGMENTS_DATA      = require('../../data/segments.json');

const CACHED_RESULTS = {
  'guest-before': require('../../data/cached-results/guest-before.json'),
  'guest-after':  require('../../data/cached-results/guest-after.json'),
  'sarah-before': require('../../data/cached-results/sarah-before.json'),
  'sarah-after':  require('../../data/cached-results/sarah-after.json'),
  'alex-before':  require('../../data/cached-results/alex-before.json'),
  'alex-after':   require('../../data/cached-results/alex-after.json'),
};

function selectedState() {
  if (_runtimeState) return _runtimeState;
  return process.env.DEMO_STATE === 'post_fix' ? 'post_fix' : 'pre_fix';
}

function loadSyntheticDimension(dimensionId) {
  const prs = selectedState() === 'post_fix' ? PRS_POST_FIX : PRS_PRE_FIX;
  const found = (prs.dimensions || []).find((d) => d && d.dimension_id === dimensionId);
  if (!found) {
    throw new Error(
      `[m1-bloomreach] synthetic dimension "${dimensionId}" not found in ${selectedState()} state`,
    );
  }
  return Object.assign({}, found, { is_synthetic: true });
}

function loadProductsCatalogue() { return PRODUCTS_CATALOGUE; }
function loadPersonasFile()      { return PERSONAS_DATA; }
function loadSegmentsFile()      { return SEGMENTS_DATA; }

function loadCachedSearchResult(cacheKey) {
  return CACHED_RESULTS[cacheKey] || null;
}

function isLiveMode() {
  return process.env.DATA_SOURCE === 'live';
}

module.exports = {
  loadSyntheticDimension,
  loadProductsCatalogue,
  loadPersonasFile,
  loadSegmentsFile,
  loadCachedSearchResult,
  isLiveMode,
  selectedState,
  setRuntimeState,
};
