"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  DiscoveryProduct,
  FixResult,
  PRSState,
  Persona,
} from "@/lib/contracts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ApprovalModal } from "./components/ApprovalModal";
import { NLChat } from "./modules/NLChat";
import { PRSScorecard } from "./modules/PRSScorecard";
import { ShopperSimulator } from "./modules/ShopperSimulator";

type Tab = "scorecard" | "simulator" | "doctor";

interface ApprovedAction {
  fix_id: string;
  approved_at: string;
  status: "pending_team_review";
}

const TABS: { id: Tab; label: string; shortLabel: string }[] = [
  { id: "scorecard", label: "Scorecard", shortLabel: "Score" },
  { id: "simulator", label: "Shopper simulator", shortLabel: "Simulator" },
  { id: "doctor", label: "Ask the doctor", shortLabel: "Doctor" },
];

interface DashboardProps {
  initialPRS: PRSState;
  personas: Persona[];
  initialBefore: DiscoveryProduct[];
  initialAfter: DiscoveryProduct[];
}

export function Dashboard({
  initialPRS,
  personas,
  initialBefore,
  initialAfter,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("scorecard");
  const [prsState, setPrsState] = useState<PRSState>(initialPRS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFix, setSelectedFix] = useState<FixResult | null>(null);
  const [, setApprovedActions] = useState<ApprovedAction[]>([]);

  async function toggleBoostRules() {
    const state =
      prsState.boost_rules_state === "all_active" ? "before" : "after";
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
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-50 border-b border-navy/20 bg-header-bg text-header-text shadow-[0_4px_24px_-10px_rgba(0,0,0,0.35)]">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-3 md:flex md:flex-wrap md:items-center md:justify-between md:gap-4 md:px-6 md:py-4">
          <div className="flex items-start justify-between gap-3 md:min-w-0 md:flex-1">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-header-muted md:text-[11px] md:tracking-[0.12em]">
                Kendra Scott · Bloomreach Discovery
              </p>
              <h1 className="mt-0.5 text-lg font-semibold leading-tight text-header-text md:text-[22px] md:font-medium">
                Personalization Performance Doctor
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <Link
                href="/plp"
                className="flex items-center rounded-lg border border-white/15 px-2.5 py-2 text-[11px] leading-none text-header-muted transition-colors hover:border-white/30 hover:text-header-text"
              >
                PLP
              </Link>
              <ThemeToggle variant="header" />
            </div>
          </div>

          <div className="mt-3 w-full md:mt-0 md:w-auto md:shrink-0">
            <div className="flex items-center gap-2">
              <nav
                className="flex w-full gap-1 rounded-xl border border-white/10 bg-white/5 p-1 md:w-auto md:rounded-full"
                aria-label="Dashboard modules"
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-w-0 flex-1 rounded-lg px-1 py-2 text-center text-[11px] font-medium transition-colors md:flex-none md:shrink-0 md:rounded-full md:px-4 md:py-1.5 md:text-[13px] ${
                      activeTab === tab.id
                        ? "bg-accent text-accent-ink shadow-sm"
                        : "text-header-muted hover:text-header-text"
                    }`}
                  >
                    <span className="md:hidden">{tab.shortLabel}</span>
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                ))}
              </nav>
              <Link
                href="/plp"
                className="hidden shrink-0 items-center rounded-full border border-white/15 px-3 py-1.5 text-[12px] leading-none text-header-muted transition-colors hover:border-white/30 hover:text-header-text md:flex"
              >
                Live PLP
              </Link>
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
        {activeTab === "simulator" && (
          <ShopperSimulator
            personas={personas}
            initialBefore={initialBefore}
            initialAfter={initialAfter}
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
