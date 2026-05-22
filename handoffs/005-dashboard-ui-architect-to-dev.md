# Handoff: 005 PPD Dashboard UI — Architect → Dev

**Date:** 2026-05-22
**From:** Architect
**To:** Dev
**Spec:** specs/005-dashboard-ui/

## What was designed

React/Vite app. Three tab modules. Module B is live (calls Discovery). ApprovalModal is state-only. Module C renders pre-loaded exchange on mount, calls M3 on submit.

## What Dev needs to implement

### Files to create/populate (`src/m4-dashboard/`)

| File | Key responsibility |
|---|---|
| `App.tsx` | Root state, tab routing, modal state |
| `modules/PRSScorecard.tsx` | Module A — dial, 5 rows, 3 fix cards |
| `modules/ShopperSimulator.tsx` | Module B — persona tabs, before/after, live Discovery |
| `modules/NLChat.tsx` | Module C — pre-loaded exchange, chips, chat input |
| `components/ScoreDial.tsx` | SVG/recharts dial for composite score |
| `components/ApprovalModal.tsx` | Modal — no API write, local state only |

### Critical implementation notes

**Module B must call live Discovery:**
```typescript
// In ShopperSimulator.tsx:
import { searchProducts } from '../../m1-bloomreach/discovery-client';
import resultCache from '../../m5-plp/lib/resultCache';
// Use resultCache first, fall back to searchProducts, fall back to data/cached-results/
```

**ApprovalModal — no API write:**
```typescript
// On Approve:
onApprove(fix);  // calls App.tsx setApprovedActions([...approvedActions, { fix_id, approved_at, status: 'pending_team_review' }])
// NO fetch(), NO axios.post(), NO any API call whatsoever
```

**Banner text (exact — copy this string):**
```
"Before: generic ranking — After: personalised results following Doctor recommendations."
```

**Quick-action chips (exact text — copy these strings):**
```
"Why is my personalisation not working?"
"What should I fix first?"
"Show me what good personalisation looks like for my top 3 customer types"
```

**Module C on mount:**
```typescript
const [exchanges, setExchanges] = useState([PRE_LOADED_EXCHANGE]);
// renders immediately — no useEffect API call
```

### Tests to write (`tests/m4-dashboard/`)
- App renders with navy header and three tabs (React Testing Library)
- ApprovalModal: Approve click updates state, no fetch called (jest.spyOn(global, 'fetch'))
- Module B: persona tab switch triggers searchProducts (mock M1)
- Module C: quick-action chip click calls handleQuery with correct text

## Critical constraints
- Module B: NEVER revert to static mockup — must call `searchProducts`
- ApprovalModal: ZERO API calls on Approve
- Three personas only: Guest, Sarah, Alex
- All prices in GBP (£)

## Dependency check
- 001 ✅, 002 ✅, 003 ✅, 004 ✅ approved
- 005 requirements-spec ✅, architecture-spec ✅, design-spec ✅ approved
