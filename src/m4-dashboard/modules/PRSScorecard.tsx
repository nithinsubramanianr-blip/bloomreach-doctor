/**
 * PRSScorecard.tsx — Module A
 *
 * Displays:
 *   - Hero section: ScoreDial + score/RAG/refresh button
 *   - PRS Dimensions section with source legend, status bars
 *   - Top Fixes section with rank badges and RPV lift
 *
 * Boost callout removed — user activates rules in Bloomreach directly,
 * then clicks "Refresh Score" to re-pull live data.
 */

import React from 'react';
import ScoreDial from '../components/ScoreDial';
import type { FixResult } from '../components/ApprovalModal';
import FoundationGapPanel from '../components/FoundationGapPanel';
import UntappedSegmentsPanel from '../components/UntappedSegmentsPanel';

const FEATURE_FOUNDATION_GAP =
  String(process.env.FEATURE_FOUNDATION_GAP || 'false').toLowerCase() === 'true';
const FEATURE_SEGMENT_OPPORTUNITIES =
  String(process.env.FEATURE_SEGMENT_OPPORTUNITIES || 'false').toLowerCase() === 'true';

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
  /**
   * Flips the shared `ppd_rules_active` cookie + re-reads the PRS state.
   * The PLP page picks up the cookie on its next window focus.
   */
  onToggleBoostRules?: () => void;
  /** Current cookie value — drives the toggle button label/style. */
  rulesActive?: boolean;
  isRefreshing?: boolean;
}

// --------------------------------------------------------------------------
// Design tokens (mirrors CLAUDE.md palette)
// --------------------------------------------------------------------------

const RAG_COLOUR = { red: '#DC2626', amber: '#F59E0B', green: '#16A34A' };

const SOURCE_LABELS: Record<string, string> = {
  discovery_api:  'Discovery API',
  marketing_mcp:  'Marketing MCP',
  analytics_mcp:  'Analytics MCP',
  engagement_mcp: 'Engagement MCP',
  engagement_api: 'Engagement API',
};

const DIM_DISPLAY: Record<string, string> = {
  bruid_match_rate:           'BRUID Match Rate',
  autosegment_coverage:       'AutoSegment Coverage',
  signal_freshness:           'Signal Freshness',
  rule_conflicts:             'Rule Conflicts',
  ab_test_coverage:           'A/B Test Coverage',
  segment_definition_quality: 'Segment Definition Quality',
  profile_completeness:       'Profile Completeness',
  behavioral_signal_richness: 'Behavioral Signal Richness',
};

const DIM_DESCRIPTION: Record<string, string> = {
  bruid_match_rate:           'Visitor recognition across sessions',
  autosegment_coverage:       'Audience segments with active rules',
  signal_freshness:           'Recency of behavioural signals',
  rule_conflicts:             'Boost rules free of conflicts',
  ab_test_coverage:           'Search experiments configured',
  segment_definition_quality: 'Multi-condition depth + Discovery exposure',
  profile_completeness:       'Customers with enriched, identified profiles',
  behavioral_signal_richness: 'Distinct event types per active user',
};

const STATUS_PILL: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  warning:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  healthy:  'bg-green-50 text-green-700 ring-1 ring-green-200',
};

const STATUS_DOT: Record<string, string> = {
  critical: '#DC2626',
  warning:  '#F59E0B',
  healthy:  '#16A34A',
};

const STATUS_BAR: Record<string, string> = {
  critical: '#DC2626',
  warning:  '#F59E0B',
  healthy:  '#16A34A',
};

// Fix card left-border accent per rank
const FIX_BORDER: Record<number, string> = {
  1: '#7C3AED',
  2: '#F59E0B',
  3: '#94A3B8',
};

// --------------------------------------------------------------------------
// RefreshIcon — SVG sync icon
// --------------------------------------------------------------------------

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

// --------------------------------------------------------------------------
// DimensionRow
// --------------------------------------------------------------------------

