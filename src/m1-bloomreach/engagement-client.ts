import "server-only";

import type { DemoState, DimensionObject, Persona, Segment } from "@/lib/contracts";
import { isLive } from "@/lib/env";
import { normaliseDimension } from "./normaliser";
import {
  loadPersonas,
  loadRawDimension,
  loadSegments,
  loomiRawDimension,
} from "./synthetic-loader";

/**
 * Engagement client — persona behavioural profiles, segment status, and the
 * three Engagement-measured PRS dimensions (Segment Definition Quality,
 * Profile Completeness, Behavioral Signal Richness). The pre-fix ("before")
 * state is sourced from loomi-snapshot.json (harvested live from the
 * wobbly-donkey Engagement project via the loomi MCP), normalised with
 * is_synthetic=false. The post-fix ("after") state is the synthetic projected
 * target from prs_post_fix.json.
 *
 * Auth (live mode): BLOOMREACH_ENGAGEMENT_API_KEY.
 */

export async function fetchSegmentDefinitionQuality(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (state === "before") {
    return normaliseDimension(
      await loomiRawDimension("segment_definition_quality"),
      false
    );
  }
  return normaliseDimension(
    await loadRawDimension(state, "segment_definition_quality"),
    true
  );
}

export async function fetchProfileCompleteness(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (state === "before") {
    return normaliseDimension(
      await loomiRawDimension("profile_completeness"),
      false
    );
  }
  return normaliseDimension(
    await loadRawDimension(state, "profile_completeness"),
    true
  );
}

export async function fetchBehavioralSignalRichness(
  state: DemoState = "before"
): Promise<DimensionObject> {
  if (state === "before") {
    return normaliseDimension(
      await loomiRawDimension("behavioral_signal_richness"),
      false
    );
  }
  return normaliseDimension(
    await loadRawDimension(state, "behavioral_signal_richness"),
    true
  );
}

export async function fetchPersonaProfiles(): Promise<Persona[]> {
  if (!isLive()) {
    console.log("[m1-bloomreach] engagement-client using synthetic fallback");
    return loadPersonas();
  }
  try {
    // TODO(live): call Engagement API for persona profiles.
    return loadPersonas();
  } catch {
    console.log("[m1-bloomreach] engagement-client using synthetic fallback");
    return loadPersonas();
  }
}

export interface SegmentStatusResult {
  segments: Segment[];
  total_active: number;
}

export async function fetchSegmentStatus(): Promise<SegmentStatusResult> {
  const load = async (): Promise<SegmentStatusResult> => {
    const segments = await loadSegments();
    return {
      segments,
      total_active: segments.filter((s) => s.is_active).length,
    };
  };

  if (!isLive()) {
    console.log("[m1-bloomreach] engagement-client using synthetic fallback");
    return load();
  }
  try {
    // TODO(live): call Engagement API for segment status.
    return load();
  } catch {
    console.log("[m1-bloomreach] engagement-client using synthetic fallback");
    return load();
  }
}
