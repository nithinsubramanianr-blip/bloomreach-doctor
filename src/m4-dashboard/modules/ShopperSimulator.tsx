/**
 * ShopperSimulator.tsx — Module B (LIVE — Invariant #7)
 *
 * Shows Before and After product columns SIDE-BY-SIDE simultaneously.
 * No Before/After toggle — both columns are always visible.
 * Three persona tabs: Guest, Sarah, Alex.
 *
 * Data is loaded synchronously via resultCache.loadFromFile() — always returns
 * products, never empty. No async searchProducts call needed.
 *
 * Rank change indicators in After column: teal ↑ (up), grey ↓ (down), — (same).
 * Banner text is verbatim from spec.
 * All prices in GBP (£).
 */

import React, { useState, useEffect } from 'react';
import resultCache from '../../m5-plp/lib/resultCache';
import type { DiscoveryProduct } from '../../m5-plp/lib/resultCache';

export type PersonaId = 'guest' | 'sarah' | 'alex';
export type DisplayState = 'before' | 'after';

export interface Persona {
  persona_id: PersonaId;
  display_name: string;
  bruid_value: string | null;
}

// ---------------------------------------------------------------------------
// Personas — sourced from personas.json data (inline constants to avoid
// a JSON import that would bypass the resultCache path).
// ---------------------------------------------------------------------------

const PERSONAS: Persona[] = [
  { persona_id: 'guest', display_name: 'Guest', bruid_value: null },
  { persona_id: 'sarah', display_name: 'Sarah', bruid_value: '_br_uid_2=sarah-gifting-demo-001' },
  { persona_id: 'alex',  display_name: 'Alex',  bruid_value: '_br_uid_2=alex-highvalue-demo-002' },
];

// ---------------------------------------------------------------------------
// Banner text — verbatim from spec (Invariant)
// ---------------------------------------------------------------------------

const BANNER_TEXT =
  'Before: generic ranking — After: personalised results following Doctor recommendations.';

// ---------------------------------------------------------------------------
// Rank-change calculation (design-spec § "Module B: Rank Change Calculation")
// ---------------------------------------------------------------------------

function calculateRankChanges(
  beforeProducts: DiscoveryProduct[],
  afterProducts: DiscoveryProduct[],
): Map<string, 'up' | 'down' | 'same'> {
  const beforeRank = new Map<string, number>();
  beforeProducts.forEach((p, idx) => beforeRank.set(p.product_id, idx + 1));

  const changes = new Map<string, 'up' | 'down' | 'same'>();
  afterProducts.forEach((p, idx) => {
    const afterPos = idx + 1;
    const beforePos = beforeRank.get(p.product_id) ?? afterPos;
    if (afterPos < beforePos) changes.set(p.product_id, 'up');
    else if (afterPos > beforePos) changes.set(p.product_id, 'down');
    else changes.set(p.product_id, 'same');
  });

  return changes;
}

// ---------------------------------------------------------------------------
// RankBadge — shared between Before and After cards
// ---------------------------------------------------------------------------

