# Personalization Performance Doctor — AI Context

## What this project is
A diagnostic agent that audits how well Bloomreach Discovery's personalization is performing for an e-commerce brand. Demo persona: **Amanda Valdez, Digital Personalization Manager at Kendra Scott** (a jewelry retailer). The tool produces a Personalization Readiness Score (PRS), a ranked fix list, a static archetype simulator, and a natural-language chat interface powered by Claude. Built as a hackathon entry for the Bloomreach Loomi Connect Hackathon (deadline: Jun 2, 2026 — 4:00 PM PST / 5:30 AM IST Jun 3).

## What this project is NOT
- Not a live Bloomreach account integration (MCP clients are present but fall back to synthetic JSON)
- Not a production system — prototype / hackathon demo only
- Not a write/mutation tool — all Bloomreach data access is read-only
- Not a generic e-commerce analytics tool — scoped to Bloomreach Discovery personalization health

---

## Architecture

```
bloomreach-doctor/
├── CLAUDE.md                              This file — loaded every session
├── docs/
│   ├── AGENTIC_ENGINEERING_PLAYBOOK.md    Pipeline methodology reference
│   └── adr/                              Architecture Decision Records
├── contexts/                             Role context files for AI pipeline
├── handoffs/
│   ├── PROTOCOL.md                       Pipeline rules and handoff templates
│   └── *.md                              Per-feature role-transition handoffs
├── specs/
│   ├── 001-synthetic-data/               M5 — synthetic data & environment setup
│   ├── 002-mcp-integration/              M1 — three MCP/API clients + normaliser
│   ├── 003-prs-scoring-engine/           M2 — five scorers + calculator + fix generator
│   ├── 004-nl-interface/                 M3 — NL query handler + reasoning chain + LLM explainer
│   ├── 005-dashboard-ui/                 M4 — Module A (PRS) + B (Archetype Sim) + C (Chat) + ApprovalModal
│   └── 006-submission-artifacts/         M6 — architecture diagram, summary, MCP doc, responsible design note, demo script
├── tests/                                One test file per feature
├── data/                                 Synthetic JSON (Bloomreach data shapes)
│   ├── archetypes.json                   Four shopper archetypes (Prospective, New Customer, Gifting, Returning VIP)
│   ├── prs_demo_state.json               Locked demo scores (52/100 Amber)
│   ├── visitors.json                     Session-level visitor data with BRUIDs
│   ├── segments.json                     AutoSegment definitions and coverage
│   ├── signals.json                      Behavioral events with timestamps
│   ├── rules.json                        Personalization rules (some conflicting)
│   ├── tests.json                        A/B test configurations
│   ├── search-results.json               Per-archetype search results (personalized vs generic)
│   └── products.json                     Kendra Scott product catalog subset (20 items)
└── src/
    ├── m1-mcp/                           M1 — three data clients
    │   ├── marketing-client.js           Loomi Connect MCP → AutoSegments, signal freshness
    │   ├── analytics-client.js           Loomi Connect MCP → A/B test coverage, revenue baselines
    │   ├── discovery-client.js           Discovery REST API → BRUID match rate, rule conflicts
    │   └── normaliser.js                 Unifies all three sources into shared schema
    ├── m2-scoring/                       M2 — pure-function scoring
    │   ├── bruid-scorer.js
    │   ├── autosegment-scorer.js
    │   ├── signal-freshness-scorer.js
    │   ├── rule-conflict-scorer.js
    │   ├── ab-test-scorer.js
    │   ├── prs-calculator.js             Sums 5 sub-scores → PRS 0–100
    │   └── fix-generator.js              Ranks fixes by revenue impact
    ├── m3-nl/                            M3 — NL interface (Module C)
    │   ├── intent-classifier.js          Classifies query intent
    │   ├── reasoning-chain.js            Decides which tools to call
    │   ├── tool-executor.js              Calls MCP/API clients
    │   └── llm-explainer.js             Claude API → structured explanation
    ├── m4-ui/                            M4 — React UI
    │   ├── components/
    │   │   ├── ModuleA/                  PRS Scorecard tab
    │   │   ├── ModuleB/                  Archetype Simulator tab (static)
    │   │   ├── ModuleC/                  NL Chat Interface tab ("Ask the Doctor")
    │   │   └── ApprovalModal/            Human-in-the-loop fix approval modal
    │   └── App.tsx
    └── m5-data/                          M5 — data adapters (one per client)
        ├── synthetic-marketing.js
        ├── synthetic-analytics.js
        └── synthetic-discovery.js
```

---

