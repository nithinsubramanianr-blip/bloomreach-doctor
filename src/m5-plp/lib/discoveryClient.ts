/**
 * discoveryClient.ts
 *
 * Thin wrapper around the Bloomreach Discovery search API with a Loomi catalog
 * fallback for sandboxes where VITE_DISCOVERY_ENDPOINT is not configured.
 *
 * Search priority:
 *   1) Bloomreach Discovery REST API — when VITE_DISCOVERY_ENDPOINT is set.
 *   2) Loomi Engagement catalog API  — when Discovery is absent; uses the
 *      /exponea-api Vite proxy so CORS is handled in dev.
 *
 * Spec: 006-react-plp / FR-006-23..25, design-spec lib/discoveryClient.ts
 */

import type { DiscoveryProduct, DisplayState } from './resultCache';

export interface DiscoverySearchResult {
  query: string;
  total: number;
  products: DiscoveryProduct[];
}

const DEFAULT_TIMEOUT_MS = 4000;

type Persona = 'guest' | 'sarah' | 'alex';

function readEndpoint(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — import.meta.env shape provided by vite-env.d.ts
    return import.meta?.env?.VITE_DISCOVERY_ENDPOINT;
  } catch {
    return undefined;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Pacific Apparel sample catalog — senior's feature/nextjs-app recipe.
// account_id + domain_key are NOT secrets; they travel in the request URL.
// Override via VITE_DISCOVERY_ACCOUNT_ID / VITE_DISCOVERY_DOMAIN_KEY if a
// different catalog is wired in.
// ──────────────────────────────────────────────────────────────────────────
const PACIFIC_APPAREL_ACCOUNT_ID = '7529';
const PACIFIC_APPAREL_DOMAIN_KEY = 'pacific_apparel';

const CATALOG_SEARCH_PAGE = 'https://tools.bloomreach.com/discovery/catalogs/search';

// Fields requested (`fl`) — must match senior's exactly so doc mapping works.
const DISCOVERY_FL = [
  'pid',
  'title',
  'brand',
  'price',
  'sale_price',
  'thumb_image',
  'url',
  'price_range',
  'description',
].join(',');

function readDiscoveryConfig(): { accountId: string; domainKey: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const env = import.meta?.env ?? {};
    const accountId = (env.VITE_DISCOVERY_ACCOUNT_ID as string | undefined)?.trim();
    const domainKey = (env.VITE_DISCOVERY_DOMAIN_KEY as string | undefined)?.trim();
    return {
      accountId: accountId && accountId.length > 0 ? accountId : PACIFIC_APPAREL_ACCOUNT_ID,
      domainKey: domainKey && domainKey.length > 0 ? domainKey : PACIFIC_APPAREL_DOMAIN_KEY,
    };
  } catch {
    return {
      accountId: PACIFIC_APPAREL_ACCOUNT_ID,
      domainKey: PACIFIC_APPAREL_DOMAIN_KEY,
    };
  }
}

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

