---
feature: Next.js PLP
spec_id: "006"
module: M5
phase: requirements
owner: PM
status: draft
version: "1.0"
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

# Requirements Spec — Next.js PLP (006 / M5)

## Problem
The demo needs a working product listing page that shows Discovery search results changing in real time when personas are switched and when boost rules are activated. This is Component C1 — the visual proof that Option X works.

## Functional Requirements

### Application Shell

- **FR-006-1:** Next.js App Router application. Default route renders query "necklace" (hardcoded).
- **FR-006-2:** Navy header matching M4 dashboard palette (`#1B3A5C`).
- **FR-006-3:** Persona switcher dropdown in header with three options: "Guest (New Prospecting)", "Sarah — Gifting", "Alex — High Value Returning".
- **FR-006-4:** Page renders correctly at 1280px desktop and 768px mobile.

### Persona Switcher

- **FR-006-5:** On persona switch: (1) clear existing `_br_uid_2` cookie, (2) set new `_br_uid_2` cookie value from `personas.json` `bruid_value` field, (3) re-query Discovery, (4) re-render product grid.
- **FR-006-6:** Guest persona: no `_br_uid_2` cookie is set (null bruid_value).
- **FR-006-7:** Switching persona SHALL complete the re-render within 3 seconds.

### Product Grid

- **FR-006-8:** 4 columns on desktop (1280px+), 2 columns on mobile (768px).
- **FR-006-9:** Each product card: image placeholder, product name, price (GBP), category badge.
- **FR-006-10:** "Personalised for you" badge on top 3 products when `is_personalised = true` (hidden in before state, visible in after state).

### Before/After State

- **FR-006-11:** Page has a Before/After toggle (matching Module B toggle in M4). Before = boost rules inactive state, After = boost rules active state.
- **FR-006-12:** In Before state: no personalisation badges shown. In After state: "Personalised for you" badges on top 3 products.
- **FR-006-13:** The toggle does NOT activate/deactivate rules — that is TA1's manual action. The toggle switches the displayed cached result set (before vs after cache).

### Result Caching (lib/resultCache.ts)

- **FR-006-14:** Cache key: `${persona_id}-${state}` (e.g. `sarah-before`, `alex-after`).
- **FR-006-15:** Cache TTL: 300 seconds.
- **FR-006-16:** Pre-populated cache files in `/data/cached-results/` serve as permanent fallback.
- **FR-006-17:** If Discovery latency > 2 seconds, serve from cache automatically.
- **FR-006-18:** If Discovery call fails entirely, serve from `/data/cached-results/`. Never show empty grid.

### Loading and Error States

- **FR-006-19:** Loading state: skeleton card grid (grey placeholder cards, same grid dimensions as product cards).
- **FR-006-20:** Error state: falls back to cached results silently. No error message shown to user.

### Discovery Client (lib/discoveryClient.ts)

- **FR-006-21:** Reads `NEXT_PUBLIC_DISCOVERY_ENDPOINT` env var.
- **FR-006-22:** Sends `_br_uid_2` cookie value in request headers/params as required by Discovery API.
- **FR-006-23:** Result cache is shared with Module B (M4) — no duplicate Discovery calls for the same persona+state.

## Acceptance Criteria
- [ ] Persona switcher clears and sets BRUID cookie correctly (Guest = no cookie)
- [ ] Switching persona re-renders product grid
- [ ] 4-column desktop grid renders at 1280px
- [ ] "Personalised for you" badge visible on After state, hidden on Before state
- [ ] Skeleton loading state shown while Discovery call is in progress
- [ ] Empty grid never shown — cached fallback always serves
- [ ] Cache TTL is 300 seconds
- [ ] No duplicate Discovery calls for same persona+state within TTL window

## Out of Scope
- Full e-commerce PLP features (filters, sort, pagination beyond the demo grid)
- User authentication or account pages
- Cart or checkout functionality
- Any page other than the necklace search results page
