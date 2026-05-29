/**
 * M3 NL — Loomi Conversations Server client.
 *
 * The Bloomreach Loomi Conversations Server is an MCP endpoint that exposes
 * conversational product / catalog tools (search_products, get_product,
 * search_productCollections, seeker_products). The prototype endpoint requires
 * no authentication.
 *
 * Doc: https://documentation.bloomreach.com/loomi-connect/docs/connect-the-conversations-server
 *
 * In this app we expose ONE high-level tool to Claude — `askLoomiConversations`
 * — which dispatches to whichever Conversations Server tool best fits the
 * user's product/catalog question. Claude only sees this one entry point;
 * the actual MCP tool routing happens server-side here.
 */

'use strict';

const PROXY_PATH = '/loomi-conversations';

function isBrowser() {
  return typeof window !== 'undefined' && typeof fetch !== 'undefined';
}

function parseMcpBody(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
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
  throw new Error('Loomi Conversations: unparseable response');
}

async function callMcpTool(toolName, args) {
  if (!isBrowser()) {
    throw new Error(`Loomi Conversations: ${toolName} requires a browser environment`);
  }

  // eslint-disable-next-line no-console
  console.log(`[ppd:loomi-conversations] → ${toolName}`, args);

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

  console.log(`[ppd:loomi-conversations] ← ${toolName} response = ${resp}`);
  if (!resp.ok) throw new Error(`Loomi Conversations ${toolName} → ${resp.status}`);

  const raw = await resp.text();
  const rpc = parseMcpBody(raw);

  if (rpc.error) {
    throw new Error(`Loomi Conversations ${toolName} error: ${rpc.error.message || JSON.stringify(rpc.error)}`);
  }
  if (rpc.result && rpc.result.isError) {
    const msg = (rpc.result.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join(' ')
      .slice(0, 200);
    throw new Error(`Loomi Conversations tool ${toolName} failed: ${msg}`);
  }

  const textBlock = (rpc.result && rpc.result.content || []).find((c) => c.type === 'text');
  if (!textBlock) throw new Error(`Loomi Conversations ${toolName}: no text content`);

  const parsed = JSON.parse(textBlock.text);
  // eslint-disable-next-line no-console
  console.log(`[ppd:loomi-conversations] - parsed ← ${parsed}`,
    Array.isArray(parsed.data) ? `items=${parsed.data.length}` : 'ok');
  return parsed;
}

/**
 * High-level entry point Claude calls. Routes the query to the most-specific
 * Loomi Conversations tool we can identify. Falls back to `search_products`
 * for free-text queries.
 *
 * @param {object} args
 * @param {string} args.query   The shopper-facing question (e.g. "necklaces under £50")
 * @param {string} [args.kind]  Optional hint — 'product' | 'collection' | 'seeker'
 */
async function askLoomiConversations(args = {}) {
  const query = String(args.query || '').trim();
  if (!query) throw new Error('askLoomiConversations: query is required');

  const kind = (args.kind || '').toLowerCase();
  if (kind === 'collection') {
    return callMcpTool('search_productCollections', { query });
  }
  if (kind === 'seeker') {
    return callMcpTool('seeker_products', { query });
  }
  // Default — full-text product search.
  return callMcpTool('search_products', { query });
}

module.exports = {
  askLoomiConversations,
};
