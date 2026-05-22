---
feature: PPD Dashboard UI
spec_id: "005"
module: M4
phase: requirements
owner: PM
status: draft
version: "2.0"
entry_criteria:
  - 003-prs-scoring-engine approved
  - 004-nl-interface approved
  - Design palette confirmed
exit_criteria:
  - All three modules fully specified
  - ApprovalModal no-write constraint explicit
  - Module B live constraint explicit
  - Acceptance criteria testable
  - Human has set status to approved
---

# Requirements Spec — PPD Dashboard UI (005 / M4)

## Problem
All scoring, NL, and integration work needs a React front-end that is compelling, demo-ready, and judges Module C's reasoning trace visibly. Module B must show live Discovery results (not a static mockup). The ApprovalModal closes the "responsible design" story.

## User
**Amanda Valdez**, Digital Personalization Manager, Kendra Scott. Running this in a browser during a demo to her VP or in a Bloomreach account review.

## Functional Requirements

### Global Layout

- **FR-005-1:** Navy (`#1B3A5C`) header showing "Personalization Performance Doctor" and "Kendra Scott".
- **FR-005-2:** Three tab buttons: "PRS Scorecard" (Module A), "Shopper Simulator" (Module B), "Ask the Doctor" (Module C).
- **FR-005-3:** Active tab highlighted with teal (`#0E7C7B`).
- **FR-005-4:** Renders correctly at 1280px and 1920px viewport widths.

### Module A — PRS Scorecard

- **FR-005-5:** Circular dial or gauge (recharts or custom SVG — no external charting dependency beyond recharts if used) showing composite PRS with RAG colour.
- **FR-005-6:** Five dimension rows: dimension name, source label ("Discovery API" / "Marketing MCP" / "Analytics MCP"), score bar, status badge (critical/warning/healthy).
- **FR-005-7:** "Top Fixes" section with 3 ranked fix cards: rank badge, dimension name, fix title, RPV lift %, "Review" button. Ranked AutoSegment first.
- **FR-005-8:** Clicking "Review" opens ApprovalModal pre-populated with that fix's data.
- **FR-005-9:** "Last refreshed" timestamp from `prs_pre_fix.json` `generated_at` field.

### Module B — Shopper Simulator (LIVE — not static)

- **FR-005-10:** Three persona tabs: "Guest", "Sarah", "Alex".
- **FR-005-11:** Before/After toggle at top of Module B. Default state: Before.
- **FR-005-12:** Each persona + state combination calls Discovery search API with the correct BRUID context (from `personas.json` `bruid_value` field).
- **FR-005-13:** Result grid shows rank position numbers on each product card.
- **FR-005-14:** Rank change indicators on After state: teal ↑ arrow (moved up vs Before), grey ↓ arrow (moved down), dash for no change.
- **FR-005-15:** Banner: **"Before: generic ranking — After: personalised results following Doctor recommendations."**
- **FR-005-16:** Module B reuses M5 PLP result cache. No duplicate Discovery calls.
- **FR-005-17:** If Discovery returns in > 2 seconds, serve from `/data/cached-results/{persona}-{state}.json`.
- **FR-005-18:** Never shows an empty grid — falls back to cached results on any error.

### Module C — Ask the Doctor

- **FR-005-19:** Pre-loaded exchange visible on initial render (no API call on load).
- **FR-005-20:** Three quick-action chips above input: "Why is my personalisation not working?", "What should I fix first?", "Show me what good personalisation looks like for my top 3 customer types".
- **FR-005-21:** Text input + "Ask" button. Submit triggers M3 `handleQuery()`.
- **FR-005-22:** Each response renders with:
  1. **Reasoning Trace panel** — collapsed by default, toggle to expand. Shows each tool call: name, input summary, output summary.
  2. **Plain-English explanation** — expanded by default. Shows summary, score breakdown, top fixes, next action.
- **FR-005-23:** Loading indicator ("Consulting Bloomreach data...") while M3 is working.
- **FR-005-24:** Error state + retry button on M3 failure.
- **FR-005-25:** "Copy" button copies plain-text explanation.

### ApprovalModal

- **FR-005-26:** Props: `action_title`, `action_description`, `estimated_impact`, `risk_level`.
- **FR-005-27:** Three buttons: **Approve** (teal `#0E7C7B` filled), **Review Later** (grey outlined), **Dismiss** (text link).
- **FR-005-28:** On Approve: transitions to confirmation state "Action logged for review by your team". **NO API call is made.** Application state only.
- **FR-005-29:** Accessible: focus trapped while open, closes on Escape, returns focus to trigger on close.

## Acceptance Criteria
- [ ] App renders with navy header and three tabs
- [ ] Module A shows 52 Amber score with all 5 dimension rows and source labels
- [ ] "Review" opens ApprovalModal; Approve shows confirmation (no API call)
- [ ] Module B persona tabs render with before/after toggle
- [ ] Module B shows rank numbers and rank change indicators
- [ ] Module B banner text matches spec exactly
- [ ] Module B never shows empty grid (cached fallback confirmed)
- [ ] Module C pre-loaded exchange renders on page load
- [ ] Quick-action chips trigger correct queries
- [ ] Reasoning trace panel toggles open/closed
- [ ] App renders without console errors at 1280px

## Out of Scope
- Mobile viewport < 768px
- User authentication
- Score history / time-series charts
- Export to PDF or CSV
- Approval modal triggering live API writes (Phase 2)
