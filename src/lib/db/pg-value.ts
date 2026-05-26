/** Postgres `date` — boş string asla gönderilmez. */
export function pgDate(
  value: string | null | undefined,
  fallback?: string | null
): string | null {
  if (value == null) return fallback ?? null;
  const v = String(value).trim();
  if (!v) return fallback ?? null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return fallback ?? null;
  return m[1];
}

/** Postgres `timestamptz` — boş string → null. */
export function pgTimestamptz(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  return v || null;
}

/** Postgres `time` — boş string → null. */
export function pgTime(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  return v || null;
}
