/**
 * FoundationGapPanel — PRS Scorecard add-on (FEATURE_FOUNDATION_GAP).
 *
 * Audits the live Engagement project for three structural foundations
 * (predictions, recommendations, scenarios) and surfaces gaps. A project
 * with 1M+ events and zero predictions/recs/scenarios cannot personalize
 * regardless of segment quality — this panel makes that visible.
 */

import React, { useEffect, useState } from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import foundationGapClient from '../../m1-bloomreach/foundation-gap-client.js';
const { fetchFoundationGap } = foundationGapClient as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface FoundationGapData {
  predictions: { count: number; present: boolean; samples: string[] };
  recommendations: { count: number; present: boolean; samples: string[] };
  scenarios: { count: number; present: boolean; samples: string[] };
  total_customers: number;
  total_events: number;
  foundation_score: number;
  is_synthetic: boolean;
  timestamp: string;
}

const TILE_META = [
  {
    key: 'predictions' as const,
    title: 'Predictions',
    blurb: 'Churn, LTV, propensity models',
    missing_explanation: 'Without predictions, you cannot identify at-risk or high-value customers for targeting.',
  },
  {
    key: 'recommendations' as const,
    title: 'Recommendation engines',
    blurb: 'Collaborative filtering / neural models',
    missing_explanation: 'Without a recommendation engine, your PLP cannot adapt to behavioural signals.',
  },
  {
    key: 'scenarios' as const,
    title: 'Scenarios',
    blurb: 'Multi-step automation flows',
    missing_explanation: 'Without scenarios, you cannot trigger personalised journeys from real-time signals.',
  },
];

function FoundationTile({
  title,
  blurb,
  present,
  count,
  samples,
  missingExplanation,
}: {
  title: string;
  blurb: string;
  present: boolean;
  count: number;
  samples: string[];
  missingExplanation: string;
}) {
  const colour = present ? '#16A34A' : '#DC2626';
  const bg = present ? '#16A34A12' : '#DC262610';
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border p-3"
      style={{ borderColor: colour + '30', backgroundColor: bg }}
      data-testid={`foundation-tile-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-800">{title}</p>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: colour }}
        >
          {present ? `${count} configured` : 'Missing'}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">{blurb}</p>
      {present && samples.length > 0 ? (
        <p className="text-[11px] text-slate-600 italic">{samples.slice(0, 2).join(', ')}{samples.length > 2 ? '…' : ''}</p>
      ) : (
        <p className="text-[11px] text-slate-600 leading-snug">{missingExplanation}</p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse"
      data-testid="foundation-gap-skeleton"
    >
      <div className="h-3 w-32 bg-slate-100 rounded mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-24 rounded-lg bg-slate-50 border border-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function FoundationGapPanel() {
  const [data, setData] = useState<FoundationGapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFoundationGap()
      .then((result: FoundationGapData) => {
        if (!cancelled) setData(result);
      })
      .catch(() => { /* client returns synthetic on failure — never throws */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (isLoading) return <Skeleton />;
  if (!data) return null;

  const missingCount = [data.predictions, data.recommendations, data.scenarios].filter(t => !t.present).length;
  const score = data.foundation_score;
  const scoreColor = score >= 67 ? '#16A34A' : score >= 34 ? '#F59E0B' : '#DC2626';

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-5"
      data-testid="foundation-gap-panel"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Foundation Health
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Structural personalization foundations in your Engagement project.
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-bold" style={{ color: scoreColor }}>{score}<span className="text-sm text-slate-400">/100</span></span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            {missingCount === 0 ? 'All foundations present' : `${missingCount} missing`}
          </span>
        </div>
      </div>

      {missingCount > 0 && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-200">
          You have <span className="font-semibold">{data.total_customers.toLocaleString()}</span> customers and
          {' '}<span className="font-semibold">{data.total_events.toLocaleString()}</span> events,
          but {missingCount === 3 ? 'no personalization foundation' : `${missingCount} foundation${missingCount > 1 ? 's' : ''} missing`}.
          {' '}Without these, segment-level fixes have a ceiling.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TILE_META.map(meta => (
          <FoundationTile
            key={meta.key}
            title={meta.title}
            blurb={meta.blurb}
            present={data[meta.key].present}
            count={data[meta.key].count}
            samples={data[meta.key].samples}
            missingExplanation={meta.missing_explanation}
          />
        ))}
      </div>

      {data.is_synthetic && (
        <p className="mt-3 text-[10px] text-slate-400 italic">Synthetic fallback — live MCP call failed.</p>
      )}
    </div>
  );
}
