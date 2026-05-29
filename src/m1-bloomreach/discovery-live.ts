import "server-only";

import type {
  DemoState,
  DiscoveryProduct,
  DiscoverySearchResult,
  PersonaId,
} from "@/lib/contracts";

/**
 * Live Bloomreach Discovery search (dxpapi core). Server-only — this module is
 * imported solely by discovery-client.ts (which is `server-only`), so the API
 * call, account_id and persona BRUIDs never reach the browser. The PLP and
 * Module B hit /api/discovery/search; only the server ever touches this code.
 *
 * Personalisation is driven entirely by the `url` query param exactly as Paul
 * specified: the audience flag (e.g. gifting_intent=true) is appended to the
 * catalog search URL. BEFORE = call WITHOUT the flag (generic ranking); AFTER
 * (Option X active) = call WITH it (segment-boosted ranking).
 *
 * The caller (discovery-client.searchProducts) wraps this in try/catch and
 * falls back to the deterministic synthetic ranking on any error, so a network
 * failure or bad response never empties the grid.
 */

// Public Discovery identifiers (not secrets — they travel in the request URL).
const DEFAULT_DISCOVERY_ENDPOINT = "https://core.dxpapi.com/api/v1/core/";
// Use `||` (not `??`) and trim so a SET-BUT-EMPTY env var also falls through to
// the default. With `??` an empty string would survive and produce a hostless
// fetch URL ("?account_id=..."), crashing Node's URL parser and silently
// dropping us into the synthetic fallback.
const DISCOVERY_ENDPOINT =
  process.env.NEXT_PUBLIC_DISCOVERY_ENDPOINT?.trim() ||
  DEFAULT_DISCOVERY_ENDPOINT;
const ACCOUNT_ID = "7529";
const DOMAIN_KEY = "pacific_apparel";

// Fields requested from Discovery (fl) — exactly as specified.
const FL = [
  "pid",
  "title",
  "brand",
  "price",
  "sale_price",
  "thumb_image",
  "url",
  "price_range",
  "description",
].join(",");

const REQUEST_TIMEOUT_MS = 4000;

/** Base catalog URL the `url` param decorates; the audience flag is appended. */
const CATALOG_SEARCH_URL =
  "https://tools.bloomreach.com/discovery/catalogs/search" +
  `?catalog=${DOMAIN_KEY}&environment=production`;

/**
 * Per-persona Discovery context. `audienceFlag` is the personalisation flag Paul
 * mapped to each segment; it is only applied in the AFTER state. `bruid` is the
 * `_br_uid_2` value (guest has no cookie → null, param omitted).
 */
const PERSONA_DISCOVERY: Record<
  PersonaId,
  { userId: string; bruid: string | null; audienceFlag: string }
> = {
  guest: { userId: "guest", bruid: null, audienceFlag: "new_prospecting" },
  sarah: {
    userId: "sarah",
    bruid: "jakob-gifting-demo-001",
    audienceFlag: "gifting_intent",
  },
  alex: {
    userId: "alex",
    bruid: "marvin-highvalue-demo-002",
    audienceFlag: "high_value_returning",
  },
};

// Emit the "live mode ACTIVE" banner once per process, on the first live call,
// so `npm run dev` shows definitively which mode (and endpoint) is in effect.
let announced = false;
function announceLiveModeOnce(): void {
  if (announced) return;
  announced = true;
  console.log(
    `[m1-bloomreach] live mode ACTIVE → endpoint=${DISCOVERY_ENDPOINT}, account=${ACCOUNT_ID}, domain=${DOMAIN_KEY}`
  );
}

/** A request_id in Bloomreach's `br_<digits>` form. */
function generateRequestId(): string {
  const n = Math.floor(Math.random() * 1e10);
  return `br_${n.toString().padStart(10, "0")}`;
}

/** Strips a leading `_br_uid_2=` if a raw cookie string is passed in. */
function normaliseBruid(value: string): string {
  return value.startsWith("_br_uid_2=")
    ? value.slice("_br_uid_2=".length)
    : value;
}

