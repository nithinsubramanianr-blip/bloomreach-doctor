/**
 * Shared cross-module contracts for the Personalization Performance Doctor.
 *
 * These types are the single source of truth for the module boundaries defined
 * in CLAUDE.md (M1->M2, M2->M4, M3->M4). They are pure type declarations with
 * no runtime code, so both server and client modules may import them freely.
 */

// ---------------------------------------------------------------------------
// PRS dimensions (M1 -> M2 contract)
// ---------------------------------------------------------------------------

export type DimensionId =
  | "bruid_match_rate"
  | "autosegment_coverage"
  | "signal_freshness"
  | "rule_conflicts"
  | "ab_test_coverage";

export type DimensionStatus =
  | "critical"
  | "warning"
  | "healthy"
  | "out_of_scope";

export type DataSource = "discovery_api" | "marketing_mcp" | "analytics_mcp";

/** Canonical order M1 returns dimensions in (prs-data-fetcher / data files). */
export const DIMENSION_ORDER: readonly DimensionId[] = [
  "bruid_match_rate",
  "autosegment_coverage",
  "signal_freshness",
  "rule_conflicts",
  "ab_test_coverage",
] as const;

/**
 * Normalised dimension object — the M1->M2 contract. Required fields match the
 * CLAUDE.md contract; the optional fields are extra context carried by the
 * synthetic data files (used for display in M4).
 */
