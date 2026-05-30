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
  type DisplayState,
  type PersonaId,
} from '../lib/resultCache';
import { search as discoverySearch } from '../lib/discoveryClient';
import { readRulesActiveCookie } from '../../lib/rules-flag';

/**
 * PLPPage — route "/"
 *
 * Personalisation state is driven by the `ppd_rules_active` cookie.
 *   false → Discovery search with NO audience flag → same generic ranking for all personas
 *   true  → Discovery search WITH audience flag per persona → personalised ranking
 *
 * Search is fully user-driven: the search box controls the query sent to
 * Discovery. Boost rules do not change the query, only the audience context.
 */

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
  state: DisplayState,
  query: string,
): Promise<DiscoveryProduct[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const live = await discoverySearch(
      query,
      getBruidCookie(),
      controller.signal,
      4000,
      state,
    );
    clearTimeout(timer);
    if (live.products && live.products.length > 0) {
      resultCache.set(personaId, state, {
        products: live.products,
        cached_at: Date.now(),
      });
      return live.products;
    }
    throw new Error('Empty live result');
  } catch (err) {
    console.warn('Live fetch failed, falling back to cache file', err);
    clearTimeout(timer);
    const file = resultCache.loadFromFile(personaId, state);
    resultCache.set(personaId, state, file);
    return file.products;
  }
}

export default function PLPPage() {
  const [activePersonaId, setActivePersonaId] = useState<string>('guest');
  const [products, setProducts] = useState<DiscoveryProduct[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  // Search query — what Discovery actually receives
  const [searchQuery, setSearchQuery] = useState('necklace');
  // Pending input — what the user is typing in the search box
  const [pendingInput, setPendingInput] = useState('necklace');
  // Personalisation flag — seeded from the cookie, refreshed on window focus
  const [rulesActive, setRulesActive] = useState<boolean>(() => readRulesActiveCookie());
  const displayState: DisplayState = rulesActive ? 'after' : 'before';

  const loadProducts = useCallback(
    async (personaId: string, state: DisplayState, query: string, force = false) => {
      if (force) {
        resultCache.set(personaId, state, { products: [], cached_at: 0 });
      }
      setProducts(null);
      const result = await fetchProductsLive(personaId, state, query);
      setProducts(result);
      setLastFetchedAt(new Date());
    },
    [],
  );

  // Persona, state, or query change → re-fetch.
  useEffect(() => {
    const persona = rawPersonas.find((p) => p.persona_id === activePersonaId);
    if (persona) applyPersonaCookie(persona);

    let cancelled = false;
    setProducts(null);
    fetchProductsLive(activePersonaId, displayState, searchQuery).then((p) => {
      if (!cancelled) {
        setProducts(p);
        setLastFetchedAt(new Date());
      }
    });
    return () => { cancelled = true; };
  }, [activePersonaId, displayState, searchQuery]);

  // Pick up cookie flips made from the dashboard "Activate boost rules" button.
  useEffect(() => {
    function sync() {
      const next = readRulesActiveCookie();
      setRulesActive((prev) => (prev === next ? prev : next));
    }
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = pendingInput.trim();
    if (trimmed && trimmed !== searchQuery) {
      setSearchQuery(trimmed);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await loadProducts(activePersonaId, displayState, searchQuery, true);
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

        {/* ── Search form ── */}
        <form onSubmit={handleSearch} className="mb-5 flex gap-3" data-testid="search-form">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <input
              type="text"
              value={pendingInput}
              onChange={e => setPendingInput(e.target.value)}
              placeholder="Search products…"
              data-testid="search-input"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <button
            type="submit"
            disabled={!pendingInput.trim()}
            data-testid="search-button"
            className="rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#2D1BB5' }}
          >
            Search
          </button>
        </form>

        {/* ── Page header row ── */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Search results for &ldquo;{searchQuery}&rdquo;
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: rulesActive ? '#7C3AED' : '#64748B' }}
                data-testid="plp-personalisation-pill"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-white/80 ${rulesActive ? 'animate-pulse' : ''}`}
                  aria-hidden="true"
                />
                {rulesActive
                  ? 'Personalisation active'
                  : 'Personalisation inactive · same ranking for all personas'}
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

        <ProductGrid products={products} displayState={displayState} />
      </main>
    </div>
  );
}
