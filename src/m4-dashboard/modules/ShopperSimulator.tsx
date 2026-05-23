"use client";

import { useState } from "react";

import type {
  DemoState,
  DiscoveryProduct,
  Persona,
  PersonaId,
} from "@/lib/contracts";
import { searchWithTimeout } from "@/m5-plp/lib/discoveryClient";
import resultCache from "@/m5-plp/lib/resultCache";

/**
 * Module B — live Shopper Simulator. Calls the Discovery search route per
 * persona + state (shares M5's resultCache, ADR-005-2). Initial Guest data is
 * provided by the server; persona switches fetch in event handlers. Shows
 * rank-change indicators on the After state vs Before. Never a static mockup.
 */

const BANNER =
  "Before: generic ranking — After: personalised results following Doctor recommendations.";

const GRID_LIMIT = 12;

type RankChange = "up" | "down" | "same";

interface ShopperSimulatorProps {
  personas: Persona[];
  initialBefore: DiscoveryProduct[];
  initialAfter: DiscoveryProduct[];
}

export function ShopperSimulator({
  personas,
  initialBefore,
  initialAfter,
}: ShopperSimulatorProps) {
  const [activePersona, setActivePersona] = useState<PersonaId>("guest");
  const [displayState, setDisplayState] = useState<DemoState>("before");
  const [before, setBefore] = useState<DiscoveryProduct[]>(initialBefore);
  const [after, setAfter] = useState<DiscoveryProduct[]>(initialAfter);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchState(persona: PersonaId, state: DemoState) {
    const cached = resultCache.get(persona, state);
    if (cached) return cached.products;
    const result = await searchWithTimeout(persona, state);
    resultCache.set(persona, state, result);
    return result.products;
  }

  async function selectPersona(persona: PersonaId) {
    setActivePersona(persona);
    if (persona === "guest") {
      setBefore(initialBefore);
      setAfter(initialAfter);
      return;
    }
    setIsLoading(true);
    try {
      const [b, a] = await Promise.all([
        fetchState(persona, "before"),
        fetchState(persona, "after"),
      ]);
      setBefore(b);
      setAfter(a);
    } catch {
      // Keep current products — never blank the grid.
    } finally {
      setIsLoading(false);
    }
  }

  const products = displayState === "before" ? before : after;

  // Rank change map: after rank vs before rank (lower number = higher rank).
  const beforeRank = new Map(before.map((p) => [p.product_id, p.rank_position]));
  const rankChangeFor = (product: DiscoveryProduct): RankChange => {
    const prev = beforeRank.get(product.product_id);
    if (prev === undefined) return "same";
    if (product.rank_position < prev) return "up";
    if (product.rank_position > prev) return "down";
    return "same";
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white p-6">
      {/* Persona tabs + before/after toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-black/10 bg-gray-100 p-1">
          {personas.map((p) => (
            <button
              key={p.persona_id}
              type="button"
              onClick={() => selectPersona(p.persona_id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activePersona === p.persona_id
                  ? "bg-navy text-white shadow-sm"
                  : "text-gray-600 hover:text-navy"
              }`}
            >
              {p.display_name}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-black/10 bg-gray-100 p-1">
          {(["before", "after"] as const).map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setDisplayState(state)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                displayState === state
                  ? "bg-teal text-white shadow-sm"
                  : "text-gray-600 hover:text-navy"
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-600">
        {BANNER}
      </p>

      {/* Grid */}
      <div
        className={`mt-4 grid grid-cols-2 gap-3 transition-opacity md:grid-cols-4 ${
          isLoading ? "opacity-60" : "opacity-100"
        }`}
      >
        {products.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-lg border border-black/10 bg-gray-200"
              />
            ))
          : products.slice(0, GRID_LIMIT).map((product) => (
              <SimProductCard
                key={product.product_id}
                product={product}
                displayState={displayState}
                rankChange={rankChangeFor(product)}
              />
            ))}
      </div>
    </div>
  );
}

function SimProductCard({
  product,
  displayState,
  rankChange,
}: {
  product: DiscoveryProduct;
  displayState: DemoState;
  rankChange: RankChange;
}) {
  const personalised = displayState === "after" && product.rank_position <= 3;
  const showChange = displayState === "after";

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white">
      <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-navy/90 px-2 py-0.5 text-xs font-semibold text-white">
        #{product.rank_position}
        {showChange && rankChange === "up" && (
          <span className="text-teal" aria-label="moved up">
            ↑
          </span>
        )}
        {showChange && rankChange === "down" && (
          <span className="text-gray-300" aria-label="moved down">
            ↓
          </span>
        )}
        {showChange && rankChange === "same" && (
          <span className="text-gray-300" aria-label="no change">
            –
          </span>
        )}
      </span>
      {personalised && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-teal px-2 py-0.5 text-[10px] font-semibold text-white">
          Personalised
        </span>
      )}
      <div className="flex h-28 items-center justify-center bg-gray-200 text-xs text-gray-400">
        {product.category}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <h4 className="line-clamp-2 text-xs font-medium text-navy">
          {product.name}
        </h4>
        <span className="mt-auto text-sm font-semibold text-navy">
          £{product.price.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default ShopperSimulator;
