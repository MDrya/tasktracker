import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** True when both Supabase env vars are present. The UI shows a setup
 *  notice instead of crashing when they are missing. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Lazily created singleton Supabase client.
 *
 * Created on first use (not at module load) so `next build` succeeds
 * without env vars. When real auth is added later, this is the only
 * place that needs to grow session handling.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
          "Copy .env.local.example to .env.local and fill in your project values."
      );
    }
    client = createClient(url, anonKey);
  }
  return client;
}
