import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig } from "../../config/env.js";

let supabaseClient = null;

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  if (supabaseClient) return supabaseClient;

  supabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  return supabaseClient;
}
