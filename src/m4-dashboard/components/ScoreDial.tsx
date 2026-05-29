/**
 * ScoreDial.tsx — M4 PPD Dashboard
 *
 * Pure SVG arc gauge for the composite PRS score (0–100).
 * No external charting dependency — built from first principles.
 * Colour follows RAG status: red=#DC2626, amber=#F59E0B, green=#16A34A.
 *
 * Arc is a 270° sweep (135° start → 405° end), centre bottom.
 * score=0 maps to 135°, score=100 maps to 405°.
 */

import React from 'react';

export interface ScoreDialProps {
  score: number;       // 0–100
  ragStatus: 'red' | 'amber' | 'green';
  size?: number;       // px, default 180
}

const RAG_COLOURS: Record<string, string> = {
  red:   '#DC2626',
  amber: '#F59E0B',
  green: '#16A34A',
};

const RAG_LABELS: Record<string, string> = {
  red:   'Critical',
  amber: 'Amber',
  green: 'Healthy',
};

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const [sx, sy] = polarToCartesian(cx, cy, r, startAngle);
  const [ex, ey] = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
}

export default function ScoreDial({ score, ragStatus, size = 180 }: ScoreDialProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.09;

  const START_ANGLE = 135;
  const TOTAL_SWEEP = 270;
  const END_ANGLE = START_ANGLE + TOTAL_SWEEP;

  const clampedScore = Math.max(0, Math.min(100, score));
  const fillAngle = START_ANGLE + (clampedScore / 100) * TOTAL_SWEEP;

  const trackPath = describeArc(cx, cy, r, START_ANGLE, END_ANGLE);
  const fillPath = clampedScore === 0
    ? ''
    : clampedScore === 100
      ? describeArc(cx, cy, r, START_ANGLE, END_ANGLE - 0.01)
      : describeArc(cx, cy, r, START_ANGLE, fillAngle);

  const colour = RAG_COLOURS[ragStatus] ?? '#F59E0B';
  const label  = RAG_LABELS[ragStatus] ?? 'Amber';

  return (
    <div
      className="flex flex-col items-center"
      data-testid="score-dial"
      aria-label={`PRS score ${clampedScore} out of 100, ${label}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Fill */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={colour}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Score text */}
        <text
          x={cx}
          y={cy - size * 0.04}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.22}
          fontWeight="700"
          fill="#2D1BB5"
        >
          {clampedScore}
        </text>
        {/* /100 label */}
        <text
          x={cx}
          y={cy + size * 0.14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.1}
          fill="#6B7280"
        >
          / 100
        </text>
        {/* RAG status pill */}
        <rect
          x={cx - size * 0.18}
          y={cy + size * 0.27}
          width={size * 0.36}
          height={size * 0.13}
          rx={size * 0.065}
          fill={colour}
          opacity={0.15}
        />
        <text
          x={cx}
          y={cy + size * 0.335}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.09}
          fontWeight="600"
          fill={colour}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
