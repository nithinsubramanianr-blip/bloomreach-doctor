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

import type { DiscoveryProduct } from './resultCache';

export interface DiscoverySearchResult {
  query: string;
  total: number;
  products: DiscoveryProduct[];
}

const DEFAULT_TIMEOUT_MS = 2000;

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

function readDiscoveryConfig(): { accountId?: string; domainKey?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const env = import.meta?.env ?? {};
    return {
      accountId: env.VITE_DISCOVERY_ACCOUNT_ID as string | undefined,
      domainKey: env.VITE_DISCOVERY_DOMAIN_KEY as string | undefined,
    };
  } catch {
    return {};
  }
}

// Normalises a raw Discovery search doc (uses BR standard field names pid/title)
// to our internal DiscoveryProduct shape.
function mapDiscoveryDoc(
  doc: Record<string, unknown>,
  persona: Persona,
): DiscoveryProduct {
  return {
    product_id: (doc.pid ?? doc.product_id ?? '') as string,
    name: (doc.title ?? doc.name ?? '') as string,
    description: doc.description as string | undefined,
    price: Number(doc.price ?? 0),
    currency: 'USD',
    category: doc.category as string | undefined,
    price_band: doc.price_band as string | undefined,
    gift_eligible: Boolean(doc.gift_eligible),
    is_new_arrival: Boolean(doc.is_new_arrival),
    is_bestseller: Boolean(doc.is_bestseller),
    image_url: (doc.thumb_image ?? doc.image_url) as string | undefined,
    is_personalised: persona !== 'guest',
  };
}

function bruidToPersona(bruid: string | null): Persona {
  if (!bruid) return 'guest';
  if (bruid.includes('sarah')) return 'sarah';
  if (bruid.includes('alex')) return 'alex';
  return 'guest';
}

// Maps persona → Discovery ref_url segment value.
// Discovery boost rules are configured to fire when ref_url matches these strings:
//   new_prospecting  → boost is_bestseller = true
//   gifting_intent   → boost gift_eligible = true
//   high_value_returning → boost is_new_arrival = true OR price_band = premium
const PERSONA_SEGMENT_MAP: Record<Persona, string> = {
  guest: 'new_prospecting',
  sarah: 'gifting_intent',
  alex: 'high_value_returning',
};

function personaToRefUrl(bruid: string | null): string {
  return PERSONA_SEGMENT_MAP[bruidToPersona(bruid)];
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

/**
 * Calls Discovery search. Throws (or aborts) on timeout / network error.
 * Callers are responsible for catching and falling back to resultCache.
 */
export async function search(
  query: string,
  bruid: string | null,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<DiscoverySearchResult> {
  const dedupKey = `${query}|${bruid ?? ''}`;
  const existing = _inflight.get(dedupKey);
  if (existing) return existing;
  const pending = _searchUncached(query, bruid, signal, timeoutMs)
    .finally(() => { _inflight.delete(dedupKey); });
  _inflight.set(dedupKey, pending);
  return pending;
}

async function _searchUncached(
  query: string,
  bruid: string | null,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<DiscoverySearchResult> {
  const endpoint = readEndpoint();

  if (!endpoint) {
    return searchViaLoomiCatalog(query, bruid, signal);
  }

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
    const segment = personaToRefUrl(bruid); // e.g. "gifting_intent"
    const { accountId, domainKey } = readDiscoveryConfig();

    const reqUrl = new URL(endpoint);
    reqUrl.searchParams.set('q', query);
    reqUrl.searchParams.set('search_type', 'keyword');
    reqUrl.searchParams.set('request_type', 'search');
    reqUrl.searchParams.set('start', '0');
    reqUrl.searchParams.set('rows', '50');
    reqUrl.searchParams.set(
      'fl',
      'pid,title,description,price,category,price_band,gift_eligible,is_new_arrival,is_bestseller,thumb_image,image_url',
    );

    if (accountId) reqUrl.searchParams.set('account_id', accountId);
    if (domainKey) reqUrl.searchParams.set('domain_key', domainKey);

    // BR audience segment signal: embed as query param inside the `url` value.
    // Boost rules are configured to fire when `url` contains e.g. &gifting_intent=true.
    // (Confirmed pattern from BR team — replaces the old ref_url approach.)
    const basePageUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/` : endpoint;
    const audienceUrl = `${basePageUrl}?${segment}=true`;
    reqUrl.searchParams.set('url', audienceUrl);

    if (bruid) {
      const value = bruid.includes('=') ? bruid.split('=').slice(1).join('=') : bruid;
      reqUrl.searchParams.set('_br_uid_2', value);
    }

    // eslint-disable-next-line no-console
    console.group('[ppd:discovery] → REQUEST');
    // eslint-disable-next-line no-console
    console.log('URL:', reqUrl.toString());
    // eslint-disable-next-line no-console
    console.log('Params:', Object.fromEntries(reqUrl.searchParams));
    // eslint-disable-next-line no-console
    console.groupEnd();

    const resp = await fetch(reqUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!resp.ok) throw new Error(`Discovery responded ${resp.status}`);

    const body = await resp.json();

    // eslint-disable-next-line no-console
    console.group('[ppd:discovery] ← RESPONSE');
    // eslint-disable-next-line no-console
    console.log('Status:', resp.status);
    // eslint-disable-next-line no-console
    console.log('numFound:', body?.response?.numFound ?? body?.total);
    // eslint-disable-next-line no-console
    console.log('Raw body:', body);
    // eslint-disable-next-line no-console
    console.groupEnd();

    const rawDocs: Record<string, unknown>[] = Array.isArray(body?.response?.docs)
      ? body.response.docs
      : Array.isArray(body?.products)
        ? body.products
        : [];

    if (rawDocs.length === 0) throw new Error('Discovery returned empty products');

    const products = rawDocs.map((doc) => mapDiscoveryDoc(doc, persona));

    return {
      query,
      total: typeof body?.response?.numFound === 'number'
        ? body.response.numFound
        : typeof body?.total === 'number'
          ? body.total
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
