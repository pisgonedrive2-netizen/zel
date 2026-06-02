/** API ham cevabından yayın tarihi (ISO) çıkarır. */
export function pickPublishedAtIso(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;

  const stringKeys = [
    "taken_at",
    "taken_at_timestamp",
    "posted_at",
    "postedAt",
    "publishedAt",
    "publishedDate",
    "publishDate",
    "uploadDate",
    "create_time",
    "createTime",
    "create_time_formatted",
    "timestamp",
    "created_at",
  ];
  for (const k of stringKeys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) {
      const iso = normalizeToIso(v.trim());
      if (iso) return iso;
    }
    if (typeof v === "number" && v > 1_000_000_000) {
      return new Date(v > 1e12 ? v : v * 1000).toISOString();
    }
  }

  for (const nested of [o.data, o.media, o.post, o.itemInfo, o.itemStruct, o.video]) {
    if (nested && typeof nested === "object") {
      const inner = pickPublishedAtIso(nested);
      if (inner) return inner;
    }
  }
  return undefined;
}

function normalizeToIso(s: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.includes("T") ? s : `${s.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const n = Number(s);
  if (Number.isFinite(n) && n > 1_000_000_000) {
    return new Date(n > 1e12 ? n : n * 1000).toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
