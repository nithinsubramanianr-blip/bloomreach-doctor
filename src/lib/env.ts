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
  claudeModel: () =>
    process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514",
};

/** Public Discovery endpoint (safe to expose to the client). */
export function discoveryEndpoint(): string {
  return process.env.NEXT_PUBLIC_DISCOVERY_ENDPOINT ?? "";
}
