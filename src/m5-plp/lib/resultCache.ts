/**
 * resultCache.ts
 *
 * In-memory singleton cache (300s TTL) shared between M5 PLP and M4 ShopperSimulator.
 * Also provides `loadFromFile` — the final fallback so the grid is NEVER empty.
 *
 * Spec: 006-react-plp / ADR-006-1, ADR-006-5
 */

// Static imports of the six cached-results JSON files so loadFromFile is sync
// and zero-network. The JSON files in /data/cached-results currently have an
// empty `products` array as a placeholder; we layer SAMPLE_FALLBACK_PRODUCTS
// underneath so the grid is never empty in any environment.
import guestBefore from '../../../data/cached-results/guest-before.json';
import guestAfter from '../../../data/cached-results/guest-after.json';
import sarahBefore from '../../../data/cached-results/sarah-before.json';
import sarahAfter from '../../../data/cached-results/sarah-after.json';
import alexBefore from '../../../data/cached-results/alex-before.json';
import alexAfter from '../../../data/cached-results/alex-after.json';

export type PersonaId = 'guest' | 'sarah' | 'alex';
export type DisplayState = 'before' | 'after';

export interface DiscoveryProduct {
  product_id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category?: string;
  price_band?: 'entry' | 'premium' | string;
  gift_eligible?: boolean;
  is_new_arrival?: boolean;
  is_bestseller?: boolean;
  image_url?: string;
  is_personalised?: boolean;
}

export interface CachedResult {
  products: DiscoveryProduct[];
  cached_at: number; // epoch ms
}

export interface ResultCacheApi {
  get(personaId: PersonaId | string, state: DisplayState): CachedResult | null;
  set(
    personaId: PersonaId | string,
    state: DisplayState,
    result: CachedResult,
  ): void;
  isStale(personaId: PersonaId | string, state: DisplayState): boolean;
  loadFromFile(
    personaId: PersonaId | string,
    state: DisplayState,
  ): CachedResult;
  clear(): void;
  _key(personaId: string, state: DisplayState): string;
}

const TTL_MS = 300 * 1000; // 300 seconds — invariant from spec

// --------------------------------------------------------------------------
// SAMPLE_FALLBACK_PRODUCTS
// Last-resort sample products so the grid is never empty even when the JSON
// cache placeholders are empty. Mirrors entries in /data/products.json (GBP).
// Each persona+state slice projects different ranking + personalisation flags
// so the demo "before/after" visual contrast still works offline.
// --------------------------------------------------------------------------

const P = (
  product_id: string,
  name: string,
  price: number,
  category: string,
  extras: Partial<DiscoveryProduct> = {},
): DiscoveryProduct => ({
  product_id,
  name,
  price,
  currency: 'GBP',
  category,
  ...extras,
});

// Eight curated products per cell — keeps grid full (4×2 desktop, 2×4 mobile).
const SAMPLE_FALLBACK_PRODUCTS: Record<
  PersonaId,
  Record<DisplayState, DiscoveryProduct[]>
