import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { incrementUsage } from "@/lib/social-api/quota";
import { probePlatformFeature } from "@/lib/social-api/feature-probe";
import { getPlatformFeature } from "@/lib/social-api/platform-capabilities";
import type { SocialPlatform } from "@/lib/social-api/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { platform, featureId } — tek bir API özelliğini canlı test eder (1 kota). */
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

  const body = (await req.json().catch(() => ({}))) as {
    platform?: string;
    featureId?: string;
  };
  const platform = body.platform as SocialPlatform | undefined;
  const featureId = body.featureId?.trim();

  if (!platform || !["youtube", "instagram", "tiktok"].includes(platform)) {
    return NextResponse.json({ ok: false, error: "platform gerekli" }, { status: 400 });
  }
  if (!featureId || !getPlatformFeature(platform, featureId)) {
    return NextResponse.json({ ok: false, error: "featureId geçersiz" }, { status: 400 });
  }

  const result = await probePlatformFeature(platform, featureId);
  if (result.status > 0 || result.ok) {
    await incrementUsage(platform, 1).catch(() => undefined);
  }

  return NextResponse.json({
    ok: result.ok,
    platform,
    featureId: result.featureId,
    endpoint: result.endpoint,
    status: result.status,
    latencyMs: result.latencyMs,
    message: result.message,
    preview: result.preview,
  });
}
