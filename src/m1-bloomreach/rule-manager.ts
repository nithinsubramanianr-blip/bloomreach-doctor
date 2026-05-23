import "server-only";

import type { DemoState, RuleActivationState } from "@/lib/contracts";

/**
 * Reads the activation state of the three demo boost rules (Option X).
 *
 * READ-ONLY (ADR-002-5 / FR-002-7): this module never writes or mutates rule
 * state. The actual toggle is a manual action TA1 performs in the Discovery
 * merchandising UI during the live demo.
 *
 * In synthetic mode the "current" state is driven by the dashboard's
 * Before/After toggle, passed in as `state`: before = all inactive, after =
 * all active. The live path would read real rule state from Discovery.
 */
export async function getRuleActivationState(
  state: DemoState = "before"
): Promise<RuleActivationState> {
  const allActive = state === "after";
  const value: "active" | "inactive" = allActive ? "active" : "inactive";

  return {
    rule_1_gifting: value,
    rule_2_high_value: value,
    rule_3_new_prospecting: value,
    all_active: allActive,
    checked_at: new Date().toISOString(),
  };
}
