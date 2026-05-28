import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  DataSource,
  DemoState,
  DimensionId,
  DimensionObject,
  DiscoverySearchResult,
  FixObject,
  PersonaId,
  PRSStateFile,
  Persona,
  Product,
  Segment,
} from "@/lib/contracts";
import { prsFileForState } from "@/lib/contracts";

/**
 * Server-only loader for the C5 synthetic data layer (`/data/*.json`).
 *
 * This is the single place that touches the JSON files on disk. M1 clients call
 * these loaders for their synthetic fallback path. Files are read at request
 * time (no build-time bundling) so editing /data needs no rebuild. Results are
 * memoised per-process since the synthetic data is immutable during a run.
 */

const DATA_DIR = path.join(process.cwd(), "data");

const cache = new Map<string, unknown>();

async function readJson<T>(relativePath: string): Promise<T> {
  if (cache.has(relativePath)) {
    return cache.get(relativePath) as T;
  }
  const full = path.join(DATA_DIR, relativePath);
  const raw = await fs.readFile(full, "utf8");
  const parsed = JSON.parse(raw) as T;
  cache.set(relativePath, parsed);
  return parsed;
}

/** Loads prs_pre_fix.json ('before') or prs_post_fix.json ('after'). */
export async function loadPRSState(state: DemoState): Promise<PRSStateFile> {
  return readJson<PRSStateFile>(`prs_${prsFileForState(state)}.json`);
}

/** Returns the raw dimension object for one dimension in the given state. */
export async function loadRawDimension(
  state: DemoState,
  dimensionId: DimensionId
): Promise<DimensionObject> {
  const prs = await loadPRSState(state);
  const dimension = prs.dimensions.find((d) => d.dimension_id === dimensionId);
  if (!dimension) {
    throw new Error(
      `synthetic-loader: dimension "${dimensionId}" not found in ${state} state`
    );
  }
  return dimension;
}

export async function loadPersonas(): Promise<Persona[]> {
  const data = await readJson<{ personas: Persona[] }>("personas.json");
  return data.personas;
}

export async function loadProducts(): Promise<Product[]> {
  const data = await readJson<{ products: Product[] }>("products.json");
  return data.products;
}

/**
 * Loads the REAL Bloomreach product catalogue (data/catalog.json), harvested
 * from the `bounteous_fashion_jewellery_product` catalog via the loomi MCP.
 * This is the live source the PLP / Shopper Simulator render. Same shape as
 * loadProducts(), so it is a drop-in replacement for the synthetic catalogue.
 */
export async function loadCatalog(): Promise<Product[]> {
  const data = await readJson<{ products: Product[] }>("catalog.json");
  return data.products;
}

export async function loadSegments(): Promise<Segment[]> {
  const data = await readJson<{ segments: Segment[] }>("segments.json");
  return data.segments;
}

export async function loadFixCatalogue(): Promise<FixObject[]> {
  const data = await readJson<{ fixes: FixObject[] }>("fix_catalogue.json");
  return data.fixes;
}

// ---------------------------------------------------------------------------
// loomi-snapshot.json — the REAL, MCP-harvested diagnosis source.
//
// This is the live diagnosis feed for the three MCP-sourced dimensions
// (AutoSegment coverage, signal freshness, A/B coverage) and the three demo
// personas. Harvested from the wobbly-donkey Engagement project via the loomi
// MCP — not fabricated. The two Discovery dimensions (BRUID, rule conflicts)
// are NOT in here; they stay as placeholders in prs_pre_fix.json until wired.
// ---------------------------------------------------------------------------

interface LoomiSnapshot {
  _meta: { harvested_at: string };
  diagnosis: {
    autosegment_coverage: { raw_value: number; segmentations_count: number };
    ab_test_coverage: { raw_value: number; experiments_count: number };
    signal_freshness: {
      freshness_figure: number;
      total_customers: number;
      active_customers_last_30d: number;
      active_customers_last_90d: number;
      most_recent_event_days_ago: number;
    };
    recommendation_engines: {
      engines_count: number;
      engines_wired_to_catalog: number;
      catalog: { item_count: number };
    };
  };
  demo_personas: LoomiPersona[];
}

interface LoomiPersona {
  role: string;
  would_be_segment: string;
  display_name?: string;
  customer_id: string;
  identifier: string;
  location?: string;
  total_events: number;
  purchases: number;
  key_events: string[];
  rationale: string;
}

/** persona_id (app) -> demo_personas[].role (snapshot). */
const PERSONA_ROLE: Record<PersonaId, string> = {
  guest: "new_low_signal_prospect",
  sarah: "gifting",
  alex: "high_value_returning",
};

export async function loadLoomiSnapshot(): Promise<LoomiSnapshot> {
  return readJson<LoomiSnapshot>("loomi-snapshot.json");
}

const statusFor = (score: number): "critical" | "warning" | "healthy" =>
  score <= 8 ? "critical" : score <= 14 ? "warning" : "healthy";

const round20 = (raw: number): number =>
  Math.max(0, Math.min(20, Math.round(raw * 20)));

