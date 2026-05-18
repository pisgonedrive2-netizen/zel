import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabaseUrl } from "@/lib/env";

let admin: SupabaseClient | null = null;

/** Server-only Supabase client (service role, bypasses RLS). */
export function getSupabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(getSupabaseUrl(), getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
