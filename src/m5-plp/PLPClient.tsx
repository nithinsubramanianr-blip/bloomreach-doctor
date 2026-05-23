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
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-header-muted md:text-[11px] md:tracking-[0.12em]">
              Kendra Scott · Live PLP
            </p>
            <h1 className="mt-0.5 text-lg font-semibold text-header-text md:text-[22px] md:font-medium">
              Necklace search
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <PersonaSwitcher
              personas={personas}
              activePersonaId={activePersona}
              onChange={handlePersona}
            />
            <Link
              href="/"
              className="rounded-lg border border-white/15 px-2.5 py-2 text-[11px] text-header-muted transition-colors hover:border-white/30 hover:text-header-text md:rounded-full md:px-3 md:py-1.5 md:text-[12px]"
            >
              <span className="md:hidden">Doctor</span>
              <span className="hidden md:inline">Open Doctor</span>
            </Link>
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-4">
          <BeforeAfterToggle value={displayState} onChange={handleState} />
          {stateBlurb && (
            <p className="max-w-xl text-[12px] text-muted md:text-[13px]">
              {stateBlurb}
            </p>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-5 md:px-6 md:py-8">
        <div
          className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-4 md:gap-4 ${
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
    <div className="inline-flex w-full max-w-xs rounded-xl border border-border bg-surface-2 p-1 md:w-auto">
      {(["before", "after"] as const).map((state) => (
        <button
          key={state}
          type="button"
          onClick={() => onChange(state)}
          className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-medium capitalize transition-colors md:flex-none md:px-4 md:text-[13px] ${
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
