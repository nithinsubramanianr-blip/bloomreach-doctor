---
feature: React PLP
spec_id: "006"
phase: design
owner: Architect
status: approved
revised: 2026-05-25
revision-reason: Framework swap from Next.js to React/Vite per human decision
approved-on: 2026-05-25
version: "2.0"
---

# Design Spec — React PLP (006 / M5)

> Folder renamed from `specs/006-nextjs-plp/` to `specs/006-react-plp/` on 2026-05-25. Implementation is React + Vite + TypeScript inside a shared Vite app (also hosts M4 at `/doctor`).

## Shared App Entry

### src/main.tsx
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css'; // Tailwind directives

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

### src/App.tsx
```typescript
import { Routes, Route } from 'react-router-dom';
import PLPPage from './m5-plp/pages/PLPPage';
import DashboardPage from './m4-dashboard/App'; // M4 root, spec 005

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PLPPage />} />
      <Route path="/doctor" element={<DashboardPage />} />
    </Routes>
  );
}
```

### vite.config.ts (sketch)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

### index.html
Standard Vite HTML with `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`.

## M5 Component Props

### PLPPage.tsx (replaces former `app/page.tsx`)
```typescript
// No props — top-level route component.
// On mount: load Guest/Before from cache fallback chain.
// Owns local state: activePersonaId, displayState ('before' | 'after'), products, loading.
// Renders: <Header />, <PersonaSwitcher />, <BeforeAfterToggle />, <ProductGrid />.
```

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

### BeforeAfterToggle.tsx
```typescript
interface BeforeAfterToggleProps {
  value: 'before' | 'after';
  onChange: (value: 'before' | 'after') => void;
}
// Pure UI toggle. Never calls Discovery. Parent uses value to pick cache entry.
```

### ProductGrid.tsx
```typescript
interface ProductGridProps {
  products: DiscoveryProduct[] | null;  // null = loading
  displayState: 'before' | 'after';
}
// products === null → render 8 skeleton cards (bg-gray-200 animate-pulse)
// products === []   → render 8 skeleton cards + log warning (per Edge Cases)
// otherwise         → render ProductCard per item
```

## lib/resultCache.ts API
```typescript
interface CachedResult {
  products: DiscoveryProduct[];
  cached_at: number; // epoch ms
}

interface ResultCache {
  get(personaId: string, state: 'before' | 'after'): CachedResult | null;
  set(personaId: string, state: 'before' | 'after', result: CachedResult): void;
  isStale(personaId: string, state: 'before' | 'after'): boolean;  // true if > 300s old
  loadFromFile(personaId: string, state: 'before' | 'after'): CachedResult;  // reads data/cached-results/
}

const resultCache: ResultCache = createResultCache({ ttlSeconds: 300 });
export default resultCache;
```

The singleton is exported as the default and imported by both M5 (`PLPPage`) and M4 (`ShopperSimulator`). Because both modules now run in the same Vite bundle, the singleton is a true in-memory shared instance.

## lib/discoveryClient.ts API
```typescript
interface DiscoveryClientConfig {
  endpoint: string;   // import.meta.env.VITE_DISCOVERY_ENDPOINT
  timeoutMs: 2000;    // hard limit — if exceeded, caller uses cache
}

async function search(
  query: string,         // always "necklace"
  bruid: string | null,  // _br_uid_2 cookie value
  signal?: AbortSignal
): Promise<DiscoverySearchResult>

// Sends bruid in request header: X-BR-UID-2 (or query param per Discovery API spec)
// Returns DiscoverySearchResult (see 002 design-spec for schema)
```

## Fetch Flow (in PLPPage.tsx)
```typescript
async function fetchProducts(personaId: string, state: 'before' | 'after') {
  // 1. Check cache
  if (!resultCache.isStale(personaId, state)) {
    const hit = resultCache.get(personaId, state);
    if (hit) return hit;
  }

  // 2. Try live Discovery with 2s timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const result = await discoveryClient.search('necklace', getBRUID(), controller.signal);
    clearTimeout(timeout);
    resultCache.set(personaId, state, { products: result.products, cached_at: Date.now() });
    return result;
  } catch {
    clearTimeout(timeout);
    // 3. Fall back to file cache — never show empty grid
    return resultCache.loadFromFile(personaId, state);
  }
}
```

Invoke from `useEffect` on mount and on persona/state change:
```typescript
useEffect(() => {
  let cancelled = false;
  setProducts(null); // show skeletons
  fetchProducts(activePersonaId, displayState).then(r => {
    if (!cancelled) setProducts(r.products);
  });
  return () => { cancelled = true; };
}, [activePersonaId, displayState]);
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

When toggle flips, the `useEffect` above re-runs with the new `displayState`, which loads the corresponding cache entry (`{persona}-before` or `{persona}-after`).

## Header
```
Background: #1B3A5C (navy)
Content: "Kendra Scott" (left) | PersonaSwitcher dropdown (right)
Height: 64px
```

## Env Var
```
VITE_DISCOVERY_ENDPOINT=<discovery search url>
```
Read via `import.meta.env.VITE_DISCOVERY_ENDPOINT` inside `discoveryClient.ts`. Vite refuses to expose vars without the `VITE_` prefix.

## Edge Cases

- **Guest persona cookie:** On switch to Guest, delete the `_br_uid_2` cookie entirely. Setting it to `""` is not sufficient — explicitly expire it.
- **Re-render within 3s:** From persona switch to grid render must complete within 3 seconds (uses cache if needed).
- **Both states empty (before + after cache empty):** Render 8 skeleton cards. Log warning. Do not crash.
- **products.csv not matching products.json:** products.json is canonical. If Discovery returns a product_id not in products.json, render it with available fields.
- **Route mismatch:** Hitting an undefined route falls through to default `<PLPPage />` behaviour (or a 404 component if Dev chooses — not required).
- **Cross-route cache:** Navigating between `/` and `/doctor` does NOT clear the resultCache singleton (same JS runtime, same module instance).
