import "server-only";

import type { Persona, Segment } from "@/lib/contracts";
import { isLive } from "@/lib/env";
import { loadPersonas, loadSegments } from "./synthetic-loader";

/**
 * Engagement client — persona behavioural profiles and segment status.
 * Auth (live mode): BLOOMREACH_ENGAGEMENT_API_KEY.
 */

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
