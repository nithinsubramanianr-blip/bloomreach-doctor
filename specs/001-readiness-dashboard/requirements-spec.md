---
feature: Personalization Readiness Dashboard
spec_id: "001"
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - Project CLAUDE.md exists and is complete
  - Synthetic data files planned (src/data/)
exit_criteria:
  - All functional requirements defined and numbered
  - Acceptance criteria are testable (binary pass/fail)
  - Out-of-scope list prevents scope creep
  - Human has set status to approved
---

# Requirements Spec — Personalization Readiness Dashboard (001)

## Problem

Bloomreach Discovery customers have personalization features enabled but no single place to assess whether those features are actually working. A merchant might have AutoSegments configured, BRUIDs tracking, and Loomi rules set up — yet still see flat conversion rates because a misconfiguration or data gap is silently undermining personalization. There is no dashboard that aggregates personalization health into a single actionable score.

## User stories

- **US-001-1:** As a Bloomreach merchant, I want to see a single Personalization Readiness Score (0–100) so I can quickly understand my overall personalization health without reading raw logs.
- **US-001-2:** As a merchant, I want to see how each of the 5 health dimensions contributes to my overall score so I know which area to fix first.
- **US-001-3:** As a merchant, I want to see a ranked top-3 fix list with estimated revenue impact per fix so I can prioritize work by business value.
- **US-001-4:** As a Bloomreach account manager, I want to show this dashboard to a client in a live demo so it must be visually compelling and load within 2 seconds.

## Functional requirements

### Scoring engine

- **FR-001-1:** The system SHALL compute a BRUID Match Rate sub-score (0–20 points) based on the percentage of site sessions where a `_br_uid_2` cookie is present and maps to a known returning visitor profile. Target: 70%+ = 20 pts; linear interpolation below.
- **FR-001-2:** The system SHALL compute an AutoSegment Coverage sub-score (0–20 points) based on the percentage of sessions where the visitor is assigned to a named AutoSegment. Target: 75%+ = 20 pts; linear interpolation below.
- **FR-001-3:** The system SHALL compute a Signal Freshness sub-score (0–20 points) based on the age of the most recent behavioral events (clicks, purchases, add-to-carts) in the signals dataset. Events within 24 hours = 20 pts; 24–72 hrs = 14 pts; 3–7 days = 8 pts; >7 days = 0 pts.
- **FR-001-4:** The system SHALL compute a Rule Conflicts sub-score (0–20 points) by detecting contradictory personalization rules (e.g., a rule that boosts a category for all visitors and a rule that suppresses the same category for a subset). Zero conflicts = 20 pts; 1 conflict = 14 pts; 2 conflicts = 8 pts; 3+ conflicts = 0 pts.
- **FR-001-5:** The system SHALL compute an A/B Test Coverage sub-score (0–20 points) based on the percentage of active personalization rules that have a corresponding A/B test configuration. 60%+ = 20 pts; linear interpolation below.
- **FR-001-6:** The system SHALL compute the Personalization Readiness Score as the sum of all 5 sub-scores (range: 0–100).
- **FR-001-7:** All scoring functions SHALL be pure functions — same input always produces same output, no side effects, no async.

### Dashboard UI

- **FR-001-8:** The dashboard SHALL display the overall score prominently with color coding: red for score < 40, yellow for 40–74, green for 75+.
- **FR-001-9:** The dashboard SHALL display each dimension's sub-score as a labeled bar or gauge alongside the numeric value and the target threshold.
- **FR-001-10:** The dashboard SHALL display a ranked top-3 fix list. Each fix SHALL include: dimension name, one-sentence description of the issue, and an estimated revenue impact (expressed as a percentage lift to revenue per visit, based on stated assumptions).
- **FR-001-11:** The dashboard SHALL display the demo brand name (Kendra Scott) and a timestamp indicating when the data was last refreshed.
- **FR-001-12:** The dashboard SHALL be responsive and render correctly at 1280px and 1920px viewport widths.

### Data access

- **FR-001-13:** All data access SHALL go through `src/data-access/` — the dashboard component must never import raw JSON directly.
- **FR-001-14:** The data access layer SHALL have a `synthetic` adapter (reads from `src/data/*.json`) and a stub `mcp` adapter. Switching is controlled by the `DATA_SOURCE` environment variable.

## Acceptance criteria

- [ ] Overall score is displayed with correct color for scores in each band (red/yellow/green)
- [ ] Each of the 5 sub-scores renders with its label, numeric value, and color indicator
- [ ] Top-3 fix list is ranked by estimated revenue impact (highest first)
- [ ] Changing any input value in the synthetic data changes the score correctly
- [ ] All 5 scoring functions have passing unit tests with at least 3 input/output pairs each
- [ ] Dashboard loads and renders in < 2 seconds in a local dev environment
- [ ] No raw JSON imports in any component file (import graph check in tests)
- [ ] Demo renders without console errors or warnings

## Out of scope for this feature

- Live Bloomreach API integration (MCP adapter is a stub only)
- Write/mutation of any Bloomreach data
- Historical score trending or time-series charts
- User authentication
- Export to PDF or CSV
- Mobile viewport (< 768px)
