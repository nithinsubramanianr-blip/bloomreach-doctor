"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  DemoState,
  DiscoveryProduct,
  Persona,
  PersonaEvent,
  PersonaId,
} from "@/lib/contracts";
import { BRAND } from "@/lib/brand";
import { ProductCard } from "@/components/ProductCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PersonaSwitcher } from "./components/PersonaSwitcher";
import { searchWithTimeout } from "./lib/discoveryClient";
import resultCache from "./lib/resultCache";

interface PLPClientProps {
  personas: Persona[];
  initialProducts: DiscoveryProduct[];
  /** Single source of truth — false: generic ranking, true: personalised. */
  rulesActive: boolean;
}

const PRICE_BANDS: {
  id: string;
  label: string;
  test: (p: DiscoveryProduct) => boolean;
}[] = [
  { id: "all", label: "All prices", test: () => true },
  { id: "lt75", label: "Under £75", test: (p) => p.price < 75 },
  { id: "75to200", label: "£75–£200", test: (p) => p.price >= 75 && p.price <= 200 },
  { id: "gt200", label: "Over £200", test: (p) => p.price > 200 },
];

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PLPClient({
  personas,
  initialProducts,
  rulesActive,
}: PLPClientProps) {
  // The display state is derived entirely from the flag — never a local toggle.
  const state: DemoState = rulesActive ? "after" : "before";

  const [activePersona, setActivePersona] = useState<PersonaId>("guest");
  const [products, setProducts] = useState<DiscoveryProduct[]>(initialProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [priceBand, setPriceBand] = useState<string>("all");

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category)))];
  const priceTest =
    PRICE_BANDS.find((b) => b.id === priceBand)?.test ?? (() => true);
  const filtered = products.filter(
    (p) => (category === "all" || p.category === category) && priceTest(p)
  );

  async function loadFor(persona: PersonaId) {
    // Guest in the current state is exactly the server-rendered initial set.
    if (persona === "guest") {
      setProducts(initialProducts);
      return;
    }
    const cached = resultCache.get(persona, state);
    if (cached) {
      setProducts(cached.products);
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
    loadFor(persona);
  }

  const activePersonaObj = personas.find((p) => p.persona_id === activePersona);
  const banner = rulesActive
    ? activePersonaObj?.plp_after_state ??
      "Personalised results, ranked for this shopper's segment."
    : "Every shopper sees the same generic ranking until fixes are approved.";

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-50 border-b border-navy/20 bg-header-bg text-header-text shadow-[0_4px_24px_-10px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-header-muted md:text-[11px] md:tracking-[0.12em]">
              {BRAND.store} · Live PLP
            </p>
            <h1 className="mt-0.5 text-lg font-semibold text-header-text md:text-[22px] md:font-medium">
              {BRAND.store} Featured Jewellery
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
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-3 md:px-6 md:py-4">
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              rulesActive
                ? "bg-accent-soft text-accent"
                : "bg-surface-2 text-muted ring-1 ring-border"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${rulesActive ? "bg-accent" : "bg-faint"}`}
            />
            Personalisation {rulesActive ? "active" : "inactive"}
          </span>
          <p className="max-w-xl text-[12px] text-muted md:text-[13px]">
            {banner}
          </p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-5 md:px-6 md:py-8">
        {activePersonaObj && <JourneyPanel persona={activePersonaObj} />}

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3">
            <Facet
              label="Category"
              options={categories.map((c) => ({
                id: c,
                label: c === "all" ? "All" : titleCase(c),
              }))}
              value={category}
              onChange={setCategory}
            />
            <Facet
              label="Price"
              options={PRICE_BANDS.map((b) => ({ id: b.id, label: b.label }))}
              value={priceBand}
              onChange={setPriceBand}
            />
          </div>
          <p className="text-[12px] text-muted md:text-[13px]">
            Showing {filtered.length} of {products.length}
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-muted">
            No products match these filters.
          </p>
        ) : (
          <div
            className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-4 md:gap-4 ${
              isLoading ? "opacity-60" : "opacity-100"
            }`}
          >
            {filtered.map((product, i) => (
              <ProductCard
                key={product.product_id}
                product={product}
                displayState={state}
                index={i}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const EVENT_META: Record<PersonaEvent["type"], { label: string; glyph: string }> = {
  page_view: { label: "Viewed", glyph: "◉" },
  search: { label: "Searched", glyph: "⌕" },
  wishlist_add: { label: "Wishlisted", glyph: "♡" },
  purchase: { label: "Purchased", glyph: "✓" },
};

function eventDate(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? ts
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "Why this segment" — the active persona's events that justify their segment. */
function JourneyPanel({ persona }: { persona: Persona }) {
  const journey = persona.journey ?? [];
  if (journey.length === 0 && !persona.bruid_present) {
    return (
      <section className="mb-5 rounded-2xl border border-border bg-surface p-4 md:p-5">
        <h2 className="text-[14px] font-semibold text-text">
          Why {persona.display_name} is in “{persona.segment_name}”
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {persona.personalisation_gap ?? persona.profile_description}
        </p>
      </section>
    );
  }
  return (
    <section className="mb-5 rounded-2xl border border-border bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-text">
          Why {persona.display_name} is in “{persona.segment_name}”
        </h2>
        <span className="caption">{journey.length} signals</span>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {persona.personalisation_gap ?? persona.profile_description}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {journey.map((e, i) => (
          <li
            key={i}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 text-[12px] text-text-body"
          >
            <span className="text-accent" aria-hidden>
              {EVENT_META[e.type].glyph}
            </span>
            <span className="font-medium">{EVENT_META[e.type].label}</span>
            <span className="text-muted">{e.category}</span>
            <span className="text-faint">· {eventDate(e.timestamp)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Facet({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              value === opt.id
                ? "bg-accent text-accent-ink"
                : "border border-border bg-surface text-text-body hover:border-accent/40 hover:text-text"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default PLPClient;
