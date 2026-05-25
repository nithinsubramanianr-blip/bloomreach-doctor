---
feature: React PLP
spec_id: "006"
phase: architecture
owner: Architect
status: approved
revised: 2026-05-25
revision-reason: Framework swap from Next.js to React/Vite per human decision
approved-on: 2026-05-25
version: "2.0"
---

# Architecture Spec — React PLP (006 / M5)

> Folder renamed from `specs/006-nextjs-plp/` to `specs/006-react-plp/` on 2026-05-25. Implementation is React + Vite + TypeScript.

## Role in the System

M5 is the live product listing page. It is the visual proof that Option X (rule activation) changes real search results per persona. M5 is mounted as the root route (`/`) of a **single shared Vite application** that also hosts M4 (mounted at `/doctor`).

```
Browser (Vite dev server, single port — default 5173)
  │
  └─ Shared React Router app
        │
        ├─ Route "/"          → M5 PLP (this spec)
        │     ├─ PersonaSwitcher ──► sets/clears _br_uid_2 cookie ──► triggers re-fetch
        │     ├─ BeforeAfterToggle ──► switches displayed cache entry
        │     └─ ProductGrid ──► renders DiscoveryProduct[]
        │           │
        │           └─ lib/resultCache.ts ──► lib/discoveryClient.ts ──► Discovery API
        │                                 └─ data/cached-results/ (fallback)
        │
        └─ Route "/doctor"    → M4 Dashboard (spec 005)
              └─ Module B (ShopperSimulator) imports the SAME resultCache.ts singleton
```

## Shared Vite App Boundary

| Concern | Owned by |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | Spec 006 (this spec) — single root config |
| `src/main.tsx` (ReactDOM root, BrowserRouter wrap) | Spec 006 |
| `src/App.tsx` (top-level layout + `<Routes>` declarations) | Spec 006 |
| `src/m5-plp/**` (PLP pages, components, lib) | Spec 006 |
| `src/m4-dashboard/**` (dashboard internals) | Spec 005 (unchanged) |
| Tailwind config / global CSS | Spec 006 (shared) |

There is exactly ONE `package.json`, ONE Vite config, ONE dev server, ONE production build. M4 and M5 are sibling modules inside the same app, distinguished by route.

## Key Architectural Decisions

### ADR-006-1: resultCache.ts is the shared cache between M4 and M5
M4's `ShopperSimulator.tsx` imports `resultCache` from `src/m5-plp/lib/resultCache`. This is the single source of truth for all Discovery search results. Cache key: `{persona_id}-{state}`. TTL: 300s. Because M4 and M5 now run in the same JS bundle, the cache singleton is naturally shared in-memory (no cross-app boundary).

### ADR-006-2: BRUID is managed as a browser cookie, not React state
`PersonaSwitcher` uses `document.cookie` to clear `_br_uid_2` and set the new value. The cookie value comes from `personas.json` `bruid_value` field. For Guest, the cookie is deleted (not set to empty string). `document.cookie` works identically in any React app — no Next-specific cookie helpers.

### ADR-006-3: Before/After toggle does NOT call Discovery
The toggle switches which cache entry is displayed (`{persona}-before` vs `{persona}-after`). The before/after entries are populated by TA1 running two sets of Discovery calls — one with rules inactive, one with rules active. The toggle never triggers a new API call.

### ADR-006-4: Client-side rendering only — no SSR
The previous architecture used a Next.js App Router Server Component to pre-fetch the Guest/Before state. This is replaced by a client-side effect in `PLPPage.tsx`: on mount, fetch Guest/Before via the cache + Discovery fallback chain. Skeleton cards render until first result arrives. No SSR, no hydration step.

### ADR-006-5: Never show empty grid
Fallback priority:
1. In-memory resultCache (300s TTL)
2. If miss or stale: call `discoveryClient.search()` with 2-second `AbortController` timeout
3. If timeout: serve from `data/cached-results/{key}.json` (loaded via static import or `fetch('/data/cached-results/...')`)
4. If Discovery fails entirely: same file fallback

