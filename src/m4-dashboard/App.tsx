/**
 * App.tsx — M4 PPD Dashboard root.
 *
 * Mounts at /doctor (Shared Vite Root — architecture-spec addendum).
 * Owns all top-level state: active tab, PRS data, modal open/close,
 * approved actions list (local only — Invariant #8, no API write).
 *
 * Session persistence: `exchanges` (chat history) and `dynamicChips` live
 * here so they survive tab switches without re-mounting NLChat.
 *
 * Tabs: PRS Scorecard | Ask the Doctor
 *
 * Design palette (Bounteous x Accolite):
 *   Primary #2D1BB5 — header band gradient anchor
 *   Accent  #7C3AED — active tab, CTAs, Approve button
 *   Amber   #F59E0B — warning
 *   White   #FFFFFF — card backgrounds
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PRSScorecard, { type PRSState, type DimensionResult } from './modules/PRSScorecard';
import NLChat, { type AgentResponse } from './modules/NLChat';
import ApprovalModal from './components/ApprovalModal';
import type { FixResult } from './components/ApprovalModal';
import DoctorsReport from './components/DoctorsReport';

const FEATURE_DOCTORS_REPORT =
  String(process.env.FEATURE_DOCTORS_REPORT || 'false').toLowerCase() === 'true';
import {
  readRulesActiveCookie,
  setRulesActiveCookie,
} from '../lib/rules-flag';

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
/* eslint-disable @typescript-eslint/no-explicit-any */
import prsFetcherModule from '../m1-bloomreach/prs-data-fetcher.js';
import syntheticLoaderModule from '../m1-bloomreach/_synthetic-loader.js';
import prsCalculatorModule from '../m2-scoring/prs-calculator.js';
import fixGeneratorModule from '../m2-scoring/fix-generator.js';
import loomiConversationsModule from '../m3-nl/loomi-conversations-client.js';

const { setRuntimeState } = syntheticLoaderModule as any;
const { fetchAllDimensions, resetInflight: resetFetcherInflight } = prsFetcherModule as any;
const { calculatePRS }    = prsCalculatorModule as any;
const { generateFixList } = fixGeneratorModule as any;
const { askLoomiConversations } = loomiConversationsModule as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

async function loadPRSState(): Promise<PRSState> {
  const dimensions = await fetchAllDimensions();
  const prs = calculatePRS(dimensions) as PRSState;
  const fixList = generateFixList(prs) as FixResult[];
  return { ...prs, fix_list: fixList };
}

// --------------------------------------------------------------------------
// Dynamic chips — generated from live PRS critical/warning dimensions
// --------------------------------------------------------------------------

const DEFAULT_CHIPS: readonly string[] = [
  'Why is my personalisation not working?',
  'What should I fix first?',
  'Show me what good personalisation looks like for my top 3 customer types',
];

const DIM_CHIP: Record<string, (dim: DimensionResult) => string> = {
  bruid_match_rate:           (d) => `Why is visitor recognition at only ${Math.round((d.raw_value ?? 0) * 100)}%?`,
  autosegment_coverage:       (d) => `How do I improve segment coverage from ${Math.round((d.raw_value ?? 0) * 100)}%?`,
  ab_test_coverage:           (d) => `How can I grow A/B test coverage beyond ${Math.round((d.raw_value ?? 0) * 100)}%?`,
  signal_freshness:           ()  => 'Why are my behavioural signals stale?',
  segment_definition_quality: ()  => 'How can I improve segment definition quality?',
  profile_completeness:       ()  => 'What is causing low customer profile completeness?',
  behavioral_signal_richness: ()  => 'How do I capture richer behavioural signals?',
  rule_conflicts:             ()  => 'Are there conflicts in my boost rules?',
};

function generateChipsFromPRS(prsState: PRSState): string[] {
  const critical = prsState.dimensions
    .filter(d => d.status === 'critical' || d.status === 'warning')
    .sort((a, b) => (a.normalised_score ?? a.score) - (b.normalised_score ?? b.score));

  const chips: string[] = [];
  for (const dim of critical) {
    const fn = DIM_CHIP[dim.dimension_id];
    if (fn && chips.length < 2) chips.push(fn(dim));
  }
  chips.push(`How do I get my score from ${prsState.composite_score} to 75+?`);
  return chips.slice(0, 3);
}

// --------------------------------------------------------------------------
// Loomi fix enrichment — attaches product suggestions from Conversations API
// --------------------------------------------------------------------------

const DIM_LOOMI_QUERY: Record<string, string> = {
  autosegment_coverage:       'bestselling jeans for gift buyers',
  bruid_match_rate:           'trending fashion items for new visitors',
  ab_test_coverage:           'featured clothing collections to test',
  signal_freshness:           'new arrival tops and shirts',
  segment_definition_quality: 'gift ready premium clothing',
  profile_completeness:       'personalised clothing recommendations',
  behavioral_signal_richness: 'top rated fashion styles',
  rule_conflicts:             'sale items to promote',
};

