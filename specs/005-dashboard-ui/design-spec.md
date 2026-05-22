---
feature: PPD Dashboard UI
spec_id: "005"
phase: design
owner: Architect
status: approved
version: "1.0"
---

# Design Spec — PPD Dashboard UI (005 / M4)

## Component Props

### App.tsx (root state)
```typescript
// State owned by App
interface AppState {
  activeTab: 'scorecard' | 'simulator' | 'doctor';
  prsState: PRSState | null;
  isModalOpen: boolean;
  selectedFix: FixResult | null;
  approvedActions: ApprovedAction[];
}

interface ApprovedAction {
  fix_id: string;
  approved_at: string;  // ISO8601
  status: 'pending_team_review';
}
```

### ScoreDial.tsx
```typescript
interface ScoreDialProps {
  score: number;        // 0–100
  ragStatus: 'red' | 'amber' | 'green';
  size?: number;        // px, default 180
}
// Colours: red=#DC2626, amber=#F59E0B, green=#16A34A
```

### PRSScorecard.tsx (Module A)
```typescript
interface PRSScorecardProps {
  prsState: PRSState;
  onReviewFix: (fix: FixResult) => void;
}
// Renders ScoreDial, 5 DimensionRows, 3 FixCards
// "Last refreshed" from prsState.generated_at
```

### DimensionRow (internal to PRSScorecard)
```typescript
// Source label mapping:
// discovery_api → "Discovery API"
// marketing_mcp → "Marketing MCP"
// analytics_mcp → "Analytics MCP"
// Status badge colours: critical=red, warning=amber, healthy=green (Tailwind)
```

### ApprovalModal.tsx
```typescript
interface ApprovalModalProps {
  isOpen: boolean;
  fix: FixResult | null;
  onApprove: (fix: FixResult) => void;    // sets local approvedActions
  onReviewLater: () => void;              // closes modal
  onDismiss: () => void;                  // closes modal
}
// Approve button: teal #0E7C7B filled
// Review Later: grey outlined
// Dismiss: text link
// On Approve: renders "Action logged for review by your team" — NO API call
// Focus trap while open, close on Escape, return focus to trigger on close
```

### ShopperSimulator.tsx (Module B)
```typescript
interface ShopperSimulatorProps {
  personas: Persona[];    // from personas.json via M1
}

// Internal state
interface SimulatorState {
  activePersona: 'guest' | 'sarah' | 'alex';
  displayState: 'before' | 'after';
  products: DiscoveryProduct[];
  isLoading: boolean;
}

// Banner text (exact — do not paraphrase):
// "Before: generic ranking — After: personalised results following Doctor recommendations."
```

### ProductCard (internal to ShopperSimulator)
```typescript
interface ProductCardProps {
  product: DiscoveryProduct;
  rankPosition: number;
  rankChange?: 'up' | 'down' | 'same';   // only in 'after' state
  displayState: 'before' | 'after';
}
// Rank change: teal ↑ (up), grey ↓ (down), dash (same)
// "Personalised for you" badge: visible on top 3 in 'after' state only
```

### NLChat.tsx (Module C)
```typescript
interface NLChatProps {
  prsState: PRSState;
}

// Quick-action chip text (exact):
// 1. "Why is my personalisation not working?"
// 2. "What should I fix first?"
// 3. "Show me what good personalisation looks like for my top 3 customer types"

// Loading indicator text: "Consulting Bloomreach data..."
```

## Module B: Rank Change Calculation
```typescript
// Called when switching from 'before' to 'after'
function calculateRankChanges(
  beforeProducts: DiscoveryProduct[],
  afterProducts: DiscoveryProduct[]
): Map<string, 'up' | 'down' | 'same'> {
  // For each product_id in afterProducts:
  // find rank_position in beforeProducts
  // if after.rank_position < before.rank_position → 'up' (lower number = higher rank)
  // if after.rank_position > before.rank_position → 'down'
  // else → 'same'
}
```

## Loading & Error States

| Component | Loading | Error |
|---|---|---|
| PRSScorecard | Skeleton dial + 5 skeleton rows | Show last known state |
| ShopperSimulator | Grey skeleton product grid (same dimensions) | Serve from cached-results, no error message |
| NLChat | "Consulting Bloomreach data..." spinner | Error message + Retry button |
| ApprovalModal | N/A | N/A |

## Viewport Requirements
- 1280px: primary demo viewport — all elements visible without scroll
- 1920px: must render correctly (wider cards, same layout)
- 768px mobile: out of scope per requirements