function toNumber(value: number | string | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/** Effective display price: sale_price when it is a real discount, else price. */
function effectivePrice(doc: DiscoveryDoc): number {
  const price = toNumber(doc.price);
  const sale = toNumber(doc.sale_price);
  return sale > 0 && sale < price ? sale : price || sale;
}

/**
 * Maps a Discovery doc to our DiscoveryProduct shape. The senior's recipe:
 * top-3 rows in the AFTER state are badged `is_personalised` so the
 * "personalised" pill on the card lights up only for boosted items.
 *
 * Fields surfaced from the live doc: pid, title, brand, price, sale_price,
 * thumb_image, url, description. Anything else stays undefined (the card
 * skips fields gracefully). `category` deliberately remains undefined so the
 * UI doesn't show the search term as a fake category badge.
 */
function mapDiscoveryDoc(
  doc: DiscoveryDoc,
  index: number,
  _query: string,
  state: DisplayState,
): DiscoveryProduct {
  const listPrice = toNumber(doc.price);
  const salePrice = toNumber(doc.sale_price);
  const onSale = salePrice > 0 && salePrice < listPrice;

  return {
    product_id: doc.pid ?? `live-${index}`,
    name: doc.title ?? '',
    description: doc.description,
    price: effectivePrice(doc),
    list_price: listPrice > 0 ? listPrice : undefined,
    sale_price: onSale ? salePrice : undefined,
    currency: 'USD',
    brand: doc.brand,
    image_url: doc.thumb_image,
    product_url: doc.url,
    rank_position: index + 1,
    is_personalised: state === 'after' && index < 3,
  };
}

function bruidToPersona(bruid: string | null): Persona {
  if (!bruid) return 'guest';
  // Senior's BRUIDs map to actual customers in the Pacific Apparel demo data.
  if (bruid.includes('jakob') || bruid.includes('sarah')) return 'sarah';
  if (bruid.includes('marvin') || bruid.includes('alex')) return 'alex';
  return 'guest';
}

// Maps persona → Discovery audience flag.
// Discovery boost rules fire when `url` contains the flag query parameter:
//   new_prospecting       → boost is_bestseller = true
//   gifting_intent        → boost gift_eligible = true
//   high_value_returning  → boost is_new_arrival = true OR price_band = premium
const PERSONA_AUDIENCE_FLAG: Record<Persona, string> = {
  guest: 'new_prospecting',
  sarah: 'gifting_intent',
  alex: 'high_value_returning',
};

// Senior's pre-seeded BRUIDs (Pacific Apparel demo customers).
// Used when no _br_uid_2 cookie is set on the calling page.
const PERSONA_FALLBACK_BRUID: Record<Persona, string | null> = {
  guest: null,
  sarah: 'jakob-gifting-demo-001',
  alex: 'marvin-highvalue-demo-002',
};

/** Builds the personalisation `url` param value (senior's recipe). */
function buildContextUrl(persona: Persona, state: DisplayState, domainKey: string): string {
  const base = `${CATALOG_SEARCH_PAGE}?catalog=${encodeURIComponent(domainKey)}&environment=production`;
  if (state !== 'after') return base;
  const flag = PERSONA_AUDIENCE_FLAG[persona];
  return `${base}&${flag}=true`;
}

/** A request_id in Bloomreach's `br_<digits>` form. */
function generateRequestId(): string {
  const n = Math.floor(Math.random() * 1e10);
  return `br_${n.toString().padStart(10, '0')}`;
}

/** Strips a leading `_br_uid_2=` if a raw cookie string is passed in. */
function normaliseBruid(value: string): string {
  return value.startsWith('_br_uid_2=') ? value.slice('_br_uid_2='.length) : value;
}

function boostScore(props: Record<string, unknown>, persona: Persona): number {
  let score = ((props.review_count as number) ?? 0) / 10000;
  if (persona === 'sarah' && props.gift_eligible) score += 100;
  if (persona === 'alex' && (props.is_new_arrival || props.price_band === 'premium')) score += 100;
  if (persona === 'guest' && props.is_bestseller) score += 100;
  return score;
}

/**
 * Loomi MCP path — used when VITE_DISCOVERY_ENDPOINT is absent or fails.
 *
 * Calls the Loomi MCP server's `list_catalog_items` tool via JSON-RPC over
 * HTTP. The Vite proxy at /loomi-mcp injects the OAuth bearer token (from
 * whoami.access_token) server-side, so the credential never reaches the
 * browser bundle.
 *
 * MCP streamable HTTP requires `Accept: application/json, text/event-stream`.
 * Some MCP servers reply with an SSE stream rather than a single JSON object,
 * so the parser handles both shapes.
 */
async function searchViaLoomiCatalog(
  query: string,
  bruid: string | null,
  signal?: AbortSignal,
): Promise<DiscoverySearchResult> {
  const catalogId = process.env.BLOOMREACH_CATALOG_ID as string;
  const projectId = process.env.BLOOMREACH_PROJECT_ID as string;

  if (!catalogId || !projectId) {
    throw new Error(
      'Loomi catalog not configured — BLOOMREACH_CATALOG_ID and BLOOMREACH_PROJECT_ID required',
    );
  }

  // eslint-disable-next-line no-console
  console.log(`[ppd:loomi-catalog] → list_catalog_items q="${query}" catalog="${catalogId}"`);

  const rpcBody = {
    jsonrpc: '2.0',
    id: `plp-${Date.now()}`,
    method: 'tools/call',
    params: {
      name: 'list_catalog_items',
      arguments: {
        project_id: projectId,
        catalog_id: catalogId,
        query,
        count: 50,
      },
    },
  };

  const resp = await fetch('/loomi-mcp', {
    method: 'POST',
    headers: {
      // SSE accept is required by streamable HTTP MCP transports.
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rpcBody),
    signal,
  });

  // 401 from the dev plugin means "user has not signed in yet" — kick off
  // the OAuth bounce. Once signed in the callback redirects right back here.
  if (resp.status === 401) {
    const loginHint = resp.headers.get('X-Loomi-Auth-Required');
    if (loginHint && typeof window !== 'undefined') {
      const returnTo = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.href = `${loginHint}?return_to=${returnTo}`;
      // Resolve with a never-settling promise so the UI shows a loading state
      // until the redirect happens (instead of flashing the error state).
      return new Promise<DiscoverySearchResult>(() => {});
    }
    throw new Error('Loomi MCP 401 — sign in required');
  }

  if (!resp.ok) throw new Error(`Loomi MCP ${resp.status}`);

  // The response may be either a JSON object or an SSE stream containing one.
  const raw = await resp.text();
  const rpc = parseMcpResponse(raw);

  if (rpc.error) {
    throw new Error(`Loomi MCP error: ${rpc.error.message || JSON.stringify(rpc.error)}`);
  }

  // MCP tool results arrive as `{ content: [{ type: 'text', text: '<json>' }] }`.
  const textBlock = rpc.result?.content?.find((c: any) => c.type === 'text');
  if (!textBlock) throw new Error('Loomi MCP: no text content in result');

  const payload = JSON.parse(textBlock.text);
  const items: Record<string, any>[] = payload.data || [];
  if (items.length === 0) throw new Error('Empty Loomi catalog response');

  const persona = bruidToPersona(bruid);

  const withScore = items
    // The query searches all fields, so filter to actual necklace category.
    .filter((item) => {
      const cat = (item.properties?.category as string | undefined)?.toLowerCase() ?? '';
      return cat.includes(query.toLowerCase());
    })
    .map((item) => ({
      product: {
        product_id: item._id as string,
        name: item.properties.name as string,
        description: item.properties.description as string | undefined,
        price: item.properties.price as number,
        currency: item.properties.currency as string,
        category: item.properties.category as string | undefined,
        price_band: item.properties.price_band as string | undefined,
        gift_eligible: Boolean(item.properties.gift_eligible),
        is_new_arrival: Boolean(item.properties.is_new_arrival),
        is_bestseller: Boolean(item.properties.is_bestseller),
        image_url: item.properties.image_url as string | undefined,
        is_personalised: persona !== 'guest',
      } satisfies DiscoveryProduct,
      score: boostScore(item.properties as Record<string, unknown>, persona),
    }));

  const products = withScore
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product);

  // eslint-disable-next-line no-console
  console.log(`[ppd:loomi-catalog] ← ${products.length} products (source: loomi-catalog)`);

  return { query, total: products.length, products };
}

