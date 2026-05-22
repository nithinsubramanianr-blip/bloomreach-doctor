# Personalization Performance Doctor — AI Context

## What this project is
An AI diagnostic agent that audits Bloomreach Discovery personalization health for Kendra Scott. Demo user: **Amanda Valdez, Digital Personalization Manager, Kendra Scott**. The tool scores personalization across five dimensions into a PRS (Personalization Readiness Score), explains root causes in plain English, generates a ranked fix list, shows archetype-level search result comparisons, and keeps humans in control via an approval layer.

Hackathon: Bloomreach Loomi Connect AI Hackathon — Build window: May 26 – Jun 2, 2026. Submission deadline: **Jun 2, 2026 — 4:00 PM PST**. Demo Day: **Jun 4, 2026**.

---

## Five-Component Architecture

| Component | Name | What It Does | Owner |
|---|---|---|---|
| C1 | Next.js PLP | Product listing page. Renders Discovery search results. Persona switcher. Result caching. | TA3 |
| C2 | Bloomreach Discovery | 50-product catalogue. BRUID tracking. Three segment-scoped boost rules (pre-created **INACTIVE**). | TA1 |
| C3 | Bloomreach Engagement | Three persona behavioral profiles pre-seeded. Three manual segments linked to Discovery. | TA1 |
| C4 | PPD Agent | PRS dashboard (Modules A/B/C). NL interface with true agentic tool selection. Fix list. Human approval layer. | TA1+TA2+TA3 |
| C5 | Synthetic Data Layer | 50-product catalogue JSON/CSV. Persona event histories. PRS demo states. Fix catalogue. Cached results. | TA1+TA2 |

---

## Build Modules

| Module | Name | Folder | Owner |
|---|---|---|---|
| M1 | Bloomreach Integration Layer | `/src/m1-bloomreach/` | TA1 |
| M2 | PRS Scoring Engine | `/src/m2-scoring/` | TA2 |
| M3 | Natural Language Interface | `/src/m3-nl/` | TA2 |
| M4 | PPD Dashboard UI | `/src/m4-dashboard/` | TA3 |
| M5 | Next.js PLP | `/src/m5-plp/` | TA3 |

**Critical:** The integration layer folder is `/src/m1-bloomreach/` — NOT `/src/m1-mcp/`. All references must use this path.

---

## Directory Structure

