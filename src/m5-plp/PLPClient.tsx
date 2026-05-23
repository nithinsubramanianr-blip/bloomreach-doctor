"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  DemoState,
  DiscoveryProduct,
  Persona,
  PersonaId,
} from "@/lib/contracts";
import { PersonaSwitcher } from "./components/PersonaSwitcher";
import { ProductCard } from "./components/ProductCard";
import { searchWithTimeout } from "./lib/discoveryClient";
import resultCache from "./lib/resultCache";

/**
 * M5 PLP — live product listing page (synthetic-backed for now).
 *
 * Initial Guest/Before products come from the server (page.tsx). Persona
 * switches and Before/After toggles fetch in event handlers (not effects),
 * deduped through the shared resultCache. The grid is never blanked: on error
 * the previous products stay on screen.
 */

interface PLPClientProps {
  personas: Persona[];
  initialProducts: DiscoveryProduct[];
}

export function PLPClient({ personas, initialProducts }: PLPClientProps) {
  const [activePersona, setActivePersona] = useState<PersonaId>("guest");
  const [displayState, setDisplayState] = useState<DemoState>("before");
  const [products, setProducts] = useState<DiscoveryProduct[]>(initialProducts);
  const [isLoading, setIsLoading] = useState(false);

  async function loadFor(persona: PersonaId, state: DemoState) {
    const cached = resultCache.get(persona, state);
    if (cached) {
      setProducts(cached.products);
      return;
    }
    // The server already provided the Guest/Before set.
    if (persona === "guest" && state === "before") {
      setProducts(initialProducts);
      return;
    }
    setIsLoading(true);
    try {
      const result = await searchWithTimeout(persona, state);
      resultCache.set(persona, state, result);
      setProducts(result.products);
    } catch {
      // Never blank the grid — keep whatever is currently shown.
    } finally {
      setIsLoading(false);
    }
  }

  function handlePersona(persona: PersonaId) {
    setActivePersona(persona);
    loadFor(persona, displayState);
  }

  function handleState(state: DemoState) {
    setDisplayState(state);
    loadFor(activePersona, state);
  }

  const activePersonaObj = personas.find((p) => p.persona_id === activePersona);
  const stateBlurb =
    displayState === "before"
      ? activePersonaObj?.plp_before_state
      : activePersonaObj?.plp_after_state;

  return (
    <div className="flex flex-1 flex-col">
      {/* Navy header */}
      <header className="flex items-center justify-between bg-navy px-6 py-3 text-white">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold">Kendra Scott</span>
          <span className="text-xs uppercase tracking-widest opacity-70">
            Search: “necklace”
          </span>
        </div>
        <div className="flex items-center gap-4">
          <PersonaSwitcher
            personas={personas}
            activePersonaId={activePersona}
            onChange={handlePersona}
          />
          <Link
            href="/"
            className="text-sm underline-offset-2 opacity-90 hover:underline"
          >
            Open Doctor →
          </Link>
        </div>
      </header>

      {/* Before/After control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white px-6 py-3">
        <BeforeAfterToggle value={displayState} onChange={handleState} />
        {stateBlurb && (
          <p className="max-w-xl text-sm text-gray-600">{stateBlurb}</p>
        )}
      </div>

      {/* Product grid */}
      <main className="flex-1 bg-gray-50 px-6 py-6">
        <div
          className={`grid grid-cols-2 gap-4 transition-opacity md:grid-cols-4 ${
            isLoading ? "opacity-60" : "opacity-100"
          }`}
        >
          {products.map((product) => (
            <ProductCard
              key={product.product_id}
              product={product}
              displayState={displayState}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function BeforeAfterToggle({
  value,
  onChange,
}: {
  value: DemoState;
  onChange: (state: DemoState) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-black/10 bg-gray-100 p-1">
      {(["before", "after"] as const).map((state) => (
        <button
          key={state}
          type="button"
          onClick={() => onChange(state)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
            value === state
              ? "bg-teal text-white shadow-sm"
              : "text-gray-600 hover:text-navy"
          }`}
        >
          {state}
        </button>
      ))}
    </div>
  );
}

export default PLPClient;
