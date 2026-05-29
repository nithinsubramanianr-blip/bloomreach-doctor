/**
 * M1 Bloomreach — Normaliser
 *
 * Pure (sync) functions. Validates raw client output against the M1→M2 contract.
 * Throws NormaliserError on schema violations; never silences.
 *
 * Spec: specs/002-bloomreach-integration/design-spec.md
 * Contract: CLAUDE.md → "M1 → M2: Normalised Dimension Array"
 */

'use strict';

const VALID_STATUSES = ['critical', 'warning', 'healthy'];
const VALID_DATA_SOURCES = [
  'discovery_api',
  'engagement_api',
  'engagement_mcp',
  'marketing_mcp',
  'analytics_mcp',
];

/**
 * Typed error thrown by normaliseDimension when validation fails.
 * Carries the offending field name, expected type, and actual received value.
 */
class NormaliserError extends Error {
  constructor(field, expected, received) {
    const message = `NormaliserError: field "${field}" expected ${expected}, received ${
      received === undefined ? 'undefined' : JSON.stringify(received)
    }`;
    super(message);
    this.name = 'NormaliserError';
    this.field = field;
    this.expected = expected;
    this.received = received;
  }
}

function isString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value) {
  return Number.isInteger(value);
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * Validates raw client output and emits a DimensionObject per the M1→M2 contract:
 *   { dimension_id, raw_value (0–1 float), normalised_score (0–20 int),
 *     status (critical|warning|healthy), data_source, timestamp (ISO8601),
 *     is_synthetic (boolean) }
 *
 * The synthetic JSON files already contain pre-computed locked values. Pass
 * them through verbatim — do NOT recompute scores.
 *
 * @param {unknown} raw - object from a client (live or synthetic)
 * @param {boolean} isSynthetic - true when sourced from the C5 fallback
 * @returns {object} DimensionObject
 * @throws {NormaliserError} on any schema violation
 */
function normaliseDimension(raw, isSynthetic) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new NormaliserError('raw', 'object', raw);
  }
  if (!isBoolean(isSynthetic)) {
    throw new NormaliserError('isSynthetic', 'boolean', isSynthetic);
  }

  if (!isString(raw.dimension_id)) {
    throw new NormaliserError('dimension_id', 'non-empty string', raw.dimension_id);
  }
  if (!isFiniteNumber(raw.raw_value) || raw.raw_value < 0 || raw.raw_value > 1) {
    throw new NormaliserError('raw_value', 'float between 0 and 1', raw.raw_value);
  }
  if (!isInteger(raw.normalised_score) || raw.normalised_score < 0 || raw.normalised_score > 20) {
    throw new NormaliserError('normalised_score', 'integer between 0 and 20', raw.normalised_score);
  }
  if (!isString(raw.status) || !VALID_STATUSES.includes(raw.status)) {
    throw new NormaliserError('status', `one of ${VALID_STATUSES.join('|')}`, raw.status);
  }
  if (!isString(raw.data_source) || !VALID_DATA_SOURCES.includes(raw.data_source)) {
    throw new NormaliserError(
      'data_source',
      `one of ${VALID_DATA_SOURCES.join('|')}`,
      raw.data_source,
    );
  }
  if (!isString(raw.timestamp)) {
    throw new NormaliserError('timestamp', 'ISO8601 string', raw.timestamp);
  }

  return {
    dimension_id: raw.dimension_id,
    raw_value: raw.raw_value,
    normalised_score: raw.normalised_score,
    status: raw.status,
    data_source: raw.data_source,
    timestamp: raw.timestamp,
    is_synthetic: isSynthetic,
  };
}

module.exports = {
  normaliseDimension,
  NormaliserError,
};
