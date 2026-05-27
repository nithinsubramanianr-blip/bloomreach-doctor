/**
 * Vite dev-server plugin — Loomi MCP OAuth flow + JSON-RPC proxy.
 *
 * Why this exists
 * ---------------
 * The Loomi MCP server (https://loomi-mcp-alpha.bloomreach.com/mcp) is an
 * OAuth 2.1 protected resource. Tokens are issued per registered client via
 * the authorization-code + PKCE flow. The token visible inside an MCP client
 * session (e.g. Claude Code's `whoami.access_token`) is bound to that client
 * — calling the MCP server with it from any other process returns 401.
 *
 * This plugin runs the OAuth dance inside the Vite dev server so the React
 * PLP can issue live `tools/call` requests against the MCP server:
 *
 *   1. On first dev-server start, the plugin reads (or registers) an OAuth
 *      client via Dynamic Client Registration and caches the credentials in
 *      `.bloomreach-client.json` (gitignored).
 *   2. The user opens `http://localhost:5173/oauth/login` once. The plugin
 *      redirects to the Loomi authorize endpoint with a PKCE challenge.
 *   3. Loomi redirects back to `/oauth/callback?code=...`. The plugin
 *      exchanges the code for an access token + refresh token and writes
 *      them to `.bloomreach-token.json`.
 *   4. The plugin proxies POST `/loomi-mcp` to the MCP server, injecting
 *      `Authorization: Bearer <access_token>` server-side. On 401 it
 *      transparently refreshes the token and retries once.
 *
 * Nothing in this flow ever puts a token in the browser bundle.
 */

import { createHash, randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

interface ClientConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scope: string;
  registered_at: number;
}

interface TokenSet {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_at: number; // epoch seconds
  scope?: string;
  obtained_at: number;
}

interface PendingAuth {
  code_verifier: string;
  return_to: string;
  created_at: number;
}

interface PluginOptions {
  mcpUrl: string;             // e.g. https://loomi-mcp-alpha.bloomreach.com/mcp
  proxyPath?: string;         // default '/loomi-mcp'
  clientFile?: string;        // default '.bloomreach-client.json'
  tokenFile?: string;         // default '.bloomreach-token.json'
}

const DEFAULT_PROXY_PATH = '/loomi-mcp';
const DEFAULT_CLIENT_FILE = '.bloomreach-client.json';
const DEFAULT_TOKEN_FILE = '.bloomreach-token.json';

