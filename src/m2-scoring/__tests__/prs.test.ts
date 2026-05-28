import preFix from "../../../data/prs_pre_fix.json";
import postFix from "../../../data/prs_post_fix.json";
import type { DimensionObject } from "@/lib/contracts";
import {
  scoreABCoverage,
  scoreAutoSegment,
  scoreBRUID,
  scoreRuleConflicts,
  scoreSignalFreshness,
  statusFromScore,
} from "../dimension-scorers";
import { calculatePRS } from "../prs-calculator";
import { generateFixList } from "../fix-generator";

const preFixDimensions = preFix.dimensions as DimensionObject[];
const postFixDimensions = postFix.dimensions as DimensionObject[];

// ---------------------------------------------------------------------------
// Mandatory tests (CLAUDE.md "Mandatory Jest Tests" + handoff 003)
// ---------------------------------------------------------------------------

describe("PRS mandatory tests", () => {
  it("Test 1 — REAL pre-fix scores 3 Red from the 3 Engagement MCP dims (BRUID + Rule Conflicts out of scope, excluded)", () => {
    const result = calculatePRS(preFixDimensions);
    // Composite is the 3 in-scope dims only, rescaled to 0–100:
    // round((0 autosegment + 2 freshness + 0 ab) / 60 * 100) = 3
    expect(result.composite_score).toBe(3);
    expect(result.rag_status).toBe("red");

    const dim = (id: string) =>
      result.dimensions.find((d) => d.dimension_id === id);

    // The two Discovery dimensions are OUT OF SCOPE (Discovery not enabled for
    // this sandbox) and excluded, so their values no longer inflate the score.
    expect(dim("bruid_match_rate")?.status).toBe("out_of_scope");
    expect(dim("bruid_match_rate")?.out_of_scope).toBe(true);
    expect(dim("rule_conflicts")?.status).toBe("out_of_scope");
    expect(dim("rule_conflicts")?.out_of_scope).toBe(true);

    // Real MCP dimensions — show 0 where it is 0, no fabrication.
    expect(dim("autosegment_coverage")?.score).toBe(0);
    expect(dim("ab_test_coverage")?.score).toBe(0);
    expect(dim("signal_freshness")?.score).toBe(2); // round(0.1056 * 20)

    // All three live MCP dimensions are critical.
    expect(dim("autosegment_coverage")?.status).toBe("critical");
    expect(dim("ab_test_coverage")?.status).toBe("critical");
    expect(dim("signal_freshness")?.status).toBe("critical");
  });

  it("Test 2 — post-fix scores 77 Green from the 3 Engagement MCP dims (BRUID + Rule Conflicts out of scope)", () => {
    const result = calculatePRS(postFixDimensions);
    // round((16 autosegment + 14 freshness + 16 ab) / 60 * 100) = 77
    expect(result.composite_score).toBe(77);
    expect(result.rag_status).toBe("green");

    const dim = (id: string) =>
      result.dimensions.find((d) => d.dimension_id === id);

    expect(dim("autosegment_coverage")?.status).toBe("healthy");
    expect(dim("ab_test_coverage")?.status).toBe("healthy");
    // The Discovery dimensions remain out of scope and out of the composite here too.
    expect(dim("bruid_match_rate")?.status).toBe("out_of_scope");
    expect(dim("rule_conflicts")?.status).toBe("out_of_scope");
  });

  it("Test 3 — fix list from pre-fix ranks AutoSegment, BRUID, A/B Coverage", () => {
    const prs = calculatePRS(preFixDimensions);
    const fixes = generateFixList(prs);
    // signal_freshness is the 3rd-worst real dimension (score 2) but has no
    // catalogue fix, so it is skipped and BRUID (next fixable) takes the slot.
    expect(fixes).toHaveLength(3);
    expect(fixes[0].dimension).toBe("autosegment_coverage");
    expect(fixes[1].dimension).toBe("bruid_match_rate");
    expect(fixes[2].dimension).toBe("ab_test_coverage");
  });
});

