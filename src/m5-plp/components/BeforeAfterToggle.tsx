/**
 * BeforeAfterToggle
 *
 * Pure UI toggle between "Before" (rules inactive cache key) and "After"
 * (rules active cache key). MUST NEVER trigger a Discovery call.
 *
 * Spec: 006-react-plp / FR-006-13..15, ADR-006-3
 */

interface BeforeAfterToggleProps {
  value: 'before' | 'after';
  onChange: (value: 'before' | 'after') => void;
}

export default function BeforeAfterToggle({
  value,
  onChange,
}: BeforeAfterToggleProps) {
  const base =
    'px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none';
  const active = 'bg-ppd-teal text-white';
  const inactive = 'bg-white text-ppd-navy hover:bg-slate-100';

  return (
    <div
      role="group"
      aria-label="Before / After state"
      data-testid="before-after-toggle"
      className="inline-flex overflow-hidden rounded-md border border-slate-300"
    >
      <button
        type="button"
        aria-pressed={value === 'before'}
        className={`${base} ${value === 'before' ? active : inactive}`}
        onClick={() => onChange('before')}
      >
        Before
      </button>
      <button
        type="button"
        aria-pressed={value === 'after'}
        className={`${base} ${value === 'after' ? active : inactive}`}
        onClick={() => onChange('after')}
      >
        After
      </button>
    </div>
  );
}
