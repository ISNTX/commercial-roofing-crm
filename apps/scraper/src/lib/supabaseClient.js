import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnv, env } from "./env.js";

let client;

export function getSupabase() {
  if (!client) {
    assertSupabaseEnv();
    // Service role key: the scraper is a trusted internal service that
    // writes leads/contractors directly, bypassing RLS.
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
  }
  return client;
}
