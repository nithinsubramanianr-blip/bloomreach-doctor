/**
 * `rulesActive` — the single source of truth for whether personalisation
 * boost rules are live for the demo. Persisted in a cookie so it survives
 * refresh and is shared across routes (the PRS Scorecard flips it on fix
 * approval; the PLP reads it).
 *
 *   false (default) → every persona sees the same generic ranking ("before").
 *   true            → results are personalised per persona ("after").
 *
 * Senior's feature/nextjs-app uses this exact pattern.
 */

export const RULES_FLAG_COOKIE = 'ppd_rules_active';

/** Interpret a raw cookie value. Absent / anything-but-"true" => false. */
export function parseRulesActive(value: string | undefined | null): boolean {
  return value === 'true';
}

/** Read the flag from document.cookie. Returns false outside a browser. */
export function readRulesActiveCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const row = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${RULES_FLAG_COOKIE}=`));
  return parseRulesActive(row?.split('=')[1]);
}

/** Persist the flag (1-day cookie, root path). No-op outside a browser. */
export function setRulesActiveCookie(active: boolean): void {
  if (typeof document === 'undefined') return;
  document.cookie =
    `${RULES_FLAG_COOKIE}=${active ? 'true' : 'false'}; path=/; max-age=86400; samesite=lax`;
}

/** Convenience type for the demo states the flag drives. */
export type RulesState = 'before' | 'after';

export function rulesStateFromCookie(): RulesState {
  return readRulesActiveCookie() ? 'after' : 'before';
}
