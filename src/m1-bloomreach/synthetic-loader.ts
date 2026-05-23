import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  DemoState,
  DimensionId,
  DimensionObject,
  DiscoverySearchResult,
  FixObject,
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

export async function loadSegments(): Promise<Segment[]> {
  const data = await readJson<{ segments: Segment[] }>("segments.json");
  return data.segments;
}

export async function loadFixCatalogue(): Promise<FixObject[]> {
  const data = await readJson<{ fixes: FixObject[] }>("fix_catalogue.json");
  return data.fixes;
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
