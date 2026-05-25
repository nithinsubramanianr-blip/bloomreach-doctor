---
feature: React PLP
spec_id: "006"
module: M5
phase: requirements
owner: PM
status: approved
revised: 2026-05-25
revision-reason: Framework swap from Next.js to React/Vite per human decision
approved-on: 2026-05-25
version: "2.0"
entry_criteria:
  - 001-synthetic-data approved
  - 002-bloomreach-integration approved
  - Bloomreach Discovery sandbox credentials confirmed
exit_criteria:
  - Persona switcher spec complete
  - BRUID cookie management specified
  - Result cache contract defined
  - Before/After state spec complete
  - Acceptance criteria testable
  - Human has set status to approved
---

# Requirements Spec — React PLP (006 / M5)

> Folder renamed from `006-nextjs-plp/` to `006-react-plp/` on 2026-05-25 to reflect the framework swap. Implementation is React + Vite + TypeScript inside a shared Vite app (also hosts M4 at `/doctor`).

## Problem
The demo needs a working product listing page that shows Discovery search results changing in real time when personas are switched and when boost rules are activated. This is Component C1 — the visual proof that Option X works.

## Functional Requirements

### Application Shell

- **FR-006-1:** React + Vite + TypeScript single-page application. Pure client-side rendering (SPA). No SSR, no server components.
- **FR-006-2:** Unified Vite app shared with M4. React Router routes:
  - `/` → M5 PLP (shopper view, this spec)
  - `/doctor` → M4 Dashboard (Amanda's view, spec 005)
- **FR-006-3:** PLP route `/` renders the necklace search results page. The query "necklace" is hardcoded.
- **FR-006-4:** Navy header matching M4 dashboard palette (`#1B3A5C`).
- **FR-006-5:** Persona switcher dropdown in header with three options: "Guest (New Prospecting)", "Sarah — Gifting", "Alex — High Value Returning".
- **FR-006-6:** Page renders correctly at 1280px desktop and 768px mobile.

### Persona Switcher

- **FR-006-7:** On persona switch: (1) clear existing `_br_uid_2` cookie, (2) set new `_br_uid_2` cookie value from `personas.json` `bruid_value` field, (3) re-query Discovery, (4) re-render product grid.
- **FR-006-8:** Guest persona: no `_br_uid_2` cookie is set (null bruid_value). The cookie MUST be deleted (expired), not set to empty string.
- **FR-006-9:** Switching persona SHALL complete the re-render within 3 seconds.

### Product Grid

- **FR-006-10:** 4 columns on desktop (1280px+), 2 columns on mobile (768px).
- **FR-006-11:** Each product card: image placeholder, product name, price (GBP), category badge.
- **FR-006-12:** "Personalised for you" badge on top 3 products when `is_personalised = true` (hidden in before state, visible in after state).

### Before/After State

- **FR-006-13:** Page has a Before/After toggle (matching Module B toggle in M4). Before = boost rules inactive state, After = boost rules active state.
- **FR-006-14:** In Before state: no personalisation badges shown. In After state: "Personalised for you" badges on top 3 products.
- **FR-006-15:** The toggle does NOT activate/deactivate rules — that is TA1's manual action. The toggle switches the displayed cached result set (before vs after cache).

### Result Caching (lib/resultCache.ts)

- **FR-006-16:** Cache key: `${persona_id}-${state}` (e.g. `sarah-before`, `alex-after`).
- **FR-006-17:** Cache TTL: 300 seconds.
- **FR-006-18:** Pre-populated cache files in `/data/cached-results/` serve as permanent fallback.
- **FR-006-19:** If Discovery latency > 2 seconds, serve from cache automatically (AbortController).
- **FR-006-20:** If Discovery call fails entirely, serve from `/data/cached-results/`. Never show empty grid.

### Loading and Error States

- **FR-006-21:** Loading state: skeleton card grid (grey placeholder cards, same grid dimensions as product cards).
- **FR-006-22:** Error state: falls back to cached results silently. No error message shown to user.

### Discovery Client (lib/discoveryClient.ts)

- **FR-006-23:** Reads `VITE_DISCOVERY_ENDPOINT` env var (Vite exposes `VITE_*` prefixed vars to the client).
- **FR-006-24:** Sends `_br_uid_2` cookie value in request headers/params as required by Discovery API.
- **FR-006-25:** Result cache is shared with Module B (M4) — no duplicate Discovery calls for the same persona+state.

## Acceptance Criteria
- [ ] Vite dev server serves `/` (PLP) and `/doctor` (M4 dashboard) from a single `npm run dev`
- [ ] Persona switcher clears and sets BRUID cookie correctly (Guest = no cookie)
- [ ] Switching persona re-renders product grid
- [ ] 4-column desktop grid renders at 1280px
- [ ] "Personalised for you" badge visible on After state, hidden on Before state
- [ ] Skeleton loading state shown while Discovery call is in progress
- [ ] Empty grid never shown — cached fallback always serves
- [ ] Cache TTL is 300 seconds
- [ ] No duplicate Discovery calls for same persona+state within TTL window
- [ ] `VITE_DISCOVERY_ENDPOINT` env var consumed by `discoveryClient.ts`

## Out of Scope
- Full e-commerce PLP features (filters, sort, pagination beyond the demo grid)
- User authentication or account pages
- Cart or checkout functionality
- Any page other than the necklace search results page
- SSR or server components — pure SPA
- Static export, prerender, or hydration logic
