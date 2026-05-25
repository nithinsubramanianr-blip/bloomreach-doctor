# Handoff: 006 React PLP — Architect → Dev

**Date:** 2026-05-25 (revised from 2026-05-22)
**From:** Architect
**To:** Dev
**Spec:** specs/006-react-plp/ (renamed from 006-nextjs-plp; framework swapped to React/Vite)
**Branch:** stay on `feature/react-app` (do not commit, do not create new branches)

## What was designed

React + Vite + TypeScript single-page app. M5 PLP mounted at route `/`; M4 dashboard mounted at `/doctor` — **one Vite app, one dev server, one build**. Persona dropdown clears/sets `_br_uid_2` cookie. Before/After toggle switches cache entry (no re-fetch). `resultCache.ts` is the shared singleton between M4 and M5 (now a true in-memory singleton because both modules run in the same JS bundle). Never show empty grid.

The spec folder was renamed from `006-nextjs-plp/` to `006-react-plp/` on 2026-05-25.

## What Dev needs to implement

### Shared app root files to create (under `src/`)

| File | Key responsibility |
|---|---|
| `src/main.tsx` | `ReactDOM.createRoot`, wrap `<App />` in `<BrowserRouter>` from `react-router-dom` |
| `src/App.tsx` | Top-level `<Routes>`: `/` → `<PLPPage />`, `/doctor` → M4's `<App />` (`src/m4-dashboard/App.tsx`) |
| `src/index.css` | Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`) |
| `index.html` (project root) | Vite HTML entry with `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>` |
| `vite.config.ts` | `@vitejs/plugin-react`, port 5173 |
| `tsconfig.json` | Standard React + Vite TS config |
| `package.json` | Single root manifest; `dev`, `build`, `preview`, `test`, `test:e2e` scripts |

**Boundary with M4:** M4 already has its own root component (`src/m4-dashboard/App.tsx`). Spec 006 mounts it at `/doctor`. **Do not create a second Vite app.** Do not duplicate `main.tsx` inside `m4-dashboard/`. M4 contributes route components; the shared app shell is owned here.

### M5 module files to create (`src/m5-plp/`)

| File | Key responsibility |
|---|---|
| `pages/PLPPage.tsx` | Top-level route component for `/`. Owns `activePersonaId`, `displayState`, `products` state. Renders header + switcher + toggle + grid. Replaces former `app/page.tsx`. |
| `components/PersonaSwitcher.tsx` | Dropdown + cookie management |
| `components/ProductCard.tsx` | Product tile, "Personalised for you" badge, GBP price |
| `components/BeforeAfterToggle.tsx` | Pure toggle UI — no Discovery call |
| `components/ProductGrid.tsx` | Grid + skeleton state |
| `lib/resultCache.ts` | In-memory cache (300s TTL) + file fallback. **Singleton; imported by M4 too.** |
| `lib/discoveryClient.ts` | Discovery search with 2s `AbortController` timeout. Reads `import.meta.env.VITE_DISCOVERY_ENDPOINT`. |

### Routing setup
```tsx
// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import PLPPage from './m5-plp/pages/PLPPage';
import M4App from './m4-dashboard/App';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PLPPage />} />
      <Route path="/doctor" element={<M4App />} />
    </Routes>
  );
}
```

Add `react-router-dom` to dependencies.

### Cookie management (PersonaSwitcher.tsx)
```typescript
// Clear cookie (every switch, including switching TO Guest)
document.cookie = '_br_uid_2=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';

// Set cookie (Sarah and Alex only — NOT for Guest)
if (persona.bruid_value !== null) {
  document.cookie = `${persona.bruid_value}; path=/`;
}
```

### Env var
```
VITE_DISCOVERY_ENDPOINT=<discovery search url>
```
Read via `import.meta.env.VITE_DISCOVERY_ENDPOINT`. **Do not use `NEXT_PUBLIC_*` prefixes — Vite will not expose them.**

Update `.env.example` to rename `NEXT_PUBLIC_DISCOVERY_ENDPOINT` → `VITE_DISCOVERY_ENDPOINT`.

### resultCache.ts is the shared singleton
M4 `ShopperSimulator.tsx` imports the default export. Do NOT create a second cache. Export as singleton (module-level instance).

```typescript
// In M4's ShopperSimulator.tsx (already specced in 005):
import resultCache from '../../m5-plp/lib/resultCache';
```

Because M4 and M5 are now in the same JS bundle, the singleton is genuinely shared — no cross-app workaround needed.

### Fallback chain (never show empty grid)
```typescript
// 1. resultCache hit (not stale)? return it
// 2. call discoveryClient.search with 2s AbortController timeout
// 3. timeout or error? return resultCache.loadFromFile(persona, state)
//    loadFromFile reads data/cached-results/{persona}-{state}.json
//    (prefer static import of the 6 JSON files; alternative is fetch from public/)
```

### Tests to write (`tests/m5-plp/`)
- PersonaSwitcher: switching to Guest deletes `_br_uid_2` cookie
- PersonaSwitcher: switching to Sarah sets correct bruid_value cookie
- resultCache: returns file fallback when in-memory miss
- ProductGrid: "Personalised for you" badge on rank 1–3 in After state only
- ProductGrid: never renders empty — skeleton shown while loading
- Router: hitting `/` renders PLPPage; hitting `/doctor` renders M4 root
- `discoveryClient` reads `import.meta.env.VITE_DISCOVERY_ENDPOINT`

## Critical constraints (unchanged from v1)

- Guest persona: cookie MUST be deleted, not set to empty string
- Before/After toggle: NEVER triggers a Discovery call
- Grid never empty: file fallback is the last resort, always works
- TTL: 300s exactly
- Discovery call timeout: 2000ms via AbortController
- Currency: GBP (£) everywhere — never USD
- Three personas only: Guest, Sarah, Alex
- Demo query is hardcoded "necklace"

## New constraints from the framework swap

- **Pure SPA.** No SSR, no server components, no static export.
- **Single Vite app.** One `package.json`, one dev server (`npm run dev`), one build (`npm run build`).
- **React Router v6 (`react-router-dom`).** Do not introduce TanStack Router, wouter, or another router.
- **Env vars must be `VITE_*` prefixed** to be exposed to the client.
- **Do not break M4's existing module internals** — only mount its root component at `/doctor`.
- **Do not bootstrap Vite yet** — wait for human approval gate on these revised specs first. After approval, Dev runs `npm create vite@latest` (or equivalent) and wires up per this handoff.

## Dependency check
- 001 ✅ (impl ✅), 002 ✅ approved
- 005 architecture-spec patched 2026-05-25 (clarifying shared-app boundary; M4 internals unaffected)
- 006 requirements-spec, architecture-spec, design-spec → **status: draft (revised 2026-05-25), awaiting human approval gate**
- Branch: `feature/react-app` (stay here, no new branches)
