---
feature: React PLP
spec_id: "006"
phase: implementation
owner: Dev
status: approved
implemented-on: 2026-05-25
version: "1.0"
branch: feature/react-app
---

# Implementation Spec — React PLP (006 / M5)

> Shared Vite app shell + M5 PLP module. M4 dashboard route serves a small placeholder until spec 005 is implemented in a later round.

## Files Built

### Shared Vite root (single app for M4 + M5)

| File | Purpose |
|---|---|
| `index.html` | Vite HTML entry with `<div id="root">` + module script |
| `vite.config.ts` | React plugin, dev server on port 5173, build → `dist/` |
| `tsconfig.json` | Strict TS, target ES2020, jsx react-jsx, moduleResolution Bundler |
| `tsconfig.node.json` | Composite project for `vite.config.ts` |
| `tailwind.config.js` | Content scan over `index.html` + `src/**/*.{ts,tsx,js,jsx}`. PPD palette under `theme.extend.colors.ppd.*` |
| `postcss.config.js` | tailwindcss + autoprefixer |
| `src/main.tsx` | `ReactDOM.createRoot` + `<BrowserRouter><App /></BrowserRouter>` |
| `src/App.tsx` | `<Routes>` for `/` → PLPPage, `/doctor` → DashboardPlaceholder, `*` → PLPPage |
| `src/index.css` | `@tailwind base/components/utilities` + design-token CSS variables |
| `src/vite-env.d.ts` | `import.meta.env.VITE_DISCOVERY_ENDPOINT` typings |

### M5 module — `src/m5-plp/`

| File | Purpose |
|---|---|
| `pages/PLPPage.tsx` | Route `/`. Owns `activePersonaId`, `displayState`, `products`. Fetches via resultCache → discoveryClient → file fallback. Hardcoded query `"necklace"`. |
| `pages/DashboardPlaceholder.tsx` | Stub for `/doctor` route until spec 005 is implemented. Navy banner + link back to `/`. |
| `components/PersonaSwitcher.tsx` | Dropdown of 3 personas. Owns `_br_uid_2` cookie lifecycle: always clears, sets only when `bruid_value !== null`. Exports `applyPersonaCookie` for reuse. |
| `components/BeforeAfterToggle.tsx` | Pure UI. NEVER triggers Discovery. Two buttons with `aria-pressed`. |
| `components/ProductCard.tsx` | Tile with image fallback, GBP price (`£{n.toFixed(2)}`), badge ONLY when `displayState === 'after' && rankPosition <= 3`. |
| `components/ProductGrid.tsx` | 2-col mobile / 4-col desktop grid. `products === null` → 8 skeletons. `products === []` → 8 skeletons + `console.warn` (never empty). |
| `lib/resultCache.ts` | Singleton 300s TTL cache. `get/set/isStale/loadFromFile/clear`. Static-imports the six `data/cached-results/*.json` files; layers in-code `SAMPLE_FALLBACK_PRODUCTS` so loadFromFile is guaranteed non-empty regardless of JSON placeholders. Exports `TTL_MS` and `createResultCache` factory. |
| `lib/discoveryClient.ts` | `search(query, bruid, signal, timeoutMs=2000)` using `import.meta.env.VITE_DISCOVERY_ENDPOINT`. Merges caller signal + internal AbortController. Sends BRUID as `X-BR-UID-2` header + `_br_uid_2` query param. Throws if endpoint unset or response non-OK. |

### Tests — `tests/m5-plp/`

| File | Coverage |
|---|---|
| `PersonaSwitcher.test.tsx` | (a) Sarah sets `_br_uid_2=sarah-gifting-demo-001`. (b) Alex sets `_br_uid_2=alex-highvalue-demo-002`. (c) Switching TO Guest **deletes** the cookie (not empty string — `getCookieValue` returns `null`). (d) `applyPersonaCookie` helper round-trip. |
| `resultCache.test.ts` | Set/get round-trip, isStale logic, TTL constant === 300000ms, stale-after-TTL, **loadFromFile returns non-empty on in-memory miss**, After-state Sarah products carry `gift_eligible`, isolated instance contract via `createResultCache`. |
| `ProductGrid.test.tsx` | 8 skeleton cards on `null`, 8 skeletons + warn on `[]` (never empty), N cards on populated, **badge on rank 1–3 in After only**, not in Before. |
| `BeforeAfterToggle.test.tsx` | onChange fires `'after'`/`'before'`. `aria-pressed` reflects state. |

## Test Summary

```
Test Suites: 7 passed, 7 total
Tests:       100 passed, 100 total
Time:        ~0.6s
```

- 4 M5 test files / 20 M5 tests — all pass.
- All 80 pre-existing tests (C5 + M1 + M2) still pass.
- Run via `npm test` (uses configured multi-project Jest config; unchanged).

