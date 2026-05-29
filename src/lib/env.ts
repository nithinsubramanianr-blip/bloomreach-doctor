/**
 * Centralised environment access. All secrets are read from the environment —
 * never hardcoded (CLAUDE.md invariant #13). Secret getters are only meaningful
 * server-side; client code may read NEXT_PUBLIC_* values.
 */

export type DataSourceMode = "live" | "synthetic";

/** 'live' only when explicitly set; everything else falls back to synthetic. */
export function getDataSource(): DataSourceMode {
  return process.env.DATA_SOURCE === "live" ? "live" : "synthetic";
}

export function isLive(): boolean {
  return getDataSource() === "live";
}

/** Server-only Bloomreach / Anthropic configuration. */
export const serverEnv = {
  discoveryApiKey: () => process.env.BLOOMREACH_DISCOVERY_API_KEY ?? "",
  engagementApiKey: () => process.env.BLOOMREACH_ENGAGEMENT_API_KEY ?? "",
  marketingMcpUrl: () => process.env.BLOOMREACH_MCP_MARKETING_URL ?? "",
  analyticsMcpUrl: () => process.env.BLOOMREACH_MCP_ANALYTICS_URL ?? "",
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY ?? "",
  // Optional Anthropic-compatible gateway (e.g. https://gateway.bounteous.tools).
  // Empty => SDK default (https://api.anthropic.com). Lets a personal key (direct)
  // and an org key (via gateway) both work — just swap the .env values.
  anthropicBaseUrl: () => process.env.ANTHROPIC_BASE_URL ?? "",
  claudeModel: () =>
    process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
};

/** Default dxpapi core search endpoint when the env var is missing/empty. */
export const DEFAULT_DISCOVERY_ENDPOINT = "https://core.dxpapi.com/api/v1/core/";

/**
 * Public Discovery endpoint (safe to expose to the client). Uses `||` + trim so
 * a SET-BUT-EMPTY env var falls through to the default instead of returning ""
 * — an empty endpoint produces a hostless fetch URL that crashes URL parsing.
 */
export function discoveryEndpoint(): string {
  return (
    process.env.NEXT_PUBLIC_DISCOVERY_ENDPOINT?.trim() ||
    DEFAULT_DISCOVERY_ENDPOINT
  );
}
