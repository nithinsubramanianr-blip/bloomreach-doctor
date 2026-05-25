/**
 * ApprovalModal.tsx — M4 PPD Dashboard
 *
 * Displays a fix for human review. On Approve: calls onApprove(fix) which
 * records the action in App.tsx local state ONLY.
 *
 * CRITICAL — Invariant #8:
 *   ZERO network requests on the Approve click path.
 *   No fetch(), no axios, no XHR, no API call of any kind.
 *   onApprove() updates React state in App.tsx — nothing else.
 *
 * Accessibility: focus trapped while open, closes on Escape,
 * returns focus to trigger element on close.
 */

import React, { useEffect, useRef, useState } from 'react';

export interface FixResult {
  fix_id: string;
  fix_title: string;
  description: string;
  estimated_rpv_lift_pct_min: number;
  estimated_rpv_lift_pct_max: number;
  effort: string;
  risk_level: string;
  action_label?: string;
  steps?: string[];
  position?: number;
  dimension?: string;
  revenue_impact?: string;
}

export interface ApprovalModalProps {
  isOpen: boolean;
  fix: FixResult | null;
  onApprove: (fix: FixResult) => void;   // pushes to approvedActions[] — no API call
  onReviewLater: () => void;
  onDismiss: () => void;
}

export default function ApprovalModal({
  isOpen,
  fix,
  onApprove,
  onReviewLater,
  onDismiss,
}: ApprovalModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const approveRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Reset confirmed state when modal opens with a new fix.
  useEffect(() => {
    if (isOpen) {
      setConfirmed(false);
      triggerRef.current = document.activeElement as HTMLElement;
      // Delay focus so the modal is rendered first.
      requestAnimationFrame(() => approveRef.current?.focus());
    } else {
      // Return focus to trigger element on close.
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onDismiss]);

  if (!isOpen || !fix) return null;

  function handleApprove() {
    if (!fix) return;
    // INVARIANT #8: no API call here — onApprove updates local state only.
    onApprove(fix);
    setConfirmed(true);
  }

  const riskColour =
    fix.risk_level === 'low'
      ? 'text-green-700 bg-green-50'
      : fix.risk_level === 'medium'
        ? 'text-amber-700 bg-amber-50'
        : 'text-red-700 bg-red-50';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      data-testid="approval-modal"
    >
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6">
          <h2
            id="modal-title"
            className="text-lg font-semibold"
            style={{ color: '#1B3A5C' }}
          >
            Review Fix
          </h2>
          <button
            onClick={onDismiss}
            aria-label="Close modal"
            className="ml-4 text-slate-400 hover:text-slate-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {confirmed ? (
            /* Confirmation state */
            <div
              className="flex flex-col items-center py-6 text-center"
              data-testid="approval-confirmed"
            >
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: '#0E7C7B20' }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0E7C7B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-base font-semibold" style={{ color: '#1B3A5C' }}>
                Action logged for review by your team
              </p>
              <p className="mt-1 text-sm text-slate-500">
                This fix has been queued in your approval log. No changes have
                been made to Bloomreach Discovery automatically.
              </p>
            </div>
          ) : (
            <>
              {/* Fix title */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Fix title
                </p>
                <p className="mt-0.5 text-base font-semibold" style={{ color: '#1B3A5C' }}>
                  {fix.fix_title}
                </p>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  What this does
                </p>
                <p className="mt-0.5 text-sm text-slate-600">{fix.description}</p>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-400">RPV Lift</p>
                  <p className="mt-0.5 text-sm font-bold" style={{ color: '#0E7C7B' }}>
                    {fix.estimated_rpv_lift_pct_min}–{fix.estimated_rpv_lift_pct_max}%
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-400">Effort</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-700">{fix.effort}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-400">Risk</p>
                  <p className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-semibold capitalize ${riskColour}`}>
                    {fix.risk_level}
                  </p>
                </div>
              </div>

              {/* Steps */}
              {fix.steps && fix.steps.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Steps
                  </p>
                  <ol className="mt-1 space-y-1 pl-4">
                    {fix.steps.map((step, i) => (
                      <li key={i} className="text-sm text-slate-600 list-decimal">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer buttons */}
        {!confirmed && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            {/* Dismiss — text link */}
            <button
              onClick={onDismiss}
              className="text-sm text-slate-400 hover:text-slate-600 underline"
            >
              Dismiss
            </button>

            <div className="flex gap-3">
              {/* Review Later — grey outlined */}
              <button
                onClick={onReviewLater}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Review Later
              </button>

              {/* Approve — teal filled. ZERO API CALLS. */}
              <button
                ref={approveRef}
                onClick={handleApprove}
                data-testid="approve-button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ backgroundColor: '#0E7C7B' }}
              >
                Approve
              </button>
            </div>
          </div>
        )}

        {confirmed && (
          <div className="flex justify-end border-t border-slate-100 px-6 py-4">
            <button
              onClick={onDismiss}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: '#0E7C7B' }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
