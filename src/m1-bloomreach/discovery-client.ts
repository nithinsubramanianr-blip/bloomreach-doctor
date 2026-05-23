import "server-only";

import type {
  DemoState,
  DimensionObject,
  DiscoverySearchResult,
  PersonaId,
} from "@/lib/contracts";
import { isLive } from "@/lib/env";
import { normaliseDimension } from "./normaliser";
import { loadRawDimension } from "./synthetic-loader";
import { syntheticSearch } from "./synthetic-search";

/**
 * Discovery REST client. The only place that talks to Bloomreach Discovery.
 * Exposes two PRS dimension fetchers (BRUID match rate, rule conflicts) plus
 * the product search used by M5 PLP and M4 Module B.
 *
 * Auth (live mode): BLOOMREACH_DISCOVERY_API_KEY.
 */

/** Returns the BRUID match rate dimension (Discovery API / synthetic). */
export async function fetchBRUIDMatchRate(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (!isLive()) {
    console.log("[m1-bloomreach] discovery-client using synthetic fallback");
    return normaliseDimension(await loadRawDimension(state, "bruid_match_rate"), true);
  }
  try {
    // TODO(live): GET /api/v1/bruid/match-rate
    return normaliseDimension(await loadRawDimension(state, "bruid_match_rate"), true);
  } catch {
    console.log("[m1-bloomreach] discovery-client using synthetic fallback");
    return normaliseDimension(await loadRawDimension(state, "bruid_match_rate"), true);
  }
}

/** Returns the rule conflicts dimension (Discovery API / synthetic). */
export async function fetchRuleConflicts(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (!isLive()) {
    console.log("[m1-bloomreach] discovery-client using synthetic fallback");
    return normaliseDimension(await loadRawDimension(state, "rule_conflicts"), true);
  }
  try {
    // TODO(live): GET /api/v1/rules/conflict-analysis
    return normaliseDimension(await loadRawDimension(state, "rule_conflicts"), true);
  } catch {
    console.log("[m1-bloomreach] discovery-client using synthetic fallback");
    return normaliseDimension(await loadRawDimension(state, "rule_conflicts"), true);
  }
}

/**
 * Executes a Discovery product search with persona/state context.
 *
 * @param query   search term (always "necklace" in the demo)
 * @param persona persona id — selects the boost rule in synthetic mode
 * @param state   before (rules inactive) / after (rules active)
 * @param bruid   _br_uid_2 cookie value (used by the live path only)
 */
export async function searchProducts(
  query: string,
  persona: PersonaId,
  state: DemoState,
  bruid: string | null = null
): Promise<DiscoverySearchResult> {
  if (!isLive()) {
    console.log("[m1-bloomreach] discovery-client using synthetic fallback");
    return syntheticSearch(persona, state);
  }

  try {
    // TODO(live): call Bloomreach Discovery search REST API using `bruid`
    // context and `query`, then normalise to DiscoverySearchResult. Layered in
    // once sandbox credentials arrive.
    void query;
    void bruid;
    return syntheticSearch(persona, state);
  } catch {
    console.log("[m1-bloomreach] discovery-client using synthetic fallback");
    return syntheticSearch(persona, state);
  }
}
