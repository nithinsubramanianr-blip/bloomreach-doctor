---
feature: Submission Artifacts
spec_id: "006"
module: M6
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - 002-mcp-integration architecture decisions are stable
  - 005-dashboard-ui demo is stable and recordable
  - All five modules (M1–M5) are in a demo-ready state
exit_criteria:
  - All 6 artifact files exist in docs/submission/
  - Demo video recorded and link documented
  - Human has reviewed all written artifacts
  - Human has set status to approved
---

# Requirements Spec — Submission Artifacts (006 / M6)

## Problem

The hackathon requires six specific artifacts alongside the working demo. These are evaluated by judges independently of the live demo. Missing or weak artifacts reduce scores on all five criteria even if the product itself is excellent.

## Deadline

**Jun 2, 2026 — 4:00 PM PST (5:30 AM IST Jun 3, 2026).** This is a hard cutoff. Artifact writing must begin no later than Jun 1.

## Functional requirements

### Artifact 1 — Project Summary

- **FR-006-1:** `/docs/submission/project-summary.md` SHALL be approximately 500 words.
- **FR-006-2:** SHALL cover: problem statement, solution overview, primary user (Amanda Valdez), value proposition, how Loomi Connect MCP is used, business impact claim.
- **FR-006-3:** Language SHALL be plain English, readable by a non-technical executive.

### Artifact 2 — Demo Video

- **FR-006-4:** Demo video SHALL be 5–6 minutes, screen recording with narration.
- **FR-006-5:** SHALL show end-to-end: Module A (PRS Scorecard) → Module C ("Ask the Doctor" — the key judging moment) → Module B (Archetype Simulator) → ApprovalModal interaction.
- **FR-006-6:** SHALL include at least one live Module C interaction (type a question, show reasoning trace and response).
- **FR-006-7:** Video link SHALL be documented in `/docs/submission/demo-video-link.md`.

### Artifact 3 — Architecture Overview

- **FR-006-8:** `/docs/submission/architecture-diagram.md` SHALL contain a text-based or mermaid diagram showing: Browser → M4 UI → M3 NL → M2 Scoring → M1 MCP (three clients) → Loomi Connect MCP + Discovery API + Synthetic fallback.
- **FR-006-9:** SHALL annotate which surfaces are live vs. synthetic in the demo.

### Artifact 4 — MCP Usage Explanation

- **FR-006-10:** `/docs/submission/mcp-usage.md` SHALL explain: which Loomi Connect MCP surfaces are used (Marketing, Analytics), which tools are called, what data is returned, and how that data flows into the PRS score and NL responses.
- **FR-006-11:** SHALL be explicit that Discovery data comes from a REST API, not MCP, and explain why.
- **FR-006-12:** SHALL note that MCP calls are currently stubbed to synthetic fallbacks and explain what "wiring in" the live URL would require (config change only).

### Artifact 5 — Responsible Design Note

- **FR-006-13:** `/docs/submission/responsible-design.md` SHALL cover:
  - What is simulated vs. what would be executed in production
  - How the ApprovalModal implements human-in-the-loop oversight for recommended fixes
  - Data handling — no PII in synthetic data, no credentials in source
  - What would need to change for production deployment (auth, rate limits, write permissions gating)

### Artifact 6 — Team Details

- **FR-006-14:** `/docs/submission/team.md` SHALL contain: team member names, roles, Slack handles, and a one-line bio per member.

## Acceptance criteria

- [ ] All 6 artifact files exist in `docs/submission/`
- [ ] Project summary is 400–600 words
- [ ] Architecture diagram clearly shows all three data surfaces (Marketing MCP, Analytics MCP, Discovery REST)
- [ ] MCP usage doc explicitly names which tools are called on each surface
- [ ] Responsible design note references the ApprovalModal by name
- [ ] Demo video is 5–7 minutes (slight buffer on upper end)
- [ ] Team details file is complete with Slack handles

## Out of scope for this feature

- Marketing copy or press releases
- Investor pitch deck
- Technical white paper
