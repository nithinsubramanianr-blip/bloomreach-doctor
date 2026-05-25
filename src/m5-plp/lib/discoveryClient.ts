/**
 * discoveryClient.ts
 *
 * Thin wrapper around the Bloomreach Discovery search API.
 *
 * - Reads `import.meta.env.VITE_DISCOVERY_ENDPOINT`.
 * - 2 second timeout via AbortController — caller falls back to resultCache
 *   file fallback on timeout/error so the grid is never empty.
 * - Hardcoded query "necklace" used by callers; this module is query-agnostic.
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

function readEndpoint(): string | undefined {
  // Vite injects import.meta.env at build time. Guard for non-Vite runtimes
  // (e.g. Jest/jsdom) where import.meta.env may be undefined.
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — import.meta.env shape provided by vite-env.d.ts
    return import.meta?.env?.VITE_DISCOVERY_ENDPOINT;
  } catch {
    return undefined;
  }
}

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
  const endpoint = readEndpoint();
  if (!endpoint) {
    throw new Error(
      'VITE_DISCOVERY_ENDPOINT is not configured — using cache fallback.',
    );
  }

  // Combine caller's signal with our own timeout signal.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(endpoint);
    url.searchParams.set('q', query);
    if (bruid) {
      // bruid here is the cookie's _br_uid_2 value — pass to Discovery.
      const value = bruid.includes('=') ? bruid.split('=').slice(1).join('=') : bruid;
      url.searchParams.set('_br_uid_2', value);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (bruid) {
      headers['X-BR-UID-2'] = bruid;
    }

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
      credentials: 'include',
    });

    if (!resp.ok) {
      throw new Error(`Discovery responded ${resp.status}`);
    }

    const body = await resp.json();
    // Be lenient about response shape — Discovery normalisation happens in M1
    // for the live build. For now, accept { products: [] } or { response: { docs: [] } }.
    const products: DiscoveryProduct[] = Array.isArray(body?.products)
      ? body.products
      : Array.isArray(body?.response?.docs)
        ? body.response.docs
        : [];

    return {
      query,
      total: typeof body?.total === 'number' ? body.total : products.length,
      products,
    };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export default { search };
export { readEndpoint as _readEndpointForTests };
