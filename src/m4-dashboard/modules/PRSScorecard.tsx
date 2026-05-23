"use client";

import type {
  DataSource,
  DimensionStatus,
  FixResult,
  PRSState,
  ScoredDimension,
} from "@/lib/contracts";
import { ScoreDial } from "../components/ScoreDial";

/**
 * Module A — PRS Scorecard. Dial + 5 dimension rows + 3 ranked fix cards.
 * The Option X control activates the boost rules (synthetic: flips the demo
 * state), driving the live 52 -> 70 refresh.
 */

const SOURCE_LABEL: Record<DataSource, string> = {
  discovery_api: "Discovery API",
  marketing_mcp: "Marketing MCP",
  analytics_mcp: "Analytics MCP",
};

const STATUS_STYLES: Record<DimensionStatus, string> = {
  critical: "bg-red/10 text-red",
  warning: "bg-amber/10 text-amber",
  healthy: "bg-green/10 text-green",
};

const STATUS_BAR: Record<DimensionStatus, string> = {
  critical: "bg-red",
  warning: "bg-amber",
  healthy: "bg-green",
};

interface PRSScorecardProps {
  prsState: PRSState;
  onReviewFix: (fix: FixResult) => void;
  onActivateRules: () => void;
  isRefreshing: boolean;
}

export function PRSScorecard({
  prsState,
  onReviewFix,
  onActivateRules,
  isRefreshing,
}: PRSScorecardProps) {
  const rulesActive = prsState.boost_rules_state === "all_active";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Score + Option X */}
      <section className="flex flex-col items-center gap-4 rounded-xl border border-black/10 bg-white p-6">
        <h2 className="self-start text-sm font-semibold uppercase tracking-wide text-gray-500">
          Personalization Readiness Score
        </h2>
        <ScoreDial score={prsState.composite_score} ragStatus={prsState.rag_status} />
        <p className="text-center text-xs text-gray-500">
          Last refreshed{" "}
          {new Date(prsState.generated_at).toLocaleString("en-GB")}
        </p>
        <button
          type="button"
          onClick={onActivateRules}
          disabled={rulesActive || isRefreshing}
          className="w-full rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rulesActive
            ? "Boost rules active ✓"
            : isRefreshing
              ? "Activating…"
              : "Activate boost rules (Option X)"}
        </button>
        <p className="text-center text-[11px] text-gray-400">
          {rulesActive
            ? "Rules active — score reflects post-fix state."
            : "Simulates TA1 activating the 3 boost rules in Discovery."}
        </p>
      </section>

      {/* Dimensions */}
      <section className="rounded-xl border border-black/10 bg-white p-6 lg:col-span-2">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Five Dimensions
        </h2>
        <ul className="space-y-3">
          {prsState.dimensions.map((d) => (
            <DimensionRow key={d.dimension_id} dimension={d} />
          ))}
        </ul>
      </section>

      {/* Top fixes */}
      <section className="rounded-xl border border-black/10 bg-white p-6 lg:col-span-3">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Top Fixes
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {prsState.fix_list.map((fix) => (
            <FixCard key={fix.fix_id} fix={fix} onReview={onReviewFix} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DimensionRow({ dimension }: { dimension: ScoredDimension }) {
  const pct = (dimension.score / dimension.max_score) * 100;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-navy">{dimension.dimension_name}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {SOURCE_LABEL[dimension.data_source]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLES[dimension.status]}`}
          >
            {dimension.status}
          </span>
          <span className="w-12 text-right text-sm font-semibold text-navy">
            {dimension.score}/20
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${STATUS_BAR[dimension.status]}`}
          style={{ width: `${pct}%`, transition: "width 700ms ease" }}
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
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
          {fix.position}
        </span>
        <span className="text-xs uppercase tracking-wide text-gray-400">
          {fix.dimension.replace(/_/g, " ")}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-navy">{fix.fix_title}</h3>
      <p className="text-xs font-medium text-teal">{fix.revenue_impact}</p>
      <button
        type="button"
        onClick={() => onReview(fix)}
        className="mt-auto rounded-lg border border-teal px-3 py-1.5 text-sm font-medium text-teal hover:bg-teal hover:text-white"
      >
        Review
      </button>
    </div>
  );
}

export default PRSScorecard;
