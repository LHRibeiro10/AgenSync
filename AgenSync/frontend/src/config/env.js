const authProviders = ["api", "supabase"];

function readString(name, fallback = "") {
  const value = import.meta.env[name];
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function readEnum(name, allowed, fallback) {
  const value = readString(name, fallback);
  return allowed.includes(value) ? value : fallback;
}

export const env = Object.freeze({
  authProvider: readEnum("VITE_AUTH_PROVIDER", authProviders, "supabase"),
  apiUrl: readString("VITE_API_URL"),
  supabaseUrl: readString("VITE_SUPABASE_URL"),
  supabaseAnonKey: readString("VITE_SUPABASE_ANON_KEY"),
  supabaseResetPasswordRedirectUrl: readString(
    "VITE_SUPABASE_RESET_PASSWORD_REDIRECT_URL",
    `${typeof window !== "undefined" ? window.location.origin : ""}/reset-password`
  ),
  tokenStorageKey: readString("VITE_AUTH_TOKEN_STORAGE_KEY", "@agensync-token")
});

export function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
