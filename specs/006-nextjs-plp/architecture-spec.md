---
feature: Next.js PLP
spec_id: "006"
phase: architecture
owner: Architect
status: approved
version: "1.0"
---

# Architecture Spec — Next.js PLP (006 / M5)

## Role in the System

M5 is the live product listing page. It is the visual proof that Option X (rule activation) changes real search results per persona. It is a separate Next.js App Router application that runs alongside the Vite M4 dashboard.

```
Browser
  │
  ├─ M4 Dashboard (Vite, port 5173) — Module B embeds result cache from M5
  │
  └─ M5 Next.js PLP (port 3000) — standalone page, persona dropdown in header
        │
        ├─ PersonaSwitcher ──► sets/clears _br_uid_2 cookie ──► triggers re-fetch
        ├─ BeforeAfterToggle ──► switches displayed cache entry
        └─ ProductGrid ──► renders DiscoveryProduct[]
              │
              └─ lib/resultCache.ts ──► lib/discoveryClient.ts ──► Discovery API
                                    └─ data/cached-results/ (fallback)
```

## Key Architectural Decisions

### ADR-006-1: resultCache.ts is the shared cache between M4 and M5
M4's `ShopperSimulator.tsx` imports `resultCache.ts` from M5. This is the single source of truth for all Discovery search results. Cache key: `{persona_id}-{state}`. TTL: 300s.

### ADR-006-2: BRUID is managed as a browser cookie, not React state
`PersonaSwitcher` uses `document.cookie` to clear `_br_uid_2` and set the new value. The cookie value comes from `personas.json` `bruid_value` field. For Guest, the cookie is deleted (not set to empty string).

### ADR-006-3: Before/After toggle does NOT call Discovery
The toggle switches which cache entry is displayed (`{persona}-before` vs `{persona}-after`). The before/after entries are populated by TA1 running two sets of Discovery calls — one with rules inactive, one with rules active. The toggle never triggers a new API call.

### ADR-006-4: App Router Server Component for initial render
`app/page.tsx` is a Server Component that pre-fetches the Guest Before state on first load. Client components handle persona switching and re-fetching.

### ADR-006-5: Never show empty grid
Fallback priority:
1. In-memory resultCache (300s TTL)
2. If miss or stale: call `discoveryClient.search()`
3. If Discovery latency > 2s: serve from `data/cached-results/{key}.json`
4. If Discovery fails entirely: serve from `data/cached-results/{key}.json`

## File Responsibilities

| File | Responsibility |
|---|---|
| app/page.tsx | Server component, initial render (Guest, Before state) |
| components/PersonaSwitcher.tsx | Dropdown UI, cookie management, re-fetch trigger |
| components/ProductCard.tsx | Single product tile with badge and price |
| lib/resultCache.ts | In-memory cache + file fallback. Shared with M4. |
| lib/discoveryClient.ts | Calls Discovery search API. Reads NEXT_PUBLIC_DISCOVERY_ENDPOINT. |