/** Builds the personalisation `url` param: base catalog URL + (AFTER) flag. */
function buildContextUrl(personaId: PersonaId, state: DemoState): string {
  const { audienceFlag } = PERSONA_DISCOVERY[personaId];
  return state === "after"
    ? `${CATALOG_SEARCH_URL}&${audienceFlag}=true`
    : CATALOG_SEARCH_URL;
}

// ---------------------------------------------------------------------------
// Response mapping
// ---------------------------------------------------------------------------

interface DiscoveryDoc {
  pid?: string;
  title?: string;
  brand?: string;
  price?: number | string;
  sale_price?: number | string;
  thumb_image?: string;
  url?: string;
  price_range?: Array<number | string>;
  description?: string;
}

interface DiscoveryApiResponse {
  response?: {
    numFound?: number;
    start?: number;
    docs?: DiscoveryDoc[];
  };
}

function toNumber(value: number | string | undefined): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Effective display price: sale_price when it is a real discount, else price. */
function effectivePrice(doc: DiscoveryDoc): number {
  const price = toNumber(doc.price);
  const sale = toNumber(doc.sale_price);
  return sale > 0 && sale < price ? sale : price || sale;
}

/**
 * Maps a Discovery doc to the existing DiscoveryProduct shape so the PLP renders
 * unchanged. `category` is the search term (all results match q), `is_personalised`
 * flags the boosted top-of-page items in the AFTER state for the "For you" badge.
 */
function toDiscoveryProduct(
  doc: DiscoveryDoc,
  index: number,
  query: string,
  state: DemoState
): DiscoveryProduct {
  return {
    product_id: doc.pid ?? `live-${index}`,
    name: doc.title ?? "Untitled product",
    price: effectivePrice(doc),
    currency: "USD",
    category: query,
    rank_position: index + 1,
    is_personalised: state === "after" && index < 3,
    image_url: doc.thumb_image,
  };
}

// ---------------------------------------------------------------------------
// Live search
// ---------------------------------------------------------------------------

/**
 * Executes a live Discovery keyword search for a persona + demo state and maps
 * the response to DiscoverySearchResult. Throws on network/HTTP/parse failure or
 * an empty result set so the caller can fall back to the synthetic ranking.
 *
 * @param bruidOverride optional `_br_uid_2` (raw or bare) — defaults to the
 *                      persona's pre-seeded BRUID.
 */
export async function liveSearch(
  query: string,
  personaId: PersonaId,
  state: DemoState,
  bruidOverride: string | null = null
): Promise<DiscoverySearchResult> {
  announceLiveModeOnce();
  const persona = PERSONA_DISCOVERY[personaId];
  const params = new URLSearchParams({
    account_id: ACCOUNT_ID,
    domain_key: DOMAIN_KEY,
    request_type: "search",
    search_type: "keyword",
    rows: "50",
    start: "0",
    request_id: generateRequestId(),
    user_id: persona.userId,
    fl: FL,
    q: query,
    url: buildContextUrl(personaId, state),
  });

  const bruid = bruidOverride
    ? normaliseBruid(bruidOverride)
    : persona.bruid;
  if (bruid) {
    params.set("_br_uid_2", bruid);
  }

  const requestUrl = `${DISCOVERY_ENDPOINT}?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let json: DiscoveryApiResponse;
  try {
    const res = await fetch(requestUrl, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Discovery responded ${res.status}`);
    }
    json = (await res.json()) as DiscoveryApiResponse;
  } catch (error) {
    // A hostless URL (empty endpoint) crashes the URL parser — name the env var
    // so the cause is obvious instead of a bare "Failed to parse URL".
    if (error instanceof TypeError && /parse URL/i.test(error.message)) {
      throw new Error(
        `Discovery endpoint is invalid ("${DISCOVERY_ENDPOINT}") — check NEXT_PUBLIC_DISCOVERY_ENDPOINT is set to a full URL (e.g. ${DEFAULT_DISCOVERY_ENDPOINT})`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const docs = json.response?.docs ?? [];
  if (docs.length === 0) {
    throw new Error("Discovery returned no products");
  }

  const products = docs.map((doc, i) =>
    toDiscoveryProduct(doc, i, query, state)
  );

  return {
    query,
    total: json.response?.numFound ?? products.length,
    products,
    cached: false,
    cache_key: `${personaId}-${state}-live`,
  };
}
