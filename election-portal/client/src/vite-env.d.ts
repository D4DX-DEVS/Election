/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
