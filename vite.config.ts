import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import loomiAuth from './vite-plugins/loomi-auth';

// Single shared Vite app — M5 PLP at "/" and M4 dashboard placeholder at "/doctor".
// commonjs() runs before react() so CJS source files in M1/M2/M3 are converted
// to ESM before the React JSX transform sees them. Without this, Vite's esbuild
// dev server only applies syntax transforms (JSX/TS) — it does NOT convert
// require()/module.exports, so those calls fail at runtime in the browser.
export default defineConfig(({ mode }) => {
  // loadEnv with empty prefix loads ALL .env vars (not just VITE_-prefixed ones).
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      viteCommonjs(),
      react(),
      loomiAuth({
        mcpUrl: env.BLOOMREACH_LOOMI_MCP_URL || 'https://loomi-mcp-alpha.bloomreach.com/mcp',
      }),
    ],

    // Inject non-VITE_ env vars for CJS M1 modules that read process.env at runtime.
    // Vite replaces literal `process.env.KEY` tokens in the browser bundle with
    // these static values — they are NOT available at runtime otherwise.
    define: {
      'process.env.DATA_SOURCE': JSON.stringify(env.DATA_SOURCE || 'synthetic'),
      'process.env.DEMO_STATE': JSON.stringify(env.DEMO_STATE || 'pre_fix'),
      // Browser code routes Engagement API calls through the Vite proxy (/exponea-api).
      // The API key is injected by the proxy at the server level — never baked into
      // the client bundle.
      'process.env.BLOOMREACH_ENGAGEMENT_BASE_URL': JSON.stringify('/exponea-api'),
      'process.env.BLOOMREACH_PROJECT_ID': JSON.stringify(env.BLOOMREACH_PROJECT_ID || ''),
      'process.env.BLOOMREACH_CATALOG_ID': JSON.stringify(env.BLOOMREACH_CATALOG_ID || ''),
      // Keep a placeholder so TypeScript/code paths compile cleanly.
      // The actual auth header is added by the proxy below, not the browser.
      'process.env.BLOOMREACH_ENGAGEMENT_API_KEY': JSON.stringify('__proxy_injected__'),
    },

    server: {
      port: 5173,
      // /loomi-mcp is served by the loomiAuth plugin (with OAuth + token refresh).
      // /exponea-api is kept for any other Engagement REST endpoints used by M1.
      // /loomi-conversations is the Bloomreach Loomi Conversations Server MCP
      // endpoint — no auth required for the prototype.
      proxy: {
        '/exponea-api': {
          target: env.BLOOMREACH_ENGAGEMENT_BASE_URL || 'https://uqa.app.exponea.dev',
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => path.replace(/^\/exponea-api/, ''),
          configure: (proxyServer) => {
            proxyServer.on('proxyReq', (proxyReq) => {
              if (env.BLOOMREACH_ENGAGEMENT_API_KEY) {
                proxyReq.setHeader(
                  'Authorization',
                  `Bearer ${env.BLOOMREACH_ENGAGEMENT_API_KEY}`,
                );
              }
            });
          },
        },
        '/loomi-conversations': {
          target: env.BLOOMREACH_LOOMI_CONVERSATIONS_URL
            || 'https://uqa.api.exponea.dev/cocoaas/public/api/clarity-search/v1/mcp/019d4917-3c76-7479-9f00-06c620b231bb',
          changeOrigin: true,
          secure: true,
          rewrite: (path: string) => path.replace(/^\/loomi-conversations/, ''),
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      // Tell Rollup's CommonJS plugin to convert local CJS source modules to ESM.
      // node_modules must be included so react/jsx-runtime (CJS) is also processed.
      commonjsOptions: {
        include: [/node_modules/, /src\/m1-bloomreach\//, /src\/m2-scoring\//, /src\/m3-nl\//],
      },
    },
  };
});