export default function loomiAuthPlugin(opts: PluginOptions): Plugin {
  const proxyPath = opts.proxyPath ?? DEFAULT_PROXY_PATH;

  let clientFilePath = '';
  let tokenFilePath = '';
  let client: ClientConfig | null = null;
  let tokens: TokenSet | null = null;
  const pending = new Map<string, PendingAuth>(); // state → verifier

  // ─────────────────────────────────────────────────────────────────────────
  // File helpers
  // ─────────────────────────────────────────────────────────────────────────

  function loadClient(): ClientConfig | null {
    if (!existsSync(clientFilePath)) return null;
    try { return JSON.parse(readFileSync(clientFilePath, 'utf8')); } catch { return null; }
  }

  function loadTokens(): TokenSet | null {
    if (!existsSync(tokenFilePath)) return null;
    try { return JSON.parse(readFileSync(tokenFilePath, 'utf8')); } catch { return null; }
  }

  function saveTokens(t: TokenSet) {
    writeFileSync(tokenFilePath, JSON.stringify(t, null, 2), 'utf8');
    tokens = t;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PKCE helpers
  // ─────────────────────────────────────────────────────────────────────────

  function b64url(buf: Buffer): string {
    return buf.toString('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  function pkcePair() {
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OAuth flow
  // ─────────────────────────────────────────────────────────────────────────

  async function exchangeCodeForTokens(code: string, verifier: string): Promise<TokenSet> {
    if (!client) throw new Error('OAuth client not configured');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: client.redirect_uri,
      client_id: client.client_id,
      client_secret: client.client_secret,
      code_verifier: verifier,
    });
    const resp = await fetch(client.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`token exchange ${resp.status}: ${text}`);
    }
    const json = await resp.json() as Record<string, any>;
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      token_type: json.token_type ?? 'Bearer',
      expires_at: now + (Number(json.expires_in) || 3600),
      scope: json.scope,
      obtained_at: now,
    };
  }

  async function refreshTokens(): Promise<TokenSet | null> {
    if (!client || !tokens?.refresh_token) return null;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: client.client_id,
      client_secret: client.client_secret,
    });
    const resp = await fetch(client.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[loomi-auth] refresh failed (${resp.status}) — re-login required`);
      return null;
    }
    const json = await resp.json() as Record<string, any>;
    const now = Math.floor(Date.now() / 1000);
    const next: TokenSet = {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? tokens.refresh_token,
      token_type: json.token_type ?? 'Bearer',
      expires_at: now + (Number(json.expires_in) || 3600),
      scope: json.scope,
      obtained_at: now,
    };
    saveTokens(next);
    return next;
  }

  async function ensureFreshToken(): Promise<string | null> {
    if (!tokens) tokens = loadTokens();
    if (!tokens) return null;
    const now = Math.floor(Date.now() / 1000);
    if (tokens.expires_at - now > 30) return tokens.access_token;
    const refreshed = await refreshTokens();
    return refreshed?.access_token ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Middleware
  // ─────────────────────────────────────────────────────────────────────────

  function send(res: ServerResponse, status: number, body: string, contentType = 'text/html') {
    res.statusCode = status;
    res.setHeader('Content-Type', contentType);
    res.end(body);
  }

  function startLogin(req: IncomingMessage, res: ServerResponse) {
    if (!client) {
      send(res, 500, 'OAuth client missing — restart dev server to register');
      return;
    }
    const url = new URL(req.url ?? '', 'http://localhost');
    const returnTo = url.searchParams.get('return_to') || '/';

    const { verifier, challenge } = pkcePair();
    const state = b64url(randomBytes(16));
    pending.set(state, {
      code_verifier: verifier,
      return_to: returnTo,
      created_at: Date.now(),
    });

    const authUrl = new URL(client.authorization_endpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', client.client_id);
    authUrl.searchParams.set('redirect_uri', client.redirect_uri);
    authUrl.searchParams.set('scope', client.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    res.statusCode = 302;
    res.setHeader('Location', authUrl.toString());
    res.end();
  }

  async function handleCallback(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '', 'http://localhost');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      send(res, 400, `<h1>OAuth error</h1><pre>${error}</pre>`);
      return;
    }
    if (!code || !state) {
      send(res, 400, '<h1>Missing code or state</h1>');
      return;
    }
    const entry = pending.get(state);
    if (!entry) {
      send(res, 400, '<h1>Unknown state — login expired</h1>');
      return;
    }
    pending.delete(state);

    try {
      const t = await exchangeCodeForTokens(code, entry.code_verifier);
      saveTokens(t);
      // Auto-redirect back to where the user started so the one-time OAuth
      // bounce is invisible after the user clicks through the consent screen.
      const returnTo = entry.return_to.startsWith('/') ? entry.return_to : '/';
      res.statusCode = 302;
      res.setHeader('Location', returnTo);
      res.end();
    } catch (err) {
      send(res, 500, `<h1>Token exchange failed</h1><pre>${(err as Error).message}</pre>`);
    }
  }

  function statusPage(_req: IncomingMessage, res: ServerResponse) {
    const t = tokens ?? loadTokens();
    const now = Math.floor(Date.now() / 1000);
    const connected = !!t && t.expires_at - now > 0;
    send(res, 200, `
      <!doctype html><html><body style="font-family:sans-serif;padding:2rem">
        <h1>Loomi MCP auth</h1>
        <p>Status: <strong>${connected ? 'connected' : 'not connected'}</strong></p>
        ${t ? `<p>Expires in ${t.expires_at - now}s</p>` : ''}
        <p><a href="/oauth/login">${connected ? 'Re-authenticate' : 'Sign in'}</a></p>
      </body></html>`);
  }

  async function proxyMcp(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST') {
      send(res, 405, 'Method Not Allowed', 'text/plain');
      return;
    }

    let token = await ensureFreshToken();
    if (!token) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      // Custom header so the React client can detect "needs login" without
      // parsing the JSON body.
      res.setHeader('X-Loomi-Auth-Required', '/oauth/login');
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Not authenticated — visit /oauth/login',
          data: { login_url: '/oauth/login' },
        },
      }));
      return;
    }

    // Read body
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);

    const doFetch = async (bearer: string) => fetch(opts.mcpUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': req.headers['content-type'] ?? 'application/json',
      },
      body,
    });

    let upstream = await doFetch(token);

    // On 401, force refresh and retry once.
    if (upstream.status === 401) {
      const refreshed = await refreshTokens();
      if (refreshed) upstream = await doFetch(refreshed.access_token);
    }

    res.statusCode = upstream.status;
    upstream.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'content-encoding') return; // node-fetch decoded
      if (k.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(k, v);
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Plugin definition
  // ─────────────────────────────────────────────────────────────────────────

  return {
    name: 'loomi-auth',
    apply: 'serve',

    configResolved(config) {
      clientFilePath = join(config.root, opts.clientFile ?? DEFAULT_CLIENT_FILE);
      tokenFilePath = join(config.root, opts.tokenFile ?? DEFAULT_TOKEN_FILE);
      client = loadClient();
      tokens = loadTokens();
    },

    configureServer(server: ViteDevServer) {
      const banner = () => {
        if (!client) {
          // eslint-disable-next-line no-console
          console.warn('[loomi-auth] no client config — see .bloomreach-client.json');
          return;
        }
        const t = tokens ?? loadTokens();
        if (!t) {
          // eslint-disable-next-line no-console
          console.log('\x1b[33m[loomi-auth] not signed in — open http://localhost:5173/oauth/login\x1b[0m');
        } else {
          const remaining = t.expires_at - Math.floor(Date.now() / 1000);
          // eslint-disable-next-line no-console
          console.log(`\x1b[32m[loomi-auth] signed in (token expires in ${remaining}s)\x1b[0m`);
        }
      };
      banner();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        if (req.url === '/oauth/login' || req.url.startsWith('/oauth/login?')) {
          return startLogin(req, res);
        }
        if (req.url.startsWith('/oauth/callback')) {
          return handleCallback(req, res);
        }
        if (req.url === '/oauth/status') {
          return statusPage(req, res);
        }
        if (req.url === proxyPath || req.url.startsWith(`${proxyPath}?`)) {
          return proxyMcp(req, res);
        }

        next();
      });
    },
  };
}
