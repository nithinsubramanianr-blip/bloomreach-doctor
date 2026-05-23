import "server-only";

import type {
  DemoState,
  DiscoveryProduct,
  DiscoverySearchResult,
  PersonaId,
  Product,
} from "@/lib/contracts";
import { loadCachedResult, loadProducts } from "./synthetic-loader";

/**
 * Deterministic synthetic Discovery search.
 *
 * Produces the Before/After rankings the demo depends on, with zero Bloomreach
 * dependency. "Before" is generic ranking (bestsellers surface naturally, no
 * personalisation). "After" applies each persona's boost rule (Option X), which
 * lifts the targeted product set to the top. Same input -> same output.
 *
 * Boost rules (CLAUDE.md "Three Boost Rules"):
 *   guest (Rule 3 / New Prospecting):    is_bestseller
 *   sarah (Rule 1 / Gifting Intent):     gift_eligible
 *   alex  (Rule 2 / High Value Returning): is_new_arrival OR price_band === 'premium'
 */

const DEMO_QUERY = "necklace";

function boostPredicate(personaId: PersonaId): (p: Product) => boolean {
  switch (personaId) {
    case "sarah":
      return (p) => p.gift_eligible;
    case "alex":
      return (p) => p.is_new_arrival || p.price_band === "premium";
    case "guest":
    default:
      return (p) => p.is_bestseller;
  }
}

/** Generic relevance ranking shared by all personas in the "before" state. */
function genericComparator(a: Product, b: Product): number {
  // Bestsellers first, then by review_count desc, then stable by product_id.
  if (a.is_bestseller !== b.is_bestseller) return a.is_bestseller ? -1 : 1;
  if (a.review_count !== b.review_count) return b.review_count - a.review_count;
  return a.product_id.localeCompare(b.product_id);
}

function toDiscoveryProduct(
  p: Product,
  rank: number,
  personalised: boolean
): DiscoveryProduct {
  return {
    product_id: p.product_id,
    name: p.name,
    price: p.price,
    currency: "GBP",
    category: p.category,
    rank_position: rank,
    is_personalised: personalised,
  };
}

/**
 * Runs the synthetic search for a persona + state and returns a ranked result.
 * Results are scoped to necklace-category products (the hardcoded demo query).
 */
export async function syntheticSearch(
  personaId: PersonaId,
  state: DemoState
): Promise<DiscoverySearchResult> {
  const cacheKey = `${personaId}-${state}`;

  // If a real cached file has been populated (post-sandbox), prefer it.
  const populated = await loadCachedResult(personaId, state);
  if (populated) {
    return { ...populated, cached: true, cache_key: cacheKey };
  }

  const all = await loadProducts();
  const necklaces = all.filter((p) => p.category === "necklace");

  // Base generic ranking — identical for every persona ("before").
  const ranked = [...necklaces].sort(genericComparator);

  if (state === "after") {
    // Apply the persona's boost rule: boosted products rise to the top,
    // preserving generic order within each group (stable sort).
    const isBoosted = boostPredicate(personaId);
    ranked.sort((a, b) => {
      const ba = isBoosted(a) ? 0 : 1;
      const bb = isBoosted(b) ? 0 : 1;
      if (ba !== bb) return ba - bb;
      return genericComparator(a, b);
    });
  }

  const products = ranked.map((p, i) =>
    toDiscoveryProduct(p, i + 1, state === "after" && i < 3)
  );

  return {
    query: DEMO_QUERY,
    total: products.length,
    products,
    cached: false,
    cache_key: cacheKey,
  };
}
