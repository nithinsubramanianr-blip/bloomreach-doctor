import type { DemoState, DiscoverySearchResult } from "@/lib/contracts";

/**
 * In-memory result cache shared by M5 PLP and M4 Module B (ADR-006-1).
 *
 * Key: `${personaId}-${state}`. TTL: 300s. This is the client-side dedupe layer
 * that prevents duplicate Discovery fetches for the same persona+state.
 *
 * NOTE: the "file fallback" from design-spec 006 lives server-side in the
 * Discovery route handler (the synthetic search always returns a populated
 * ranking), per the project rule that all Discovery/file work stays on the
 * server. So this cache is purely in-memory and never touches the filesystem.
 */

const TTL_MS = 300_000; // 300 seconds

interface CacheEntry {
  result: DiscoverySearchResult;
  storedAt: number;
}

class ResultCache {
  private store = new Map<string, CacheEntry>();

  private keyFor(personaId: string, state: DemoState): string {
    return `${personaId}-${state}`;
  }

  get(personaId: string, state: DemoState): DiscoverySearchResult | null {
    const entry = this.store.get(this.keyFor(personaId, state));
    if (!entry) return null;
    if (Date.now() - entry.storedAt > TTL_MS) return null;
    return entry.result;
  }

  set(personaId: string, state: DemoState, result: DiscoverySearchResult): void {
    this.store.set(this.keyFor(personaId, state), {
      result,
      storedAt: Date.now(),
    });
  }

  isStale(personaId: string, state: DemoState): boolean {
    const entry = this.store.get(this.keyFor(personaId, state));
    if (!entry) return true;
    return Date.now() - entry.storedAt > TTL_MS;
  }
}

/** Singleton — both M5 and M4 import this exact instance. */
export const resultCache = new ResultCache();
export default resultCache;