async function enrichFixListWithLoomi(fixes: FixResult[], prsState: PRSState): Promise<FixResult[]> {
  try {
    const worst = [...prsState.dimensions]
      .filter(d => d.status === 'critical' || d.status === 'warning')
      .sort((a, b) => (a.normalised_score ?? a.score) - (b.normalised_score ?? b.score))[0];

    if (!worst) return fixes;

    const query = DIM_LOOMI_QUERY[worst.dimension_id] ?? 'top recommended products';
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = await askLoomiConversations({ query, kind: 'seeker' }) as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const items: any[] = Array.isArray(result?.data) ? result.data : [];
    if (items.length === 0) return fixes;

    const products = items.slice(0, 3).map((p: any) => p.title || p.name || p.product_id || 'Product');

    return fixes.map((fix, idx) =>
      idx === 0 ? { ...fix, featured_products: products } : fix,
    );
  } catch (err) {
    console.warn('[PPD] Loomi fix enrichment failed — using unenriched fixes:', err);
    return fixes;
  }
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
  // Shared rules-active flag — single source of truth across PLP + Dashboard.
  const [rulesActive, setRulesActive] = useState<boolean>(() => readRulesActiveCookie());

  // Chat session persistence — lifted here so NLChat survives tab switches.
  const [exchanges, setExchanges] = useState<AgentResponse[]>([]);
  // Dynamic chips generated from the live PRS state.
  const [dynamicChips, setDynamicChips] = useState<readonly string[]>(DEFAULT_CHIPS);

  useEffect(() => {
    setRuntimeState(rulesActive ? 'post_fix' : 'pre_fix');
    loadPRSState()
      .then((state) => {
        setPrsState(state);
        setDynamicChips(generateChipsFromPRS(state));
        // Enrich in background — doesn't block the initial render.
        enrichFixListWithLoomi(state.fix_list, state).then(enrichedFixes => {
          setPrsState(current => current ? { ...current, fix_list: enrichedFixes } : current);
        });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[M4] PRS load error:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Boost-rules toggle ----------
  async function handleToggleBoostRules() {
    setIsRefreshing(true);
    const next = !rulesActive;
    setRulesActive(next);
    setRulesActiveCookie(next);
    setRuntimeState(next ? 'post_fix' : 'pre_fix');
    resetFetcherInflight?.();
    try {
      const state = await loadPRSState();
      setPrsState(state);
      setDynamicChips(generateChipsFromPRS(state));
      enrichFixListWithLoomi(state.fix_list, state).then(enrichedFixes => {
        setPrsState(current => current ? { ...current, fix_list: enrichedFixes } : current);
      });
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

  // ---------- Doctor's Report export (FEATURE_DOCTORS_REPORT) ----------
  function handleExportReport() {
    if (!prsState) return;
    // Add a class to <body> that flips the print stylesheet — the report
    // becomes the only visible element; window.print() then opens the dialog.
    document.body.classList.add('printing-report');

    const cleanup = () => {
      document.body.classList.remove('printing-report');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // Give the browser one paint frame to apply the class before printing.
    requestAnimationFrame(() => {
      window.print();
    });
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dashboard-app">
      {/* ── Header ── */}
      <header
        className="ppd-header-gradient px-6 py-4 flex items-center justify-between shadow-lg"
        data-testid="dashboard-header"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg ring-1 ring-white/30 backdrop-blur"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
          >
            🩺
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight tracking-tight">
              Personalization Performance Doctor
            </h1>
            <p className="text-xs text-white/70 tracking-wide">
              Bounteous x Accolite · Powered by Bloomreach
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {approvedActions.length > 0 && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: '#7C3AED' }}
              data-testid="approved-count-badge"
            >
              {approvedActions.length} fix{approvedActions.length !== 1 ? 'es' : ''} queued
            </span>
          )}
          {FEATURE_DOCTORS_REPORT && (
            <button
              onClick={handleExportReport}
              disabled={!prsState}
              data-testid="export-report-button"
              className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 12 15 15"/>
              </svg>
              Export Report
            </button>
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
              style={isActive ? { color: '#7C3AED', borderColor: '#7C3AED' } : undefined}
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
              onToggleBoostRules={handleToggleBoostRules}
              rulesActive={rulesActive}
              isRefreshing={isRefreshing}
            />
          </div>
        )}

        {activeTab === 'doctor' && (
          <div role="tabpanel" data-testid="panel-doctor">
            <NLChat
              prsState={prsState}
              exchanges={exchanges}
              onExchangesChange={setExchanges}
              dynamicChips={dynamicChips}
            />
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

      {/* ── Printable Doctor's Report (hidden on screen, shown on print) ── */}
      {FEATURE_DOCTORS_REPORT && (
        <DoctorsReport prsState={prsState} approvedActions={approvedActions} />
      )}
    </div>
  );
}
