import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import personasJson from '../../../data/personas.json';
import PersonaSwitcher, {
  applyPersonaCookie,
  type PersonaOption,
} from '../components/PersonaSwitcher';
import BeforeAfterToggle from '../components/BeforeAfterToggle';
import ProductGrid from '../components/ProductGrid';
import resultCache, {
  type DiscoveryProduct,
  type DisplayState,
  type PersonaId,
} from '../lib/resultCache';
import { search as discoverySearch } from '../lib/discoveryClient';

/**
 * PLPPage — route "/"
 *
 * Owns: activePersonaId, displayState, products (loading=null).
 * Hardcoded query "necklace" for all three personas.
 *
 * Fetch chain (never empty grid):
 *   1) fresh resultCache entry        → return
 *   2) discoveryClient.search w/ 2s   → store + return
 *   3) timeout / error                → resultCache.loadFromFile()
 *
 * Spec: 006-react-plp / FR-006-1..25
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

async function fetchProducts(
  personaId: PersonaId | string,
  state: DisplayState,
): Promise<DiscoveryProduct[]> {
  // 1. Fresh cache hit?
  if (!resultCache.isStale(personaId, state)) {
    const hit = resultCache.get(personaId, state);
    if (hit) return hit.products;
  }

  // 2. Live Discovery with 2s timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const live = await discoverySearch(
      DEMO_QUERY,
      getBruidCookie(),
      controller.signal,
    );
    clearTimeout(timer);
    if (live.products && live.products.length > 0) {
      resultCache.set(personaId, state, {
        products: live.products,
        cached_at: Date.now(),
      });
      return live.products;
    }
    // Empty live result — fall through to file fallback so grid is non-empty.
    throw new Error('Empty live result');
  } catch {
    clearTimeout(timer);
    // 3. File fallback — guaranteed non-empty by resultCache.loadFromFile.
    const file = resultCache.loadFromFile(personaId, state);
    resultCache.set(personaId, state, file);
    return file.products;
  }
}

export default function PLPPage() {
  const [activePersonaId, setActivePersonaId] = useState<string>('guest');
  const [displayState, setDisplayState] = useState<DisplayState>('before');
  const [products, setProducts] = useState<DiscoveryProduct[] | null>(null);

  // Apply the initial Guest cookie state (deleted) once on mount.
  useEffect(() => {
    const initial = rawPersonas.find((p) => p.persona_id === activePersonaId);
    if (initial) applyPersonaCookie(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProducts(null);
    fetchProducts(activePersonaId, displayState).then((p) => {
      if (!cancelled) setProducts(p);
    });
    return () => {
      cancelled = true;
    };
  }, [activePersonaId, displayState]);

  const brandLabel =
    (import.meta as any)?.env?.VITE_APP_DEMO_BRAND ?? 'Kendra Scott';

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        data-testid="plp-header"
        className="flex h-16 items-center justify-between px-6"
        style={{ backgroundColor: '#1B3A5C' }}
      >
        <div className="flex items-center gap-4 text-white">
          <span className="text-lg font-semibold">{brandLabel}</span>
          <Link
            to="/doctor"
            className="text-xs uppercase tracking-wide text-white/70 hover:text-white"
          >
            PPD Doctor
          </Link>
        </div>
        <PersonaSwitcher
          personas={rawPersonas}
          activePersonaId={activePersonaId}
          onChange={(id) => setActivePersonaId(id)}
        />
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ppd-navy">
              Search results for "{DEMO_QUERY}"
            </h1>
            <p className="text-sm text-slate-600">
              Persona-aware ranking. Toggle Before/After to see the impact of
              boost rule activation.
            </p>
          </div>
          <BeforeAfterToggle
            value={displayState}
            onChange={(v) => setDisplayState(v)}
          />
        </div>

        <ProductGrid products={products} displayState={displayState} />
      </main>
    </div>
  );
}
