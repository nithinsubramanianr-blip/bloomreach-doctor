import { cookies } from "next/headers";

import { RULES_FLAG_COOKIE, parseRulesActive } from "@/lib/rules-flag";
import { searchProducts } from "@/m1-bloomreach/discovery-client";
import { loadPersonas } from "@/m1-bloomreach/synthetic-loader";
import { PLPClient } from "@/m5-plp/PLPClient";

/**
 * M5 PLP route (/plp). Server Component: reads the `rulesActive` flag from the
 * cookie (single source of truth) and pre-fetches the Guest result set for the
 * matching state. There is no before/after toggle — the page reflects whatever
 * the flag currently says, so flipping it (via fix approval) changes the page
 * on refresh. Reading the cookie opts this route into dynamic rendering.
 */
export default async function PLPPage() {
  const jar = await cookies();
  const rulesActive = parseRulesActive(jar.get(RULES_FLAG_COOKIE)?.value);
  const state = rulesActive ? "after" : "before";

  const [personas, initial] = await Promise.all([
    loadPersonas(),
    searchProducts("necklace", "guest", state),
  ]);

  return (
    <PLPClient
      personas={personas}
      initialProducts={initial.products}
      rulesActive={rulesActive}
    />
  );
}