// ---------------------------------------------------------------------------
// Per-scorer tests (FR-003-18 — locked-value path + live formula path)
// ---------------------------------------------------------------------------

describe("statusFromScore thresholds", () => {
  it("treats 8 as critical, 9 and 14 as warning, 15 as healthy", () => {
    expect(statusFromScore(8)).toBe("critical");
    expect(statusFromScore(9)).toBe("warning");
    expect(statusFromScore(14)).toBe("warning");
    expect(statusFromScore(15)).toBe("healthy");
  });
});

describe("scoreBRUID", () => {
  it("uses the locked normalised_score when present (0.22 -> 8)", () => {
    const r = scoreBRUID({ raw_value: 0.22, normalised_score: 8 });
    expect(r.score).toBe(8);
    expect(r.status).toBe("critical");
  });
  it("falls back to the formula round(raw*20) (0.22 -> 4)", () => {
    expect(scoreBRUID({ raw_value: 0.22 }).score).toBe(4);
  });
  it("scores a healthy value (0.9 -> 18)", () => {
    const r = scoreBRUID({ raw_value: 0.9 });
    expect(r.score).toBe(18);
    expect(r.status).toBe("healthy");
  });
});

describe("scoreAutoSegment", () => {
  it("locked pre-fix (0.14 -> 6 critical)", () => {
    const r = scoreAutoSegment({ raw_value: 0.14, normalised_score: 6 });
    expect(r.score).toBe(6);
    expect(r.status).toBe("critical");
  });
  it("locked post-fix (0.68 -> 16 healthy)", () => {
    const r = scoreAutoSegment({ raw_value: 0.68, normalised_score: 16 });
    expect(r.score).toBe(16);
    expect(r.status).toBe("healthy");
  });
  it("formula path (0.5 -> 10 warning)", () => {
    const r = scoreAutoSegment({ raw_value: 0.5 });
    expect(r.score).toBe(10);
    expect(r.status).toBe("warning");
  });
});

describe("scoreSignalFreshness", () => {
  it("locked (0.58 -> 14 warning)", () => {
    const r = scoreSignalFreshness({ raw_value: 0.58, normalised_score: 14 });
    expect(r.score).toBe(14);
    expect(r.status).toBe("warning");
  });
  it("formula path (0.58 -> 12)", () => {
    expect(scoreSignalFreshness({ raw_value: 0.58 }).score).toBe(12);
  });
  it("healthy (0.8 -> 16)", () => {
    expect(scoreSignalFreshness({ raw_value: 0.8 }).status).toBe("healthy");
  });
});

describe("scoreRuleConflicts", () => {
  it("locked pre-fix (0.95 -> 18 healthy)", () => {
    const r = scoreRuleConflicts({ raw_value: 0.95, normalised_score: 18 });
    expect(r.score).toBe(18);
    expect(r.status).toBe("healthy");
  });
  it("locked post-fix (0.90 -> 16 healthy)", () => {
    expect(scoreRuleConflicts({ raw_value: 0.9, normalised_score: 16 }).score).toBe(16);
  });
  it("formula path (0.3 -> 6 critical)", () => {
    expect(scoreRuleConflicts({ raw_value: 0.3 }).status).toBe("critical");
  });
});

describe("scoreABCoverage", () => {
  it("locked pre-fix (0.14 -> 6 critical)", () => {
    const r = scoreABCoverage({ raw_value: 0.14, normalised_score: 6 });
    expect(r.score).toBe(6);
    expect(r.status).toBe("critical");
  });
  it("locked post-fix (0.80 -> 16 healthy)", () => {
    expect(scoreABCoverage({ raw_value: 0.8, normalised_score: 16 }).status).toBe("healthy");
  });
  it("formula path (0.8 -> 16)", () => {
    expect(scoreABCoverage({ raw_value: 0.8 }).score).toBe(16);
  });
});