function DimensionRow({ dim }: { dim: DimensionResult }) {
  const displayName =
    dim.dimension_name ?? DIM_DISPLAY[dim.dimension_id] ?? dim.dimension_id;
  const description = DIM_DESCRIPTION[dim.dimension_id] ?? '';
  const sourceLabel = SOURCE_LABELS[dim.data_source ?? ''] ?? dim.data_source ?? '—';
  const score = dim.normalised_score ?? dim.score;
  const pct = Math.round((score / 20) * 100);
  const pillClass = STATUS_PILL[dim.status] ?? STATUS_PILL.warning;
  const dotColour = STATUS_DOT[dim.status] ?? '#F59E0B';
  const barColour = STATUS_BAR[dim.status] ?? '#F59E0B';

  const rawPctLabel =
    dim.raw_value !== undefined && dim.raw_value !== null
      ? `${Math.round(dim.raw_value * 100)}%`
      : null;

  return (
    <div
      className="group flex items-center gap-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors px-1 -mx-1 rounded-lg"
      data-testid={`dimension-row-${dim.dimension_id}`}
    >
      {/* Status dot */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: dotColour }}
          aria-hidden="true"
        />
      </div>

      {/* Name + meta */}
      <div className="w-44 flex-shrink-0">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{displayName}</p>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5 leading-tight">{description}</p>
        )}
        <p className="text-xs text-slate-300 mt-0.5">{sourceLabel}</p>
      </div>

      {/* Progress bar track */}
      <div className="flex-1">
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: barColour }}
          />
        </div>
      </div>

      {/* Score + raw % */}
      <div className="w-28 text-right flex-shrink-0">
        <span className="text-sm font-bold text-slate-700">
          {score}
          <span className="font-normal text-slate-300">/20</span>
        </span>
        {rawPctLabel && (
          <span className="ml-1.5 text-xs text-slate-400">({rawPctLabel})</span>
        )}
      </div>

      {/* Status pill */}
      <div className="w-20 flex-shrink-0 flex justify-end">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${pillClass}`}
        >
          {dim.status}
        </span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// FixCard
// --------------------------------------------------------------------------

function FixCard({ fix, onReview }: { fix: FixResult; onReview: (fix: FixResult) => void }) {
  const borderColour = FIX_BORDER[fix.position ?? 3] ?? '#94A3B8';
  const rankLabel = fix.position === 1 ? '1st Priority' : fix.position === 2 ? '2nd Priority' : '3rd Priority';

  return (
    <div
      className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      style={{ borderLeftWidth: '4px', borderLeftColor: borderColour }}
      data-testid={`fix-card-${fix.fix_id}`}
    >
      {/* Rank badge */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm"
        style={{ backgroundColor: '#2D1BB5' }}
        aria-label={rankLabel}
      >
        {fix.position}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 leading-snug">{fix.fix_title}</p>
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap"
            style={{ backgroundColor: '#7C3AED15', color: '#7C3AED' }}
          >
            +{fix.estimated_rpv_lift_pct_min}–{fix.estimated_rpv_lift_pct_max}% RPV
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">{fix.description}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <span>⏱</span> Effort: {fix.effort}
          </span>
          {fix.risk_level && (
            <>
              <span className="text-slate-200">•</span>
              <span className="text-xs text-slate-400 capitalize">Risk: {fix.risk_level}</span>
            </>
          )}
        </div>
        {fix.featured_products && fix.featured_products.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 mb-1.5">Loomi AI — products to feature:</p>
            <div className="flex flex-wrap gap-1.5">
              {fix.featured_products.slice(0, 3).map((p, i) => (
                <span
                  key={i}
                  className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: '#EDE9FE', color: '#7C3AED', boxShadow: '0 0 0 1px #c4b5fd' }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review CTA */}
      <button
        onClick={() => onReview(fix)}
        data-testid={`review-button-${fix.fix_id}`}
        className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-opacity"
        style={{ backgroundColor: '#7C3AED' }}
        aria-label={`Review fix: ${fix.fix_title}`}
      >
        Review →
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Skeleton states
// --------------------------------------------------------------------------

function SkeletonDimRow() {
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-slate-100 animate-pulse">
      <div className="h-2.5 w-2.5 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="w-44 space-y-1.5">
        <div className="h-3 bg-slate-200 rounded w-28" />
        <div className="h-2 bg-slate-100 rounded w-20" />
      </div>
      <div className="flex-1 h-2 bg-slate-200 rounded-full" />
      <div className="w-28 h-3 bg-slate-200 rounded" />
      <div className="w-20 h-5 bg-slate-100 rounded-full" />
    </div>
  );
}

function SkeletonFixCard() {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4 animate-pulse">
      <div className="h-10 w-10 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-slate-200 rounded w-3/4" />
        <div className="h-2.5 bg-slate-100 rounded w-full" />
        <div className="h-2 bg-slate-100 rounded w-1/3" />
      </div>
      <div className="h-7 w-16 bg-slate-100 rounded-lg flex-shrink-0" />
    </div>
  );
}

// --------------------------------------------------------------------------
// ScoreHero — summary header card
// --------------------------------------------------------------------------

function ScoreHero({
  score,
  ragStatus,
  formattedDate,
  criticalCount,
  warningCount,
  onToggleBoostRules,
  rulesActive,
  isRefreshing,
}: {
  score: number;
  ragStatus: 'red' | 'amber' | 'green';
  formattedDate: string;
  criticalCount: number;
  warningCount: number;
  onToggleBoostRules?: () => void;
  rulesActive?: boolean;
  isRefreshing?: boolean;
}) {
  const ragColour = RAG_COLOUR[ragStatus] ?? RAG_COLOUR.amber;
  const ragBadgeClass =
    ragStatus === 'red'
      ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
      : ragStatus === 'green'
        ? 'bg-green-100 text-green-700 ring-1 ring-green-200'
        : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';

  const healthSummary =
    criticalCount > 0
      ? `${criticalCount} critical dimension${criticalCount !== 1 ? 's' : ''} need attention`
      : warningCount > 0
        ? `${warningCount} dimension${warningCount !== 1 ? 's' : ''} need monitoring`
        : 'All dimensions healthy';

  const healthSummaryColour =
    criticalCount > 0 ? '#DC2626' : warningCount > 0 ? '#D97706' : '#16A34A';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Subtle top accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: ragColour }} />

      <div className="p-5 flex items-start gap-5">
        {/* Left: ScoreDial */}
        <div className="flex-shrink-0">
          <ScoreDial score={score} ragStatus={ragStatus} size={148} />
        </div>

        {/* Right: Score info */}
        <div className="flex-1 min-w-0 pt-1 flex flex-col gap-3">
          {/* Score + RAG + Refresh row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span
                className="text-5xl font-extrabold leading-none tabular-nums"
                style={{ color: ragColour }}
                data-testid="composite-score-display"
              >
                {score}
              </span>
              <span className="text-xl font-light text-slate-300">/100</span>
              <span
                className={`inline-block rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-widest ${ragBadgeClass}`}
              >
                {ragStatus}
              </span>
            </div>

            {/* Boost-rules toggle (single source of truth for PLP + Scorecard) */}
            {onToggleBoostRules && (
              <button
                onClick={onToggleBoostRules}
                disabled={isRefreshing}
                data-testid="toggle-boost-rules-button"
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 transition-all ${
                  rulesActive
                    ? 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    : 'text-white shadow-sm hover:brightness-110'
                }`}
                style={
                  rulesActive
                    ? ({ focusRingColor: '#7C3AED' } as React.CSSProperties)
                    : { backgroundColor: '#7C3AED' }
                }
                aria-label={rulesActive ? 'Deactivate boost rules' : 'Activate boost rules'}
              >
                <RefreshIcon spinning={isRefreshing ?? false} />
                {isRefreshing
                  ? rulesActive
                    ? 'Deactivating…'
                    : 'Activating…'
                  : rulesActive
                    ? 'Deactivate boost rules'
                    : 'Activate boost rules'}
              </button>
            )}
          </div>

          {/* Subtitle */}
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Personalisation Readiness Score
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Last refreshed: {formattedDate}
            </p>
          </div>

          {/* Health summary */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: `${healthSummaryColour}10` }}
          >
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: healthSummaryColour }}
              aria-hidden="true"
            />
            <p className="text-xs font-medium" style={{ color: healthSummaryColour }}>
              {healthSummary}
            </p>
          </div>

          {/* Hint for the boost-rules toggle */}
          <p className="text-xs text-slate-400 leading-relaxed">
            {rulesActive
              ? 'Boost rules active — every persona\'s PLP shows personalised ranking. Click Deactivate to return to the pre-fix state.'
              : 'Click Activate boost rules to simulate the post-fix state — the PLP will re-rank for each persona via the Discovery audience flag.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// PRSScorecard
// --------------------------------------------------------------------------

export default function PRSScorecard({
  prsState,
  onReviewFix,
  onToggleBoostRules,
  rulesActive = false,
  isRefreshing = false,
}: PRSScorecardProps) {
  if (!prsState) {
    return (
      <div className="p-6 space-y-5 max-w-4xl mx-auto" data-testid="prs-scorecard-skeleton">
        {/* Hero skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
          <div className="flex gap-5">
            <div className="h-36 w-36 rounded-full bg-slate-100 flex-shrink-0" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-10 w-24 bg-slate-200 rounded" />
              <div className="h-4 w-48 bg-slate-100 rounded" />
              <div className="h-9 bg-slate-100 rounded-lg" />
            </div>
          </div>
        </div>
        {/* Dimensions skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-2">
          {[1, 2, 3, 4, 5].map(i => <SkeletonDimRow key={i} />)}
        </div>
        {/* Fixes skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonFixCard key={i} />)}
        </div>
      </div>
    );
  }

  const { composite_score, rag_status, dimensions, fix_list, generated_at } = prsState;

  const criticalCount = dimensions.filter(d => d.status === 'critical').length;
  const warningCount  = dimensions.filter(d => d.status === 'warning').length;

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
    <div className="p-6 space-y-5 max-w-4xl mx-auto" data-testid="prs-scorecard">

      {/* ── Section 1: Hero ── */}
      <ScoreHero
        score={composite_score}
        ragStatus={rag_status}
        formattedDate={formattedDate}
        criticalCount={criticalCount}
        warningCount={warningCount}
        onToggleBoostRules={onToggleBoostRules}
        rulesActive={rulesActive}
        isRefreshing={isRefreshing}
      />

      {/* ── Section 2: PRS Dimensions ── */}
      <div className="rounded-xl border border-slate-200 bg-white px-5">
        <div className="flex items-center justify-between py-3.5 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            PRS Dimensions
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Discovery API</span>
            <span>·</span>
            <span>Marketing MCP</span>
            <span>·</span>
            <span>Analytics MCP</span>
            <span>·</span>
            <span>Engagement MCP</span>
          </div>
        </div>
        {dimensions.map(dim => (
          <DimensionRow key={dim.dimension_id} dim={dim} />
        ))}
      </div>

      {/* ── Section 2.5: Foundation Health (FEATURE_FOUNDATION_GAP) ── */}
      {FEATURE_FOUNDATION_GAP && <FoundationGapPanel />}

      {/* ── Section 2.6: Untapped Segments (FEATURE_SEGMENT_OPPORTUNITIES) ── */}
      {FEATURE_SEGMENT_OPPORTUNITIES && <UntappedSegmentsPanel onReviewFix={onReviewFix} />}

      {/* ── Section 3: Top Fixes ── */}
      {fix_list && fix_list.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Top Fixes
            </h3>
            <span className="text-xs text-slate-300">Loomi AI · ranked by revenue impact</span>
          </div>
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
