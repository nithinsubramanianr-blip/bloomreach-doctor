import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import personasJson from '../../../data/personas.json';
import PersonaSwitcher, {
  applyPersonaCookie,
  type PersonaOption,
} from '../components/PersonaSwitcher';
import ProductGrid from '../components/ProductGrid';
import resultCache, {
  type DiscoveryProduct,
  type PersonaId,
} from '../lib/resultCache';
import { search as discoverySearch } from '../lib/discoveryClient';

/**
 * PLPPage — route "/"
 *
 * Always displays live/personalised results — no Before/After toggle.
 * Fetch chain (never empty grid):
 *   1) Always forces a fresh Discovery call (clears cache on mount/persona switch)
 *   2) discoveryClient.search with 3s timeout → store in cache + return
 *   3) timeout / error → resultCache.loadFromFile('after') as fallback
 *
 * Refresh button: clears cache entry and re-triggers fetch.
 */

const DEMO_QUERY = 'necklace';

const rawPersonas: PersonaOption[] = (personasJson as any).personas.map(
  (p: any) => ({
    persona_id: p.persona_id,
    display_name: p.display_name,
    archetype_name: p.archetype_name,
    bruid_value: p.bruid_value ?? null,
  }),
);

function getBruidCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((s) => s.trim())
    .find((c) => c.startsWith('_br_uid_2='));
  if (!match) return null;
  const value = match.slice('_br_uid_2='.length);
  return value.length > 0 ? `_br_uid_2=${value}` : null;
}

async function fetchProductsLive(
  personaId: PersonaId | string,
): Promise<DiscoveryProduct[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const live = await discoverySearch(
      DEMO_QUERY,
      getBruidCookie(),
      controller.signal,
    );
    clearTimeout(timer);
    if (live.products && live.products.length > 0) {
      resultCache.set(personaId, 'after', {
        products: live.products,
        cached_at: Date.now(),
      });
      return live.products;
    }
    throw new Error('Empty live result');
  } catch(err) {
    console.warn('Live fetch failed, falling back to cache file', err);
    clearTimeout(timer);
    const file = resultCache.loadFromFile(personaId, 'after');
    resultCache.set(personaId, 'after', file);
    return file.products;
  }
}

export default function PLPPage() {
  const [activePersonaId, setActivePersonaId] = useState<string>('guest');
  const [products, setProducts] = useState<DiscoveryProduct[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const loadProducts = useCallback(async (personaId: string, force = false) => {
    if (force) {
      resultCache.set(personaId, 'after', {
        products: [],
        cached_at: 0,
      });
    }
    setProducts(null);
    const result = await fetchProductsLive(personaId);
    setProducts(result);
    setLastFetchedAt(new Date());
  }, []);

  // Single effect: applies the persona cookie + loads products whenever the
  // active persona changes (including initial mount). The discoveryClient
  // dedupes in-flight calls so React 18 StrictMode's double-invoke still
  // results in only one network round-trip per persona.
  useEffect(() => {
    const persona = rawPersonas.find((p) => p.persona_id === activePersonaId);
    if (persona) applyPersonaCookie(persona);

    let cancelled = false;
    setProducts(null);
    fetchProductsLive(activePersonaId).then((p) => {
      if (!cancelled) {
        setProducts(p);
        setLastFetchedAt(new Date());
      }
    });
    return () => { cancelled = true; };
  }, [activePersonaId]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await loadProducts(activePersonaId, true);
    } finally {
      setIsRefreshing(false);
    }
  }

  function handlePersonaChange(id: string) {
    const persona = rawPersonas.find((p) => p.persona_id === id);
    if (persona) applyPersonaCookie(persona);
    setActivePersonaId(id);
  }

  const brandLabel =
    (import.meta as any)?.env?.VITE_APP_DEMO_BRAND ?? 'Bounteous x Accolite';

  const formattedTime = lastFetchedAt
    ? lastFetchedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header
        data-testid="plp-header"
        className="ppd-header-gradient flex h-16 items-center justify-between px-6 shadow-lg"
      >
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-white tracking-tight">{brandLabel}</span>
          <Link
            to="/doctor"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="nav-ppd-doctor"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            PPD Doctor
          </Link>
        </div>
        <PersonaSwitcher
          personas={rawPersonas}
          activePersonaId={activePersonaId}
          onChange={handlePersonaChange}
        />
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* ── Page header row ── */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Search results for "{DEMO_QUERY}"
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: '#7C3AED' }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse"
                  aria-hidden="true"
                />
                Live · Personalised results
              </span>
              {formattedTime && (
                <span className="text-xs text-slate-400">
                  Updated {formattedTime}
                </span>
              )}
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || products === null}
            data-testid="refresh-results-button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 disabled:opacity-50 transition-all"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRefreshing ? 'animate-spin' : ''}
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            {isRefreshing ? 'Refreshing…' : 'Refresh Results'}
          </button>
        </div>

        <ProductGrid products={products} displayState="after" />
      </main>
    </div>
  );
}
