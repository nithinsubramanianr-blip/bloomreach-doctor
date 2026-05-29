/**
 * M1 Bloomreach — MCP JSON-RPC bridge.
 *
 * Posts `tools/call` requests to the OAuth-authenticated Loomi MCP proxy
 * exposed by the Vite dev server at `/loomi-mcp` (see vite-plugins/loomi-auth.ts).
 *
 * The proxy injects the bearer token server-side so the browser bundle never
 * holds it. On 401 (no token yet) the browser is redirected to /oauth/login
 * so the user can complete the OAuth flow once and return to the same page.
 *
 * Used by the dashboard's M1 clients for PRS dimensions that have an MCP
 * tool equivalent (autosegments, project overview, experiments). Dimensions
 * without an MCP equivalent (BRUID match rate, rule conflicts) remain
 * synthetic.
 */

'use strict';

const PROXY_PATH = '/loomi-mcp';

function isBrowser() {
  return typeof window !== 'undefined' && typeof fetch !== 'undefined';
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const returnTo = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  window.location.href = `/oauth/login?return_to=${returnTo}`;
}

function parseMcpBody(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);

  // SSE — find the last `data: ...` frame that parses as JSON.
  const lines = trimmed.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('data:')) {
      const json = line.slice(5).trim();
      if (json && json !== '[DONE]') {
        try { return JSON.parse(json); } catch { /* keep scanning */ }
      }
    }
  }
  throw new Error('Loomi MCP: unparseable response');
}

/**
 * Calls an MCP tool by name and returns the parsed JSON payload from its
 * single text-content block. Throws on transport / RPC errors so the M1
 * client can fall back to synthetic data.
 *
 * @param {string} toolName  e.g. 'list_autosegments'
 * @param {object} args      tool arguments
 */
async function callMcpTool(toolName, args) {
  if (!isBrowser()) {
    throw new Error(`MCP bridge: ${toolName} requires a browser environment`);
  }

  // eslint-disable-next-line no-console
  console.log(`[ppd:mcp-bridge] → ${toolName}`, args);

  const rpcBody = {
    jsonrpc: '2.0',
    id: `${toolName}-${Date.now()}`,
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };

  const resp = await fetch(PROXY_PATH, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rpcBody),
  });

  // Plugin returns 401 + X-Loomi-Auth-Required when the user hasn't signed in
  // yet. Redirect them to /oauth/login; the OAuth callback lands them back
  // on the same page with a fresh token.
  if (resp.status === 401 && resp.headers.get('X-Loomi-Auth-Required')) {
    redirectToLogin();
    // Return a never-resolving promise so callers' .catch doesn't fire mid-redirect.
    return new Promise(() => {});
  }

  if (!resp.ok) throw new Error(`Loomi MCP ${toolName} → ${resp.status}`);

  const raw = await resp.text();
  const rpc = parseMcpBody(raw);

  if (rpc.error) {
    throw new Error(`Loomi MCP ${toolName} error: ${rpc.error.message || JSON.stringify(rpc.error)}`);
  }

  // MCP tools wrap upstream errors as `result.isError = true` with the error
  // message in the text block. Surface that as a JS error so the caller's
  // synthetic-fallback catch block runs.
  if (rpc.result && rpc.result.isError) {
    const msg = (rpc.result.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join(' ')
      .slice(0, 200);
    throw new Error(`MCP tool ${toolName} failed: ${msg}`);
  }

  const textBlock = (rpc.result && rpc.result.content || []).find((c) => c.type === 'text');
  if (!textBlock) throw new Error(`Loomi MCP ${toolName}: no text content`);

  const parsed = JSON.parse(textBlock.text);
  const count = Array.isArray(parsed.data) ? parsed.data.length : '—';
  // eslint-disable-next-line no-console
  console.log(`[ppd:mcp-bridge] ← ${toolName} items=${count}`);
  return parsed;
}

/**
 * Calls `callMcpTool` with retries on rate-limit errors. The Loomi sandbox
 * enforces 1 req/sec per user; multiple parallel dimension fetches can trip
 * this when the dashboard mounts. We retry up to 3 times with a 1.2s delay
 * each so all parallel dashboard calls have a window to succeed.
 *
 * In-flight dedup: multiple M1 fetchers ask for the same MCP tool (e.g.
 * `get_project_overview` powers both signal_freshness and behavioral_signal_
 * richness). Two concurrent calls with the same toolName+args share the same
 * inflight promise instead of hitting the network twice.
 */
const _inflight = new Map();

async function callMcpToolWithRetry(toolName, args, opts = {}) {
  const maxAttempts = opts.maxAttempts || 4;
  const retryDelayMs = opts.retryDelayMs || 1200;
  const dedupKey = `${toolName}|${JSON.stringify(args || {})}`;

  const existing = _inflight.get(dedupKey);
  if (existing) return existing;

  const pending = (async () => {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await callMcpTool(toolName, args);
      } catch (err) {
        lastErr = err;
        const msg = (err && err.message) ? err.message : String(err);
        if (!/rate limit|Too many requests/i.test(msg)) throw err;
        if (attempt === maxAttempts) break;
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
    throw lastErr;
  })().finally(() => { _inflight.delete(dedupKey); });

  _inflight.set(dedupKey, pending);
  return pending;
}

module.exports = {
  callMcpTool,
  callMcpToolWithRetry,
};
