/**
 * `rulesActive` — the single source of truth for whether personalisation boost
 * rules are live. Persisted in a cookie so it survives refresh and is shared
 * across routes (the dashboard flips it on fix approval; the PLP reads it).
 *
 *   false (default) → every persona sees the same generic ranking ("before").
 *   true            → results are personalised per persona ("after").
 *
 * This module is import-safe from both server and client code. The server PLP
 * page reads the cookie via `next/headers`; client code uses the helpers below.
 * (next/headers is intentionally NOT imported here so this stays universal.)
 */

export const RULES_FLAG_COOKIE = "ppd_rules_active";

/** Interpret a raw cookie value. Absent / anything-but-"true" => false. */
export function parseRulesActive(value: string | undefined | null): boolean {
  return value === "true";
}

/** Client-only: read the flag from document.cookie. */
export function readRulesActiveCookie(): boolean {
  if (typeof document === "undefined") return false;
  const row = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${RULES_FLAG_COOKIE}=`));
  return parseRulesActive(row?.split("=")[1]);
}

/** Client-only: persist the flag (1-day cookie, root path). */
export function setRulesActiveCookie(active: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = `${RULES_FLAG_COOKIE}=${active ? "true" : "false"}; path=/; max-age=86400; samesite=lax`;
}