```
bloomreach-doctor/
├── CLAUDE.md
├── .env.example
├── docs/
│   ├── AGENTIC_ENGINEERING_PLAYBOOK.md
│   ├── PPD_Developer_Onboarding_Kit.pdf
│   ├── mcp-tool-map.md          (Marketing + Analytics MCP tools mapped to PRS dimensions)
│   ├── mcp-limitations.md       (which dimensions cannot be sourced live → synthetic fallback)
│   ├── sandbox-confirmations.md (credentials confirmed + tool list per surface)
│   ├── boost-rules.md           (three boost rules spec — IDs, conditions, activation)
│   ├── demo-script.md           (step-by-step demo flow for recording)
│   └── adr/
├── contexts/                    (role context files)
├── handoffs/
│   ├── PROTOCOL.md
│   └── *.md
├── specs/
│   ├── 001-synthetic-data/
│   ├── 002-bloomreach-integration/
│   ├── 003-prs-scoring-engine/
│   ├── 004-nl-interface/
│   ├── 005-dashboard-ui/
│   ├── 006-nextjs-plp/
│   └── 007-submission-artifacts/
├── tests/
│   └── integration/
├── data/                        (C5 — Synthetic Data Layer)
│   ├── products.json            (50 generic jewellery products, GBP)
│   ├── products.csv             (same catalogue in CSV for Discovery import)
│   ├── personas.json            (3 personas: Guest, Sarah, Alex)
│   ├── prs_pre_fix.json         (locked 52/100 Amber — demo start state)
│   ├── prs_post_fix.json        (70/100 Amber trending Green — demo end state)
│   ├── fix_catalogue.json       (3 fixes, AutoSegment rank 1)
│   ├── segments.json            (3 segment definitions)
│   └── cached-results/          (pre-populated per persona+state for fallback)
│       ├── guest-before.json
│       ├── guest-after.json
│       ├── sarah-before.json
│       ├── sarah-after.json
│       ├── alex-before.json
│       └── alex-after.json
└── src/
    ├── m1-bloomreach/
    │   ├── discovery-client.js       (BRUID match rate, rule conflict detection)
    │   ├── engagement-client.js      (persona profiles, segment management)
    │   ├── marketing-mcp-client.js   (AutoSegment coverage, signal freshness)
    │   ├── analytics-mcp-client.js   (A/B test coverage, revenue baselines)
    │   ├── normaliser.js             (unifies all sources → common dimension schema)
    │   └── rule-manager.js           (reads rule activation state from Discovery)
    ├── m2-scoring/
    │   ├── dimension-scorers.js      (5 scorer functions in one file)
    │   ├── prs-calculator.js         (sums 5 sub-scores → composite PRS + RAG)
    │   ├── fix-generator.js          (ranks bottom dimensions → maps to fix_catalogue)
    │   └── __tests__/
    ├── m3-nl/
    │   ├── query-handler.js          (entry point — classifies intent, orchestrates)
    │   ├── reasoning-chain.js        (assembles context object for LLM)
    │   ├── tools-registry.js         (registers M1 fetchers as Claude tools)
    │   ├── llm-explainer.js          (ONLY file that imports @anthropic-ai/sdk)
    │   └── response-formatter.js     (formats agent response for M4)
    ├── m4-dashboard/
    │   ├── App.tsx
    │   ├── modules/
    │   │   ├── PRSScorecard.tsx      (Module A)
    │   │   ├── ShopperSimulator.tsx  (Module B — live Discovery calls)
    │   │   └── NLChat.tsx            (Module C)
    │   └── components/
    │       ├── ApprovalModal.tsx
    │       └── ScoreDial.tsx
    └── m5-plp/
        ├── app/page.tsx
        ├── components/PersonaSwitcher.tsx
        ├── components/ProductCard.tsx
        ├── lib/resultCache.ts
        └── lib/discoveryClient.ts
```

---

## Three Personas

| Persona | Display Name | Segment | BRUID | Demo Query |
|---|---|---|---|---|
| New Prospecting | Guest | New Prospecting | null (no cookie) | "necklace" |
| Gifting | Sarah | Gifting Intent | Pre-seeded from Engagement | "necklace" |
| High Value Returning | Alex | High Value Returning | Pre-seeded from Engagement | "necklace" |

**All three use the same query: "necklace" (hardcoded in PLP).** No per-persona queries.

Full profiles in `/data/personas.json`.

---

## PRS Demo States

### Pre-Fix State — 52/100 Amber (demo start)

| Dimension | Raw Input | Score | Status | Data Source |
|---|---|---|---|---|
| BRUID Match Rate | 0.22 (22%) | 8/20 | critical | Discovery API |
| AutoSegment Coverage | 0.14 (14%) | 6/20 | critical | Marketing MCP |
| Signal Freshness | 0.58 (58%) | 14/20 | warning | Marketing MCP |
| Rule Conflicts | 0.95 (95% conflict-free) | 18/20 | healthy | Discovery API |
| A/B Test Coverage | 0.14 (14%) | 6/20 | critical | Analytics MCP |
| **TOTAL** | | **52/100** | **Amber** | |

### Post-Fix State — 70/100 Amber trending Green (demo end)

| Dimension | Raw Input | Score | Status | Change Driver |
|---|---|---|---|---|
| BRUID Match Rate | 0.22 | 8/20 | critical | No change — strategic fix |
| AutoSegment Coverage | 0.68 | 16/20 | healthy | Segments created + rules active |
| Signal Freshness | 0.58 | 14/20 | warning | No change |
| Rule Conflicts | 0.90 | 16/20 | healthy | Minor — 3 new rules added |
| A/B Test Coverage | 0.14 | 6/20 | critical | No change |
| **TOTAL** | | **60/100** | **Amber** | |

