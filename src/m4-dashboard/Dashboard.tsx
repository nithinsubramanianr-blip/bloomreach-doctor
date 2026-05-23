"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  DiscoveryProduct,
  FixResult,
  PRSState,
  Persona,
} from "@/lib/contracts";
import { ApprovalModal } from "./components/ApprovalModal";
import { NLChat } from "./modules/NLChat";
import { PRSScorecard } from "./modules/PRSScorecard";
import { ShopperSimulator } from "./modules/ShopperSimulator";

/**
 * M4 Dashboard shell — navy header, three tabs (Module A/B/C), Option X
 * activation (refetches /api/prs?state=after for the live 52 -> 70 refresh),
 * and the approval-modal state (no API write).
 */

type Tab = "scorecard" | "simulator" | "doctor";

interface ApprovedAction {
  fix_id: string;
  approved_at: string;
  status: "pending_team_review";
}

const TABS: { id: Tab; label: string }[] = [
  { id: "scorecard", label: "PRS Scorecard" },
  { id: "simulator", label: "Shopper Simulator" },
  { id: "doctor", label: "Ask the Doctor" },
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
    // Application state ONLY — no API write (CLAUDE.md invariant #8).
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
    <div className="flex flex-1 flex-col bg-gray-50">
      {/* Navy header */}
      <header className="flex items-center justify-between bg-navy px-6 py-3 text-white">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-semibold">
            Personalization Performance Doctor
          </span>
          <span className="text-sm opacity-70">Kendra Scott</span>
        </div>
        <Link
          href="/plp"
          className="text-sm underline-offset-2 opacity-90 hover:underline"
        >
          View live PLP →
        </Link>
      </header>

      {/* Tab bar */}
      <nav className="flex gap-1 border-b border-black/10 bg-white px-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-teal text-teal"
                : "border-transparent text-gray-500 hover:text-navy"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active module */}
      <main className="flex-1 p-6">
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
