import type { RagStatus } from "@/lib/contracts";

/**
 * Composite PRS gauge — a custom SVG arc (no charting dependency). Colour
 * follows RAG status (red < 50, amber 50–74, green 75+).
 */

const RAG_COLOURS: Record<RagStatus, string> = {
  red: "#DC2626",
  amber: "#F59E0B",
  green: "#16A34A",
};

interface ScoreDialProps {
  score: number; // 0–100
  ragStatus: RagStatus;
  size?: number; // px
}

export function ScoreDial({ score, ragStatus, size = 180 }: ScoreDialProps) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - clamped / 100);
  const colour = RAG_COLOURS[ragStatus];

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
          stroke="#E5E7EB"
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
          style={{ transition: "stroke-dashoffset 700ms ease, stroke 400ms ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold" style={{ color: colour }}>
          {clamped}
        </span>
        <span className="text-xs uppercase tracking-widest text-gray-500">
          / 100
        </span>
        <span
          className="mt-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase text-white"
          style={{ backgroundColor: colour }}
        >
          {ragStatus}
        </span>
      </div>
    </div>
  );
}

export default ScoreDial;