## Build Summary

`npx vite build` (or `npm run build`):

```
✓ 49 modules transformed
dist/index.html                   0.42 kB │ gzip:  0.28 kB
dist/assets/index-*.css          10.21 kB │ gzip:  2.95 kB
dist/assets/index-*.js          181.17 kB │ gzip: 58.47 kB
✓ built in ~500ms
```

## Decisions Made (not pre-specified)

1. **`package.json` scripts added.** Inserted only the three non-conflicting entries `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"` alongside existing `"test": "jest"`. No dependency changes.
2. **Sample fallback products embedded in `resultCache.ts`.** The six `/data/cached-results/*.json` files currently have `"products": []` placeholders. To satisfy invariant FR-006-20 ("never show empty grid") in any environment, `loadFromFile` falls back to an in-code `SAMPLE_FALLBACK_PRODUCTS` map keyed by `persona × state` (8 GBP products each, sourced from `data/products.json`). When the JSON files are populated with real Discovery results, that data is preferred automatically.
3. **`*` catch-all route → PLPPage.** Design spec called this optional; I wired it to PLPPage so deep-linking can't 404 during the demo.
4. **`X-BR-UID-2` header + `_br_uid_2` query param.** Discovery's exact BRUID transport isn't specified in 002 yet, so the client sends both. Cookie is also forwarded via `credentials: 'include'`. M1's normaliser will own the final shape when live integration lands.
5. **`BeforeAfterToggle.test.tsx` uses `getAttribute('aria-pressed')` instead of `toHaveAttribute`.** Jest config's `setupFilesAfterEach` key is invalid (Jest warns), so `@testing-library/jest-dom` matchers aren't auto-loaded. I was instructed NOT to touch jest config, so the test sidesteps the matcher and uses the vanilla DOM API. All M5 assertions therefore use built-in matchers; no jest-dom dependency at runtime.
6. **`DashboardPlaceholder.tsx`** owned by M5 spec rather than M4, per orchestrator brief — does NOT import from `src/m4-dashboard/`. When 005 ships, swap to `src/m4-dashboard/App` in `src/App.tsx`.

## Constraints Verified

- [x] Guest persona cookie is DELETED, not empty string (`PersonaSwitcher.test.tsx` line confirms `getCookieValue` returns `null` after switch to Guest).
- [x] Before/After toggle is purely UI — `BeforeAfterToggle.tsx` has no network code, only `onChange`.
- [x] Grid never empty — `ProductGrid` renders skeletons on `null` AND on `[]`. `resultCache.loadFromFile` guarantees non-empty products.
- [x] TTL is 300 seconds (`TTL_MS === 300 * 1000`, asserted in test).
- [x] Discovery timeout is 2000ms via AbortController (configurable param, default 2000).
- [x] GBP throughout (`£{price.toFixed(2)}`, all sample products `currency: 'GBP'`).
- [x] Three personas only — sourced from `data/personas.json`.
- [x] Demo query `"necklace"` hardcoded in `PLPPage.tsx`.
- [x] `VITE_DISCOVERY_ENDPOINT` read via `import.meta.env`.
- [x] Single Vite app, single dev server, single build.
- [x] React Router v6 (`react-router-dom`).
- [x] No SSR. Pure SPA.
- [x] No import from `src/m4-dashboard/` (doesn't exist yet).
- [x] No edits to `package.json` deps / `jest.config.js` / `jest.setup.js` / `jest.styleMock.js` / `CLAUDE.md`.

## Open Issues

1. **`/data/cached-results/*.json` placeholders are empty.** Owned by C5/spec 001. Once populated with real Discovery results, the in-code `SAMPLE_FALLBACK_PRODUCTS` becomes a deeper safety net but is no longer the primary fallback shown to users.
2. **`.env.example` still says `NEXT_PUBLIC_DISCOVERY_ENDPOINT`.** Not in this spec's scope to touch (no instruction in the orchestrator brief), but the architect spec calls it out for renaming. Flagging for the orchestrator to dispatch.
3. **`jest.config.js` `setupFilesAfterEach` option is unrecognised** (Jest warns). The correct key is `setupFilesAfterEach` — actually Jest's valid key is `setupFilesAfterEach`… in practice, jest-dom matchers don't load. M5 tests work around it. Flagging for the orchestrator; out of scope to fix per instructions.
4. **Spec 005 hand-off.** When M4 dashboard lands, swap `DashboardPlaceholder` in `src/App.tsx` for `src/m4-dashboard/App`. `src/m5-plp/lib/resultCache.ts` is already exported as a default singleton ready for M4's `ShopperSimulator` to import.
