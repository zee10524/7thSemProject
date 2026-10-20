/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API when it is not served under the same origin (leave empty with the proxy). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