## Three data surfaces (NOT one MCP pipe)

This is critical. The integration layer has **three separate clients**:

| Client | File | Source type | Data provided |
|---|---|---|---|
| Marketing client | `src/m1-mcp/marketing-client.js` | Loomi Connect MCP (HTTP) | AutoSegment coverage, signal freshness |
| Analytics client | `src/m1-mcp/analytics-client.js` | Loomi Connect MCP (HTTP) | A/B test coverage, revenue baselines |
| Discovery client | `src/m1-mcp/discovery-client.js` | Discovery REST API (separate auth) | BRUID match rate, rule conflict detection |

Each client has a synthetic fallback: if the live call fails or returns empty, fall back to the corresponding synthetic JSON in `/data/`. Both paths produce the same normalized schema (enforced by `normaliser.js`).

---

## Four shopper archetypes (Module B)

| Archetype | Demo query |
|---|---|
| Prospective — first visit, no login, browsing broadly | "necklace" |
| New Customer — purchased once, limited signal | "yellow rose" |
| Gifting Shopper — high intent, seasonal, price-sensitive | "necklace gift" |
| Returning VIP — repeat purchaser, known preferences, high LTV | "necklace gift" |

Full archetype profiles in `/data/archetypes.json`.

---

## Demo scenario — locked PRS values

| Dimension | Source | Score | Status |
|---|---|---|---|
| BRUID Match Rate | Discovery API | 8/20 | critical |
| AutoSegment Coverage | Marketing MCP | 12/20 | warning |
| Signal Freshness | Marketing MCP | 14/20 | warning |
| Rule Conflicts | Discovery API | 10/20 | warning |
| A/B Test Coverage | Analytics MCP | 8/20 | critical |
| **TOTAL** | | **52/100** | **Amber** |

RAG thresholds: Red < 50, Amber 50–74, Green 75+. BRUID Match Rate must be the top-ranked fix. The scoring engine must produce exactly 52/100 from `data/prs_demo_state.json`.

---

## Module C — NL Chat Interface ("Ask the Doctor")

Module C is the most critical component for the "Agent Behaviour & Intelligence" judging criterion (20% of score). It demonstrates: **understand → decide → recommend**.

Flow:
1. User types plain-English question (e.g., "Why is 1:1 personalization not working?")
2. Intent classifier categorises: diagnosis | fix-request | dimension-drill | archetype-compare
3. Reasoning chain decides which MCP tools / API calls to make
4. Tool executor calls the relevant clients
5. Evidence passed to Claude (`claude-sonnet-4-20250514`) for explanation
6. Response rendered with TWO visible sections:
   - **Collapsed "Reasoning trace"** panel — which tools were called and why
   - **Expanded plain-English explanation** — summary, score breakdown, top fixes, next action

Pre-loaded demo exchange: "Why is 1:1 personalization not working?" → full agent response showing reasoning trace.

---

## ApprovalModal (human-in-the-loop)

Required for "Responsible Design" submission artifact. Props: `action_title`, `action_description`, `estimated_impact`, `risk_level`. Three buttons:
- **Approve** (teal `#0E7C7B`) → confirmation state "Action logged for review by your team"
- **Review Later** (grey)
- **Dismiss** (text link)

---

## Design palette

| Token | Value | Usage |
|---|---|---|
| Navy | `#1B3A5C` | Header, nav |
| Teal | `#0E7C7B` | Active state, CTA, Approve button |
| Amber | warm amber | Warning indicators |
| White | `#FFFFFF` | Content area background |
| Red | system red | PRS < 50 |
| Green | system green | PRS 75+ |

---

## Agentic engineering structure
This project uses a spec-driven, role-based pipeline. See `contexts/` and `handoffs/`.

To start the orchestrator:
```
Read contexts/orchestrator.md.
Scan all folders in specs/ and build the status dashboard.
For each feature with a phase ready to advance, present the gate.
Wait for my approval before doing anything.
```

---

## Key invariants — do not break these

1. **Three clients, not one.** Marketing MCP, Analytics MCP, and Discovery REST are separate. Never merge them into a single client.
2. **Each client has a synthetic fallback.** Fallback must produce the exact same schema as the live path. Tested.
3. **Scoring functions are pure.** `src/m2-scoring/` functions take data objects, return numbers. No side effects, no async, no API calls.
4. **No live Bloomreach credentials in source.** All secrets via environment variables only.
5. **Specs before code.** No implementation starts until `requirements-spec.md` has `status: approved`.
6. **Tests are not optional.** Every feature ships with a passing test file in `tests/`.
7. **Read-only Bloomreach access.** The MCP clients must never call write/mutation tools.
8. **Claude API calls go through `src/m3-nl/llm-explainer.js` only.** No other file imports the Anthropic SDK.
9. **Module B is static.** The Archetype Simulator makes zero live API calls. All data loaded from `/data/` at page load.
10. **PRS demo produces exactly 52/100.** Do not adjust scores without updating `data/prs_demo_state.json` and this file.

