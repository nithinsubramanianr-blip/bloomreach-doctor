---
feature: Synthetic Data & Environment
spec_id: "001"
module: M5
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - CLAUDE.md is complete with correct architecture and archetypes
exit_criteria:
  - All synthetic JSON files exist with correct shape
  - All four archetypes defined in archetypes.json
  - prs_demo_state.json produces exactly 52/100
  - Each file has been validated against the normaliser schema
  - Human has set status to approved
---

# Requirements Spec — Synthetic Data & Environment (001 / M5)

## Problem

All three MCP/API clients need a synthetic fallback that activates when live endpoints are unavailable. The fallback must produce the same normalised schema as the live path — otherwise the scoring engine and NL interface cannot be built and tested without live credentials. This feature is the foundation that unblocks M2 (scoring) and M3 (NL interface) in parallel.

## User stories

- **US-001-1:** As a developer, I want to run the entire app locally without Bloomreach credentials so I can build and test every module against deterministic data.
- **US-001-2:** As a QA engineer, I want synthetic data that produces the exact locked demo scores (52/100 Amber) so every test run is reproducible.
- **US-001-3:** As a demo presenter, I want the archetype simulator to show four distinct shopper experiences so judges can see the personalization gap clearly.

## Functional requirements

### Core data files

- **FR-001-1:** `/data/archetypes.json` SHALL define exactly four archetypes with these fields per entry: `archetype_id`, `archetype_name`, `profile_description`, `login_status`, `session_count`, `purchase_history`, `segment_list`, `last_signal_date`, `bruid_present`, `demo_query`.
- **FR-001-2:** The four archetypes SHALL be: `prospective` (demo_query: "necklace"), `new_customer` (demo_query: "yellow rose"), `gifting_shopper` (demo_query: "necklace gift"), `returning_vip` (demo_query: "necklace gift").
- **FR-001-3:** `/data/prs_demo_state.json` SHALL contain the five dimension scores that produce PRS = 52/100: BRUID Match Rate 8/20 (critical), AutoSegment Coverage 12/20 (warning), Signal Freshness 14/20 (warning), Rule Conflicts 10/20 (warning), A/B Test Coverage 8/20 (critical).
- **FR-001-4:** `/data/search-results.json` SHALL contain personalized and generic result sets for all four archetypes for queries: "necklace", "yellow rose", "necklace gift". Each set SHALL reference product IDs from `products.json` and include 6 product IDs per column.
- **FR-001-5:** `/data/products.json` SHALL contain at least 20 Kendra Scott products with fields: `product_id`, `name`, `category`, `price`, `sale_price`, `material`, `tags`, `is_on_sale`, `is_new_arrival`, `is_trending`, `is_gift_set`, `image_placeholder`, `rating`, `review_count`.

### Normaliser schema

- **FR-001-6:** Each synthetic data file SHALL be documented in `/src/m5-data/schema.md` with the exact JSON schema it conforms to, so the normaliser can validate both live and synthetic paths against the same shape.

### Adapter files

- **FR-001-7:** `/src/m5-data/synthetic-marketing.js` SHALL read from `segments.json` and `signals.json` and return data conforming to the Marketing MCP normalised schema.
- **FR-001-8:** `/src/m5-data/synthetic-analytics.js` SHALL read from `tests.json` and return data conforming to the Analytics MCP normalised schema.
- **FR-001-9:** `/src/m5-data/synthetic-discovery.js` SHALL read from `visitors.json` and `rules.json` and return data conforming to the Discovery API normalised schema.

## Acceptance criteria

- [ ] `archetypes.json` contains exactly 4 entries with all required fields
- [ ] `prs_demo_state.json` scores sum to exactly 52
- [ ] All four archetypes have search results in `search-results.json` for all three demo queries
- [ ] Each adapter file exports a function that returns data in the expected normalised schema
- [ ] Unit tests confirm each adapter output matches the normaliser schema
- [ ] No live credentials required to load any synthetic file

## Out of scope for this feature

- Actual MCP client implementation (that is M1 — 002-mcp-integration)
- Scoring calculations (that is M2 — 003-prs-scoring-engine)
- UI rendering of any data
