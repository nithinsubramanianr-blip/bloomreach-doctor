# MCP Limitations & Synthetic Fallback Map

Documents which PRS dimensions cannot currently be sourced live and why.

---

## Current Status (pending sandbox + Loomi MCP docs)

| Dimension | Live Source | Can Go Live? | Blocker |
|---|---|---|---|
| BRUID Match Rate | Discovery REST API | Yes — once BR sandbox credentials received | Credentials pending |
| AutoSegment Coverage | Loomi Marketing MCP | Yes — once MCP endpoint docs received | Loomi MCP docs + credentials pending |
| Signal Freshness | Loomi Marketing MCP | Yes — once MCP endpoint docs received | Loomi MCP docs + credentials pending |
| Rule Conflicts | Discovery REST API | Yes — once BR sandbox credentials received | Credentials pending |
| A/B Test Coverage | Loomi Analytics MCP | Yes — once MCP endpoint docs received | Loomi MCP docs + credentials pending |

**All 5 dimensions currently use synthetic fallback.** The fallback path returns identical schema so the app functions fully in demo mode.

---

## Synthetic Fallback Values

Pre-fix state (`prs_pre_fix.json`):

| Dimension | Synthetic Raw Value | Score |
|---|---|---|
| BRUID Match Rate | 0.22 | 8/20 |
| AutoSegment Coverage | 0.14 | 6/20 |
| Signal Freshness | 0.58 | 14/20 |
| Rule Conflicts | 0.95 | 18/20 |
| A/B Test Coverage | 0.14 | 6/20 |

Post-fix state (`prs_post_fix.json`):

| Dimension | Synthetic Raw Value | Score |
|---|---|---|
| BRUID Match Rate | 0.22 | 8/20 |
| AutoSegment Coverage | 0.68 | 16/20 |
| Signal Freshness | 0.58 | 14/20 |
| Rule Conflicts | 0.90 | 16/20 |
| A/B Test Coverage | 0.80 | 16/20 |

---

## Known Limitations

1. **Dynamic rule fetching** — `rule-manager.js` reads activation state (ACTIVE/INACTIVE) only. Rule conditions (e.g. `gift_eligible = true`) are hardcoded from demo setup. Post-hackathon: extend to fetch full rule definitions from Discovery merchandising API.

2. **Loomi AI MCP tool names unknown** — Marketing and Analytics MCP clients use placeholder endpoint config. Cannot be made live until Loomi MCP docs are received.

3. **BRUID persistence** — Guest sessions have no BRUID cookie. BRUID persistence for guest sessions is out of scope (Phase 2).

4. **A/B test granularity** — Analytics MCP coverage is a single float (% of traffic). Per-experiment breakdown is not modelled in this version.
