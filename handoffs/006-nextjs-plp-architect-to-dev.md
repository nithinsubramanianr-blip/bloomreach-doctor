# Handoff: 006 Next.js PLP — Architect → Dev

**Date:** 2026-05-22
**From:** Architect
**To:** Dev
**Spec:** specs/006-nextjs-plp/

## What was designed

Next.js App Router PLP. Persona dropdown clears/sets `_br_uid_2` cookie. Before/After toggle switches cache entry (no re-fetch). `resultCache.ts` is shared with M4 Module B. Never show empty grid.

## What Dev needs to implement

### Files to create (`src/m5-plp/`)

| File | Key responsibility |
|---|---|
| `app/page.tsx` | Server component, initial render — Guest/Before |
| `components/PersonaSwitcher.tsx` | Dropdown + cookie management |
| `components/ProductCard.tsx` | Product tile, "Personalised for you" badge, GBP price |
| `lib/resultCache.ts` | In-memory cache (300s TTL) + file fallback. **Exported and imported by M4.** |
| `lib/discoveryClient.ts` | Discovery search with 2s timeout. Reads NEXT_PUBLIC_DISCOVERY_ENDPOINT. |

### Cookie management (PersonaSwitcher.tsx)
```typescript
// Clear cookie (all personas, including when switching)
document.cookie = '_br_uid_2=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';

// Set cookie (Sarah and Alex only — NOT for Guest)
if (persona.bruid_value !== null) {
  document.cookie = `${persona.bruid_value}; path=/`;
}
```

### resultCache.ts is the shared cache
M4 `ShopperSimulator.tsx` imports this file. Do NOT create a second cache. Export a singleton.

### fallback chain (never show empty grid)
```typescript
// 1. resultCache hit? return it
// 2. call discoveryClient.search with 2s AbortController timeout
// 3. timeout or error? return resultCache.loadFromFile(persona, state)
// loadFromFile reads data/cached-results/{persona}-{state}.json
```

### Tests to write (`tests/m5-plp/`)
- PersonaSwitcher: switching to Guest deletes `_br_uid_2` cookie
- PersonaSwitcher: switching to Sarah sets correct bruid_value cookie
- resultCache: returns file fallback when in-memory miss
- ProductGrid: "Personalised for you" badge on rank 1–3 in After state only
- ProductGrid: never renders empty — skeleton shown while loading

## Critical constraints
- Guest persona: cookie MUST be deleted, not set to empty string
- Before/After toggle: NEVER triggers a Discovery call
- Grid never empty: file fallback is the last resort, always works
- TTL: 300s exactly

## Dependency check
- 001 ✅, 002 ✅ approved
- 006 requirements-spec ✅, architecture-spec ✅, design-spec ✅ approved
