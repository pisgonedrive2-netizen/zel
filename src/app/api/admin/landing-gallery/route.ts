import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildItemFromParsed,
  getLandingGalleryItems,
  galleryViewsLabel,
  saveLandingGalleryItems,
  type LandingGalleryItem,
  type LandingGalleryPlatform,
} from "@/lib/landing-gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RankedClip = LandingGalleryItem & {
  linkId: string;
  handle: string | null;
  viewsLabel: string;
  lastSnapshotDate: string | null;
  lastCheckedAt: string | null;
  staleDays: number | null;
  kind: "short" | "reel" | "video" | "post";
};

function classifyKind(platform: LandingGalleryPlatform, url: string): RankedClip["kind"] {
  const u = url.toLowerCase();
  if (platform === "youtube") {
    if (u.includes("/shorts/")) return "short";
    return "video";
  }
  if (platform === "instagram") {
    if (u.includes("/reel") || u.includes("/reels/")) return "reel";
    return "post";
  }
  if (platform === "tiktok") return "short";
  return "post";
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function mapPlatform(raw: string): LandingGalleryPlatform | null {
  const p = raw.toLowerCase();
  if (p.includes("youtube")) return "youtube";
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("instagram")) return "instagram";
  return null;
}

async function loadRankedClips(minViews: number, limit: number): Promise<{
  ranked: RankedClip[];
  byPlatform: Record<string, number>;
}> {
  const { data: links } = await getSupabaseAdmin()
    .from("brand_links")
    .select("id, brand_id, platform, url, handle, last_views, external_ref, last_snapshot_date, last_checked_at")
    .not("last_views", "is", null)
    .gte("last_views", minViews)
    .order("last_views", { ascending: false })
    .limit(limit);

  const brandIds = [
    ...new Set((links ?? []).map((r) => String((r as { brand_id: string }).brand_id)).filter(Boolean)),
  ];
  const brandNameById = new Map<string, string>();
  if (brandIds.length > 0) {
    const { data: brands } = await getSupabaseAdmin().from("brands").select("id, name").in("id", brandIds);
    for (const b of brands ?? []) {
      brandNameById.set(String((b as { id: string }).id), String((b as { name: string }).name));
    }
  }

  const byPlatform: Record<string, number> = { youtube: 0, tiktok: 0, instagram: 0, other: 0 };
  const ranked: RankedClip[] = [];

  for (const row of links ?? []) {
    const r = row as {
      id: string;
      brand_id: string;
      platform: string;
      url: string;
      handle: string | null;
      last_views: number | null;
      external_ref: string | null;
      last_snapshot_date: string | null;
      last_checked_at: string | null;
    };
    const platform = mapPlatform(r.platform);
    if (!platform) continue;
    const built = buildItemFromParsed({
      url: r.url,
      brand: brandNameById.get(r.brand_id),
      views: r.last_views ?? 0,
    });
    if (!built) continue;
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
    const checked = r.last_checked_at ?? (r.last_snapshot_date ? `${r.last_snapshot_date}T12:00:00Z` : null);
    ranked.push({
      ...built,
      linkId: r.id,
      handle: r.handle,
      viewsLabel: galleryViewsLabel(built.views),
      lastSnapshotDate: r.last_snapshot_date,
      lastCheckedAt: r.last_checked_at,
      staleDays: daysSince(checked),
      kind: classifyKind(platform, r.url),
    });
  }

  return { ranked, byPlatform };
}

/** Admin — galeri + sıralı top Shorts/Reels/TikTok/YT/IG. */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const minViews = Math.max(0, Number(sp.get("minViews") ?? 100_000) || 100_000);
  const limit = Math.min(200, Math.max(20, Number(sp.get("limit") ?? 120) || 120));

  const items = await getLandingGalleryItems();
  const { ranked, byPlatform } = await loadRankedClips(minViews, limit);

  // Galeri öğelerinin güncel izlenmelerini brand_links ile hizala (görüntüleme için)
  const viewsById = new Map(ranked.map((r) => [r.id, r.views]));
  const syncedPreview = items.map((it) => {
    const live = viewsById.get(it.id);
    const views = live != null ? live : it.views;
    return { ...it, views, viewsLabel: galleryViewsLabel(views), liveViews: live ?? null };
  });

  return NextResponse.json({
    ok: true,
    items: syncedPreview,
    ranked,
    suggestions: ranked, // geriye uyum
    stats: {
      minViews,
      total: ranked.length,
      byPlatform,
      staleOver7d: ranked.filter((r) => (r.staleDays ?? 0) >= 7).length,
    },
  });
}

/** Admin — galeri kaydet veya izlenmeleri brand_links’ten senkronla. */
export async function PUT(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    items?: LandingGalleryItem[];
    action?: "save" | "syncViews" | "sortByViews";
  };

  const action = body.action ?? "save";

  try {
    if (action === "syncViews" || action === "sortByViews") {
      const current = body.items ?? (await getLandingGalleryItems());
      const { ranked } = await loadRankedClips(0, 500);
      const viewsById = new Map(ranked.map((r) => [r.id, r.views]));
      let next = current.map((it) => ({
        ...it,
        views: viewsById.get(it.id) ?? it.views,
      }));
      if (action === "sortByViews") {
        next = [...next].sort((a, b) => b.views - a.views);
      }
      const saved = await saveLandingGalleryItems(next, session.userId ?? session.username);
      return NextResponse.json({
        ok: true,
        items: saved.map((it) => ({ ...it, viewsLabel: galleryViewsLabel(it.views) })),
        action,
      });
    }

    if (!Array.isArray(body.items)) {
      return NextResponse.json({ ok: false, error: "items dizisi gerekli" }, { status: 400 });
    }
    if (body.items.length > 12) {
      return NextResponse.json({ ok: false, error: "En fazla 12 içerik" }, { status: 400 });
    }

    const saved = await saveLandingGalleryItems(body.items, session.userId ?? session.username);
    return NextResponse.json({
      ok: true,
      items: saved.map((it) => ({ ...it, viewsLabel: galleryViewsLabel(it.views) })),
      action: "save",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Kayıt başarısız" },
      { status: 500 }
    );
  }
}
