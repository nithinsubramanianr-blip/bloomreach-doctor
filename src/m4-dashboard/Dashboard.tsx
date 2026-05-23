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

const TABS: { id: Tab; label: string }[] = [
  { id: "scorecard", label: "Scorecard" },
  { id: "simulator", label: "Shopper simulator" },
  { id: "doctor", label: "Ask the doctor" },
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

  async function activateRules() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/prs?state=after");
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
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-header-muted">
              Kendra Scott · Bloomreach Discovery
            </p>
            <h1 className="font-display text-[22px] font-medium leading-tight text-header-text">
              Personalization Performance Doctor
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav
              className="flex rounded-full border border-white/10 bg-white/5 p-1"
              aria-label="Dashboard modules"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-accent text-accent-ink shadow-sm"
                      : "text-header-muted hover:text-header-text"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <Link
              href="/plp"
              className="hidden rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-header-muted transition-colors hover:border-white/30 hover:text-header-text sm:inline"
            >
              Live PLP
            </Link>
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-8">
        {activeTab === "scorecard" && (
          <PRSScorecard
            prsState={prsState}
            onReviewFix={reviewFix}
            onActivateRules={activateRules}
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