function RankBadge({
  rank,
  change,
  isAfter,
}: {
  rank: number;
  change?: 'up' | 'down' | 'same';
  isAfter: boolean;
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: '#1B3A5C' }}
      >
        {rank}
      </span>
      {isAfter && change && change !== 'same' && (
        <span
          className="text-xs font-bold"
          style={{ color: change === 'up' ? '#0E7C7B' : '#9CA3AF' }}
          aria-label={change === 'up' ? 'moved up' : 'moved down'}
        >
          {change === 'up' ? '↑' : '↓'}
        </span>
      )}
      {isAfter && change === 'same' && (
        <span className="text-xs text-slate-300" aria-label="no change">—</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductCard — compact, used in both Before and After columns
// ---------------------------------------------------------------------------

function ProductCard({
  product,
  rankPosition,
  rankChange,
  isAfter,
}: {
  product: DiscoveryProduct;
  rankPosition: number;
  rankChange?: 'up' | 'down' | 'same';
  isAfter: boolean;
}) {
  const showPersonalisedBadge =
    isAfter && rankPosition <= 3 && (product as DiscoveryProduct & { is_personalised?: boolean }).is_personalised !== false;

  return (
    <div
      className="relative flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm"
      data-testid={`product-card-${isAfter ? 'after' : 'before'}-${product.product_id}`}
    >
      {/* Minimal colored strip — replaces tall image placeholder */}
      <div className="h-12 bg-slate-50" aria-hidden="true" />

      {/* Card body */}
      <div className="p-3 flex flex-col gap-1">
        {/* Rank badge row */}
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-medium text-slate-800 leading-tight line-clamp-2 flex-1">
            {product.name}
          </p>
          <RankBadge rank={rankPosition} change={rankChange} isAfter={isAfter} />
        </div>

        {/* Price */}
        <p className="text-sm font-bold" style={{ color: '#1B3A5C' }}>
          £{product.price.toFixed(2)}
        </p>

        {/* "Personalised for you" chip — top 3 in After column */}
        {showPersonalisedBadge && (
          <span
            className="self-start rounded-full px-2 py-0.5 text-xs font-semibold text-white mt-0.5"
            style={{ backgroundColor: '#0E7C7B' }}
          >
            Personalised for you
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonGrid — 2-column grid skeleton (for consistent loading pattern)
// ---------------------------------------------------------------------------

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 animate-pulse" data-testid="skeleton-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="h-12 bg-slate-100" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-slate-100 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShopperSimulator
// ---------------------------------------------------------------------------

export default function ShopperSimulator() {
  const [activePersona, setActivePersona] = useState<PersonaId>('guest');
  const [beforeProducts, setBeforeProducts] = useState<DiscoveryProduct[]>([]);
  const [afterProducts, setAfterProducts] = useState<DiscoveryProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load both Before and After products synchronously when persona changes.
  useEffect(() => {
    setIsLoading(true);

    const before = resultCache.loadFromFile(activePersona, 'before');
    const after = resultCache.loadFromFile(activePersona, 'after');

    setBeforeProducts(before.products);
    setAfterProducts(after.products);

    setIsLoading(false);
  }, [activePersona]);

  // Rank changes: compare After positions vs Before positions.
  const rankChanges: Map<string, 'up' | 'down' | 'same'> =
    beforeProducts.length > 0 && afterProducts.length > 0
      ? calculateRankChanges(beforeProducts, afterProducts)
      : new Map();

  // Slice to first 8 products for display.
  const beforeSlice = beforeProducts.slice(0, 8);
  const afterSlice = afterProducts.slice(0, 8);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5" data-testid="shopper-simulator">
      {/* ── Persona Tabs ── */}
      <div className="flex gap-2">
        {PERSONAS.map(persona => (
          <button
            key={persona.persona_id}
            onClick={() => setActivePersona(persona.persona_id)}
            data-testid={`persona-tab-${persona.persona_id}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activePersona === persona.persona_id
                ? 'text-white'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            style={
              activePersona === persona.persona_id
                ? { backgroundColor: '#1B3A5C' }
                : undefined
            }
          >
            {persona.display_name}
          </button>
        ))}
      </div>

      {/* ── Banner ── */}
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 border border-amber-200">
        {BANNER_TEXT}
      </p>

      {/* ── Side-by-side comparison ── */}
      <div className="grid grid-cols-[1fr_1px_1fr] gap-0" data-testid="comparison-layout">
        {/* ── Before column ── */}
        <div className="pr-5 space-y-3">
          {/* Column header */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Before
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Generic ranking</p>
          </div>

          {isLoading ? (
            <SkeletonGrid />
          ) : (
            <div className="grid grid-cols-2 gap-3" data-testid="before-product-grid">
              {beforeSlice.map((product, idx) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  rankPosition={idx + 1}
                  isAfter={false}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="bg-slate-200 self-stretch mx-0" aria-hidden="true" />

        {/* ── After column ── */}
        <div className="pl-5 space-y-3">
          {/* Column header */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: '#0E7C7B' }}
            >
              After
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Personalised</p>
          </div>

          {isLoading ? (
            <SkeletonGrid />
          ) : (
            <div className="grid grid-cols-2 gap-3" data-testid="after-product-grid">
              {afterSlice.map((product, idx) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  rankPosition={idx + 1}
                  rankChange={rankChanges.get(product.product_id)}
                  isAfter={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
