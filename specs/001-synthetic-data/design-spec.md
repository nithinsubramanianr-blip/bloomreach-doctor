---
feature: Synthetic Data Layer
spec_id: "001"
phase: design
owner: Architect
status: approved
version: "1.0"
---

# Design Spec — Synthetic Data Layer (001 / C5)

## Canonical Data Schemas

### Dimension Object (M1→M2 contract — applies to all C5 dimension data)
```typescript
interface DimensionObject {
  dimension_id: 'bruid_match_rate' | 'autosegment_coverage' | 'signal_freshness' | 'rule_conflicts' | 'ab_test_coverage';
  dimension_name: string;
  raw_value: number;          // float 0.0–1.0
  normalised_score: number;   // int 0–20
  max_score: 20;
  status: 'critical' | 'warning' | 'healthy';
  data_source: 'discovery_api' | 'marketing_mcp' | 'analytics_mcp';
  is_synthetic: boolean;
  timestamp: string;          // ISO8601
}
```

### PRS State Object (M2→M4 contract)
```typescript
interface PRSState {
  composite_score: number;    // int 0–100
  rag_status: 'red' | 'amber' | 'green';
  boost_rules_state: 'all_inactive' | 'all_active';
  dimensions: DimensionObject[];  // exactly 5
  generated_at: string;       // ISO8601
}
```

### Persona Object
```typescript
interface Persona {
  persona_id: 'guest' | 'sarah' | 'alex';
  display_name: string;
  archetype_name: string;
  bruid_present: boolean;
  bruid_value: string | null;  // null for guest
  segment_name: string;
  demo_query: 'necklace';      // always "necklace"
  purchase_count: number;
  aov: number;                 // GBP
}
```

### Fix Object (fix_catalogue.json)
```typescript
interface FixObject {
  fix_id: string;
  rank: 1 | 2 | 3;
  dimension_linked: string;
  fix_title: string;
  plain_english_description: string;
  effort_level: 'Low' | 'Medium' | 'High';
  estimated_revenue_impact: string;
  action_label: string;
  risk_level: 'Low' | 'Medium' | 'High';
  steps: string[];
}
```

### Cached Result File (cached-results/{persona}-{state}.json)
```typescript
interface CachedResult {
  _meta: {
    persona_id: string;
    state: 'before' | 'after';
    cache_key: string;          // "{persona_id}-{state}"
    ttl_seconds: 300;
    boost_rules_active: boolean;
    generated_at: string;
  };
  query: 'necklace';
  total: number;
  products: DiscoveryProduct[];  // populated from live Discovery calls
}

interface DiscoveryProduct {
  product_id: string;
  name: string;
  price: number;
  currency: 'GBP';
  category: string;
  rank_position: number;         // 1-based rank in result set
  is_personalised?: boolean;     // true for top 3 in after state
}
```

## Locked Demo Values

| File | Key field | Locked value |
|---|---|---|
| prs_pre_fix.json | composite_score | 52 |
| prs_pre_fix.json | boost_rules_state | "all_inactive" |
| prs_post_fix.json | composite_score | 70 |
| prs_post_fix.json | boost_rules_state | "all_active" |
| personas.json | demo_query (all) | "necklace" |
| fix_catalogue.json | fixes[0].rank | 1 (AutoSegment) |

These values are immutable. Dev MUST NOT compute them — read from file.

## Edge Cases

- **Broken product images:** `image_url` is a placeholder path. M4 and M5 components render a grey box on 404. No console error surfaced to user.
- **Empty cached-results products array:** Placeholder files ship with `products: []`. Before demo day, TA1/TA2 populates these from live Discovery calls. M4 and M5 must handle empty array gracefully — show skeleton state, not crash.
- **Guest persona bruid_value null:** M5 MUST NOT set any `_br_uid_2` cookie when `bruid_value === null`. Not an empty string — the cookie must not exist.
