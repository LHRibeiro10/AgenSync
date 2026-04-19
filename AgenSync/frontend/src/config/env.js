const dataModes = ["local", "remote"];
const authProviders = ["api", "supabase"];

function readString(name, fallback = "") {
  const value = import.meta.env[name];
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function readBoolean(name, fallback) {
  const value = readString(name);
  if (!value) return fallback;
  return value.toLowerCase() === "true";
}

function readEnum(name, allowed, fallback) {
  const value = readString(name, fallback);
  return allowed.includes(value) ? value : fallback;
}

export const env = Object.freeze({
  dataMode: readEnum("VITE_DATA_MODE", dataModes, "local"),
  authProvider: readEnum("VITE_AUTH_PROVIDER", authProviders, "api"),
  apiUrl: readString("VITE_API_URL", "http://localhost:3333/api"),
  supabaseUrl: readString("VITE_SUPABASE_URL"),
  supabaseAnonKey: readString("VITE_SUPABASE_ANON_KEY"),
  supabaseResetPasswordRedirectUrl: readString(
    "VITE_SUPABASE_RESET_PASSWORD_REDIRECT_URL",
    `${typeof window !== "undefined" ? window.location.origin : ""}/reset-password`
  ),
  tokenStorageKey: readString("VITE_AUTH_TOKEN_STORAGE_KEY", "agensync_token"),
  mockFallbackEnabled: readBoolean("VITE_ENABLE_MOCK_FALLBACK", true)
});

export function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
