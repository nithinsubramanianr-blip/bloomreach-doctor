/**
 * App.tsx — M4 PPD Dashboard root.
 *
 * Mounts at /doctor (Shared Vite Root — architecture-spec addendum).
 * Owns all top-level state: active tab, PRS data, modal open/close,
 * approved actions list (local only — Invariant #8, no API write).
 *
 * Tabs: PRS Scorecard | Ask the Doctor
 * Shopper Simulator removed per product requirements.
 *
 * Design palette:
 *   Navy  #1B3A5C — header, tab text
 *   Teal  #0E7C7B — active tab, CTAs, Approve button
 *   Amber #F59E0B — warning
 *   White #FFFFFF — card backgrounds
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PRSScorecard, { type PRSState } from './modules/PRSScorecard';
import NLChat from './modules/NLChat';
import ApprovalModal from './components/ApprovalModal';
import type { FixResult } from './components/ApprovalModal';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type ActiveTab = 'scorecard' | 'doctor';

interface ApprovedAction {
  fix_id: string;
  approved_at: string; // ISO8601
  status: 'pending_team_review';
}

// --------------------------------------------------------------------------
// Tab definitions
// --------------------------------------------------------------------------

const TABS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: 'scorecard', label: 'PRS Scorecard', icon: '📊' },
  { id: 'doctor',    label: 'Ask the Doctor', icon: '🩺' },
];

// --------------------------------------------------------------------------
// PRS data bootstrap
// --------------------------------------------------------------------------

// CJS modules imported as ESM default — Vite/esbuild synthesises named exports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import prsFetcherModule from '../m1-bloomreach/prs-data-fetcher.js';
import syntheticLoaderModule from '../m1-bloomreach/_synthetic-loader.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
const { setRuntimeState } = syntheticLoaderModule as any;
/* eslint-enable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import prsCalculatorModule from '../m2-scoring/prs-calculator.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import fixGeneratorModule from '../m2-scoring/fix-generator.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fetchAllDimensions } = prsFetcherModule as any;
const { calculatePRS }       = prsCalculatorModule as any;
const { generateFixList }    = fixGeneratorModule as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

async function loadPRSState(): Promise<PRSState> {
  const dimensions = await fetchAllDimensions();
  const prs = calculatePRS(dimensions) as PRSState;
  const fixList = generateFixList(prs) as FixResult[];
  return { ...prs, fix_list: fixList };
}

// --------------------------------------------------------------------------
// M4 Dashboard App
// --------------------------------------------------------------------------

export default function DashboardApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scorecard');
  const [prsState, setPrsState] = useState<PRSState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFix, setSelectedFix] = useState<FixResult | null>(null);
  const [approvedActions, setApprovedActions] = useState<ApprovedAction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load PRS data on mount.
  useEffect(() => {
    loadPRSState()
      .then(state => setPrsState(state))
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error('[M4] PRS load error:', err);
      });
  }, []);

  // ---------- Refresh handler ----------
  // Called when user returns from Bloomreach after activating boost rules.
  // setRuntimeState('post_fix') simulates the system detecting active rules
  // via Discovery API (in synthetic mode this switches to the post-fix data).
  async function handleRefreshScore() {
    setIsRefreshing(true);
    setRuntimeState('post_fix');
    try {
      const state = await loadPRSState();
      setPrsState(state);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[M4] PRS refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }

  // ---------- Modal handlers ----------

  function handleReviewFix(fix: FixResult) {
    setSelectedFix(fix);
    setIsModalOpen(true);
  }

  function handleApprove(fix: FixResult) {
    // INVARIANT #8: NO API call. Local state only.
    const action: ApprovedAction = {
      fix_id: fix.fix_id,
      approved_at: new Date().toISOString(),
      status: 'pending_team_review',
    };
    setApprovedActions(prev => [...prev, action]);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setSelectedFix(null);
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dashboard-app">
      {/* ── Header ── */}
      <header
        className="px-6 py-4 flex items-center justify-between shadow-md"
        style={{ backgroundColor: '#1B3A5C' }}
        data-testid="dashboard-header"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: 'rgba(14,124,123,0.3)' }}
          >
            🩺
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              Personalization Performance Doctor
            </h1>
            <p className="text-xs text-blue-200">Kendra Scott · Powered by Bloomreach</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {approvedActions.length > 0 && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: '#0E7C7B' }}
              data-testid="approved-count-badge"
            >
              {approvedActions.length} fix{approvedActions.length !== 1 ? 'es' : ''} queued
            </span>
          )}
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="nav-live-store"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Live Store
          </Link>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <nav
        className="flex border-b border-slate-200 bg-white px-6"
        data-testid="tab-bar"
        role="tablist"
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`mr-1 flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                isActive ? 'border-current' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              style={isActive ? { color: '#0E7C7B', borderColor: '#0E7C7B' } : undefined}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Tab panels ── */}
      <main className="pt-2" data-testid="tab-content">
        {activeTab === 'scorecard' && (
          <div role="tabpanel" data-testid="panel-scorecard">
            <PRSScorecard
              prsState={prsState as PRSState}
              onReviewFix={handleReviewFix}
              onRefreshScore={handleRefreshScore}
              isRefreshing={isRefreshing}
            />
          </div>
        )}

        {activeTab === 'doctor' && (
          <div role="tabpanel" data-testid="panel-doctor">
            <NLChat prsState={prsState} />
          </div>
        )}
      </main>

      {/* ── Approval Modal ── */}
      <ApprovalModal
        isOpen={isModalOpen}
        fix={selectedFix}
        onApprove={handleApprove}
        onReviewLater={handleCloseModal}
        onDismiss={handleCloseModal}
      />
    </div>
  );
}
