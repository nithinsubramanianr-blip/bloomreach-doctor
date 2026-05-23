"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  DemoState,
  DiscoveryProduct,
  Persona,
  PersonaId,
} from "@/lib/contracts";
import { ProductCard } from "@/components/ProductCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PersonaSwitcher } from "./components/PersonaSwitcher";
import { searchWithTimeout } from "./lib/discoveryClient";
import resultCache from "./lib/resultCache";

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
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-50 border-b border-navy/20 bg-header-bg text-header-text shadow-[0_4px_24px_-10px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-header-muted">
              Kendra Scott · Live PLP
            </p>
            <h1 className="font-display text-[22px] font-medium text-header-text">
              Necklace search
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PersonaSwitcher
              personas={personas}
              activePersonaId={activePersona}
              onChange={handlePersona}
            />
            <Link
              href="/"
              className="hidden rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-header-muted transition-colors hover:border-white/30 hover:text-header-text sm:inline"
            >
              Open Doctor
            </Link>
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <BeforeAfterToggle value={displayState} onChange={handleState} />
          {stateBlurb && (
            <p className="max-w-xl text-[13px] text-muted">{stateBlurb}</p>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-8">
        <div
          className={`grid grid-cols-2 gap-4 transition-opacity md:grid-cols-4 ${
            isLoading ? "opacity-60" : "opacity-100"
          }`}
        >
          {products.map((product, i) => (
            <ProductCard
              key={product.product_id}
              product={product}
              displayState={displayState}
              index={i}
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
    <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
      {(["before", "after"] as const).map((state) => (
        <button
          key={state}
          type="button"
          onClick={() => onChange(state)}
          className={`rounded-lg px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
            value === state
              ? state === "after"
                ? "bg-accent text-accent-ink"
                : "bg-surface text-text shadow-sm"
              : "text-muted hover:text-text"
          }`}
        >
          {state}
        </button>
      ))}
    </div>
  );
}

export default PLPClient;
