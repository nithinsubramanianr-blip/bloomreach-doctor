---
feature: Agent Diagnosis
spec_id: "003"
phase: requirements
owner: PM
status: draft
version: "1.0"
entry_criteria:
  - 001-readiness-dashboard requirements-spec.md is approved
  - 002-shopper-simulator requirements-spec.md is approved
  - ANTHROPIC_API_KEY available in environment
exit_criteria:
  - All functional requirements defined and numbered
  - Claude API usage boundaries defined (prompt safety, cost controls)
  - Acceptance criteria are testable (binary pass/fail)
  - Out-of-scope list prevents scope creep
  - Human has set status to approved
---

# Requirements Spec — Agent Diagnosis (003)

## Problem

The Readiness Dashboard (001) gives merchants a numeric score and a top-3 fix list. But merchants often need more: a plain-English explanation of *why* their score is low, *what specifically* is misconfigured, and *how exactly* to fix it with estimated business impact. Generating this diagnosis by hand requires a Bloomreach expert. The Agent Diagnosis module uses Claude to analyze the raw score data and generate a natural-language diagnosis and action plan automatically.

## User stories

- **US-003-1:** As a merchant, I want to click a "Run Diagnosis" button on the dashboard and receive a plain-English paragraph explaining what is wrong with my personalization setup, so I don't need to interpret raw scores myself.
- **US-003-2:** As a merchant, I want to see 3 specific, actionable fix recommendations with estimated revenue impact, so I know exactly what to do next.
- **US-003-3:** As an account manager, I want to copy the diagnosis output into a client-facing email or Slack message, so I can use it to start a remediation conversation.
- **US-003-4:** As a demo presenter, I want the diagnosis to run and render within 10 seconds, so the demo doesn't stall.

## Functional requirements

### Agent invocation

- **FR-003-1:** The module SHALL expose a "Run Diagnosis" button on the Readiness Dashboard. Clicking it SHALL trigger a Claude API call.
- **FR-003-2:** All Claude API calls SHALL go through `src/agent/` — no other module may import the Anthropic SDK.
- **FR-003-3:** The agent SHALL receive as input: the 5 sub-scores, the overall score, the top-3 fix list from 001, and the persona comparison summary from 002.
- **FR-003-4:** The agent SHALL use the Claude `claude-sonnet-4-6` model by default (configurable via environment variable `CLAUDE_MODEL`).
- **FR-003-5:** The API call SHALL include a system prompt that establishes the agent as a "Bloomreach personalization expert" and instructs it to be specific, data-driven, and action-oriented.
- **FR-003-6:** The agent SHALL NOT be given tools that write or mutate Bloomreach data. Read-only context only.

### Output

- **FR-003-7:** The diagnosis output SHALL include: (a) a 2–3 sentence executive summary of personalization health, (b) a numbered list of 3 specific fix recommendations, each with an estimated % lift to revenue per visit, (c) a one-sentence next step for each fix.
- **FR-003-8:** The output SHALL be rendered as formatted text (markdown → HTML). It SHALL NOT be rendered as raw markdown string.
- **FR-003-9:** The output SHALL be sanitized before rendering to prevent XSS. No user-controlled content is in the prompt, but Claude output must be treated as untrusted HTML.
- **FR-003-10:** The UI SHALL show a loading state ("Analyzing your personalization data...") while the API call is in flight.
- **FR-003-11:** The UI SHALL show a graceful error state if the API call fails (timeout or error), with a retry button.

### Cost and safety controls

- **FR-003-12:** The prompt sent to Claude SHALL be constructed entirely from structured data (scores, labels, thresholds) — no free-text user input is injected into the prompt.
- **FR-003-13:** `max_tokens` SHALL be capped at 800 to bound response length and API cost.
- **FR-003-14:** The API key SHALL be read from `ANTHROPIC_API_KEY` environment variable and NEVER embedded in source code or committed to version control.

### Copy and share

- **FR-003-15:** The rendered diagnosis SHALL have a "Copy to clipboard" button that copies the plain-text version of the diagnosis.

## Acceptance criteria

- [ ] Clicking "Run Diagnosis" triggers a Claude API call and renders output within 10 seconds
- [ ] Loading state is shown while the call is in flight
- [ ] Error state and retry button appear when the call fails (simulate with invalid API key)
- [ ] Diagnosis output includes executive summary, 3 numbered fixes with revenue impact estimates, and next steps
- [ ] Output is rendered as HTML (not raw markdown string)
- [ ] No XSS vulnerability — output is sanitized before DOM insertion
- [ ] API key is not present in any source file (grep check in tests)
- [ ] "Copy to clipboard" button copies plain text correctly
- [ ] `max_tokens` is capped at 800 in all API calls
- [ ] No Anthropic SDK import outside of `src/agent/`

## Out of scope for this feature

- Streaming responses (single response only in this version)
- Multi-turn conversation / chat interface
- Saving or persisting diagnosis history
- Sending diagnosis via email or Slack from within the app
- Claude tool use / function calling (text generation only)
- Custom prompt editor for merchants
