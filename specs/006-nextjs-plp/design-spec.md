---
feature: Next.js PLP
spec_id: "006"
phase: design
owner: Architect
status: approved
version: "1.0"
---

# Design Spec — Next.js PLP (006 / M5)

## Component Props

### PersonaSwitcher.tsx
```typescript
interface PersonaSwitcherProps {
  personas: Persona[];
  activePersonaId: string;
  onChange: (personaId: string) => void;
}

// Dropdown options:
// "Guest (New Prospecting)"  → persona_id: 'guest',  bruid_value: null
// "Sarah — Gifting"          → persona_id: 'sarah',  bruid_value: '_br_uid_2=sarah-gifting-demo-001'
// "Alex — High Value Returning" → persona_id: 'alex', bruid_value: '_br_uid_2=alex-highvalue-demo-002'

// On change:
// 1. document.cookie = '_br_uid_2=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'  (clear)
// 2. if bruid_value !== null: document.cookie = `${bruid_value}; path=/`             (set)
// 3. call onChange(personaId) → triggers re-fetch in parent
```

### ProductCard.tsx
```typescript
interface ProductCardProps {
  product: DiscoveryProduct;
  rankPosition: number;
  displayState: 'before' | 'after';
}
// "Personalised for you" badge: shown when displayState==='after' AND rankPosition <= 3
// Price: always GBP (£{price})
// Image: product.image_url — on error render grey placeholder box
```

## lib/resultCache.ts API
```typescript
interface ResultCache {
  get(personaId: string, state: 'before' | 'after'): CachedResult | null;
  set(personaId: string, state: 'before' | 'after', result: CachedResult): void;
  isStale(personaId: string, state: 'before' | 'after'): boolean;  // true if > 300s old
  loadFromFile(personaId: string, state: 'before' | 'after'): CachedResult;  // reads data/cached-results/
}

const resultCache: ResultCache = createResultCache({ ttlSeconds: 300 });
export default resultCache;
```

## lib/discoveryClient.ts API
```typescript
interface DiscoveryClientConfig {
  endpoint: string;   // NEXT_PUBLIC_DISCOVERY_ENDPOINT
  timeoutMs: 2000;    // hard limit — if exceeded, caller uses cache
}

async function search(
  query: string,          // always "necklace"
  bruid: string | null,  // _br_uid_2 cookie value
  signal?: AbortSignal
): Promise<DiscoverySearchResult>

// Sends bruid in request header: X-BR-UID-2 (or query param per Discovery API spec)
// Returns DiscoverySearchResult (see 002 design-spec for schema)
```

## Fetch Flow (client component)
```typescript
async function fetchProducts(personaId: string, state: 'before' | 'after') {
  // 1. Check cache
  if (!resultCache.isStale(personaId, state)) {
    return resultCache.get(personaId, state);
  }

  // 2. Try live Discovery with 2s timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const result = await discoveryClient.search('necklace', getBRUID(), controller.signal);
    clearTimeout(timeout);
    resultCache.set(personaId, state, result);
    return result;
  } catch {
    clearTimeout(timeout);
    // 3. Fall back to file cache — never show empty grid
    return resultCache.loadFromFile(personaId, state);
  }
}
```

## Grid Layout
```
Desktop (1280px+): 4 columns — grid-cols-4
Mobile (768px):    2 columns — grid-cols-2  (out of scope but don't break)

Product card height: fixed at 280px
Skeleton card: same dimensions, bg-gray-200 animate-pulse
```

## Before/After Toggle
```typescript
// Toggle does NOT fetch — just switches displayed cache entry
// Label: "Before" (left) / "After" (right)
// Default state on page load: "Before"
// In "After" state: "Personalised for you" badge visible on products at rank 1–3
```

## Header
```
Background: #1B3A5C (navy)
Content: "Kendra Scott" (left) | PersonaSwitcher dropdown (right)
Height: 64px
```

## Edge Cases

- **Guest persona cookie:** On switch to Guest, delete the `_br_uid_2` cookie entirely. Setting it to `""` is not sufficient — explicitly expire it.
- **Re-render within 3s:** From persona switch to grid render must complete within 3 seconds (uses cache if needed).
- **Both states empty (before + after cache empty):** Render 8 skeleton cards. Log warning. Do not crash.
- **products.csv not matching products.json:** products.json is canonical. If Discovery returns a product_id not in products.json, render it with available fields.
