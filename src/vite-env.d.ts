/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISCOVERY_ENDPOINT?: string;
  readonly VITE_APP_DEMO_BRAND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
