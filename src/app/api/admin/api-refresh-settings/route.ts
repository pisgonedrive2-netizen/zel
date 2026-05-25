import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import {
  CRON_INTERVAL_OPTIONS,
  getApiRefreshSettings,
  saveApiRefreshSettings,
  suggestMinCronIntervalHours,
} from "@/lib/social-api/settings";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SocialPlatform } from "@/lib/social-api/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function trackedCounts(): Promise<Record<SocialPlatform, number>> {
  const counts: Record<SocialPlatform, number> = { youtube: 0, instagram: 0, tiktok: 0 };
  const { data } = await getSupabaseAdmin()
    .from("brand_links")
    .select("platform")
    .eq("status", "active")
    .eq("auto_track", true);
  for (const row of data ?? []) {
    const p = String((row as { platform: string }).platform).toLowerCase();
    if (p.includes("youtube")) counts.youtube += 1;
    else if (p.includes("instagram")) counts.instagram += 1;
    else if (p.includes("tiktok")) counts.tiktok += 1;
  }
  return counts;
}

/** GET — mevcut API yenileme ayarları + plan önerileri */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const settings = await getApiRefreshSettings();
  const counts = await trackedCounts();
  const suggestions = {
    youtube: suggestMinCronIntervalHours("youtube", counts.youtube),
    instagram: suggestMinCronIntervalHours("instagram", counts.instagram),
    tiktok: suggestMinCronIntervalHours("tiktok", counts.tiktok),
  };

  return NextResponse.json({
    ok: true,
    settings,
    intervalOptions: CRON_INTERVAL_OPTIONS,
    suggestions,
    trackedCounts: counts,
  });
}

/** PATCH — admin ayarları günceller */
export async function PATCH(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    cronIntervalHours: number;
    notifyEnabled: boolean;
    notifyCooldownHours: number;
  }>;

  const counts = await trackedCounts();
  if (body.cronIntervalHours != null) {
    const minSuggested = Math.max(
      suggestMinCronIntervalHours("youtube", counts.youtube),
      suggestMinCronIntervalHours("instagram", counts.instagram),
      suggestMinCronIntervalHours("tiktok", counts.tiktok)
    );
    if (body.cronIntervalHours < minSuggested) {
      return NextResponse.json(
        {
          ok: false,
          error: `Seçilen aralık (${body.cronIntervalHours}sa) Basic plan kotası için çok sık. En az ${minSuggested} saat önerilir.`,
          minSuggestedHours: minSuggested,
        },
        { status: 400 }
      );
    }
  }

  const settings = await saveApiRefreshSettings(body, session.userId);
  return NextResponse.json({ ok: true, settings });
}