export interface DimensionObject {
  dimension_id: DimensionId;
  dimension_name: string;
  raw_value: number; // 0.0–1.0
  normalised_score: number; // 0–20
  max_score: 20;
  status: DimensionStatus;
  data_source: DataSource;
  is_synthetic: boolean;
  timestamp: string; // ISO8601
  /**
   * When true, this dimension is OUT OF SCOPE for the hackathon (the two
   * Discovery dimensions — Discovery is not enabled for this sandbox). It is
   * shown as "not in scope" in the UI and EXCLUDED from the composite PRS so its
   * placeholder value cannot inflate or contradict the score.
   */
  out_of_scope?: boolean;
  // Optional context present in the /data files:
  raw_label?: string;
  target_value?: number;
  target_label?: string;
  change_from_pre_fix?: number;
  change_driver?: string;
  client?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// PRS state (M2 -> M4 contract)
// ---------------------------------------------------------------------------

export type RagStatus = "red" | "amber" | "green";
export type BoostRulesState = "all_inactive" | "all_active";

/** Demo axis used by the PLP / Shopper Simulator and PRS state loader. */
export type DemoState = "before" | "after";

/** Raw shape of prs_pre_fix.json / prs_post_fix.json. */
export interface PRSStateFile {
  composite_score: number;
  rag_status: RagStatus;
  boost_rules_state: BoostRulesState;
  dimensions: DimensionObject[];
}

/** Minimal output of a single M2 scorer (design-spec 003). */
export interface ScorerResult {
  dimension_id: DimensionId;
  score: number; // 0–20
  max_score: 20;
  status: DimensionStatus;
  explanation: string;
}

/** Input accepted by the scorers: raw value, with optional locked score. */
export interface ScorerInput {
  raw_value: number;
  normalised_score?: number;
}

/** Output of an M2 scorer for one dimension (carries display context too). */
export interface ScoredDimension {
  dimension_id: DimensionId;
  dimension_name: string;
  raw_value: number;
  score: number; // 0–20
  max_score: 20;
  status: DimensionStatus;
  data_source: DataSource;
  explanation: string;
  /** True when the dimension is out of scope (Discovery not enabled) — excluded from the composite. */
  out_of_scope?: boolean;
  raw_label?: string;
  target_value?: number;
  target_label?: string;
  change_from_pre_fix?: number;
  change_driver?: string;
  is_synthetic?: boolean;
}

/** The M2 -> M4 PRS state object consumed by Module A and Module C. */
export interface PRSState {
  composite_score: number; // 0–100
  rag_status: RagStatus;
  boost_rules_state?: BoostRulesState;
  dimensions: ScoredDimension[]; // exactly 5
  fix_list: FixResult[]; // 3 ranked fixes
  generated_at: string; // ISO8601
}

// ---------------------------------------------------------------------------
// Fixes (fix_catalogue.json -> M2 fix-generator -> M4)
// ---------------------------------------------------------------------------

/** Raw shape of a fix in fix_catalogue.json. */
export interface FixObject {
  rank: number;
  fix_id: string;
  dimension_linked: string;
  fix_title: string;
  plain_english_description: string;
  effort_level: string;
  estimated_revenue_impact: string;
  estimated_rpv_lift_pct_min: number;
  estimated_rpv_lift_pct_max: number;
  action_label: string;
  risk_level: string;
  steps: string[];
  impact_assumption?: string;
}

/** A ranked fix produced by fix-generator (M2 -> M4). */
export interface FixResult {
  position: 1 | 2 | 3;
  fix_id: string;
  dimension: string; // dimension_id
  fix_title: string;
  description: string;
  effort: string;
  revenue_impact: string;
  action_label: string;
  risk_level: string;
  steps: string[];
}

// ---------------------------------------------------------------------------
// Personas, products, segments (C5)
// ---------------------------------------------------------------------------

export type PersonaId = "guest" | "sarah" | "alex";

/**
 * A single behavioural event in a persona's session history (provenance).
 * The persona journeys are now REAL events harvested from Bloomreach Engagement
 * via the loomi MCP, so the type vocabulary mirrors the real Engagement event
 * types rather than a synthetic subset.
 */
export interface PersonaEvent {
  type:
    | "page_view"
    | "search"
    | "wishlist_add"
    | "purchase"
    | "view_item"
    | "view_category"
    | "cart_update"
    | "checkout"
    | "banner"
    | "registration"
    | "consent"
    | "loyalty_update"
    | "survey"
    | "support_ticket";
  category: string; // product category, search term, or short label
  /** Specifics for the chip — e.g. the product title + price, or a note. */
  detail?: string;
  timestamp: string; // ISO8601
}

export interface Persona {
  persona_id: PersonaId;
  display_name: string;
  archetype_name: string;
  profile_description: string;
  login_status: string;
  session_count: number;
  page_views: number;
  product_clicks: number;
  purchase_count: number;
  aov: number;
  segment_name: string;
  last_signal_date: string | null;
  bruid_present: boolean;
  bruid_value: string | null;
  demo_query: string;
  plp_before_state?: string;
  plp_after_state?: string;
  personalisation_gap?: string;
  /** Behavioural events that justify this persona's segment assignment. */
  journey?: PersonaEvent[];
  /** Provenance: the real Bloomreach customer this persona is sourced from. */
  real_customer?: {
    customer_id: string;
    identifier: string;
    location?: string;
    total_events: number;
  };
}

export interface Product {
  product_id: string;
  name: string;
  description: string;
  price: number;
  currency: "USD";
  category: string;
  price_band: "entry" | "mid" | "premium";
  gift_eligible: boolean;
  gift_wrappable: boolean;
  is_new_arrival: boolean;
  is_bestseller: boolean;
  review_count: number;
  image_url: string;
}

export interface Segment {
  segment_id: string;
  segment_name: string;
  display_name: string;
  persona_linked: PersonaId;
  linked_boost_rule: string;
  boost_condition: string;
  is_active: boolean;
  member_count_synthetic: number;
}

// ---------------------------------------------------------------------------
// Discovery search (M1 searchProducts / M5 PLP / M4 Module B)
// ---------------------------------------------------------------------------

export type Affinity = "gift" | "premium" | "bestseller";

export interface DiscoveryProduct {
  product_id: string;
  name: string;
  price: number;
  currency: "USD";
  category: string;
  rank_position: number; // 1-based
  is_personalised: boolean;
  // Presentation-only passthrough (does not affect ranking):
  image_url?: string;
  affinity?: Affinity;
}

export interface DiscoverySearchResult {
  query: string;
  total: number;
  products: DiscoveryProduct[];
  cached: boolean;
  cache_key: string;
}

// ---------------------------------------------------------------------------
// Boost rules (Option X — read-only via rule-manager)
// ---------------------------------------------------------------------------

export interface RuleActivationState {
  rule_1_gifting: "active" | "inactive";
  rule_2_high_value: "active" | "inactive";
  rule_3_new_prospecting: "active" | "inactive";
  all_active: boolean;
  checked_at: string; // ISO8601
}

// ---------------------------------------------------------------------------
// Agent response (M3 -> M4 contract)
// ---------------------------------------------------------------------------

export interface ReasoningTraceStep {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output_summary: string;
}

export interface AgentResponse {
  query: string;
  intent: string;
  reasoning_trace: ReasoningTraceStep[];
  llm_response: {
    summary_sentence: string;
    score_breakdown: string;
    top_3_fixes: string[];
    suggested_next_action: string;
  };
  timestamp: string; // ISO8601
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps the demo axis to the PRS state file basename. */
export function prsFileForState(state: DemoState): "pre_fix" | "post_fix" {
  return state === "after" ? "post_fix" : "pre_fix";
}