> **⚠️ ARITHMETIC FLAG:** The post-fix dimension scores (8+16+14+16+6) sum to **60**, not 70 as stated in the spec. The individual dimension scores are used as canonical. Architect must resolve: either some dimension scores are wrong, or the total is wrong. **Do not change dimension scores without human confirmation.**

Scoring formula: `score = round(raw_percentage × 20)`, capped at 20. Status: 0–8 = critical, 9–14 = warning, 15–20 = healthy.

> **⚠️ FORMULA FLAG:** The stated formula `round(raw × 20)` does not produce the stated scores from the stated raw values (e.g. round(0.22 × 20) = 4, not 8). Architect must reconcile formula with locked scores before Dev implements scorers.

---

## Fix Catalogue — Ranked Order

| Rank | Fix | Dimension | Est. RPV Lift |
|---|---|---|---|
| 1 | Create 3 manual audience segments | AutoSegment Coverage | 12–18% |
| 2 | Enable BRUID persistence for guest sessions | BRUID Match Rate | 8–15% |
| 3 | Configure segment-scoped boost rules | Rule Conflicts | 5–10% |

Fix list from pre-fix state: rank 1 = AutoSegment, rank 2 = BRUID, rank 3 = A/B Coverage (sorted by score ascending, mapped to catalogue by revenue impact descending).

---

## Option X — Live Demo Mechanic

**This is the centrepiece of the demo.**

1. **Pre-demo:** All three boost rules are INACTIVE in Discovery merchandising UI
2. **During demo:** TA1 toggles rules from INACTIVE → ACTIVE in Discovery
3. **PLP results change in real time** per persona
4. **PRS dashboard refreshes** from 52/100 → 70/100

### Three Boost Rules (pre-created INACTIVE)

| Rule | Audience Segment | Boost Condition | State |
|---|---|---|---|
| Rule 1 | Gifting Intent | `gift_eligible = true` | **INACTIVE** |
| Rule 2 | High Value Returning | `is_new_arrival = true` OR `price_band = premium` | **INACTIVE** |
| Rule 3 | New Prospecting | `is_bestseller = true` | **INACTIVE** |

**Option Y fallback** (only if Discovery rule propagation > 60 seconds): pre-record two PLP states, cut into demo video.

---

## Module C — True Agentic Tool Selection

Module C uses Claude `claude-sonnet-4-20250514` with **native tool use (function calling)**. The five M1 data fetcher functions are registered as tools. Claude selects which tools to call at runtime. `tool_choice: { type: "auto" }`.

**This is NOT manual orchestration.** Claude decides which tools to call.

The reasoning trace is extracted from `tool_use` and `tool_result` content blocks in the Claude API response.

### Intent → Expected Tool Selection

| Intent | Example Query | Tools Selected |
|---|---|---|
| diagnosis | "Why is my personalisation not working?" | All 5 tools |
| fix-request | "What should I fix first?" | Bottom 2 dimension tools + fix catalogue |
| dimension-drill | "Why is my BRUID score so low?" | `fetchBRUIDMatchRate` only |
| archetype-compare | "Show me what good personalisation looks like for my top 3 customer types" | `fetchAutoSegmentCoverage` + `fetchSignalFreshness` + persona data |

Three pre-loaded quick-action chips in Module C:
1. "Why is my personalisation not working?"
2. "What should I fix first?"
3. "Show me what good personalisation looks like for my top 3 customer types"

**Option B fallback** (manual orchestration): activate ONLY if Option A not working by end of Day 3. Scores lower on Agent Behaviour criterion.

---

## Module B — Live Shopper Simulator

Module B is **NOT a static mockup**. It pulls live results from Discovery.

- Three persona tabs: Guest, Sarah, Alex
- Before/After toggle at top
- Each persona + state calls Discovery search API with correct BRUID context
- Rank position numbers on product cards
- Rank change indicators: teal ↑ (moved up), grey ↓ (moved down) — comparing after vs before
- Banner: "Before: generic ranking — After: personalised results following Doctor recommendations."
- Reuses result caching from M5 PLP — no duplicate Discovery calls
- `/data/cached-results/` as final fallback

---

## Module Integration Contracts (binding)

