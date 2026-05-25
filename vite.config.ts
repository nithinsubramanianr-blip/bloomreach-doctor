import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';

// Single shared Vite app — M5 PLP at "/" and M4 dashboard placeholder at "/doctor".
// commonjs() runs before react() so CJS source files in M1/M2/M3 are converted
// to ESM before the React JSX transform sees them. Without this, Vite's esbuild
// dev server only applies syntax transforms (JSX/TS) — it does NOT convert
// require()/module.exports, so those calls fail at runtime in the browser.
export default defineConfig({
  plugins: [viteCommonjs(), react()],
  server: {
    port: 5173,
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
});
