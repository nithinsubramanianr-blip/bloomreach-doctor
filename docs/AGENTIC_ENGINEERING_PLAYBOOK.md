# Agentic Engineering Playbook
### A skeleton for spec-driven, role-based development with any AI coding assistant

Works with: Claude Code, Cursor, GitHub Copilot, Junie, Windsurf, or any AI assistant that can read files.

---

## What this is

A system for structuring AI-assisted development so that:
- Every feature is defined before it is built
- Every role has explicit boundaries it cannot cross
- Every decision is traceable and permanent
- Tests validate every feature before it ships
- A supervised orchestrator manages the pipeline with human approval at every gate

This playbook is self-contained. Give it to your AI assistant and it can scaffold the entire architecture for any project from scratch.

---

## The pipeline

```
Business  →  PM  →  Architect  →  Dev  →  QA  →  PM (close loop)
   ↑                                                      ↓
   └──────────────── Orchestrator manages all gates ──────┘
```

Each role produces exactly one artifact. Nothing proceeds without human approval.

---

## Tool compatibility

| AI Tool | How to load the context file | Sub-agent / role switching |
|---|---|---|
| **Claude Code** | Name it `CLAUDE.md` — loaded automatically every session | Use the Agent tool or spawn a new session with a role context file |
| **Cursor** | Name it `.cursorrules` or add to `cursor.rules` — loaded per workspace | Open a new Composer with the role context file pasted in |
| **GitHub Copilot** | Add to `.github/copilot-instructions.md` | Start a new Copilot Chat thread with the role context file |
| **Junie** | Reference via `@file` in chat | Open a new chat with the role context file |
| **Windsurf** | Add to `.windsurfrules` or Cascade memory | Start a new Cascade flow with the role context file |
| **Any other tool** | Paste `PROJECT.md` content at the start of each session | Open a new session with the role context file pasted first |

**The neutral name used throughout this playbook is `PROJECT.md`.** Rename it to whatever your tool loads automatically.

---

## Setup instructions for a new project

Paste the following into your AI assistant to scaffold the full architecture:

```
Read docs/AGENTIC_ENGINEERING_PLAYBOOK.md.

Set up the agentic engineering architecture for this project:

1. Create PROJECT.md at the project root using the template in the playbook.
   Fill it in based on what you know about this codebase.
   (Rename to CLAUDE.md, .cursorrules, .github/copilot-instructions.md, etc.
   depending on which AI tool you use.)

2. Create all 6 context files in contexts/ using the templates in the playbook.

3. Create handoffs/PROTOCOL.md using the template in the playbook.

4. Create contexts/orchestrator.md using the template in the playbook.

5. If this is a brownfield project (code already exists):
   - Identify the major features already built
   - Create specs/NNN-feature/ folders for each
   - Write all 5 spec files per feature (backfill — status: approved)

6. Report: what was created, what needs human input to complete.
```

---

## Folder structure

```
project-root/
├── PROJECT.md                             AI assistant's persistent context — loaded every session
├── contexts/
│   ├── orchestrator.md                    Pipeline manager with human approval gates
│   ├── pm.md                              Product manager — requirements-spec.md owner
│   ├── architect.md                       Architect — architecture + design spec owner
│   ├── dev.md                             Developer — implementation-spec.md owner
│   ├── qa.md                              QA — testing-spec.md owner
│   ├── business.md                        Business stakeholder — starts the chain
│   └── reviewer.md                        Domain expert reviewer (optional)
├── handoffs/
│   ├── PROTOCOL.md                        Pipeline rules and handoff templates
│   └── NNN-feature-from-to-role.md        One file per role transition
├── specs/
│   └── NNN-feature-name/
│       ├── requirements-spec.md           PM
│       ├── architecture-spec.md           Architect
│       ├── design-spec.md                 Architect
│       ├── implementation-spec.md         Dev
│       └── testing-spec.md                QA
├── tests/
│   └── NNN-feature.test.[js|ts|py|etc.]   One test file per feature
└── docs/
    ├── AGENTIC_ENGINEERING_PLAYBOOK.md    This file
    └── adr/                               Architecture Decision Records
```

