import type { RagStatus } from "@/lib/contracts";

const RAG_VAR: Record<RagStatus, string> = {
  red: "var(--red)",
  amber: "var(--amber)",
  green: "var(--green)",
};

interface ScoreDialProps {
  score: number;
  ragStatus: RagStatus;
  size?: number;
}

export function ScoreDial({ score, ragStatus, size = 176 }: ScoreDialProps) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - clamped / 100);
  const colour = RAG_VAR[ragStatus];

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 800ms cubic-bezier(.2,.7,.3,1)",
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="font-sans text-[42px] font-semibold leading-none"
          style={{ color: colour }}
        >
          {clamped}
        </span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-faint">
          out of 100
        </span>
        <span
          className="mt-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            color: colour,
            backgroundColor: `${colour}18`,
          }}
        >
          {ragStatus}
        </span>
      </div>
    </div>
  );
}

export default ScoreDial;
