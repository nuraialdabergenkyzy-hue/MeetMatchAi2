const apiBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined);

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  apiBaseUrl: apiBase?.replace(/\/+$/, "") ?? "",
  useMockApi:
    import.meta.env.VITE_USE_MOCK_API === "true" || !apiBase,
};
export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);
export const isDemoAuthMode = !isSupabaseConfigured;