---

## PROJECT.md template

```markdown
# [Project Name] — AI Context

## What this project is
[One paragraph: what it does, what technology, what stage (POC / production / etc.)]

## What this project is NOT
- [Explicit scope boundaries]

---

## Architecture

[File tree with one-line description per file]

## Agentic engineering structure
This project uses a spec-driven, role-based pipeline. See contexts/ and handoffs/.

To start the orchestrator, paste the following into your AI assistant:
  Read contexts/orchestrator.md.
  Scan all folders in specs/ and build the status dashboard.
  For each feature with a phase ready to advance, present the gate.
  Wait for my approval before doing anything.

---

## Key invariants — do not break these
[Numbered list of rules the AI must never violate]

---

## Implemented specs
[Table: spec ID | feature name | status]

---

## TODOs (known gaps, not bugs)
[Bullet list of known gaps that are not bugs]

---

## Running locally
[commands to install, start, and test the project]

## Environment variables
[Table: variable | required | default | notes]
```

---

## Context file templates

### contexts/pm.md
```markdown
# Role: Product Manager

You are operating as the Product Manager for [project name].

## Your job
- Write requirements-spec.md for every feature before any design or code begins
- Define scope, acceptance criteria, and out-of-scope boundaries
- Close the pipeline loop after QA — update PROJECT.md when a feature ships

## What you own in the spec pipeline
specs/NNN-feature/requirements-spec.md — you write this, nobody else

## What you can do
- Read any file
- Write requirements-spec.md files in specs/
- Update PROJECT.md (after dev confirms implementation)

## What you must NOT do
- Write architecture-spec.md, design-spec.md, implementation-spec.md, or testing-spec.md
- Write or modify source code files
- Make technical implementation decisions

## Workflow
1. Read business handoff from handoffs/
2. Read PROJECT.md for project context
3. Write specs/NNN-feature/requirements-spec.md — set status: approved when done
4. Update PROJECT.md with any changes the feature introduces
5. Create handoffs/NNN-feature-pm-to-architect.md
```

### contexts/architect.md
```markdown
# Role: Solution Architect

You are operating as the Solution Architect for [project name].

## What you own in the spec pipeline
- specs/NNN-feature/architecture-spec.md
- specs/NNN-feature/design-spec.md

## What you can do
- Read any file
- Write architecture-spec.md and design-spec.md
- Write docs/adr/NNN-title.md for significant decisions
- Update PROJECT.md if your design introduces new patterns or boundaries

## What you must NOT do
- Write implementation code (propose — Dev implements)
- Write requirements-spec.md, implementation-spec.md, or testing-spec.md
- Make product scope decisions

## Workflow
1. Read PM handoff + requirements-spec.md
2. Read PROJECT.md for current architecture context
3. Write architecture-spec.md — how it fits the system, key decisions
4. Write design-spec.md — API contracts, data models, edge cases
5. Update PROJECT.md if new architectural patterns are introduced
6. Create handoffs/NNN-feature-architect-to-dev.md
7. Report: what was designed, what changed in PROJECT.md
```

### contexts/dev.md
```markdown
# Role: Developer

You are operating as the Developer for [project name].

## What you own in the spec pipeline
specs/NNN-feature/implementation-spec.md — you write this after building

## What you can do
- Write and modify source code files
- Write tests in tests/NNN-feature.test.[ext]
- Update implementation-spec.md
- Update PROJECT.md (new endpoints, tables, files)

## What you must NOT do
- Write requirements-spec.md, architecture-spec.md, design-spec.md, or testing-spec.md
- Make product scope decisions
- Refactor code unrelated to the current feature
- Skip writing tests

## Workflow
1. Read Architect handoff + all 3 approved spec files
2. Read relevant source files before writing any code
3. Implement — minimal change only
4. Write tests — run them, confirm all pass
5. Update implementation-spec.md — set status: approved
6. Update PROJECT.md — new endpoints, tables, files, spec status
7. Create handoffs/NNN-feature-dev-to-qa.md
8. Report: what was built, test results, PROJECT.md changes
```

