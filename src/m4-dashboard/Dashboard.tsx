"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { DemoState, FixResult, PRSState } from "@/lib/contracts";
import { BRAND } from "@/lib/brand";
import { readRulesActiveCookie, setRulesActiveCookie } from "@/lib/rules-flag";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ApprovalModal } from "./components/ApprovalModal";
import { NLChat } from "./modules/NLChat";
import { PRSScorecard } from "./modules/PRSScorecard";

type Tab = "scorecard" | "doctor";

interface ApprovedAction {
  fix_id: string;
  approved_at: string;
  status: "pending_team_review";
}

const NAV_ITEM =
  "min-w-0 flex-1 rounded-lg px-1 py-2 text-center text-[11px] font-medium transition-colors md:flex-none md:shrink-0 md:rounded-full md:px-4 md:py-1.5 md:text-[13px]";
const NAV_ACTIVE = "bg-accent text-accent-ink shadow-sm";
const NAV_INACTIVE = "text-header-muted hover:text-header-text";

interface DashboardProps {
  initialPRS: PRSState;
}

export function Dashboard({ initialPRS }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("scorecard");
  const [prsState, setPrsState] = useState<PRSState>(initialPRS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFix, setSelectedFix] = useState<FixResult | null>(null);
  const [, setApprovedActions] = useState<ApprovedAction[]>([]);

  /** Shared score refresh: fetch the PRS for a state and swap it onto the dial. */
  async function refreshScore(state: DemoState) {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/prs?state=${state}`);
      if (res.ok) {
        setPrsState((await res.json()) as PRSState);
      }
    } catch {
      // Leave the current score on screen if the refresh fails.
    } finally {
      setIsRefreshing(false);
    }
  }

  async function toggleBoostRules() {
    const nextState: DemoState =
      prsState.boost_rules_state === "all_active" ? "before" : "after";
    // Write the cookie BEFORE the fetch resolves so a refresh mid-load already
    // reflects the new state (the cookie is the PLP's single source of truth).
    setRulesActiveCookie(nextState === "after");
    await refreshScore(nextState);
  }

  // Re-read the rulesActive cookie on mount and whenever the window regains
  // focus. If another tab or the modal Approve flow flipped it, pick up the new
  // state and refresh the score so the dial + button label sync up — without
  // reloading the page. No-ops (no flicker) when the cookie already matches the
  // server-rendered prop.
  useEffect(() => {
    function sync() {
      const cookieActive = readRulesActiveCookie();
      const prsActive = prsState.boost_rules_state === "all_active";
      if (cookieActive === prsActive) return;
      void refreshScore(cookieActive ? "after" : "before");
    }
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prsState.boost_rules_state]);

  function reviewFix(fix: FixResult) {
    setSelectedFix(fix);
    setModalOpen(true);
  }

  function approveFix(fix: FixResult) {
    setApprovedActions((prev) => [
      ...prev,
      {
        fix_id: fix.fix_id,
        approved_at: new Date().toISOString(),
        status: "pending_team_review",
      },
    ]);
    // Approving a fix activates personalisation: the Live PLP reflects this on
    // its next load (single source of truth — the rulesActive cookie flag)...
    setRulesActiveCookie(true);
    // ...and the score visibly moves to green on this screen straight away.
    void refreshScore("after");
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-50 border-b border-navy/20 bg-header-bg text-header-text shadow-[0_4px_24px_-10px_rgba(0,0,0,0.35)]">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-3 md:flex md:flex-wrap md:items-center md:justify-between md:gap-4 md:px-6 md:py-4">
          <div className="flex items-start justify-between gap-3 md:min-w-0 md:flex-1">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-header-muted md:text-[11px] md:tracking-[0.12em]">
                {BRAND.store} · Bloomreach Discovery
              </p>
              <h1 className="mt-0.5 text-lg font-semibold leading-tight text-header-text md:text-[22px] md:font-medium">
                Personalization Performance Doctor
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <ThemeToggle variant="header" />
            </div>
          </div>

          <div className="mt-3 w-full md:mt-0 md:w-auto md:shrink-0">
            <div className="flex items-center gap-2">
              <nav
                className="flex w-full gap-1 rounded-xl border border-white/10 bg-white/5 p-1 md:w-auto md:rounded-full"
                aria-label="Dashboard modules"
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("scorecard")}
                  className={`${NAV_ITEM} ${activeTab === "scorecard" ? NAV_ACTIVE : NAV_INACTIVE}`}
                >
                  <span className="md:hidden">Score</span>
                  <span className="hidden md:inline">Scorecard</span>
                </button>
                <Link
                  href="/plp"
                  className={`${NAV_ITEM} ${NAV_INACTIVE} flex items-center justify-center`}
                >
                  <span className="md:hidden">PLP</span>
                  <span className="hidden md:inline">Live PLP</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab("doctor")}
                  className={`${NAV_ITEM} ${activeTab === "doctor" ? NAV_ACTIVE : NAV_INACTIVE}`}
                >
                  <span className="md:hidden">Doctor</span>
                  <span className="hidden md:inline">Ask the doctor</span>
                </button>
              </nav>
              <ThemeToggle variant="header" className="hidden md:flex" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-5 md:px-6 md:py-8">
        {activeTab === "scorecard" && (
          <PRSScorecard
            prsState={prsState}
            onReviewFix={reviewFix}
            onToggleBoostRules={toggleBoostRules}
            isRefreshing={isRefreshing}
          />
        )}
        {activeTab === "doctor" && <NLChat />}
      </main>

      <ApprovalModal
        isOpen={modalOpen}
        fix={selectedFix}
        onApprove={approveFix}
        onReviewLater={() => setModalOpen(false)}
        onDismiss={() => setModalOpen(false)}
      />
    </div>
  );
}

export default Dashboard;