### M1 → M2: Normalised Dimension Array
Array of 5 objects. Per object:
```json
{
  "dimension_id": "string",
  "raw_value": "float 0.0–1.0",
  "normalised_score": "int 0–20",
  "status": "critical|warning|healthy",
  "data_source": "marketing_mcp|analytics_mcp|discovery_api",
  "timestamp": "ISO8601",
  "is_synthetic": "boolean"
}
```

### M2 → M4: PRS State Object
```json
{
  "composite_score": "int 0–100",
  "rag_status": "red|amber|green",
  "dimensions": "array of 5 dimension results",
  "fix_list": "array of 3 fix objects",
  "generated_at": "ISO8601"
}
```

### M3 → M4: Agent Response Object
```json
{
  "query": "string",
  "intent": "string",
  "reasoning_trace": [{ "tool_name": "", "tool_input": {}, "tool_output_summary": "" }],
  "llm_response": {
    "summary_sentence": "",
    "score_breakdown": "",
    "top_3_fixes": [],
    "suggested_next_action": ""
  },
  "timestamp": "ISO8601"
}
```

### M5 ↔ M4 Module B
Both call Discovery search API. Both use M5's result cache layer. No duplicate calls.

---

## ApprovalModal — NO API write

The approval modal records intent in **application state only**. No API write call is made. The Discovery rule toggle is a **separate manual action** performed by TA1 in the Discovery merchandising UI during the demo.

---

## Design Palette

| Token | Value | Usage |
|---|---|---|
| Navy | `#1B3A5C` | Header, labels |
| Teal | `#0E7C7B` | Active tab, CTAs, Approve button |
| Amber | `#F59E0B` | Warning indicators, PRS 50–74 |
| White | `#FFFFFF` | Card backgrounds |
| Red | `#DC2626` | PRS < 50 |
| Green | `#16A34A` | PRS 75+ |

---

## Mandatory Jest Tests

```
Test 1: prs_pre_fix.json → composite 52, rag_status "amber", BRUID and AutoSegment status "critical"
Test 2: prs_post_fix.json → composite [locked value], rag_status "amber", AutoSegment status "healthy"
Test 3: fix list from pre-fix → rank 1 = AutoSegment, rank 2 = BRUID, rank 3 = A/B Coverage
```

---

## Agentic Engineering Pipeline

To start the orchestrator:
```
Read contexts/orchestrator.md.
Scan all folders in specs/ and build the status dashboard.
For each feature with a phase ready to advance, present the gate.
Wait for my approval before doing anything.
```

---

## Key Invariants — Do Not Break

1. **M1 folder is `/src/m1-bloomreach/`** — never `/src/m1-mcp/`
2. **Four separate M1 clients** — discovery, engagement, marketing-mcp, analytics-mcp. Never merged.
3. **Each client has a synthetic fallback** — same schema both paths. Tested.
4. **Scoring functions are pure** — `src/m2-scoring/` only. No async, no side effects.
5. **`llm-explainer.js` is the only file that imports `@anthropic-ai/sdk`**
6. **Module C uses Claude native tool use** — `tool_choice: auto`. Claude decides which tools to call.
7. **Module B is live** — it calls Discovery search API. Never revert to static mockup.
8. **ApprovalModal = NO API write** — application state only.
9. **Currency is GBP throughout** — no USD in product data.
10. **Three personas only** — Guest, Sarah, Alex. No fourth persona.
11. **Demo query is "necklace" for all three personas** — hardcoded.
12. **No real Kendra Scott product data** — all 50 products are generic jewellery.
13. **No secrets in source** — all via `.env` / environment variables.
14. **Specs before code** — no implementation until `requirements-spec.md` is `status: approved`.

---

## Feature Pipeline

| Spec | Module | Feature | Req | Arch | Design | Impl | Test |
|---|---|---|---|---|---|---|---|
| 001 | C5 | Synthetic Data Layer | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 002 | M1 | Bloomreach Integration Layer | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 003 | M2 | PRS Scoring Engine | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 004 | M3 | Natural Language Interface | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 005 | M4 | PPD Dashboard UI | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 006 | M5 | Next.js PLP | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 007 | — | Submission Artifacts | draft | ⬜ | ⬜ | ⬜ | ⬜ |

