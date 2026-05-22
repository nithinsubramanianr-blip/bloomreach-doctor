---
feature: Shopper Profile Simulator
spec_id: "002"
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - Project CLAUDE.md exists and is complete
  - search-results.json and products.json synthetic data files planned
exit_criteria:
  - All functional requirements defined and numbered
  - All 4 persona archetypes fully specified
  - Acceptance criteria are testable (binary pass/fail)
  - Out-of-scope list prevents scope creep
  - Human has set status to approved
---

# Requirements Spec — Shopper Profile Simulator (002)

## Problem

When a Bloomreach merchant asks "is my personalization working?", the answer is usually buried in analytics. There is no way to visually see — side by side — what a specific type of shopper experiences when personalization is working vs. when it is broken or absent. This makes it hard to build internal business cases for fixing personalization issues, and hard to demonstrate value to stakeholders.

## User stories

- **US-002-1:** As a Bloomreach account manager, I want to show a client four different shopper types receiving different search results based on their profile, so the client can viscerally understand what personalization means for their customers.
- **US-002-2:** As a merchant, I want to see what my best customer sees vs. what a first-time visitor sees for the same search query, so I understand the magnitude of personalization impact.
- **US-002-3:** As a merchant, I want to toggle between "personalization ON (working)" and "personalization OFF (generic)" for each persona, so I can see the gap the personalization system is supposed to close.
- **US-002-4:** As a demo presenter, I want to enter a custom search query and see all four personas update simultaneously, so the demo feels interactive and relevant to the audience.

## Persona archetypes

### Persona 1 — Loyal Luxury Buyer
- **Profile:** Returning customer, 12+ purchases, AOV $280, primarily browses fine jewelry (gold, diamonds, emeralds), no price sensitivity, responds to "new arrivals" and "exclusive" signals
- **With personalization:** Fine jewelry, high-price-point items, new arrivals ranked first; editorial content ("just arrived") surfaced
- **Without personalization:** Same generic results as all other visitors — mid-range items, no editorial boost

### Persona 2 — First-Time Gift Shopper
- **Profile:** No purchase history, arrived via "gifts for her" paid search ad, session duration < 5 min, browsing gift sets and under-$100 items
- **With personalization:** Gift sets, under-$100 items, and items labeled "for her" ranked first; gift-wrapping messaging surfaced
- **Without personalization:** Generic results — no gift framing, no price filter applied

### Persona 3 — Sale Hunter
- **Profile:** 3 prior purchases all during sale events, only engages during promotional periods, clicks clearance and % off badges
- **With personalization:** Sale items, clearance badges, % off prominence; "sale ends soon" urgency signals
- **Without personalization:** Generic results — full-price items ranked by default relevance

### Persona 4 — Browse-Only Teen
- **Profile:** High page views (15+ per session), zero purchases, 8 prior sessions, browses trendy/affordable items (earrings, charms, <$50), responds to social proof ("trending")
- **With personalization:** Trending items, affordable earrings and charms ranked first; "trending now" labels surfaced
- **Without personalization:** Generic results — no trend signal, mid-range items

## Functional requirements

### Simulator UI

- **FR-002-1:** The simulator SHALL display all 4 persona archetypes simultaneously in a 2×2 or 4-column layout.
- **FR-002-2:** Each persona panel SHALL show: persona name, a brief one-line description, and two side-by-side result lists (personalization ON vs. OFF).
- **FR-002-3:** Each result list SHALL display a minimum of 4 product cards per persona per mode. Each card SHALL show: product image (or placeholder), product name, price, and a personalization badge (e.g., "Boosted for you" or "Trending").
- **FR-002-4:** The simulator SHALL have a search query input field. Changing the query SHALL update all 4 persona panels simultaneously.
- **FR-002-5:** The default query on load SHALL be "necklace".
- **FR-002-6:** The simulator SHALL visually distinguish personalized results from generic results — e.g., column header color, badge styling, or border treatment.
- **FR-002-7:** The simulator SHALL show a "personalization gap" summary per persona — a one-line statement quantifying the difference (e.g., "3 of 4 results differ from generic ranking").

### Data

- **FR-002-8:** Search results for each persona SHALL come from `src/data/search-results.json` via the data access layer (no direct import in UI).
- **FR-002-9:** The data file SHALL contain pre-computed results for at least 2 search queries: "necklace" and "earrings". Additional queries SHALL gracefully fall back to the "necklace" dataset.
- **FR-002-10:** Product data (name, price, image URL placeholder, category) SHALL come from `src/data/products.json`.

### Interaction

- **FR-002-11:** Each persona panel SHALL have a "View profile" expand/collapse toggle that shows a brief persona background (purchase history summary, behavioral traits, arrival source).
- **FR-002-12:** The simulator SHALL work without any backend API call at runtime — all data is loaded from synthetic JSON at build time or on page load.

## Acceptance criteria

- [ ] All 4 persona panels render simultaneously without errors
- [ ] "Personalization ON" results differ from "Personalization OFF" results for every persona
- [ ] Changing the search query updates all 4 panels
- [ ] Each persona panel shows at least 4 product cards in each column
- [ ] Personalization gap summary renders for each persona
- [ ] "View profile" toggle shows/hides persona detail
- [ ] No raw JSON imports in any component file
- [ ] Renders without console errors or warnings at 1280px viewport

## Out of scope for this feature

- Real-time Bloomreach Search API calls
- More than 4 persona archetypes in this version
- User-defined custom personas
- Click tracking or analytics on persona interaction
- Mobile viewport (< 768px)
