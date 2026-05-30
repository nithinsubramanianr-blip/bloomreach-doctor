/**
 * PersonaProvenanceCard — Module B add-on (FEATURE_PERSONA_PROVENANCE).
 *
 * Renders a "Live customer profile from Engagement" card above the comparison
 * grid in ShopperSimulator. Calls `fetchPersonaProvenance(personaId)` which
 * resolves a real customer in the corresponding live segmentation and
 * aggregates their recent events.
 *
 * Silently falls back to a synthetic shape if MCP calls fail — the UI never
 * crashes; the `is_synthetic` badge tells the user which they're seeing.
 */

import React, { useEffect, useState } from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import engagementClient from '../../m1-bloomreach/engagement-client.js';
const { fetchPersonaProvenance } = engagementClient as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

import type { PersonaId } from '../modules/ShopperSimulator';

export interface PersonaProvenance {
  persona_id: PersonaId;
  segmentation_id: string | null;
  segment_label: string;
  segment_name?: string;
  customer_id_masked: string | null;
  total_events: number;
  event_counts: {
    view_item: number;
    cart_update: number;
    purchase: number;
    return: number;
    page_visit?: number;
    view_category?: number;
    session_start?: number;
    campaign?: number;
  };
  last_active_at: string | null;
  last_viewed_product: string | null;
  is_synthetic: boolean;
}

const personaCache = new Map<PersonaId, PersonaProvenance>();

function humanizeTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-start rounded-lg bg-slate-50 px-3 py-2 min-w-[80px]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-0.5 text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      className="mb-4 rounded-xl border border-slate-200 bg-white p-4 animate-pulse"
      data-testid="persona-provenance-skeleton"
    >
      <div className="h-3 w-48 bg-slate-100 rounded mb-3" />
      <div className="flex gap-2">
        <div className="h-12 w-20 bg-slate-100 rounded" />
        <div className="h-12 w-20 bg-slate-100 rounded" />
        <div className="h-12 w-20 bg-slate-100 rounded" />
        <div className="h-12 w-20 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

export default function PersonaProvenanceCard({ personaId }: { personaId: PersonaId }) {
  const [data, setData] = useState<PersonaProvenance | null>(personaCache.get(personaId) ?? null);
  const [isLoading, setIsLoading] = useState(!personaCache.has(personaId));

  useEffect(() => {
    let cancelled = false;
    const cached = personaCache.get(personaId);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    setIsLoading(true);
    setData(null);

    fetchPersonaProvenance(personaId)
      .then((result: PersonaProvenance) => {
        if (cancelled) return;
        personaCache.set(personaId, result);
        setData(result);
      })
      .catch(() => { /* engagement-client returns synthetic on any error — never throws */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [personaId]);

  if (isLoading) return <Skeleton />;
  if (!data) return null;

  const sourceLabel = data.is_synthetic ? 'Synthetic fallback' : 'Live from Engagement MCP';
  const sourceColor = data.is_synthetic ? '#9CA3AF' : '#7C3AED';

  return (
    <div
      className="mb-4 rounded-xl border border-slate-200 bg-white p-4"
      data-testid="persona-provenance-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#2D1BB5' }}>
            Live customer profile
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Segment: <span className="font-semibold text-slate-700">{data.segment_label}</span>
            {' · '}
            Customer: <span className="font-mono text-slate-600">{data.customer_id_masked || '—'}</span>
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: sourceColor }}
          data-testid="provenance-source-badge"
        >
          {sourceLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatPill label="Total events" value={data.total_events} />
        <StatPill label="View item" value={data.event_counts.view_item} />
        <StatPill label="Cart" value={data.event_counts.cart_update} />
        <StatPill label="Purchases" value={data.event_counts.purchase} />
        {data.event_counts.return > 0 && <StatPill label="Returns" value={data.event_counts.return} />}
        <StatPill label="Last active" value={humanizeTimestamp(data.last_active_at)} />
      </div>

      {data.last_viewed_product && (
        <p className="mt-3 text-xs text-slate-600">
          Most recent view: <span className="font-semibold text-slate-800">{data.last_viewed_product}</span>
        </p>
      )}
    </div>
  );
}
