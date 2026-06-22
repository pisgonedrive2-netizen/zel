import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { incrementUsage } from "@/lib/social-api/quota";
import { pingPlatform, recordPlatformPingSuccess } from "@/lib/social-api/health";
import type { SocialPlatform } from "@/lib/social-api/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/api-ping?platform=youtube|tiktok|instagram
 *
 * Admin tarafından manuel test çağrısı. RapidAPI'nin gerçekten cevap verip
 * vermediğini probe ile doğrular. Bu istek kotadan 1 düşer (mock değildir;
 * gerçek bir API çağrısıdır).
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  if (!isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "RAPIDAPI_KEY yok" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") as SocialPlatform | null;
  if (!platform || !["youtube", "instagram", "tiktok"].includes(platform)) {
    return NextResponse.json({ ok: false, error: "platform=youtube|instagram|tiktok gerekli" }, { status: 400 });
  }

  const result = await pingPlatform(platform);
  // Probe başarılı olsa da olmasa da gerçek bir HTTP isteği gitti; kotadan 1 düş.
  if (result.status > 0) {
    await incrementUsage(platform, 1).catch(() => undefined);
  }
  if (result.ok) {
    await recordPlatformPingSuccess(platform).catch(() => undefined);
  }

  // Sağlayıcının döndürdüğü GERÇEK kota durumunu mesaja ekle (en doğru bilgi).
  const rl = result.rateLimit;
  let quotaNote = "";
  if (rl && rl.limit != null && rl.remaining != null) {
    const resetTxt =
      rl.resetSeconds != null
        ? rl.resetSeconds < 3600
          ? ` · ~${Math.max(1, Math.round(rl.resetSeconds / 60))} dk sonra resetlenir`
          : ` · ~${Math.round(rl.resetSeconds / 3600)} saat sonra resetlenir`
        : "";
    quotaNote = `Gerçek kota: ${rl.remaining}/${rl.limit} kaldı${resetTxt}`;
  }

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    message: quotaNote ? `${result.message} — ${quotaNote}` : result.message,
    latencyMs: result.latencyMs,
    platform,
    rateLimit: rl ?? null,
  });
}
