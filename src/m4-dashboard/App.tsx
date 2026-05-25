/**
 * App.tsx — M4 PPD Dashboard root.
 *
 * Mounts at /doctor (Shared Vite Root — architecture-spec addendum).
 * Owns all top-level state: active tab, PRS data, modal open/close,
 * approved actions list (local only — Invariant #8, no API write).
 *
 * Design palette:
 *   Navy  #1B3A5C — header, tab text
 *   Teal  #0E7C7B — active tab, CTAs
 *   Amber #F59E0B — warning
 *   White #FFFFFF — card backgrounds
 */

import React, { useState, useEffect } from 'react';
import PRSScorecard, { type PRSState } from './modules/PRSScorecard';
import ShopperSimulator from './modules/ShopperSimulator';
import NLChat from './modules/NLChat';
import ApprovalModal from './components/ApprovalModal';
import type { FixResult } from './components/ApprovalModal';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type ActiveTab = 'scorecard' | 'simulator' | 'doctor';

interface ApprovedAction {
  fix_id: string;
  approved_at: string; // ISO8601
  status: 'pending_team_review';
}

// --------------------------------------------------------------------------
// Tab definitions
// --------------------------------------------------------------------------

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'scorecard',  label: 'PRS Scorecard' },
  { id: 'simulator',  label: 'Shopper Simulator' },
  { id: 'doctor',     label: 'Ask the Doctor' },
];

// --------------------------------------------------------------------------
// PRS data bootstrap
//
// Imports the pre-fix synthetic JSON directly. calculatePRS and generateFixList
// are called to produce the M2→M4 PRS State Object shape expected by PRSScorecard.
// This mirrors the "On mount: PRSScorecard → calculatePRS" data flow in the
// architecture spec.
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
  const [isBoostActive, setIsBoostActive] = useState(false);

  // Load PRS data on mount.
  useEffect(() => {
    loadPRSState()
      .then(state => setPrsState(state))
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error('[M4] PRS load error:', err);
      });
  }, []);

  // ---------- Modal handlers ----------

  async function handleActivateBoostRules() {
    setRuntimeState('post_fix');
    try {
      const state = await loadPRSState();
      setPrsState(state);
      setIsBoostActive(true);
    } catch (err) {
      console.error('[M4] Boost rules activation error:', err);
    }
  }

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
    // Modal stays open to show confirmation — user closes it via Done/Dismiss.
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setSelectedFix(null);
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dashboard-app">
      {/* ── Header ── */}
      <header
        className="px-6 py-4 flex items-center justify-between shadow-sm"
        style={{ backgroundColor: '#1B3A5C' }}
        data-testid="dashboard-header"
      >
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">
            Personalization Performance Doctor
          </h1>
          <p className="text-xs font-medium text-blue-200">Kendra Scott</p>
        </div>
        {/* Approved actions badge (visible when actions have been approved) */}
        {approvedActions.length > 0 && (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: '#0E7C7B' }}
            data-testid="approved-count-badge"
          >
            {approvedActions.length} fix{approvedActions.length !== 1 ? 'es' : ''} queued
          </span>
        )}
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
              className={`mr-1 px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
                isActive ? 'border-current' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
              style={isActive ? { color: '#0E7C7B', borderColor: '#0E7C7B' } : undefined}
            >
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
              onActivateBoostRules={handleActivateBoostRules}
              isBoostActive={isBoostActive}
            />
          </div>
        )}

        {activeTab === 'simulator' && (
          <div role="tabpanel" data-testid="panel-simulator">
            <ShopperSimulator />
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