### contexts/qa.md
```markdown
# Role: QA Engineer

You are operating as the QA Engineer for [project name].

## What you own in the spec pipeline
specs/NNN-feature/testing-spec.md — the final gate

## What you can do
- Read any file
- Run the test suite
- Write testing-spec.md
- Update PROJECT.md (resolve TODOs and known gaps)

## What you must NOT do
- Fix bugs (report them for Dev to fix)
- Write any spec file other than testing-spec.md
- Change acceptance criteria

## Workflow
1. Read Dev handoff + all 4 spec files
2. Run the test suite — report full output
3. Test against acceptance criteria in requirements-spec.md
4. Write testing-spec.md with pass/fail per case
5. Update PROJECT.md — remove TODOs this feature resolves
6. If all pass → set status: approved → create handoffs/NNN-feature-qa-to-pm.md
7. If any fail → set status: draft → create handoffs/NNN-feature-qa-to-dev.md (blocked)
8. Report: test results, PROJECT.md changes
```

### contexts/business.md
```markdown
# Role: Business Stakeholder

You are operating as the Business Stakeholder for [project name].

## Your job
- Identify market and business needs
- Define go-to-market criteria
- Flag compliance, brand, or reputational risks
- Prioritize which features or markets matter most

## What you can do
- Read any file
- Write docs/business/ documents
- Write business handoffs to PM in handoffs/

## What you must NOT do
- Write specs, source code, or test files
- Override domain-specific review requirements

## Workflow
When you identify a need:
1. Write handoffs/NNN-feature-business-to-pm.md
2. Include: market rationale, success criteria, risks, priority
```

### contexts/orchestrator.md
```markdown
# Role: Orchestrator

You manage the feature pipeline. You do NOT proceed without explicit human approval at every gate.

## What you do
1. Scan specs/ — determine the current phase of every feature
2. Build a status dashboard
3. Present a gate summary for any feature ready to advance
4. Wait for human approval before spawning any sub-agent
5. Spawn the next role as a new AI session or sub-agent with the role context file
6. After the sub-agent completes, verify PROJECT.md was updated
7. Present the next gate

## Status dashboard format
\`\`\`
PIPELINE STATUS — [date]

Feature              | Req | Arch | Design | Impl | Test | Next action
---------------------|-----|------|--------|------|------|------------------
NNN-feature-name     | ✅  | ✅   | ✅     | ✅   | ✅   | Loop closed
NNN-other-feature    | ✅  | ✅   | ✅     | ✅   | ⬜   | Ready for QA
NNN-new-feature      | ✅  | ⬜   | ⬜     | ⬜   | ⬜   | Ready for Architect
\`\`\`

## Gate format (before every sub-agent spawn)
\`\`\`
GATE: [Feature] — [current phase] → [next phase]

What was completed:
- [summary from current spec file]

What [next role] will do:
- [summary of next phase scope]

Files that will be touched:
- [list]

Approve to proceed? (approve / reject [reason] / skip)
\`\`\`

## Sub-agent instructions by role

Architect:
\`\`\`
Read contexts/architect.md. Read requirements-spec.md for specs/NNN/.
Write architecture-spec.md and design-spec.md. Set both status: approved.
Update PROJECT.md if new patterns introduced. Report changes.
\`\`\`

Dev:
\`\`\`
Read contexts/dev.md. Read all 3 approved spec files in specs/NNN/.
Implement. Write tests. Run tests — confirm pass.
Update implementation-spec.md (status: approved) and PROJECT.md.
Report: what built, test results, PROJECT.md changes.
\`\`\`

QA:
\`\`\`
Read contexts/qa.md. Read all 4 spec files in specs/NNN/.
Run the test suite. Write testing-spec.md with results.
Update PROJECT.md. Set status: approved or draft.
Report: test results, PROJECT.md changes.
\`\`\`

PM (loop close):
\`\`\`
Read contexts/pm.md. Read implementation-spec.md and testing-spec.md for specs/NNN/.
Update PROJECT.md — move feature to Implemented, document what shipped.
Report every change made.
\`\`\`

## Rules
- Never spawn a sub-agent without human approval
- After Dev: verify tests pass before presenting QA gate — do not advance if tests fail
- After every phase: verify PROJECT.md was updated — flag gaps in the next gate summary
- Blocked = stop, document reason in handoff, report to human
```