/**
 * Parses an MCP streamable-HTTP response. The body is either a JSON-RPC
 * object directly, or an SSE stream with `data: { ... }` frames.
 */
function parseMcpResponse(raw: string): any {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);

  // SSE — find the last `data: ...` line that parses as JSON.
  const lines = trimmed.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('data:')) {
      const json = line.slice(5).trim();
      if (json && json !== '[DONE]') {
        try { return JSON.parse(json); } catch { /* keep scanning */ }
      }
    }
  }
  throw new Error('Loomi MCP: unparseable response');
}

// In-flight dedup keyed by `${query}|${bruid}`. React 18 StrictMode invokes
// effects twice in dev, and PLPPage's mount + persona-change effects can race
// on the same persona. We share the inflight promise so concurrent callers
// hit one network round-trip instead of two.
const _inflight: Map<string, Promise<DiscoverySearchResult>> = new Map();

// Endpoint used when no VITE_DISCOVERY_ENDPOINT is set. Public endpoint —
// senior's feature/nextjs-app uses the same value.
const DEFAULT_DISCOVERY_ENDPOINT = 'https://core.dxpapi.com/api/v1/core/';

/**
 * Calls Discovery search. Throws (or aborts) on timeout / network error.
 * Callers are responsible for catching and falling back to resultCache.
 *
 * `state` drives the personalisation flag — 'after' appends the audience
 * flag to the `url` param so Discovery boost rules fire. 'before' calls
 * the same endpoint without the flag → generic ranking.
 */
