import { hasSupabaseConfig } from "../../config/env.js";
import { supabase } from "../supabase.ts";

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  return supabase;
}
