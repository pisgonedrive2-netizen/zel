/** Supabase + session env (server). */
export function isSupabaseEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SESSION_SECRET
  );
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return key;
}

export function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be at least 16 characters");
  return s;
}

/* --------------------------------------------------------------------------
 * RapidAPI (link otomatik yenileme — YouTube / TikTok / Instagram)
 * ------------------------------------------------------------------------ */

export function isRapidApiEnabled(): boolean {
  return Boolean(process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_KEY.length > 10);
}

export function getRapidApiKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set");
  return key;
}

/** Cron endpoint koruması; ayarlanmamışsa cron rotaları 503 döner. */
export function getCronSecret(): string | null {
  const s = process.env.CRON_SECRET;
  return s && s.length >= 16 ? s : null;
}

