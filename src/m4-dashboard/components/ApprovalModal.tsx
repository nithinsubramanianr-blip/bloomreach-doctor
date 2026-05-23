"use client";

import { useEffect, useRef, useState } from "react";

import type { FixResult } from "@/lib/contracts";

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

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setConfirmed(false);
  }

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      approveRef.current?.focus();
    } else if (triggerRef.current instanceof HTMLElement) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-panel"
      >
        {confirmed ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">
              ✓
            </div>
            <h2
              id="approval-title"
              className="font-display text-xl font-medium text-text"
            >
              Action logged for review
            </h2>
            <p className="text-sm text-muted">
              No changes were made to Bloomreach. This records your intent only —
              your team activates the change.
            </p>
            <button
              type="button"
              onClick={onReviewLater}
              className="rounded-xl bg-accent px-5 py-2.5 font-medium text-accent-ink hover:brightness-105"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="caption text-muted">Review fix · no changes made</p>
            <h2
              id="approval-title"
              className="mt-2 font-display text-[22px] font-medium text-text"
            >
              {fix.fix_title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {fix.description}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border bg-surface-2/60 p-3">
                <dt className="caption">Estimated impact</dt>
                <dd className="mt-1 font-medium text-text">
                  {fix.revenue_impact}
                </dd>
              </div>
              <div className="rounded-xl border border-border bg-surface-2/60 p-3">
                <dt className="caption">Risk level</dt>
                <dd className="mt-1 font-medium capitalize text-text">
                  {fix.risk_level}
                </dd>
              </div>
            </dl>

            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-muted marker:text-faint">
              {fix.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm text-faint hover:text-text"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={onReviewLater}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted hover:border-border-strong hover:text-text"
              >
                Review later
              </button>
              <button
                ref={approveRef}
                type="button"
                onClick={() => {
                  onApprove(fix);
                  setConfirmed(true);
                }}
                className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-accent-ink hover:brightness-105"
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