> = {
  guest: {
    before: [
      P('P035', 'Classic Chain Necklace', 28.0, 'necklace'),
      P('P041', 'Teardrop Pendant Necklace', 25.0, 'necklace'),
      P('P039', 'Layered Chain Necklace', 32.0, 'necklace'),
      P('P011', 'Minimalist Gold Necklace Gift', 40.0, 'necklace'),
      P('P015', 'Crystal Pendant Necklace Gift', 44.0, 'necklace'),
      P('P008', 'Engraved Heart Necklace Gift', 48.0, 'necklace'),
      P('P017', 'Charm Necklace Gift Set', 58.0, 'necklace'),
      P('P003', 'Rose Gold Layering Set', 52.0, 'necklace'),
    ],
    after: [
      P('P035', 'Classic Chain Necklace', 28.0, 'necklace', { is_bestseller: true, is_personalised: true }),
      P('P041', 'Teardrop Pendant Necklace', 25.0, 'necklace', { is_bestseller: true, is_personalised: true }),
      P('P039', 'Layered Chain Necklace', 32.0, 'necklace', { is_bestseller: true, is_personalised: true }),
      P('P011', 'Minimalist Gold Necklace Gift', 40.0, 'necklace', { is_bestseller: true }),
      P('P015', 'Crystal Pendant Necklace Gift', 44.0, 'necklace'),
      P('P008', 'Engraved Heart Necklace Gift', 48.0, 'necklace'),
      P('P017', 'Charm Necklace Gift Set', 58.0, 'necklace'),
      P('P003', 'Rose Gold Layering Set', 52.0, 'necklace'),
    ],
  },
  sarah: {
    before: [
      P('P025', 'Moonstone Pendant Necklace', 190.0, 'necklace'),
      P('P018', 'Diamond-Cut Gold Necklace', 195.0, 'necklace'),
      P('P035', 'Classic Chain Necklace', 28.0, 'necklace'),
      P('P041', 'Teardrop Pendant Necklace', 25.0, 'necklace'),
      P('P001', 'Silver Gift Box Necklace Set', 45.0, 'necklace'),
      P('P002', 'Gold Pendant Gift Set', 58.0, 'necklace'),
      P('P017', 'Charm Necklace Gift Set', 58.0, 'necklace'),
      P('P008', 'Engraved Heart Necklace Gift', 48.0, 'necklace'),
    ],
    after: [
      P('P001', 'Silver Gift Box Necklace Set', 45.0, 'necklace', { gift_eligible: true, is_personalised: true }),
      P('P002', 'Gold Pendant Gift Set', 58.0, 'necklace', { gift_eligible: true, is_personalised: true }),
      P('P017', 'Charm Necklace Gift Set', 58.0, 'necklace', { gift_eligible: true, is_personalised: true }),
      P('P008', 'Engraved Heart Necklace Gift', 48.0, 'necklace', { gift_eligible: true }),
      P('P013', 'Thank You Jewellery Gift Set', 62.0, 'necklace', { gift_eligible: true }),
      P('P014', 'Mother Gift Set — Necklace and Earrings', 72.0, 'necklace', { gift_eligible: true }),
      P('P003', 'Rose Gold Layering Set', 52.0, 'necklace', { gift_eligible: true }),
      P('P010', 'Celestial Star Gift Set', 55.0, 'necklace', { gift_eligible: true }),
    ],
  },
  alex: {
    before: [
      P('P035', 'Classic Chain Necklace', 28.0, 'necklace'),
      P('P041', 'Teardrop Pendant Necklace', 25.0, 'necklace'),
      P('P039', 'Layered Chain Necklace', 32.0, 'necklace'),
      P('P008', 'Engraved Heart Necklace Gift', 48.0, 'necklace'),
      P('P018', 'Diamond-Cut Gold Necklace', 195.0, 'necklace'),
      P('P019', 'Emerald Statement Necklace', 285.0, 'necklace'),
      P('P020', 'Pearl Strand Premium Necklace', 320.0, 'necklace'),
      P('P024', 'Twisted Gold Rope Chain', 175.0, 'necklace'),
    ],
    after: [
      P('P020', 'Pearl Strand Premium Necklace', 320.0, 'necklace', { price_band: 'premium', is_new_arrival: true, is_personalised: true }),
      P('P019', 'Emerald Statement Necklace', 285.0, 'necklace', { price_band: 'premium', is_new_arrival: true, is_personalised: true }),
      P('P031', 'Amethyst Cluster Pendant', 310.0, 'necklace', { price_band: 'premium', is_new_arrival: true, is_personalised: true }),
      P('P027', 'Oxidised Silver Collar Necklace', 260.0, 'necklace', { price_band: 'premium', is_new_arrival: true }),
      P('P023', 'Ruby Heart Pendant', 240.0, 'necklace', { price_band: 'premium', is_new_arrival: true }),
      P('P029', 'Gold Chain Tassel Necklace', 220.0, 'necklace', { price_band: 'premium', is_new_arrival: true }),
      P('P018', 'Diamond-Cut Gold Necklace', 195.0, 'necklace', { price_band: 'premium', is_new_arrival: true }),
      P('P024', 'Twisted Gold Rope Chain', 175.0, 'necklace', { price_band: 'premium', is_new_arrival: true }),
    ],
  },
};

// Map the imported JSON placeholders into the same lookup shape.
const CACHED_JSON: Record<
  PersonaId,
  Record<DisplayState, { products?: DiscoveryProduct[] }>
> = {
  guest: { before: guestBefore as any, after: guestAfter as any },
  sarah: { before: sarahBefore as any, after: sarahAfter as any },
  alex: { before: alexBefore as any, after: alexAfter as any },
};

function pickFromFile(
  personaId: string,
  state: DisplayState,
): DiscoveryProduct[] {
  const persona = (personaId as PersonaId) in CACHED_JSON
    ? (personaId as PersonaId)
    : 'guest';
  const fileProducts = CACHED_JSON[persona]?.[state]?.products ?? [];
  if (Array.isArray(fileProducts) && fileProducts.length > 0) {
    return fileProducts as DiscoveryProduct[];
  }
  // JSON placeholder is empty — fall through to in-code sample products.
  return SAMPLE_FALLBACK_PRODUCTS[persona][state];
}

function createResultCache(): ResultCacheApi {
  const store = new Map<string, CachedResult>();

  const key = (personaId: string, state: DisplayState) =>
    `${personaId}-${state}`;

  return {
    _key: key,
    get(personaId, state) {
      return store.get(key(personaId, state)) ?? null;
    },
    set(personaId, state, result) {
      store.set(key(personaId, state), result);
    },
    isStale(personaId, state) {
      const hit = store.get(key(personaId, state));
      if (!hit) return true;
      return Date.now() - hit.cached_at > TTL_MS;
    },
    loadFromFile(personaId, state) {
      return {
        products: pickFromFile(personaId, state),
        cached_at: Date.now(),
      };
    },
    clear() {
      store.clear();
    },
  };
}

// Module-level singleton. Importing this module from M4 and M5 yields the
// same instance because Vite resolves the module path to one bundle entry.
const resultCache: ResultCacheApi = createResultCache();

export default resultCache;
export { TTL_MS, createResultCache };
