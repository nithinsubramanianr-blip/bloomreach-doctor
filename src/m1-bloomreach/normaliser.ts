import type {
  DataSource,
  DimensionId,
  DimensionObject,
  DimensionStatus,
} from "@/lib/contracts";
import { DIMENSION_ORDER } from "@/lib/contracts";

/**
 * The single validation point for M1 (ADR-002-2). Clients return raw parsed
 * objects; the normaliser validates structure + types, stamps `is_synthetic`,
 * and emits a typed DimensionObject. On any malformed field it throws
 * NormaliserError — callers must not silence it.
 *
 * Pure and synchronous (no async, no I/O) per the M1 boundary table.
 */

export class NormaliserError extends Error {
  field: string;
  expected: string;
  received: unknown;

  constructor(field: string, expected: string, received: unknown) {
    super(
      `NormaliserError: field "${field}" expected ${expected}, received ${JSON.stringify(
        received
      )}`
    );
    this.name = "NormaliserError";
    this.field = field;
    this.expected = expected;
    this.received = received;
  }
}

const VALID_STATUS: readonly DimensionStatus[] = [
  "critical",
  "warning",
  "healthy",
];
const VALID_SOURCE: readonly DataSource[] = [
  "discovery_api",
  "marketing_mcp",
  "analytics_mcp",
];

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== "object") {
    throw new NormaliserError("<root>", "object", raw);
  }
  return raw as Record<string, unknown>;
}

/**
 * Validates a raw dimension object and returns a typed DimensionObject.
 * @param raw         the parsed object from a client/synthetic source
 * @param isSynthetic true when sourced from the C5 fallback, false when live
 */
export function normaliseDimension(
  raw: unknown,
  isSynthetic: boolean
): DimensionObject {
  const obj = asRecord(raw);

  const dimensionId = obj.dimension_id;
  if (
    typeof dimensionId !== "string" ||
    !DIMENSION_ORDER.includes(dimensionId as DimensionId)
  ) {
    throw new NormaliserError("dimension_id", "DimensionId", dimensionId);
  }

  const rawValue = obj.raw_value;
  if (typeof rawValue !== "number" || rawValue < 0 || rawValue > 1) {
    throw new NormaliserError("raw_value", "number 0.0–1.0", rawValue);
  }

  const normalisedScore = obj.normalised_score;
  if (
    typeof normalisedScore !== "number" ||
    normalisedScore < 0 ||
    normalisedScore > 20
  ) {
    throw new NormaliserError("normalised_score", "number 0–20", normalisedScore);
  }

  const status = obj.status;
  if (typeof status !== "string" || !VALID_STATUS.includes(status as DimensionStatus)) {
    throw new NormaliserError("status", VALID_STATUS.join("|"), status);
  }

  const dataSource = obj.data_source;
  if (
    typeof dataSource !== "string" ||
    !VALID_SOURCE.includes(dataSource as DataSource)
  ) {
    throw new NormaliserError("data_source", VALID_SOURCE.join("|"), dataSource);
  }

  const timestamp = obj.timestamp;
  if (typeof timestamp !== "string") {
    throw new NormaliserError("timestamp", "ISO8601 string", timestamp);
  }

  return {
    dimension_id: dimensionId as DimensionId,
    dimension_name:
      typeof obj.dimension_name === "string" ? obj.dimension_name : dimensionId,
    raw_value: rawValue,
    normalised_score: normalisedScore,
    max_score: 20,
    status: status as DimensionStatus,
    data_source: dataSource as DataSource,
    is_synthetic: isSynthetic,
    timestamp,
    // A dimension that is out of scope for the hackathon (the Discovery
    // dimensions): shown as "not in scope" and excluded from the composite.
    out_of_scope: obj.out_of_scope === true ? true : undefined,
    // pass through optional display context when present
    raw_label: typeof obj.raw_label === "string" ? obj.raw_label : undefined,
    target_value:
      typeof obj.target_value === "number" ? obj.target_value : undefined,
    target_label:
      typeof obj.target_label === "string" ? obj.target_label : undefined,
    change_from_pre_fix:
      typeof obj.change_from_pre_fix === "number"
        ? obj.change_from_pre_fix
        : undefined,
    change_driver:
      typeof obj.change_driver === "string" ? obj.change_driver : undefined,
  };
}