### ADR-006-6: Routing library — React Router v6
React Router v6 (`react-router-dom`) is the chosen router. Rationale: ubiquitous, well-documented, declarative `<Routes>` API, no Next-specific knowledge required. The router is configured in `src/App.tsx`. Route definitions:

```tsx
<Routes>
  <Route path="/" element={<PLPPage />} />
  <Route path="/doctor" element={<DashboardPage />} />
</Routes>
```

### ADR-006-7: Env var prefix — VITE_DISCOVERY_ENDPOINT
Vite only exposes env vars prefixed with `VITE_` to client code (`import.meta.env.VITE_*`). The old `NEXT_PUBLIC_DISCOVERY_ENDPOINT` is renamed to `VITE_DISCOVERY_ENDPOINT`. `discoveryClient.ts` reads `import.meta.env.VITE_DISCOVERY_ENDPOINT`.

### ADR-006-8: Cached fallback files served via Vite public asset path
The `/data/cached-results/*.json` files are loaded by `resultCache.loadFromFile()`. Two viable options:
- **Preferred:** Static import (`import guestBefore from '../../../data/cached-results/guest-before.json'`) — bundled at build time, zero network roundtrip.
- **Alternative:** Copy `/data/cached-results/` into `public/cached-results/` and `fetch('/cached-results/guest-before.json')` at runtime.

Dev chooses; static import is simpler and faster. Either way, no Discovery call is made for fallbacks.

## File Responsibilities

### Shared app root (under `src/`)

| File | Responsibility |
|---|---|
| `src/main.tsx` | ReactDOM.createRoot, wraps `<App />` in `<BrowserRouter>` |
| `src/App.tsx` | Top-level layout, `<Routes>` declarations for `/` and `/doctor` |
| `index.html` | Vite HTML entry, mounts `<div id="root" />` |
| `vite.config.ts` | Vite config (React plugin, alias paths, port) |

### M5 module (`src/m5-plp/`)

| File | Responsibility |
|---|---|
| `pages/PLPPage.tsx` | Top-level React component for route `/`. Hosts header, persona switcher, before/after toggle, product grid. Replaces former `app/page.tsx`. |
| `components/PersonaSwitcher.tsx` | Dropdown UI, cookie management, re-fetch trigger |
| `components/ProductCard.tsx` | Single product tile with badge and price |
| `components/BeforeAfterToggle.tsx` | Toggle UI (no Discovery call) |
| `components/ProductGrid.tsx` | Grid layout + skeleton state |
| `lib/resultCache.ts` | In-memory cache + file fallback. **Shared with M4** (imported directly). |
| `lib/discoveryClient.ts` | Calls Discovery search API. Reads `import.meta.env.VITE_DISCOVERY_ENDPOINT`. 2s AbortController timeout. |

## What changed vs the Next.js architecture

| Concern | Old (Next.js) | New (React + Vite) |
|---|---|---|
| Apps | Two separate apps (M4 Vite, M5 Next) | One shared Vite app |
| Entry | `app/page.tsx` (server component) | `pages/PLPPage.tsx` (client component) + shared `src/main.tsx` |
| Routing | Next App Router file-based | React Router v6 declarative `<Routes>` |
| Rendering | Server-component initial render + client hydration | Pure client-side SPA |
| Env var | `NEXT_PUBLIC_DISCOVERY_ENDPOINT` | `VITE_DISCOVERY_ENDPOINT` |
| Dev command | `npm run dev:plp` (port 3000) | `npm run dev` (single port, shared with M4) |
| Cross-app cache sharing | M4 imported file from M5 across separate builds | M4 imports same module — single bundle, true singleton |

All other behaviours (cookie semantics, 2s timeout, 300s TTL, never-empty grid, persona dropdown options, GBP pricing, Before/After toggle semantics) are **unchanged**.