---

## Feature pipeline (M1–M6)

| Spec ID | Module | Feature name | Folder | Req | Arch | Design | Impl | Test |
|---|---|---|---|---|---|---|---|---|
| 001 | M5 | Synthetic Data & Environment | /data/ | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 002 | M1 | MCP Integration Layer | /src/m1-mcp/ | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 003 | M2 | PRS Scoring Engine | /src/m2-scoring/ | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 004 | M3 | NL Interface (Ask the Doctor) | /src/m3-nl/ | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 005 | M4 | Dashboard UI (A + B + C + Modal) | /src/m4-ui/ | draft | ⬜ | ⬜ | ⬜ | ⬜ |
| 006 | M6 | Submission Artifacts | /docs/ | draft | ⬜ | ⬜ | ⬜ | ⬜ |

**Build dependency chain:**
- 001 (M5) → unblocks 003 and 004 in parallel
- 002 (M1) → feeds 003 (M2) → feeds 005 (M4)
- 002 (M1) → feeds 004 (M3) → feeds 005 (M4)
- 006 (M6) requires 002 architecture + 005 demo to be stable

---

## TODOs (known gaps, not bugs)
- Loomi Connect MCP server URL not yet available — all three clients fall back to synthetic JSON
- Architecture, design, implementation, and testing specs not yet written (awaiting requirements approval)
- React app scaffold not yet created
- Old spec folders (specs/001-readiness-dashboard/, specs/002-shopper-simulator/, specs/003-agent-diagnosis/) are superseded by the new M1–M6 structure — can be archived

---

## Running locally
```bash
npm install
npm run dev
npm test
```

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (M3) | — | Claude API for NL interface (Module C) |
| `LOOMI_CONNECT_MARKETING_URL` | No | — | Marketing MCP endpoint when available |
| `LOOMI_CONNECT_ANALYTICS_URL` | No | — | Analytics MCP endpoint when available |
| `BLOOMREACH_DISCOVERY_API_KEY` | No | — | Discovery REST API auth (separate from MCP) |
| `DATA_SOURCE` | No | `synthetic` | `synthetic` or `live` — controls all three client adapters |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Override Claude model for M3 |
| `VITE_APP_DEMO_BRAND` | No | `kendra-scott` | Brand name shown in UI |

---

## Judging criteria (20% each — know what we are optimising for)

| # | Criterion | How we address it |
|---|---|---|
| 1 | **Problem Relevance & Clarity** | Real user (Amanda Valdez), real problem (silent personalization failure), legible PRS score |
| 2 | **MCP Utilization & Depth** | Marketing MCP + Analytics MCP used meaningfully with specific tool calls shown in reasoning trace |
| 3 | **Agent Behaviour & Intelligence** | Module C: understand → decide → recommend chain with visible reasoning trace in UI |
| 4 | **Execution Quality & Feasibility** | Sound M1–M6 architecture, synthetic fallbacks, ApprovalModal for responsible design, passing tests |
| 5 | **Innovation & Differentiation** | PRS as a new abstraction; archetype simulator; human-in-the-loop fix approval |

**Criterion 3 (Agent Behaviour) is the highest-risk.** Module C must be demo-ready. Prioritise it if time is short.

---

## Submission artifacts (6 required — deadline Jun 2 4 PM PST)

| # | Artifact | Location | Status |
|---|---|---|---|
| 1 | Project summary (500 words) | docs/submission/project-summary.md | ⬜ |
| 2 | Demo video (5–6 min) | — | ⬜ |
| 3 | Architecture overview diagram | docs/submission/architecture-diagram.md | ⬜ |
| 4 | MCP usage explanation | docs/submission/mcp-usage.md | ⬜ |
| 5 | Responsible design note | docs/submission/responsible-design.md | ⬜ |
| 6 | Team details | docs/submission/team.md | ⬜ |

---

## Business impact targets
- PRS of 75+ within 90 days of tool adoption
- BRUID match rate: 70%+ (currently 40% in demo — top fix)
- AutoSegment coverage: 75%+
- Revenue per visit lift: 15%+
- At least 60% of recommended fixes acted on