/**
 * Builds a raw dimension object for one of the three MCP-sourced dimensions
 * straight from loomi-snapshot.json, ready for normaliseDimension(raw, false).
 * Throws for the two Discovery dimensions — those are not in the snapshot.
 */
export async function loomiRawDimension(
  dimensionId: DimensionId
): Promise<DimensionObject> {
  const snap = await loadLoomiSnapshot();
  const d = snap.diagnosis;
  const ts = snap._meta.harvested_at;

  const make = (
    raw: number,
    name: string,
    source: DataSource,
    label: string,
    target: number,
    targetLabel: string
  ): DimensionObject => {
    const score = round20(raw);
    return {
      dimension_id: dimensionId,
      dimension_name: name,
      raw_value: raw,
      raw_label: label,
      normalised_score: score,
      max_score: 20,
      status: statusFor(score),
      data_source: source,
      target_value: target,
      target_label: targetLabel,
      is_synthetic: false,
      timestamp: ts,
    };
  };

  switch (dimensionId) {
    case "autosegment_coverage":
      return make(
        d.autosegment_coverage.raw_value,
        "AutoSegment Coverage",
        "marketing_mcp",
        `${d.autosegment_coverage.segmentations_count} segmentations exist — ${Math.round(
          d.autosegment_coverage.raw_value * 100
        )}% AutoSegment coverage (MCP-harvested)`,
        0.75,
        "75% target"
      );
    case "signal_freshness": {
      const sf = d.signal_freshness;
      const recency =
        sf.most_recent_event_days_ago === 0
          ? "today"
          : `${sf.most_recent_event_days_ago}d ago`;
      return make(
        sf.freshness_figure,
        "Signal Freshness",
        "marketing_mcp",
        `${Math.round(sf.freshness_figure * 100)}% of customers active in last 90 days (${sf.active_customers_last_90d.toLocaleString()} of ${sf.total_customers.toLocaleString()}); ${sf.active_customers_last_30d.toLocaleString()} in 30 days; most recent event ${recency} (MCP-harvested)`,
        0.8,
        "80% target"
      );
    }
    case "ab_test_coverage":
      return make(
        d.ab_test_coverage.raw_value,
        "A/B Test Coverage",
        "analytics_mcp",
        `${d.ab_test_coverage.experiments_count} experiments configured — ${Math.round(
          d.ab_test_coverage.raw_value * 100
        )}% A/B coverage (MCP-harvested)`,
        0.6,
        "60% target"
      );
    default:
      throw new Error(
        `loomiRawDimension: "${dimensionId}" is not an MCP-sourced dimension (no snapshot data)`
      );
  }
}

/**
 * A one-paragraph summary of the real MCP findings the Doctor can cite. Pulled
 * verbatim from the harvested counts — nothing invented; 0 shown where it is 0.
 */
export async function loomiFindings(): Promise<string> {
  const { diagnosis: d } = await loadLoomiSnapshot();
  const sf = d.signal_freshness;
  return [
    `${d.autosegment_coverage.segmentations_count} segmentations exist (AutoSegment coverage 0%)`,
    `${d.ab_test_coverage.experiments_count} experiments / A/B tests configured (A/B coverage 0%)`,
    `${sf.active_customers_last_90d.toLocaleString()} of ${sf.total_customers.toLocaleString()} customers active in the last 90 days (${sf.active_customers_last_30d.toLocaleString()} in 30 days); most recent event ${
      sf.most_recent_event_days_ago === 0 ? "today" : `${sf.most_recent_event_days_ago}d ago`
    }`,
    `${d.recommendation_engines.engines_count} recommendation engines, none wired to the ${d.recommendation_engines.catalog.item_count}-item product catalog`,
  ].join("; ");
}

/**
 * Real active-shopper context for a persona, sourced from loomi-snapshot.json:
 * the actual customer behind the persona, their real events, and which segment
 * they WOULD fall into once segments exist.
 */
export async function loomiPersonaContext(
  personaId: PersonaId
): Promise<string | undefined> {
  const role = PERSONA_ROLE[personaId];
  const { demo_personas } = await loadLoomiSnapshot();
  const p = demo_personas.find((dp) => dp.role === role);
  if (!p) return undefined;
  // Use the friendly display name in the answer — never the sandbox email.
  const who = p.display_name ?? "this shopper";
  return `Real shopper ${who}${
    p.location ? ` (${p.location})` : ""
  } — ${p.total_events} events, ${p.purchases} purchase(s); would fall into segment "${p.would_be_segment}" once segments exist. Real events: ${p.key_events.join(
    "; "
  )}. ${p.rationale}`;
}

/**
 * Loads a pre-populated cached Discovery result, if one exists with products.
 * The shipped placeholders carry `products: []`; callers treat an empty array
 * as "not populated" and fall back to a generated synthetic ranking.
 */
export async function loadCachedResult(
  personaId: string,
  state: DemoState
): Promise<DiscoverySearchResult | null> {
  try {
    const data = await readJson<DiscoverySearchResult & { products: unknown[] }>(
      path.join("cached-results", `${personaId}-${state}.json`)
    );
    if (Array.isArray(data.products) && data.products.length > 0) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}
