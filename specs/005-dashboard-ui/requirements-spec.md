---
feature: Dashboard UI (Module A + B + C + ApprovalModal)
spec_id: "005"
module: M4
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - 003-prs-scoring-engine requirements-spec.md is approved
  - 004-nl-interface requirements-spec.md is approved
  - Design palette confirmed (Navy #1B3A5C, Teal #0E7C7B)
exit_criteria:
  - All three module tabs fully specified
  - ApprovalModal props and states specified
  - Static-only constraint for Module B is explicit
  - Acceptance criteria are testable
  - Human has set status to approved
---

# Requirements Spec — Dashboard UI (005 / M4)

## Problem

All the scoring, NL, and data work needs a front-end that is visually compelling and demo-ready within minutes. The UI has three tabs (Module A, B, C) plus a reusable ApprovalModal. Module B must be entirely static. Module C is the showpiece for judging criterion 3.

## User

**Amanda Valdez** — Digital Personalization Manager at Kendra Scott. Running this in a browser tab during a presentation to her VP or a Bloomreach account review.

## User stories

- **US-005-1:** As Amanda, I want to land on a dashboard that immediately shows my 52/100 Amber PRS so I feel the urgency of the problem.
- **US-005-2:** As Amanda, I want to click a tab to see side-by-side archetype results without waiting for a page load.
- **US-005-3:** As Amanda, I want to ask "Ask the Doctor" a question and see it reason through the answer with visible tool calls.
- **US-005-4:** As Amanda, I want to click "Review" on a fix and see a modal that asks me to Approve, Review Later, or Dismiss — so I feel in control.

## Functional requirements

### Global layout

- **FR-005-1:** The app SHALL have a navy (`#1B3A5C`) header bar showing "Personalization Performance Doctor" and the demo brand name "Kendra Scott".
- **FR-005-2:** The app SHALL have three tab buttons below the header: "PRS Scorecard" (Module A), "Archetype Simulator" (Module B), "Ask the Doctor" (Module C).
- **FR-005-3:** The active tab SHALL be highlighted with teal (`#0E7C7B`) underline or background.
- **FR-005-4:** The app SHALL render correctly at 1280px and 1920px viewports.

### Module A — PRS Scorecard

- **FR-005-5:** Module A SHALL display the overall PRS score (52) prominently with RAG color: Red < 50, Amber 50–74 (demo), Green 75+.
- **FR-005-6:** Module A SHALL display five dimension rows. Each row: dimension name, source label ("Discovery API" or "Marketing MCP" or "Analytics MCP"), current sub-score, max score (20), a progress bar, and a status badge (critical / warning / good).
- **FR-005-7:** Module A SHALL display a "Top Fixes" section with the ranked fix list from the fix generator. Each fix: dimension name, one-line issue description, estimated RPV lift %, and a "Review" button.
- **FR-005-8:** Clicking "Review" on any fix SHALL open the ApprovalModal with the fix details pre-populated.
- **FR-005-9:** Module A SHALL show a "Last refreshed" timestamp using the `generated_at` field from `prs_demo_state.json`.

### Module B — Archetype Simulator (STATIC — no live API calls)

- **FR-005-10:** Module B SHALL display four archetype selector tabs: "Prospective", "New Customer", "Gifting Shopper", "Returning VIP".
- **FR-005-11:** Each archetype tab SHALL show two columns side by side: "Personalised Results" (teal header) and "Generic Results" (grey header).
- **FR-005-12:** Each column SHALL show exactly six product cards from `products.json` / `search-results.json`. Each card: product image placeholder, product name, price, and (for personalised column only) a personalization badge.
- **FR-005-13:** Module B SHALL display a visible banner at the top: **"Illustrative — shows expected results when BRUID match rate reaches 70%+"** (amber background, white text).
- **FR-005-14:** Module B SHALL make ZERO live API calls. All data SHALL be loaded from synthetic JSON at page load. No `fetch()`, no `axios`, no MCP calls in any Module B component.
- **FR-005-15:** Switching between archetype tabs SHALL update both result columns without a page reload.
- **FR-005-16:** Module B SHALL NOT have a search query input field — the query for each archetype is fixed in `archetypes.json` (`demo_query` field).

### Module C — Ask the Doctor (NL Chat Interface)

- **FR-005-17:** Module C SHALL display the pre-loaded exchange on initial render: "Why is 1:1 personalization not working?" and the full agent response.
- **FR-005-18:** Module C SHALL have a text input and "Ask" button at the bottom of the panel. Submitting a query triggers the NL interface pipeline (intent classify → reason → tool execute → LLM explain).
- **FR-005-19:** Each agent response SHALL render with two sections:
  1. A **"Reasoning Trace" panel** — collapsed by default, toggle to expand — showing each tool call: name, client, rationale, duration_ms
  2. A **plain-English explanation** — expanded by default — showing executive summary, top fixes with impact, next action
- **FR-005-20:** While the agent is working, a loading indicator ("Consulting Bloomreach data...") SHALL replace the input area.
- **FR-005-21:** Each response SHALL have a "Copy" button that copies the plain-text explanation.

### ApprovalModal

- **FR-005-22:** ApprovalModal SHALL accept props: `action_title`, `action_description`, `estimated_impact`, `risk_level`.
- **FR-005-23:** ApprovalModal SHALL have three buttons:
  - **Approve** — teal (`#0E7C7B`) filled button
  - **Review Later** — grey outlined button
  - **Dismiss** — text link (no button border)
- **FR-005-24:** On Approve click: the modal body SHALL transition to a confirmation state showing "Action logged for review by your team" with a checkmark. No actual API call is made.
- **FR-005-25:** On Review Later or Dismiss: the modal SHALL close.
- **FR-005-26:** ApprovalModal SHALL be accessible: focus trapped inside while open, closes on Escape key, returns focus to trigger button on close.

## Acceptance criteria

- [ ] App renders with navy header and three tabs without errors
- [ ] Module A shows correct 52/100 Amber score and all 5 dimension rows with correct source labels
- [ ] "Review" button on Module A fix opens ApprovalModal
- [ ] ApprovalModal Approve transition shows confirmation state (no page refresh)
- [ ] Module B shows the "Illustrative" banner
- [ ] Module B has zero `fetch()` or MCP calls in component code (grep check)
- [ ] All four archetype tabs in Module B render 6 product cards per column
- [ ] Module C renders pre-loaded exchange on page load
- [ ] Module C reasoning trace panel toggles open/closed
- [ ] Submitting a query in Module C triggers the NL pipeline and renders a response
- [ ] App renders without console errors or warnings at 1280px

## Out of scope for this feature

- Mobile viewport (< 768px)
- User authentication / login
- Score history or time-series charts
- Export to PDF or CSV
- Editable product catalog or archetype profiles in the UI
