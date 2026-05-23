"use client";

import { useEffect, useState } from "react";

import type {
  DemoState,
  DiscoveryProduct,
  Persona,
  PersonaId,
} from "@/lib/contracts";
import { ProductCard, type RankChange } from "@/components/ProductCard";
import { searchWithTimeout } from "@/m5-plp/lib/discoveryClient";
import resultCache from "@/m5-plp/lib/resultCache";

const BANNER =
  "Before: generic ranking — After: personalised results following Doctor recommendations.";

const GRID_LIMIT = 12;
const COMPARE_LIMIT = 4;

type LayoutMode = "single" | "compare";

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
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("compare");
  const [before, setBefore] = useState<DiscoveryProduct[]>(initialBefore);
  const [after, setAfter] = useState<DiscoveryProduct[]>(initialAfter);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => {
      if (mq.matches) setLayoutMode("single");
    };
    syncLayout();
    mq.addEventListener("change", syncLayout);
    return () => mq.removeEventListener("change", syncLayout);
  }, []);

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
  const personaObj = personas.find((p) => p.persona_id === activePersona);

  const beforeRank = new Map(before.map((p) => [p.product_id, p.rank_position]));
  const rankChangeFor = (product: DiscoveryProduct): RankChange => {
    const prev = beforeRank.get(product.product_id);
    if (prev === undefined) return "same";
    if (product.rank_position < prev) return "up";
    if (product.rank_position > prev) return "down";
    return "same";
  };

  return (
    <div className="animate-rise shadow-panel overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-4 md:px-6 md:py-5">
        <h2 className="text-xl font-medium text-text md:text-2xl">
          Shopper simulator
        </h2>
        <p className="mt-1 text-[13px] text-muted md:text-[14px]">
          Live Discovery results for{" "}
          <span className="font-medium text-accent">“necklace”</span> — compare
          generic vs personalised ranking by shopper type.
        </p>
      </div>

      {/* Desktop controls */}
      <div className="hidden flex-wrap items-center justify-between gap-4 border-b border-border bg-surface-2/40 px-6 py-4 md:flex">
        <Segmented>
          {personas.map((p) => (
            <SegButton
              key={p.persona_id}
              active={activePersona === p.persona_id}
              onClick={() => selectPersona(p.persona_id)}
            >
              {p.display_name}
            </SegButton>
          ))}
        </Segmented>

        <div className="flex flex-wrap items-center gap-3">
          <Segmented>
            <span className="caption cursor-default px-3 py-2 pl-3.5 text-faint">
              Layout
            </span>
            <SegButton
              active={layoutMode === "compare"}
              accent
              onClick={() => setLayoutMode("compare")}
            >
              Side by side
            </SegButton>
            <SegButton
              active={layoutMode === "single"}
              onClick={() => setLayoutMode("single")}
            >
              Single view
            </SegButton>
          </Segmented>

          {layoutMode === "single" && (
            <Segmented>
              <span className="caption cursor-default px-3 py-2 pl-3.5 text-faint">
                State
              </span>
              {(["before", "after"] as const).map((state) => (
                <SegButton
                  key={state}
                  active={displayState === state}
                  accent={state === "after"}
                  onClick={() => setDisplayState(state)}
                >
                  <span className="capitalize">{state}</span>
                </SegButton>
              ))}
            </Segmented>
          )}
        </div>
      </div>

      {/* Mobile controls */}
      <div className="space-y-3 border-b border-border bg-surface-2/40 px-4 py-3 md:hidden">
        <MobileControlRow label="Shopper">
          <Segmented>
            {personas.map((p) => (
              <SegButton
                key={p.persona_id}
                active={activePersona === p.persona_id}
                onClick={() => selectPersona(p.persona_id)}
              >
                {p.display_name}
              </SegButton>
            ))}
          </Segmented>
        </MobileControlRow>
        <MobileControlRow label="State">
          <Segmented>
            {(["before", "after"] as const).map((state) => (
              <SegButton
                key={state}
                active={displayState === state}
                accent={state === "after"}
                onClick={() => setDisplayState(state)}
              >
                <span className="capitalize">{state}</span>
              </SegButton>
            ))}
          </Segmented>
        </MobileControlRow>
      </div>

      {personaObj && <PersonaStrip persona={personaObj} />}

      <div className="px-4 pt-4 text-[13px] text-muted md:px-6 md:text-[14px]">
        <p>
          <span className="font-semibold text-text">Before</span>: generic
          ranking —{" "}
          <span className="font-semibold text-text">After</span>: personalised
          results following Doctor recommendations.
        </p>
        {personaObj && layoutMode === "single" && (
          <p className="mt-1.5 text-[12px] text-faint md:text-[13px]">
            {displayState === "before"
              ? personaObj.plp_before_state
              : personaObj.plp_after_state}
          </p>
        )}
      </div>

      <span className="sr-only">{BANNER}</span>

      {layoutMode === "compare" ? (
        <div
          className={`grid gap-4 px-4 pb-2 pt-5 transition-opacity md:grid-cols-2 md:px-6 ${
            isLoading ? "opacity-60" : "opacity-100"
          }`}
        >
          <CompareColumn
            title="Before"
            subtitle="Generic ranking"
            products={before.slice(0, COMPARE_LIMIT)}
            displayState="before"
          />
          <CompareColumn
            title="After"
            subtitle="Personalised for this shopper"
            products={after.slice(0, COMPARE_LIMIT)}
            displayState="after"
            rankChangeFor={rankChangeFor}
            highlight
          />
        </div>
      ) : (
        <div
          className={`grid grid-cols-2 gap-3 px-4 pb-2 pt-5 transition-opacity md:grid-cols-4 md:gap-4 md:px-6 ${
            isLoading ? "opacity-60" : "opacity-100"
          }`}
        >
          {products.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 animate-pulse rounded-xl border border-border bg-tile"
                />
              ))
            : products.slice(0, GRID_LIMIT).map((product, i) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  displayState={displayState}
                  rankChange={rankChangeFor(product)}
                  index={i}
                />
              ))}
        </div>
      )}

      <div className="mx-4 flex flex-col gap-1 border-t border-border py-3 text-[11px] text-faint md:mx-6 md:flex-row md:flex-wrap md:justify-between md:gap-2 md:py-4 md:text-[12px]">
        <span>↑ moved up vs. Before</span>
        <span>
          {layoutMode === "compare" || displayState === "after"
            ? "After reflects personalised boost rules"
            : "Boost rules inactive"}
        </span>
      </div>
    </div>
  );
}

function MobileControlRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="caption mb-1.5 text-faint">{label}</p>
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5">{children}</div>
    </div>
  );
}

function CompareColumn({
  title,
  subtitle,
  products,
  displayState,
  rankChangeFor,
  highlight,
}: {
  title: string;
  subtitle: string;
  products: DiscoveryProduct[];
  displayState: DemoState;
  rankChangeFor?: (product: DiscoveryProduct) => RankChange;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-accent/30 bg-accent-soft/20"
          : "border-border bg-surface-2/30"
      }`}
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-lg font-medium text-text">{title}</h3>
          <p className="text-[12px] text-muted">{subtitle}</p>
        </div>
        {highlight && (
          <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
            Personalised
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {products.map((product, i) => (
          <ProductCard
            key={product.product_id}
            product={product}
            displayState={displayState}
            rankChange={rankChangeFor?.(product)}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

function Segmented({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex w-max max-w-full items-center rounded-xl border border-border bg-surface p-1 md:rounded-[11px]">
      {children}
    </div>
  );
}

function SegButton({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass = accent
    ? "bg-accent text-accent-ink"
    : "bg-surface text-text shadow-sm";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-medium transition-colors md:px-4 md:py-[7px] md:text-[13px] ${
        active ? activeClass : "text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function PersonaStrip({ persona }: { persona: Persona }) {
  return (
    <div className="mx-4 mt-4 flex items-center gap-4 rounded-xl border border-accent/20 bg-accent-soft/60 px-4 py-4 md:mx-6">
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-navy text-lg font-semibold text-white">
        {persona.display_name.charAt(0)}
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-text">
          {persona.display_name}{" "}
          <span className="font-normal text-muted">
            · {persona.archetype_name}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <PersonaChip ok={persona.bruid_present}>
            {persona.bruid_present ? "BRUID present" : "No BRUID"}
          </PersonaChip>
          <PersonaChip>{persona.segment_name}</PersonaChip>
          <PersonaChip>
            {persona.session_count} sessions · {persona.page_views} views
          </PersonaChip>
        </div>
      </div>
    </div>
  );
}

function PersonaChip({
  children,
  ok,
}: {
  children: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
        ok
          ? "bg-green/10 text-green"
          : "bg-surface text-muted ring-1 ring-border"
      }`}
    >
      {children}
    </span>
  );
}

export default ShopperSimulator;
