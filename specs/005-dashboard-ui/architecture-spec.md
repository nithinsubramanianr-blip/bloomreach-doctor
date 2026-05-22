---
feature: PPD Dashboard UI
spec_id: "005"
phase: architecture
owner: Architect
status: approved
version: "1.0"
---

# Architecture Spec — PPD Dashboard UI (005 / M4)

## Role in the System

M4 is the React/Vite front-end. It owns all user-facing presentation. It consumes M2 (PRS data) and M3 (NL agent) outputs and renders them. Module B additionally calls the Discovery search API directly (via M1 `searchProducts`) sharing M5's result cache.

## Component Tree

```
App.tsx
├── Header (navy #1B3A5C — "Personalization Performance Doctor | Kendra Scott")
├── TabBar (PRS Scorecard | Shopper Simulator | Ask the Doctor)
│
├── [tab=scorecard] PRSScorecard.tsx  ← Module A
│   ├── ScoreDial.tsx                 (composite score + RAG colour)
│   ├── DimensionRow × 5             (name, source, score bar, status badge)
│   ├── TopFixes                     (3 ranked fix cards with Review button)
│   └── ApprovalModal.tsx            (opens on Review click — no API write)
│
├── [tab=simulator] ShopperSimulator.tsx  ← Module B (LIVE)
│   ├── PersonaTabs                  (Guest | Sarah | Alex)
│   ├── BeforeAfterToggle            (Before / After)
│   ├── Banner                       (exact text from spec)
│   └── ProductGrid                  (rank numbers + rank change indicators)
│
└── [tab=doctor] NLChat.tsx          ← Module C
    ├── PreLoadedExchange            (static — no API on load)
    ├── QuickActionChips × 3
    ├── ChatInput + Ask button
    ├── ReasoningTracePanel          (collapsed by default, toggle)
    └── PlainEnglishAnswer           (expanded by default)
```

## Key Architectural Decisions

### ADR-005-1: Module B calls M1 searchProducts — not a static mockup
`ShopperSimulator.tsx` imports `searchProducts` from `src/m1-bloomreach/discovery-client.js`. It passes the selected persona's `bruid_value`. The Before/After toggle switches the displayed result set (before cache vs after cache), not the rule state.

### ADR-005-2: Module B and M5 share the result cache
The result cache lives in M5 (`src/m5-plp/lib/resultCache.ts`). M4 imports it directly. Cache key: `{persona_id}-{state}`. This prevents duplicate Discovery calls.

### ADR-005-3: ApprovalModal state is local to App.tsx
`isModalOpen`, `selectedFix`, `approvalStatus` are React state in `App.tsx`. Approved actions log to an `approvedActions[]` array in component state — no API call, no persistence. The modal receives these as props.

### ADR-005-4: Module C pre-loaded exchange is a static constant
The pre-loaded exchange object (defined in design-spec.md 004) is imported as a module constant in `NLChat.tsx`. It renders immediately without calling M3. Live M3 calls only happen when the user submits a query.

### ADR-005-5: No external charting library beyond recharts
`ScoreDial.tsx` uses either recharts `RadialBarChart` or custom SVG arc. No additional charting dependency.

## Data Flow

```
On mount:
  PRSScorecard ──► import prs_pre_fix.json via prs-data-fetcher (M1) ──► calculatePRS (M2) ──► render

On persona/state change in Module B:
  ShopperSimulator ──► resultCache.get(persona, state)
                    ──► if miss: searchProducts(query, bruid) via M1
                    ──► resultCache.set(key, result)
                    ──► render ProductGrid

On Ask button / quick-action chip:
  NLChat ──► handleQuery(text, prsState) via M3
          ──► renders ReasoningTracePanel + PlainEnglishAnswer

On Review button click:
  PRSScorecard ──► setSelectedFix(fix) ──► setModalOpen(true)
  ApprovalModal renders

On Approve click:
  ApprovalModal ──► setApprovalStatus('confirmed') [local state only]
               ──► NO API call
```

## Styling Conventions

- Tailwind CSS utility classes throughout
- Design tokens mapped to Tailwind config: `navy` = `#1B3A5C`, `teal` = `#0E7C7B`
- All monetary values in GBP (£ symbol)
- No inline styles except dynamic SVG arc calculations in ScoreDial
