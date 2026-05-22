# Handoff Protocol — Personalization Performance Doctor

## Pipeline roles and ownership

| Role | Context file | Owns |
|---|---|---|
| Business | contexts/business.md | Business handoff to PM |
| PM | contexts/pm.md | requirements-spec.md |
| Architect | contexts/architect.md | architecture-spec.md, design-spec.md |
| Dev | contexts/dev.md | implementation-spec.md, source code, tests |
| QA | contexts/qa.md | testing-spec.md |
| Orchestrator | contexts/orchestrator.md | Pipeline management, gate approvals |
| Reviewer | contexts/reviewer.md | Domain accuracy review (optional gate) |

## Handoff naming convention

```
handoffs/NNN-feature-from-to-role.md
```

Examples:
- `001-readiness-dashboard-business-to-pm.md`
- `001-readiness-dashboard-pm-to-architect.md`
- `001-readiness-dashboard-architect-to-dev.md`
- `001-readiness-dashboard-dev-to-qa.md`
- `001-readiness-dashboard-qa-to-pm.md`  (loop close — success)
- `001-readiness-dashboard-qa-to-dev.md` (blocked — failure)

## Handoff template

```markdown
# Handoff: [Feature Name]

| Field | Value |
|---|---|
| Feature # | NNN |
| From | [Role] |
| To | [Role] |
| Status | ready |
| Date | YYYY-MM-DD |
| Spec file | specs/NNN-feature/[phase]-spec.md |

## Context
Why does this work exist?

## What was done
- Bullet list of decisions or work completed

## What the receiving role must do
1. Numbered steps — specific and actionable

## Acceptance criteria
- [ ] criterion 1
- [ ] criterion 2

## Files to read first
- `specs/NNN-feature/requirements-spec.md`
- [other relevant files]

## Do not change
[Explicit list of things that must not be touched]
```

## Gate rules

1. **No phase starts without an approved spec from the prior phase.** Status field must read `status: approved`.
2. **No code ships without passing tests.** QA gate is mandatory.
3. **CLAUDE.md is updated at every phase.** If a role completes work and CLAUDE.md is unchanged, flag it.
4. **Blocked = full stop.** Create a `qa-to-dev` (or equivalent) handoff with specific failure details. Do not continue to the next feature.
5. **Human approves every gate.** The Orchestrator presents the gate; a human types `approve` before work starts.

## Status values

| Status | Meaning |
|---|---|
| `draft` | Written but not yet reviewed by human |
| `approved` | Human-approved — work may proceed |
| `blocked` | Failed QA or human rejection — must return to prior role |

## Feature pipeline order

| Feature | Depends on |
|---|---|
| 001-readiness-dashboard | nothing |
| 002-shopper-simulator | nothing |
| 003-agent-diagnosis | 001 and 002 (consumes their outputs) |
