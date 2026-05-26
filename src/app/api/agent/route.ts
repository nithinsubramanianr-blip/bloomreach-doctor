import { NextResponse, type NextRequest } from "next/server";

import type { DemoState, PersonaId } from "@/lib/contracts";
import { handleQuery } from "@/m3-nl/query-handler";

const VALID_PERSONAS: readonly PersonaId[] = ["guest", "sarah", "alex"];

/**
 * POST /api/agent  body: { query: string, state?: "before" | "after" }
 *
 * Server-only NL agent boundary. The query is treated as untrusted: trimmed and
 * length-capped before use. (It is only matched against regexes and echoed back
 * — React escapes it on render — so there is no injection surface in the
 * synthetic path. The same sanitised value will feed the Claude prompt once
 * llm-explainer is wired.)
 */
export async function POST(request: NextRequest) {
  let body: { query?: unknown; state?: unknown; persona?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const query =
    typeof body.query === "string" ? body.query.trim().slice(0, 500) : "";
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const state: DemoState = body.state === "after" ? "after" : "before";
  const persona =
    typeof body.persona === "string" &&
    VALID_PERSONAS.includes(body.persona as PersonaId)
      ? (body.persona as PersonaId)
      : undefined;
  const response = await handleQuery(query, state, persona);
  return NextResponse.json(response);
}
