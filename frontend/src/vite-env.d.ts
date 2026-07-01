/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  readonly VITE_DIFY_CHATBOT_TOKEN?: string
  readonly VITE_DIFY_CHATBOT_BASE_URL?: string
  readonly VITE_DIFY_CHATBOT_HTTPS_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
