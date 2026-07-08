/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOKETI_KEY?: string;
  readonly VITE_SOKETI_HOST?: string;
  readonly VITE_SOKETI_PORT?: string;
  readonly VITE_SOKETI_CLUSTER?: string;
  readonly VITE_SOKETI_TLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
