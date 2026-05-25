/**
 * M3 NL Interface — Intent Classifier.
 *
 * Pure, sync regex-based classifier per ADR-004-3 (no LLM call for
 * classification). Pattern set is from design-spec 004
 * § "Intent Classification Rules".
 *
 * Order of evaluation matters: dimension-drill is checked first because
 * dimension keywords (e.g. "BRUID") are specific. Then fix-request,
 * archetype-compare, diagnosis. Default is `diagnosis`.
 *
 * No SDK import. Pure function — safe to unit-test without mocking.
 */

'use strict';

const { DEFAULT_INTENT } = require('./constants');

/**
 * Patterns ordered by specificity (most specific first).
 * Mirrors design-spec but reordered so the dimension-drill catch
 * fires before the broader diagnosis/fix patterns.
 */
const INTENT_PATTERNS = [
  {
    intent: 'dimension-drill',
    patterns: [
      /\bbruid\b/i,
      /\bautosegment\b/i,
      /signal\s+freshness/i,
      /rule\s+conflicts?/i,
      /a\/b\s+test/i,
      /ab\s+test/i,
    ],
  },
  {
    intent: 'fix-request',
    patterns: [
      /what.*fix/i,
      /how.*(improve|fix)/i,
      /what.*do\s+first/i,
      /\brecommend/i,
      /should\s+i\s+fix/i,
      /fix\s+first/i,
    ],
  },
  {
    intent: 'archetype-compare',
    patterns: [
      /customer\s+type/i,
      /\bpersonas?\b/i,
      /\bsegments?\b/i,
      /\bshoppers?\b/i,
      /\barchetypes?\b/i,
      /good\s+personalisation/i,
    ],
  },
  {
    intent: 'diagnosis',
    patterns: [
      /why.*not\s+working/i,
      /what.*wrong/i,
      /personalisation.*broken/i,
      /\bdiagnos/i,
      /not\s+performing/i,
    ],
  },
];

/**
 * Classify a sanitised query string into one of the four intent labels.
 * Default to `diagnosis` if nothing matches (per design-spec).
 *
 * @param {string} queryText - sanitised user input
 * @returns {'diagnosis'|'fix-request'|'dimension-drill'|'archetype-compare'}
 */
function classifyIntent(queryText) {
  if (typeof queryText !== 'string' || queryText.trim() === '') {
    return DEFAULT_INTENT;
  }
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((rx) => rx.test(queryText))) {
      return intent;
    }
  }
  return DEFAULT_INTENT;
}

module.exports = {
  classifyIntent,
  INTENT_PATTERNS,
};
