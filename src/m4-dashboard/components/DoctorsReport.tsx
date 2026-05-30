/**
 * DoctorsReport — printable report (FEATURE_DOCTORS_REPORT).
 *
 * Hidden on screen via the `.doctors-report` CSS class. When the user clicks
 * "Export Report" in the dashboard header, App.tsx adds `printing-report` to
 * `document.body`, which (via CSS in index.css) hides every other element
 * and reveals this component. window.print() then fires; user picks
 * "Save as PDF" in the browser print dialog.
 *
 * No new dependencies — pure CSS-driven print.
 */

import React from 'react';
import type { PRSState } from '../modules/PRSScorecard';
import type { FixResult } from './ApprovalModal';

interface ApprovedActionRow {
  fix_id: string;
  approved_at: string;
  status: string;
}

interface Props {
  prsState: PRSState | null;
  approvedActions: ApprovedActionRow[];
}

const RAG_LABEL: Record<string, string> = {
  red: 'Critical — major personalization gaps',
  amber: 'Amber — actionable opportunities to lift performance',
  green: 'Healthy — personalization foundations in place',
};

const RAG_COLOR: Record<string, string> = {
  red: '#DC2626',
  amber: '#F59E0B',
  green: '#16A34A',
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

function formatPct(raw: number | undefined): string {
  if (raw == null || Number.isNaN(raw)) return '—';
  return `${Math.round(raw * 100)}%`;
}

export default function DoctorsReport({ prsState, approvedActions }: Props) {
  const generated = new Date().toLocaleString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  if (!prsState) {
    return (
      <div className="doctors-report" data-testid="doctors-report">
        <p style={{ fontFamily: 'Inter, sans-serif', padding: 40 }}>PRS state unavailable — cannot generate report.</p>
      </div>
    );
  }

  const ragColor = RAG_COLOR[prsState.rag_status] || '#475569';
  const ragLabel = RAG_LABEL[prsState.rag_status] || '';

  return (
    <div
      className="doctors-report"
      data-testid="doctors-report"
      style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: '#0F172A', lineHeight: 1.4 }}
    >
      {/* Header band */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: `4px solid ${ragColor}`,
          marginBottom: 18,
        }}
      >
        <p style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: '#7C3AED', fontWeight: 700, margin: 0 }}>
          Personalization Performance Doctor — Diagnostic Report
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 4px 0', color: '#2D1BB5' }}>
          Report for Amanda Valdez · Kendra Scott
        </h1>
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
          Generated {generated} · Bounteous x Accolite · Powered by Bloomreach
        </p>
      </div>

      {/* Headline score */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 22, padding: '0 24px' }}>
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: '50%',
            border: `8px solid ${ragColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 800, color: ragColor, lineHeight: 1 }}>
            {prsState.composite_score}
          </span>
          <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>/ 100</span>
        </div>
        <div>
          <p style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 700, margin: 0 }}>
            Personalization Readiness Score
          </p>
          <p style={{ fontSize: 18, fontWeight: 700, color: ragColor, margin: '4px 0 2px 0' }}>
            {ragLabel}
          </p>
          <p style={{ fontSize: 12, color: '#475569', margin: 0, maxWidth: 460 }}>
            Composite across {prsState.dimensions.length} PRS dimensions sourced live from Bloomreach Discovery,
            Engagement (Loomi MCP), and Analytics MCP.
          </p>
        </div>
      </div>

      {/* Dimensions table */}
      <div style={{ padding: '0 24px', marginBottom: 22 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.4, color: '#475569', margin: '0 0 8px 0' }}>
          PRS Dimensions
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ textAlign: 'left', padding: '6px 4px', color: '#475569', fontWeight: 700 }}>Dimension</th>
              <th style={{ textAlign: 'right', padding: '6px 4px', color: '#475569', fontWeight: 700 }}>Raw</th>
              <th style={{ textAlign: 'right', padding: '6px 4px', color: '#475569', fontWeight: 700 }}>Score</th>
              <th style={{ textAlign: 'left',  padding: '6px 4px', color: '#475569', fontWeight: 700 }}>Status</th>
              <th style={{ textAlign: 'left',  padding: '6px 4px', color: '#475569', fontWeight: 700 }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {prsState.dimensions.map((d) => {
              const name = DIM_DISPLAY[d.dimension_id] || d.dimension_id;
              const score = d.normalised_score ?? d.score;
              const statusColor = d.status === 'critical' ? '#DC2626' : d.status === 'warning' ? '#F59E0B' : '#16A34A';
              return (
                <tr key={d.dimension_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '6px 4px', fontWeight: 600 }}>{name}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{formatPct(d.raw_value)}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>{score}/20</td>
                  <td style={{ padding: '6px 4px', color: statusColor, fontWeight: 700, textTransform: 'capitalize' }}>{d.status}</td>
                  <td style={{ padding: '6px 4px', color: '#475569', fontSize: 10 }}>{d.data_source || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Top fixes */}
      {prsState.fix_list && prsState.fix_list.length > 0 && (
        <div style={{ padding: '0 24px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.4, color: '#475569', margin: '0 0 8px 0' }}>
            Recommended Fixes (ranked by revenue impact)
          </h2>
          {prsState.fix_list.map((fix: FixResult, idx: number) => (
            <div key={fix.fix_id} style={{ marginBottom: 12, paddingLeft: 28, position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 2,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: '#7C3AED',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {idx + 1}
              </span>
              <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{fix.fix_title}</p>
              <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0 0' }}>{fix.description}</p>
              <p style={{ fontSize: 10, color: '#0E7C7B', margin: '3px 0 0 0', fontWeight: 600 }}>
                {fix.revenue_impact || `+${fix.estimated_rpv_lift_pct_min}–${fix.estimated_rpv_lift_pct_max}% RPV`}
                {' · '}Effort: {fix.effort}{' · '}Risk: {fix.risk_level}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Approved actions */}
      {approvedActions.length > 0 && (
        <div style={{ padding: '0 24px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.4, color: '#475569', margin: '0 0 8px 0' }}>
            Approved Actions ({approvedActions.length})
          </h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {approvedActions.map((a) => (
              <li key={a.fix_id} style={{ fontSize: 11, marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', color: '#475569' }}>{a.fix_id}</span>
                {' — approved '}
                {new Date(a.approved_at).toLocaleString()}
                {' · '}status: <span style={{ fontWeight: 700, color: '#7C3AED' }}>{a.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          marginTop: 18,
          fontSize: 10,
          color: '#475569',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Generated by Personalization Performance Doctor · Bounteous x Accolite</span>
        <span>{generated}</span>
      </div>
    </div>
  );
}
