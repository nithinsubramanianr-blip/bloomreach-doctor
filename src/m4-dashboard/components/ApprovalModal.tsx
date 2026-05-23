"use client";

import { useEffect, useRef, useState } from "react";

import type { FixResult } from "@/lib/contracts";

/**
 * ApprovalModal — records intent in application state ONLY (CLAUDE.md invariant
 * #8). NO API write of any kind on Approve. The Discovery rule toggle is a
 * separate manual action performed by TA1.
 *
 * Accessible: focus trapped while open, closes on Escape, returns focus to the
 * trigger on close.
 */

interface ApprovalModalProps {
  isOpen: boolean;
  fix: FixResult | null;
  onApprove: (fix: FixResult) => void;
  onReviewLater: () => void;
  onDismiss: () => void;
}

export function ApprovalModal({
  isOpen,
  fix,
  onApprove,
  onReviewLater,
  onDismiss,
}: ApprovalModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const approveRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Reset confirmation each time the modal opens (during-render adjustment —
  // the recommended React pattern, avoids setState-in-effect).
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setConfirmed(false);
  }

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      // Focus the primary action when opened.
      approveRef.current?.focus();
    } else if (triggerRef.current instanceof HTMLElement) {
      // Return focus to the trigger on close.
      triggerRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        // Simple focus trap across focusable elements in the dialog.
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onDismiss]);

  if (!isOpen || !fix) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        {confirmed ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-2xl text-teal">
              ✓
            </div>
            <h2 id="approval-title" className="text-lg font-semibold text-navy">
              Action logged for review by your team
            </h2>
            <p className="text-sm text-gray-600">
              No changes were made to Bloomreach. This records your intent only —
              your team activates the change.
            </p>
            <button
              type="button"
              onClick={onReviewLater}
              className="rounded-lg bg-teal px-5 py-2 font-medium text-white hover:opacity-90"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 id="approval-title" className="text-lg font-semibold text-navy">
              {fix.fix_title}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{fix.description}</p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-gray-500">Estimated impact</dt>
                <dd className="font-medium text-navy">{fix.revenue_impact}</dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <dt className="text-gray-500">Risk level</dt>
                <dd className="font-medium capitalize text-navy">
                  {fix.risk_level}
                </dd>
              </div>
            </dl>

            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-gray-700">
              {fix.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm text-gray-500 hover:text-navy"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={onReviewLater}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Review Later
              </button>
              <button
                ref={approveRef}
                type="button"
                onClick={() => {
                  // NO API call — application state only.
                  onApprove(fix);
                  setConfirmed(true);
                }}
                className="rounded-lg bg-teal px-5 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Approve
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ApprovalModal;
