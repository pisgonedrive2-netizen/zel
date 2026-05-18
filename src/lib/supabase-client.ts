/** Client-side: Supabase API modu aktif mi? */
export function isSupabaseClientMode(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}
