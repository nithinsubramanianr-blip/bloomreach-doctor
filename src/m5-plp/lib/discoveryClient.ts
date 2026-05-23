import type {
  DemoState,
  DiscoverySearchResult,
  PersonaId,
} from "@/lib/contracts";

/**
 * Client-side wrapper around the server Discovery route. Never calls Bloomreach
 * directly — it hits /api/discovery/search, which owns the live/synthetic logic
 * and secrets. Enforces a 2s timeout (design-spec 006): on timeout/error the
 * caller keeps its current results so the grid is never emptied.
 */

const TIMEOUT_MS = 2000;

export async function search(
  query: string,
  persona: PersonaId,
  state: DemoState,
  signal?: AbortSignal
): Promise<DiscoverySearchResult> {
  const params = new URLSearchParams({ persona, state, q: query });
  const res = await fetch(`/api/discovery/search?${params.toString()}`, {
    signal,
  });
  if (!res.ok) {
    throw new Error(`Discovery search failed: ${res.status}`);
  }
  return (await res.json()) as DiscoverySearchResult;
}

/** search() with a hard 2s timeout via AbortController. */
export async function searchWithTimeout(
  persona: PersonaId,
  state: DemoState,
  query = "necklace"
): Promise<DiscoverySearchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await search(query, persona, state, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
