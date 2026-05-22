---
feature: Synthetic Data Layer
spec_id: "001"
component: C5
phase: requirements
owner: PM
status: draft
version: "2.0"
entry_criteria:
  - CLAUDE.md is complete with correct architecture, personas, and PRS states
exit_criteria:
  - All data files exist with correct shapes
  - Three personas in personas.json
  - prs_pre_fix.json sums to 52, prs_post_fix.json arithmetic confirmed
  - fix_catalogue.json has AutoSegment as rank 1
  - 50 products in GBP with no KS IP
  - Human has set status to approved
---

# Requirements Spec — Synthetic Data Layer (001 / C5)

## Problem
All four build modules (M1–M4) plus M5 need deterministic test data that mirrors real Bloomreach data shapes. Without this layer, no module can be built or tested before live credentials arrive. C5 also serves as the permanent fallback when live endpoints are unavailable.

## Functional Requirements

### personas.json
- **FR-001-1:** SHALL define exactly 3 personas with fields: `persona_id`, `display_name`, `archetype_name`, `profile_description`, `login_status`, `session_count`, `page_views`, `product_clicks`, `purchase_count`, `aov`, `segment_name`, `last_signal_date`, `bruid_present`, `bruid_value`, `demo_query`.
- **FR-001-2:** Personas SHALL be: `guest` (New Prospecting, no BRUID), `sarah` (Gifting, BRUID present), `alex` (High Value Returning, BRUID present).
- **FR-001-3:** `demo_query` SHALL be "necklace" for all three — no per-persona queries.

### prs_pre_fix.json
- **FR-001-4:** SHALL contain five dimension objects producing `composite_score: 52`. Scores: BRUID=8, AutoSegment=6, SignalFreshness=14, RuleConflicts=18, ABTest=6.
- **FR-001-5:** `rag_status` SHALL be "amber". `boost_rules_state` SHALL be "all_inactive".
- **FR-001-6:** Each dimension object SHALL include all M1→M2 contract fields: `dimension_id`, `raw_value`, `normalised_score`, `status`, `data_source`, `timestamp`, `is_synthetic`.

### prs_post_fix.json
- **FR-001-7:** SHALL contain five dimension objects. Scores per spec: BRUID=8, AutoSegment=16, SignalFreshness=14, RuleConflicts=16, ABTest=6. `boost_rules_state` SHALL be "all_active".
- **FR-001-8:** ⚠️ **OPEN ITEM:** Dimension scores sum to 60, spec states 70. Architect must confirm correct post-fix total before this spec can be fully approved.

### fix_catalogue.json
- **FR-001-9:** SHALL contain exactly 3 fix objects. Rank 1 = AutoSegment (12–18% RPV), Rank 2 = BRUID (8–15% RPV), Rank 3 = Rule Conflicts (5–10% RPV).
- **FR-001-10:** Each fix SHALL include: `fix_id`, `dimension_linked`, `fix_title`, `plain_english_description`, `effort_level`, `estimated_revenue_impact`, `action_label`, `risk_level`, `steps`.

### products.json / products.csv
- **FR-001-11:** SHALL contain exactly 50 products. No Kendra Scott IP, no real brand names.
- **FR-001-12:** Currency SHALL be GBP throughout. No USD.
- **FR-001-13:** Product schema: `product_id`, `name`, `description`, `price`, `currency`, `category`, `price_band` (entry/mid/premium), `gift_eligible`, `gift_wrappable`, `is_new_arrival`, `is_bestseller`, `review_count`, `image_url`.
- **FR-001-14:** Distribution: 17 gifting products (£30–£80, gift_eligible=true), 17 premium/new collection (£150–£400, is_new_arrival=true, price_band=premium), 16 bestseller/entry (£25–£60, is_bestseller=true).
- **FR-001-15:** `/data/products.csv` SHALL contain the same 50 products in CSV format for Bloomreach Discovery catalogue import.

### cached-results/
- **FR-001-16:** `/data/cached-results/` SHALL contain 6 JSON files: `{guest|sarah|alex}-{before|after}.json`. These are populated after sandbox Discovery calls are confirmed. Until then, placeholder files with empty `products: []` arrays are acceptable.
- **FR-001-17:** Each cached file SHALL match the normalised Discovery search response schema.

### segments.json
- **FR-001-18:** SHALL define 3 segment objects matching the three boost rules: New Prospecting, Gifting Intent, High Value Returning.

## Acceptance Criteria
- [ ] `personas.json` has exactly 3 entries; all required fields present; all `demo_query` = "necklace"
- [ ] `prs_pre_fix.json` dimension scores sum to exactly 52
- [ ] `fix_catalogue.json` rank 1 is AutoSegment dimension
- [ ] `products.json` has exactly 50 entries, all prices in GBP
- [ ] No product name contains "Kendra Scott" or any real brand name
- [ ] `products.csv` matches `products.json` (same 50 products)
- [ ] `cached-results/` directory exists with 6 files (placeholder or populated)

## Out of Scope
- Live Discovery API calls (that is M1)
- Scoring calculations (that is M2)
- UI rendering (that is M4)
