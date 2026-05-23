import { NextResponse, type NextRequest } from "next/server";

import type { DemoState, PersonaId } from "@/lib/contracts";
import { searchProducts } from "@/m1-bloomreach/discovery-client";

/**
 * GET /api/discovery/search?persona=sarah&state=before&q=necklace
 *
 * Server-only Discovery search. In synthetic mode this returns a deterministic
 * ranking; the live Discovery call (added later) stays behind this boundary so
 * no API key or fetch ever runs in a client component. Uncached by default in
 * Next 16, so flipping `state` always returns fresh results.
 */

const VALID_PERSONAS: readonly PersonaId[] = ["guest", "sarah", "alex"];

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const persona = (sp.get("persona") ?? "guest") as PersonaId;
  const state: DemoState = sp.get("state") === "after" ? "after" : "before";
  const query = sp.get("q") ?? "necklace";

  if (!VALID_PERSONAS.includes(persona)) {
    return NextResponse.json(
      { error: `invalid persona: ${persona}` },
      { status: 400 }
    );
  }

  const result = await searchProducts(query, persona, state);
  return NextResponse.json(result);
}
