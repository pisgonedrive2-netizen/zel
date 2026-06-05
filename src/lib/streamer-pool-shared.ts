import type { StreamerPoolProfile } from "@/store/store";

const ALLOWED_STATUS: StreamerPoolProfile["status"][] = [
  "draft",
  "published",
  "paused",
  "closed",
];
const ALLOWED_VISIBILITY: StreamerPoolProfile["visibility"][] = [
  "public",
  "brand_only",
  "invite_only",
];

function pickEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  const s = String(value ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : fallback;
}

function toStringArray(v: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(v)) return fallback;
  return (v as unknown[])
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
}

export function newProfileId(): string {
  return `spp-${crypto.randomUUID().slice(0, 10)}`;
}

/**
 * Body → StreamerPoolProfile normalize. `existing` verilirse (PATCH/PUT) yalnız
 * gelen alanlar üzerine yazılır.
 */
export function normalizeProfileBody(
  body: Partial<StreamerPoolProfile>,
  context: { employeeId: string; existing?: StreamerPoolProfile }
): StreamerPoolProfile {
  const nowIso = new Date().toISOString();
  const existing = context.existing;
  const id =
    existing?.id ??
    (typeof body.id === "string" && body.id.trim() ? body.id.trim() : newProfileId());
  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim()
      : existing?.displayName ?? "";

  const rateMin =
    body.rateMinUsd !== undefined
      ? body.rateMinUsd == null
        ? undefined
        : Math.max(0, Number(body.rateMinUsd))
      : existing?.rateMinUsd;
  const rateMax =
    body.rateMaxUsd !== undefined
      ? body.rateMaxUsd == null
        ? undefined
        : Math.max(0, Number(body.rateMaxUsd))
      : existing?.rateMaxUsd;

  return {
    id,
    employeeId: context.employeeId,
    displayName,
    headline:
      body.headline !== undefined ? String(body.headline ?? "") : existing?.headline ?? "",
    bio: body.bio !== undefined ? String(body.bio ?? "") : existing?.bio ?? "",
    categories:
      body.categories !== undefined
        ? toStringArray(body.categories)
        : existing?.categories ?? [],
    languages:
      body.languages !== undefined
        ? toStringArray(body.languages, ["tr"])
        : existing?.languages ?? ["tr"],
    countries:
      body.countries !== undefined
        ? toStringArray(body.countries, ["TR"])
        : existing?.countries ?? ["TR"],
    rateMinUsd: rateMin,
    rateMaxUsd: rateMax,
    rateCurrency:
      body.rateCurrency !== undefined
        ? String(body.rateCurrency || "USD")
        : existing?.rateCurrency ?? "USD",
    followersTotal:
      body.followersTotal !== undefined
        ? Math.max(0, Math.floor(Number(body.followersTotal) || 0))
        : existing?.followersTotal ?? 0,
    avgViews:
      body.avgViews !== undefined
        ? Math.max(0, Math.floor(Number(body.avgViews) || 0))
        : existing?.avgViews ?? 0,
    avatarUrl:
      body.avatarUrl !== undefined
        ? body.avatarUrl?.trim() || undefined
        : existing?.avatarUrl,
    coverUrl:
      body.coverUrl !== undefined ? body.coverUrl?.trim() || undefined : existing?.coverUrl,
    status:
      body.status !== undefined
        ? pickEnum(body.status, ALLOWED_STATUS, existing?.status ?? "draft")
        : existing?.status ?? "draft",
    visibility:
      body.visibility !== undefined
        ? pickEnum(body.visibility, ALLOWED_VISIBILITY, existing?.visibility ?? "public")
        : existing?.visibility ?? "public",
    igamingTags:
      body.igamingTags !== undefined
        ? toStringArray(body.igamingTags)
        : existing?.igamingTags ?? [],
    restrictedMarkets:
      body.restrictedMarkets !== undefined
        ? toStringArray(body.restrictedMarkets)
        : existing?.restrictedMarkets ?? [],
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}

export { ALLOWED_STATUS, ALLOWED_VISIBILITY };
