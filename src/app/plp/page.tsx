import { searchProducts } from "@/m1-bloomreach/discovery-client";
import { loadPersonas } from "@/m1-bloomreach/synthetic-loader";
import { PLPClient } from "@/m5-plp/PLPClient";

/**
 * M5 PLP route (/plp). Server Component: pre-fetches personas and the Guest /
 * Before result set on the server (ADR-006-4), then hands off to the client
 * component for persona switching and Before/After toggling.
 */
export default async function PLPPage() {
  const [personas, initial] = await Promise.all([
    loadPersonas(),
    searchProducts("necklace", "guest", "before"),
  ]);

  return (
    <PLPClient personas={personas} initialProducts={initial.products} />
  );
}
