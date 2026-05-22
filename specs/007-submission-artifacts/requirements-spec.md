---
feature: Submission Artifacts
spec_id: "007"
phase: requirements
owner: PM
status: approved
version: "2.0"
entry_criteria:
  - 002-bloomreach-integration architecture decisions stable
  - 005-dashboard-ui demo stable and recordable
  - All five build modules (M1–M5) demo-ready
exit_criteria:
  - All 6 artifact files exist in docs/submission/
  - Demo video recorded
  - Human has reviewed all written artifacts
  - Human has set status to approved
---

# Requirements Spec — Submission Artifacts (007)

## Deadline
**Jun 2, 2026 — 4:00 PM PST (5:30 AM IST Jun 3)**. Hard cutoff. Demo Day is **Jun 4, 2026**.

## Functional Requirements

### Artifact 1 — Project Summary
- **FR-007-1:** `/docs/submission/project-summary.md` — ~500 words, plain English.
- **FR-007-2:** Must cover: problem (Amanda's quote), solution (PRS + NL agent), user (Amanda Valdez), MCP usage (Marketing + Analytics MCP explicitly named), business impact, Option X demo mechanic.

### Artifact 2 — Demo Video
- **FR-007-3:** 5–6 minutes. Screen recording with narration.
- **FR-007-4:** Flow: Module A (52/100 PRS) → Module C (Ask the Doctor — show reasoning trace) → Module B (Before/After persona comparison) → Option X (rules activate, score moves to 70) → ApprovalModal.
- **FR-007-5:** Must include at least one live Module C interaction showing reasoning trace with tool calls visible.
- **FR-007-6:** Record a backup screenshot walkthrough in case live demo fails during judging.
- **FR-007-7:** Video link documented in `/docs/submission/demo-video-link.md`.

### Artifact 3 — Architecture Overview
- **FR-007-8:** `/docs/submission/architecture-diagram.md` — Mermaid or ASCII diagram.
- **FR-007-9:** Must show: Browser (M4+M5) → M3 NL → M2 Scoring → M1 Bloomreach Layer → Discovery API + Engagement API + Marketing MCP + Analytics MCP → C5 Synthetic fallback.
- **FR-007-10:** Must annotate which surfaces are live vs synthetic in the demo.

### Artifact 4 — MCP Usage Explanation
- **FR-007-11:** `/docs/submission/mcp-usage.md` — which surfaces, which tools, how deeply used, why.
- **FR-007-12:** Must explicitly name Marketing MCP tools (AutoSegment coverage, signal freshness) and Analytics MCP tools (A/B test coverage).
- **FR-007-13:** Must explain why BRUID and rule conflicts use Discovery REST API not MCP.

### Artifact 5 — Responsible Design Note
- **FR-007-14:** `/docs/submission/responsible-design.md` — data handling, approval flow, simulated vs executed.
- **FR-007-15:** Must explicitly state: ApprovalModal records intent in application state only. No live API write. TA1 activates rules manually.
- **FR-007-16:** Must address: no PII in synthetic data, no credentials in source, what changes for production.

### Artifact 6 — Team Details
- **FR-007-17:** `/docs/submission/team.md` — names, roles, Slack handles, one-line bio per member.

## Acceptance Criteria
- [ ] All 6 artifact files exist in `docs/submission/`
- [ ] Project summary is 400–600 words and names Marketing MCP and Analytics MCP
- [ ] Architecture diagram shows all four Bloomreach data surfaces
- [ ] MCP usage doc names specific tools per surface
- [ ] Responsible design note states "no API write" explicitly
- [ ] Demo video is 5–7 minutes
- [ ] Team details file is complete with Slack handles

## Out of Scope
- Marketing copy or press releases
- Investor pitch deck