Build dependency chain:
- 001 (C5) → unblocks 002, 003, 004 in parallel
- 002 (M1) → feeds 003 (M2) → feeds 005 (M4)
- 002 (M1) → feeds 004 (M3) → feeds 005 (M4)
- 002 (M1) → feeds 006 (M5)
- 007 requires 002 architecture stable + 005 demo stable

---

## Out of Scope

Do NOT build:
- BRUID persistence configuration (Phase 2)
- Amperity CDP integration (Phase 3)
- Approval modal triggering live API writes (Phase 2)
- Real Kendra Scott product data (post-hackathon)
- Monetate A/B test integration (not planned)
- More than 3 personas
- A fourth "browse-only teen" or "sale hunter" persona

---

## Branch Structure

```
main       (protected — only merged releases)
dev        (integration — all features merge here first)
feature/m1-bloomreach
feature/m2-scoring
feature/m3-nl
feature/m4-dashboard
feature/m5-plp
```

---

## TODOs (known gaps)

- Bloomreach sandbox credentials not yet received — all clients fall back to synthetic
- Architecture, design, implementation, testing specs not yet written (awaiting requirements approval)
- Post-fix total arithmetic discrepancy (8+16+14+16+6=60, spec says 70) — needs human confirmation
- Scoring formula discrepancy — `round(raw×20)` does not produce stated scores — Architect must resolve
- Old spec folders (001-readiness-dashboard, 002-shopper-simulator, 003-agent-diagnosis, 002-mcp-integration) are superseded

---

## Running Locally

```bash
npm install
npm run dev          # M4 dashboard (React/Vite)
npm run dev:plp      # M5 Next.js PLP
npm test             # Jest unit tests
npm run test:e2e     # Integration test (full demo flow)
```

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `BLOOMREACH_DISCOVERY_API_KEY` | Yes (M1) | — | Discovery REST API auth |
| `BLOOMREACH_ENGAGEMENT_API_KEY` | Yes (M1) | — | Engagement API auth |
| `BLOOMREACH_MCP_MARKETING_URL` | No | — | Marketing MCP endpoint |
| `BLOOMREACH_MCP_ANALYTICS_URL` | No | — | Analytics MCP endpoint |
| `ANTHROPIC_API_KEY` | Yes (M3) | — | Claude API — Module C |
| `NEXT_PUBLIC_DISCOVERY_ENDPOINT` | Yes (M5) | — | Discovery search endpoint for PLP |
| `DATA_SOURCE` | No | `synthetic` | `synthetic` or `live` |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Override Claude model |

---

## Judging Criteria (20% each)

| Criterion | How We Address It |
|---|---|
| Problem Relevance & Clarity | Real quote from Amanda Valdez. Real failing 1:1 test. 52/100 PRS tells the story immediately. |
| MCP Utilization & Depth | Marketing MCP (segments/signals) + Analytics MCP (A/B) used with specific tool calls shown in reasoning trace. |
| Agent Behaviour & Intelligence | Module C: Claude native tool use, `tool_choice: auto`. Reasoning trace visible in UI. |
| Execution Quality & Feasibility | Deterministic scoring engine. Two PRS states. Synthetic fallbacks. Passing Jest tests. |
| Innovation & Differentiation | PRS as novel abstraction. Live before/after via Option X. Human-in-loop approval layer. |

---

## Submission Artifacts (deadline Jun 2 4 PM PST)

| # | Artifact | Location | Status |
|---|---|---|---|
| 1 | Project summary (500 words) | docs/submission/project-summary.md | ⬜ |
| 2 | Demo video (5–6 min) | — | ⬜ |
| 3 | Architecture overview | docs/submission/architecture-diagram.md | ⬜ |
| 4 | MCP usage explanation | docs/submission/mcp-usage.md | ⬜ |
| 5 | Responsible design note | docs/submission/responsible-design.md | ⬜ |
| 6 | Team details | docs/submission/team.md | ⬜ |
