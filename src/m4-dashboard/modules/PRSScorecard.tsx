"use client";

import type {
  DataSource,
  DimensionStatus,
  FixResult,
  PRSState,
  ScoredDimension,
} from "@/lib/contracts";
import { ScoreDial } from "../components/ScoreDial";

const SOURCE_LABEL: Record<DataSource, string> = {
  discovery_api: "Discovery",
  marketing_mcp: "Marketing",
  analytics_mcp: "Analytics",
};

const STATUS_DOT: Record<DimensionStatus, string> = {
  critical: "bg-red",
  warning: "bg-amber",
  healthy: "bg-green",
  out_of_scope: "bg-faint",
};

const STATUS_TEXT: Record<DimensionStatus, string> = {
  critical: "text-red",
  warning: "text-amber",
  healthy: "text-green",
  out_of_scope: "text-faint",
};

const STATUS_BAR: Record<DimensionStatus, string> = {
  critical: "bg-red",
  warning: "bg-amber",
  healthy: "bg-green",
  out_of_scope: "bg-faint",
};

const STATUS_LABEL: Record<DimensionStatus, string> = {
  critical: "critical",
  warning: "warning",
  healthy: "healthy",
  out_of_scope: "not in scope",
};

interface PRSScorecardProps {
  prsState: PRSState;
  onReviewFix: (fix: FixResult) => void;
  onToggleBoostRules: () => void;
  isRefreshing: boolean;
}

export function PRSScorecard({
  prsState,
  onReviewFix,
  onToggleBoostRules,
  isRefreshing,
}: PRSScorecardProps) {
  const rulesActive = prsState.boost_rules_state === "all_active";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="animate-rise shadow-panel mx-auto flex w-full max-w-[320px] flex-col items-center rounded-2xl border border-border bg-surface p-4 md:p-6 lg:mx-0">
          <p className="caption self-start text-muted">Readiness score</p>
          <div className="my-2">
            <ScoreDial
              score={prsState.composite_score}
              ragStatus={prsState.rag_status}
            />
          </div>
          <p className="text-center text-[12px] text-faint">
            Updated{" "}
            {new Date(prsState.generated_at).toLocaleString("en-GB", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-faint">
            Scored on 3 of 5 dimensions — BRUID Match Rate &amp; Rule Conflicts
            are infrastructure scope (90-day Discovery roadmap), not this demo.
          </p>
          <button
            type="button"
            onClick={onToggleBoostRules}
            disabled={isRefreshing}
            className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              rulesActive
                ? "border border-border bg-surface-2 text-text hover:border-border-strong"
                : "bg-accent text-accent-ink hover:brightness-105"
            }`}
          >
            {isRefreshing
              ? rulesActive
                ? "Deactivating…"
                : "Activating…"
              : rulesActive
                ? "Deactivate boost rules"
                : "Activate boost rules"}
          </button>
          <p className="mt-3 text-center text-[12px] leading-relaxed text-muted">
            {rulesActive
              ? "Post-fix state — click deactivate to return to the pre-fix demo."
              : "Simulates activating the three Discovery boost rules during the demo."}
          </p>
        </section>

        <section className="animate-rise shadow-panel rounded-2xl border border-border bg-surface p-4 md:p-6">
          <div className="mb-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold text-text">Five dimensions</h2>
              <span className="text-[12px] text-faint">Each scored 0–20</span>
            </div>
            <p className="mt-1 text-[12px] text-faint">
              Score is computed from the 3 Engagement MCP dimensions. BRUID Match
              Rate and Rule Conflicts are not in scope — Discovery is not enabled
              for this hackathon sandbox.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {prsState.dimensions.map((d) => (
              <DimensionRow key={d.dimension_id} dimension={d} />
            ))}
          </ul>
        </section>
      </div>

      <section className="animate-rise shadow-panel rounded-2xl border border-border bg-surface p-4 md:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-text">Recommended fixes</h2>
          <p className="mt-1 text-[13px] text-muted">
            Ranked by estimated revenue impact — review before your team activates
            changes.
          </p>
        </div>
        <div className="grid auto-rows-fr gap-4 md:grid-cols-3">
          {prsState.fix_list.map((fix) => (
            <FixCard key={fix.fix_id} fix={fix} onReview={onReviewFix} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DimensionRow({ dimension }: { dimension: ScoredDimension }) {
  const outOfScope = dimension.status === "out_of_scope";
  const pct = outOfScope ? 0 : (dimension.score / dimension.max_score) * 100;
  const improved =
    !outOfScope &&
    typeof dimension.change_from_pre_fix === "number" &&
    dimension.change_from_pre_fix > 0;

  return (
    <li
      className={`flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 ${
        improved ? "improve-pulse rounded-lg px-2 -mx-2" : ""
      } ${outOfScope ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 max-md:flex-col max-md:gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[dimension.status]}`}
            />
            <span className="text-[15px] font-medium text-text">
              {dimension.dimension_name}
            </span>
            {improved && (
              <span className="text-[11px] font-semibold text-green">
                +{dimension.change_from_pre_fix}
              </span>
            )}
          </div>
          <p className="mt-0.5 pl-4 text-[12px] text-faint">
            {outOfScope
              ? `${SOURCE_LABEL[dimension.data_source]} · not enabled for this sandbox — excluded from score`
              : `${SOURCE_LABEL[dimension.data_source]} · ${Math.round(
                  dimension.raw_value * 100
                )}% raw`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 max-md:w-full max-md:justify-between max-md:pl-4">
          <span
            className={`text-[12px] font-semibold capitalize ${STATUS_TEXT[dimension.status]}`}
          >
            {STATUS_LABEL[dimension.status]}
          </span>
          <span className="text-lg font-semibold text-text">
            {outOfScope ? (
              <span className="text-faint">—</span>
            ) : (
              <>
                {dimension.score}
                <span className="text-[13px] font-normal text-faint">/20</span>
              </>
            )}
          </span>
        </div>
      </div>
      <div className="ml-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${STATUS_BAR[dimension.status]}`}
          style={{ width: `${pct}%`, transition: "width 800ms ease" }}
        />
      </div>
    </li>
  );
}

function FixCard({
  fix,
  onReview,
}: {
  fix: FixResult;
  onReview: (fix: FixResult) => void;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-surface-2/60 p-5 transition-colors hover:border-accent/30">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
          {fix.position}
        </span>
        <span className="caption text-muted">
          {fix.dimension.replace(/_/g, " ")}
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug text-text">
          {fix.fix_title}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[13px] font-medium text-accent">
          {fix.revenue_impact}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onReview(fix)}
        className="mt-4 h-10 w-full shrink-0 rounded-lg border border-accent/40 bg-surface px-3 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-ink"
      >
        Review fix
      </button>
    </article>
  );
}

export default PRSScorecard;
