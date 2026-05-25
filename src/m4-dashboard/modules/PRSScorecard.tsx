/**
 * PRSScorecard.tsx — Module A
 *
 * Displays:
 *   - Two-column header: ScoreDial (left) + score/RAG/boost callout (right)
 *   - PRS Dimensions section with source legend, taller bars, raw_value %
 *   - Top Fixes section with larger rank badges and left border by status
 *   - "Activate Boost Rules" button that triggers pre→post-fix transition
 */

import React from 'react';
import ScoreDial from '../components/ScoreDial';
import type { FixResult } from '../components/ApprovalModal';

// --------------------------------------------------------------------------
// Types mirroring M2→M4 PRS State Object contract (CLAUDE.md)
// --------------------------------------------------------------------------

export interface DimensionResult {
  dimension_id: string;
  dimension_name?: string;
  score: number;
  status: 'critical' | 'warning' | 'healthy';
  data_source?: string;
  raw_value?: number;
  normalised_score?: number;
}

export interface PRSState {
  composite_score: number;
  rag_status: 'red' | 'amber' | 'green';
  dimensions: DimensionResult[];
  fix_list: FixResult[];
  generated_at: string;
}

export interface PRSScorecardProps {
  prsState: PRSState;
  onReviewFix: (fix: FixResult) => void;
  onActivateBoostRules?: () => void;
  isBoostActive?: boolean;
}

// --------------------------------------------------------------------------
// RAG colour helper
// --------------------------------------------------------------------------

const RAG_COLOUR = { red: '#DC2626', amber: '#F59E0B', green: '#16A34A' };

// --------------------------------------------------------------------------
// Source label mapping (design-spec § "DimensionRow source label mapping")
// --------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  discovery_api:  'Discovery API',
  marketing_mcp:  'Marketing MCP',
  analytics_mcp:  'Analytics MCP',
};

// Dimension display names for cases where dimension_name is absent.
const DIM_DISPLAY: Record<string, string> = {
  bruid_match_rate:      'BRUID Match Rate',
  autosegment_coverage:  'AutoSegment Coverage',
  signal_freshness:      'Signal Freshness',
  rule_conflicts:        'Rule Conflicts',
  ab_test_coverage:      'A/B Test Coverage',
};

// --------------------------------------------------------------------------
// Status badge colours
// --------------------------------------------------------------------------

const STATUS_CLASSES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-amber-100 text-amber-700',
  healthy:  'bg-green-100 text-green-700',
};

// Left-border accent colour by status
const STATUS_BORDER_COLOUR: Record<string, string> = {
  critical: '#DC2626',
  warning:  '#F59E0B',
  healthy:  '#16A34A',
};

// --------------------------------------------------------------------------
// DimensionRow (internal)
// --------------------------------------------------------------------------

