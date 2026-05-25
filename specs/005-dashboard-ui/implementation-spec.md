---
feature: PPD Dashboard UI
spec_id: "005"
phase: implementation
owner: Dev
status: approved
version: "1.0"
date: "2026-05-25"
---

# Implementation Spec — PPD Dashboard UI (005 / M4)

## Summary

M4 PPD Dashboard implemented as a React/Vite application mounted at `/doctor` route.
All five source files created, four tests written, 147/147 Jest tests passing, Vite build clean.

---

## Files Created

| File | Description |
|---|---|
| `src/m4-dashboard/App.tsx` | M4 root — tab state, PRS data load, modal state, approvedActions local state |
| `src/m4-dashboard/modules/NLChat.tsx` | Module C — pre-loaded exchange, chips, handleQuery, reasoning trace |
| `tests/m4-dashboard/dashboard.test.tsx` | 16 RTL tests across all four required test cases |

## Files Modified

| File | Change |
|---|---|
| `src/App.tsx` | Swapped `DashboardPlaceholder` import/route for `DashboardApp` from `src/m4-dashboard/App` |
| `src/m4-dashboard/modules/ShopperSimulator.tsx` | Changed `import { searchProducts }` to `require()` to fix Rollup CJS named-export build error |

## Pre-Existing M4 Files (not modified)

These files existed from spec 006 dev and were already complete:

| File | Status |
|---|---|
| `src/m4-dashboard/components/ApprovalModal.tsx` | No changes — already correct |
| `src/m4-dashboard/components/ScoreDial.tsx` | No changes — pure SVG arc, no dep |
| `src/m4-dashboard/modules/PRSScorecard.tsx` | No changes — complete |
| `src/m4-dashboard/modules/ShopperSimulator.tsx` | One-line import fix only |

---

## Design Decisions

### ScoreDial approach
Pure SVG arc — no recharts or lucide-react installed. 270° sweep, polar-to-Cartesian
arc calculation in component. RAG colours applied via `ragStatus` prop.
No new dependencies added.

### CJS interop (ShopperSimulator + NLChat + App.tsx)
M1, M2, and M3 modules use CommonJS `module.exports`. Rollup (used by Vite build)
cannot resolve named exports from CJS at build time. All three M4 files that
import from these modules use `require()` with inline TypeScript type annotations.
This satisfies Invariant #7 (searchProducts called from M1) while keeping the build
clean.

### NLChat pre-loaded exchange
`useState([PRE_LOADED_EXCHANGE])` — initialised from the imported constant with no
`useEffect` fetch call. Pre-loaded exchange renders synchronously on mount.

### ApprovalModal zero-API path
`onApprove(fix)` in ApprovalModal calls only the prop. App.tsx pushes
`{ fix_id, approved_at, status: 'pending_team_review' }` to `approvedActions[]`
local state. No `fetch`, `axios`, or `XMLHttpRequest` on the Approve path.
Verified by jest.spyOn test.

---

## Test Results

```
Test Suites: 14 passed, 14 total
Tests:       147 passed, 147 total  (131 pre-existing + 16 new M4 tests)
Snapshots:   1 passed, 1 total
```

### New M4 tests (tests/m4-dashboard/dashboard.test.tsx)

| # | Test | Result |
|---|---|---|
| 1a | Dashboard renders navy header with correct titles | PASS |
| 1b | Renders three tab labels (PRS Scorecard, Shopper Simulator, Ask the Doctor) | PASS |
| 1c | PRS Scorecard tab active by default with teal colour | PASS |
| 2a | ApprovalModal Approve calls onApprove, fetch NOT called | PASS |
| 2b | Approve path: no XHR/XMLHttpRequest call | PASS |
| 2c | App.tsx: approved action logged to local state, no fetch | PASS |
| 3a | ShopperSimulator renders three persona tabs | PASS |
| 3b | Sarah tab calls searchProducts with Sarah BRUID | PASS |
| 3c | Alex tab calls searchProducts with Alex BRUID | PASS |
| 3d | Guest tab calls searchProducts with null bruid | PASS |
| 4a | Chip 1 calls handleQuery with exact chip text | PASS |
| 4b | Chip 2 calls handleQuery with exact chip text | PASS |
| 4c | Chip 3 calls handleQuery with exact chip text | PASS |
| 4d | Pre-loaded exchange visible on initial render (no API call) | PASS |
| 4e | Reasoning trace panel present but collapsed by default | PASS |
| 4f | Reasoning trace panel expands on toggle click | PASS |

### ApprovalModal has zero API calls on the Approve path (verified by test)
Test 2a: `jest.spyOn(global, 'fetch')` confirms fetch was not called.
Test 2b: `jest.spyOn(XMLHttpRequest.prototype, 'open')` confirms XHR was not called.

---

## Vite Build

```
vite v5.4.21 building for production...
✓ 54 modules transformed.
dist/index.html                   0.42 kB │ gzip:  0.28 kB
dist/assets/index-CFlpxCNO.css   17.65 kB │ gzip:  4.16 kB
dist/assets/index-BPccvkB4.js   205.57 kB │ gzip: 64.83 kB
✓ built in 466ms
```

---

## Invariant Compliance

| Invariant | Status |
|---|---|
| #1 M1 folder is `/src/m1-bloomreach/` | Compliant — all imports use this path |
| #5 Only `llm-explainer.js` imports `@anthropic-ai/sdk` | Compliant — NLChat uses require of query-handler only |
| #7 Module B calls live Discovery | Compliant — searchProducts called via require in ShopperSimulator |
| #8 ApprovalModal = NO API write | Compliant — verified by two tests |
| #9 Currency is GBP | Compliant — all prices rendered with £ symbol |
| #10 Three personas only | Compliant — Guest, Sarah, Alex |
| #11 Demo query is "necklace" | Compliant — DEMO_QUERY constant |
