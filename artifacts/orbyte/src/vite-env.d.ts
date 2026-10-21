// Names of the public settings. strictImportMetaEnv turns a misspelt name into a type error.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEMO_MODE?: string;
}