function DimensionRow({ dim }: { dim: DimensionResult }) {
  const displayName =
    dim.dimension_name ?? DIM_DISPLAY[dim.dimension_id] ?? dim.dimension_id;
  const sourceLabel =
    SOURCE_LABELS[dim.data_source ?? ''] ?? dim.data_source ?? '—';
  const score = dim.normalised_score ?? dim.score;
  const pct = Math.round((score / 20) * 100);
  const badgeClass = STATUS_CLASSES[dim.status] ?? STATUS_CLASSES.warning;

  const barColour =
    dim.status === 'critical'
      ? '#DC2626'
      : dim.status === 'warning'
        ? '#F59E0B'
        : '#16A34A';

  // Format raw_value as percentage string when available
  const rawPctLabel =
    dim.raw_value !== undefined && dim.raw_value !== null
      ? `(${Math.round(dim.raw_value * 100)}%)`
      : null;

  return (
    <div
      className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0"
      data-testid={`dimension-row-${dim.dimension_id}`}
    >
      {/* Name + source */}
      <div className="w-44 flex-shrink-0">
        <p className="text-sm font-medium text-slate-800">{displayName}</p>
        <p className="text-xs text-slate-400">{sourceLabel}</p>
      </div>

      {/* Score bar */}
      <div className="flex-1">
        <div className="h-2.5 w-full rounded-full bg-slate-100">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColour }}
          />
        </div>
      </div>

      {/* Score number + raw % */}
      <div className="w-24 text-right">
        <span className="text-sm font-semibold text-slate-700">
          {score}<span className="font-normal text-slate-400">/20</span>
        </span>
        {rawPctLabel && (
          <span className="ml-1 text-xs text-slate-400">{rawPctLabel}</span>
        )}
      </div>

      {/* Status badge */}
      <div className="w-20 flex-shrink-0">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeClass}`}
        >
          {dim.status}
        </span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// FixCard (internal)
// --------------------------------------------------------------------------

function FixCard({
  fix,
  onReview,
}: {
  fix: FixResult;
  onReview: (fix: FixResult) => void;
}) {
  const rankLabel = fix.position === 1 ? '1st' : fix.position === 2 ? '2nd' : '3rd';

  // Derive a status-like colour for the left border from RPV lift magnitude
  // Rank 1 = teal accent, 2 = amber, 3 = slate
  const leftBorderColour =
    fix.position === 1
      ? '#0E7C7B'
      : fix.position === 2
        ? '#F59E0B'
        : '#94A3B8';

  return (
    <div
      className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden"
      style={{ borderLeftWidth: '4px', borderLeftColor: leftBorderColour }}
      data-testid={`fix-card-${fix.fix_id}`}
    >
      {/* Rank badge — larger */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
        style={{ backgroundColor: '#1B3A5C' }}
        aria-label={`Rank ${rankLabel}`}
      >
        {fix.position}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{fix.fix_title}</p>
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{fix.description}</p>
        <div className="mt-2 flex items-center gap-3">
          <span
            className="text-xs font-semibold"
            style={{ color: '#0E7C7B' }}
          >
            {fix.estimated_rpv_lift_pct_min}–{fix.estimated_rpv_lift_pct_max}% RPV lift
          </span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-slate-500">Effort: {fix.effort}</span>
        </div>
      </div>

      {/* Review button */}
      <button
        onClick={() => onReview(fix)}
        data-testid={`review-button-${fix.fix_id}`}
        className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors hover:opacity-90"
        style={{ backgroundColor: '#0E7C7B' }}
        aria-label={`Review fix: ${fix.fix_title}`}
      >
        Review
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Skeleton loading state
// --------------------------------------------------------------------------

function SkeletonDimRow() {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-100 animate-pulse">
      <div className="w-44 space-y-1">
        <div className="h-3 bg-slate-200 rounded w-32" />
        <div className="h-2 bg-slate-100 rounded w-20" />
      </div>
      <div className="flex-1 h-2.5 bg-slate-200 rounded-full" />
      <div className="w-24 h-3 bg-slate-200 rounded" />
      <div className="w-20 h-5 bg-slate-100 rounded-full" />
    </div>
  );
}

// --------------------------------------------------------------------------
// BoostCallout (internal)
// --------------------------------------------------------------------------

function BoostCallout({
  isBoostActive,
  onActivate,
}: {
  isBoostActive: boolean;
  onActivate?: () => void;
}) {
  if (isBoostActive) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-semibold text-green-800">
          ✓ Boost Rules Active
        </p>
        <p className="mt-1 text-xs text-green-700">
          All 3 rules are live — personalisation is now serving your audience segments.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-800">
        ⚡ 3 boost rules are INACTIVE
      </p>
      <p className="mt-1 text-xs text-amber-700 mb-3">
        Activate them to serve personalised results to your audience segments and lift your PRS score.
      </p>
      <button
        onClick={onActivate}
        data-testid="activate-boost-rules-button"
        className="rounded-lg px-4 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors hover:opacity-90"
        style={{ backgroundColor: '#0E7C7B' }}
      >
        Activate Boost Rules →
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRSScorecard
// --------------------------------------------------------------------------

export default function PRSScorecard({
  prsState,
  onReviewFix,
  onActivateBoostRules,
  isBoostActive = false,
}: PRSScorecardProps) {
  if (!prsState) {
    // Skeleton while loading
    return (
      <div className="p-6 space-y-6" data-testid="prs-scorecard-skeleton">
        <div className="flex gap-6">
          <div className="h-40 w-40 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-10 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
            <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {[1, 2, 3, 4, 5].map(i => <SkeletonDimRow key={i} />)}
        </div>
      </div>
    );
  }

  const { composite_score, rag_status, dimensions, fix_list, generated_at } = prsState;

  const ragColour = RAG_COLOUR[rag_status] ?? RAG_COLOUR.amber;

  const ragBadgeClass =
    rag_status === 'red'
      ? 'bg-red-100 text-red-700'
      : rag_status === 'green'
        ? 'bg-green-100 text-green-700'
        : 'bg-amber-100 text-amber-700';

  const formattedDate = generated_at
    ? new Date(generated_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" data-testid="prs-scorecard">

      {/* ── Section 1: Two-column header ── */}
      <div className="flex items-start gap-6">

        {/* Left: ScoreDial */}
        <div className="flex-shrink-0">
          <ScoreDial score={composite_score} ragStatus={rag_status} size={160} />
        </div>

        {/* Right: Score display + boost callout */}
        <div className="flex-1 min-w-0 space-y-3 pt-1">

          {/* Score number + RAG badge */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className="text-5xl font-extrabold leading-none"
              style={{ color: ragColour }}
              data-testid="composite-score-display"
            >
              {composite_score}
            </span>
            <span className="text-2xl font-light text-slate-400">/100</span>
            <span
              className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${ragBadgeClass}`}
            >
              {rag_status}
            </span>
          </div>

          {/* Subtitle + timestamp */}
          <div>
            <p className="text-sm font-medium text-slate-600">
              Personalisation Readiness Score
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Last refreshed: {formattedDate}
            </p>
          </div>

          {/* Boost callout */}
          <BoostCallout
            isBoostActive={isBoostActive}
            onActivate={onActivateBoostRules}
          />
        </div>
      </div>

      {/* ── Section 2: PRS Dimensions ── */}
      <div className="rounded-xl border border-slate-200 bg-white px-4">
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            PRS Dimensions
          </h3>
          <span className="text-xs text-slate-400 hidden sm:block">
            Discovery API&nbsp;•&nbsp;Marketing MCP&nbsp;•&nbsp;Analytics MCP
          </span>
        </div>
        {dimensions.map(dim => (
          <DimensionRow key={dim.dimension_id} dim={dim} />
        ))}
      </div>

      {/* ── Section 3: Top Fixes ── */}
      {fix_list && fix_list.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Top Fixes
          </h3>
          <div className="space-y-3">
            {fix_list.map(fix => (
              <FixCard key={fix.fix_id} fix={fix} onReview={onReviewFix} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