export async function search(
  query: string,
  bruid: string | null,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  state: DisplayState = 'after',
): Promise<DiscoverySearchResult> {
  const dedupKey = `${query}|${bruid ?? ''}|${state}`;
  const existing = _inflight.get(dedupKey);
  if (existing) return existing;
  const pending = _searchUncached(query, bruid, state, signal, timeoutMs)
    .finally(() => { _inflight.delete(dedupKey); });
  _inflight.set(dedupKey, pending);
  return pending;
}

async function _searchUncached(
  query: string,
  bruid: string | null,
  state: DisplayState,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<DiscoverySearchResult> {
  // Endpoint defaults to dxpapi core when not overridden — senior's recipe.
  const endpoint = (readEndpoint() || '').trim() || DEFAULT_DISCOVERY_ENDPOINT;

  // ── Bloomreach Discovery REST path ──────────────────────────────────────
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const persona = bruidToPersona(bruid);
    const { accountId, domainKey } = readDiscoveryConfig();

    const reqUrl = new URL(endpoint);
    reqUrl.searchParams.set('account_id', accountId);
    reqUrl.searchParams.set('domain_key', domainKey);
    reqUrl.searchParams.set('request_type', 'search');
    reqUrl.searchParams.set('search_type', 'keyword');
    reqUrl.searchParams.set('rows', '50');
    reqUrl.searchParams.set('start', '0');
    reqUrl.searchParams.set('request_id', generateRequestId());
    reqUrl.searchParams.set('user_id', persona);
    reqUrl.searchParams.set('fl', DISCOVERY_FL);
    reqUrl.searchParams.set('q', query);

    // Personalisation lives in the `url` param: BR catalog search URL plus
    // the audience flag (`gifting_intent=true` etc.) only in AFTER state.
    reqUrl.searchParams.set('url', buildContextUrl(persona, state, domainKey));

    // _br_uid_2 — use the explicit cookie value if the caller provided one,
    // otherwise fall back to the senior's pre-seeded BRUID for the persona.
    const effectiveBruid = bruid
      ? normaliseBruid(bruid)
      : PERSONA_FALLBACK_BRUID[persona];
    if (effectiveBruid) {
      reqUrl.searchParams.set('_br_uid_2', effectiveBruid);
    }

    // eslint-disable-next-line no-console
    console.log(
      `[ppd:discovery] → q="${query}" persona="${persona}" state="${state}" bruid="${effectiveBruid ?? 'none'}"`,
    );

    const resp = await fetch(reqUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!resp.ok) throw new Error(`Discovery responded ${resp.status}`);

    const body = await resp.json();
    const rawDocs: DiscoveryDoc[] = Array.isArray(body?.response?.docs)
      ? body.response.docs
      : Array.isArray(body?.products)
        ? body.products
        : [];

    if (rawDocs.length === 0) throw new Error('Discovery returned empty products');

    const products = rawDocs.map((doc, idx) => mapDiscoveryDoc(doc, idx, query, state));

    // eslint-disable-next-line no-console
    console.log(`[ppd:discovery] ← ${products.length} products (state=${state})`);

    return {
      query,
      total: typeof body?.response?.numFound === 'number'
        ? body.response.numFound
        : products.length,
      products,
    };
  } catch (_discoveryErr) {
    // eslint-disable-next-line no-console
    console.warn(`[ppd:discovery] discovery-api failed, falling back to loomi-catalog`, _discoveryErr);
    // Discovery unavailable or misconfigured — fall through to Loomi catalog.
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  return searchViaLoomiCatalog(query, bruid, signal);
}

export default { search };
export { readEndpoint as _readEndpointForTests };
