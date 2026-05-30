/**
 * UntappedSegmentsPanel — PRS Scorecard add-on (FEATURE_SEGMENT_OPPORTUNITIES).
 *
 * Lists live Engagement segments that are NOT bound to any demo persona /
 * Discovery rule. Each row has a "Promote to Discovery rule" button that
 * constructs a FixResult and routes it through the existing onReviewFix
 * approval flow — preserving Invariant #8 (no API write on approve).
 */

import React, { useEffect, useState } from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import untappedClient from '../../m1-bloomreach/untapped-segments-client.js';
const { fetchUntappedSegments } = untappedClient as any;
/* eslint-enable @typescript-eslint/no-explicit-any */
import type { FixResult } from './ApprovalModal';

export interface UntappedSegment {
  segmentation_id: string;
  name: string;
  rationale: string;
  suggested_rule: string;
  estimated_rpv_lift_pct_min: number;
  estimated_rpv_lift_pct_max: number;
}

export interface UntappedSegmentsData {
  bound_count: number;
  untapped: UntappedSegment[];
  is_synthetic: boolean;
  timestamp: string;
}

interface Props {
  onReviewFix: (fix: FixResult) => void;
}

function segmentToFix(seg: UntappedSegment): FixResult {
  return {
    fix_id: `promote-segment-${seg.segmentation_id}`,
    fix_title: `Promote "${seg.name}" to a Discovery rule`,
    description: `${seg.rationale} Suggested rule: ${seg.suggested_rule}.`,
    estimated_rpv_lift_pct_min: seg.estimated_rpv_lift_pct_min,
    estimated_rpv_lift_pct_max: seg.estimated_rpv_lift_pct_max,
    effort: 'Low — 1 merchandising rule',
    risk_level: 'Low',
    action_label: 'Approve & queue for merchandising',
    revenue_impact: `${seg.estimated_rpv_lift_pct_min}–${seg.estimated_rpv_lift_pct_max}% RPV lift`,
    dimension: 'autosegment_coverage',
    steps: [
      `Open Discovery merchandising UI for catalog ${process.env.BLOOMREACH_CATALOG_ID || ''}.`,
      `Create a new boost rule scoped to segment "${seg.name}".`,
      `Set rule condition: ${seg.suggested_rule}.`,
      'Activate rule and verify in the live PLP.',
    ],
  };
}

function Skeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse"
      data-testid="untapped-segments-skeleton"
    >
      <div className="h-3 w-48 bg-slate-100 rounded mb-3" />
      <div className="space-y-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function UntappedSegmentsPanel({ onReviewFix }: Props) {
  const [data, setData] = useState<UntappedSegmentsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchUntappedSegments()
      .then((result: UntappedSegmentsData) => { if (!cancelled) setData(result); })
      .catch(() => { /* client returns synthetic on failure — never throws */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (isLoading) return <Skeleton />;
  if (!data || data.untapped.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5" data-testid="untapped-segments-empty">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
          Untapped Segment Opportunities
        </h3>
        <p className="text-xs text-slate-500">All live segments are already bound to a persona or rule. No opportunities surfaced.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5" data-testid="untapped-segments-panel">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Untapped Segment Opportunities
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{data.untapped.length}</span> live segment{data.untapped.length === 1 ? '' : 's'} exist in Engagement but {data.untapped.length === 1 ? 'is' : 'are'} not bound to any Discovery rule.
          </p>
        </div>
        {data.is_synthetic && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white bg-slate-400">
            Synthetic
          </span>
        )}
      </div>

      <div className="space-y-2">
        {data.untapped.map((seg) => (
          <div
            key={seg.segmentation_id}
            className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/50 transition-colors"
            data-testid={`untapped-row-${seg.segmentation_id}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{seg.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{seg.rationale}</p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">{seg.suggested_rule}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: '#7C3AED' }}
              >
                +{seg.estimated_rpv_lift_pct_min}–{seg.estimated_rpv_lift_pct_max}% RPV
              </span>
              <button
                onClick={() => onReviewFix(segmentToFix(seg))}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#0E7C7B' }}
                data-testid={`untapped-promote-${seg.segmentation_id}`}
              >
                Promote to rule
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