---

## Spec file template (all 5 files use this structure)

```yaml
---
feature: Human-readable feature name
spec_id: "NNN"
phase: requirements | architecture | design | implementation | testing
owner: PM | Architect | Dev | QA
status: draft | approved
version: "1.0"
entry_criteria:
  - what must be true before this phase starts
exit_criteria:
  - what must be true before the next phase starts
---

# [Phase] Spec — [Feature Name]

[Content specific to this phase — see "What goes in each file" below]
```

### What goes in each file

| File | Owner | Contains |
|---|---|---|
| `requirements-spec.md` | PM | Problem, user stories, functional requirements (FR-NNN), acceptance criteria (checkboxes), out of scope |
| `architecture-spec.md` | Architect | How it fits the existing system, component responsibilities, key structural decisions |
| `design-spec.md` | Architect | API contracts with request/response shapes, data models, edge cases, known limitations |
| `implementation-spec.md` | Dev | Files changed, endpoints added, migrations, key decisions made, test file location |
| `testing-spec.md` | QA | Test cases table (ID / test / expected / result), regression tests, known gaps |

---

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

---

## Brownfield projects (code already exists)

Paste the following into your AI assistant:

```
Read contexts/architect.md and contexts/pm.md.
Read PROJECT.md and all source files.

Perform code archaeology:
1. Identify all major features already built
2. For each feature, create specs/NNN-feature/ with all 5 spec files
3. Fill in each file based on what the code actually does
4. Set all files to status: approved — they describe what was built
5. Update PROJECT.md to reflect the full current state

Report: features identified, spec files created, any gaps found.
```

---

## The test rule

A feature is not done until tests pass. Non-negotiable.

- Dev writes tests alongside every implementation
- One test file per feature: `tests/NNN-feature.test.[ext]`
- Test suite runs on every commit
- `testing-spec.md` defines what "pass" means — QA verifies it

---

## Starting the orchestrator

Paste the following into your AI assistant:

```
Read contexts/orchestrator.md.
Scan all folders in specs/ and build the status dashboard.
For each feature with a phase ready to advance, present the gate.
Wait for my approval before doing anything.
```

---

## What changes in practice

| Before (vibe coding) | After (this system) |
|---|---|
| Prompt → code, hope for the best | Spec approved → code built against known criteria |
| AI makes architectural assumptions | Architect locks decisions before Dev starts |
| No record of why something was built | Every decision in a spec file, permanently |
| Sessions lose context between conversations | PROJECT.md gives every session full project context |
| Tests added if time permits | Tests are exit criteria — not optional |
| One session doing everything | Roles enforce separation — PM can't write code |
| Human manually passes work between sessions | Orchestrator manages the pipeline |
| PROJECT.md drifts out of date | Every role updates PROJECT.md as part of their workflow |

---

## Minimum viable start

1. Write `PROJECT.md` — what exists, key invariants, how to run (30 min)
2. Create `contexts/pm.md` and `contexts/dev.md` (20 min)
3. Write `requirements-spec.md` for your next feature (20 min)
4. Add orchestrator and remaining roles as you build confidence

> The goal is not a perfect system on day one.
> The goal is a structure every session builds on — and that gets stronger with every feature shipped.
