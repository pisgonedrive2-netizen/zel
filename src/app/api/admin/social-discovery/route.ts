import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled } from "@/lib/env";
import { runSocialDiscovery, type DiscoveryType } from "@/lib/social-api/discovery";
import { getMonthlyUsage, incrementUsage } from "@/lib/social-api/quota";
import { SOCIAL_PLANS, type SocialPlatform } from "@/lib/social-api/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canUseDiscovery(role: string): boolean {
  return ["admin", "auditor", "brand", "streamer"].includes(role);
}

function normalizeDiscoveryType(platform: SocialPlatform, type: string): DiscoveryType {
  if (type === "hashtag_posts") return "hashtag";
  if (type === "challenge_videos") return "hashtag";
  if (platform === "instagram" && type === "hashtag") return "hashtag";
  if (platform === "tiktok" && type === "hashtag") return "hashtag";
  return type as DiscoveryType;
}

/**
 * GET /api/admin/social-discovery
 * Admin, marka ve yayıncı panelleri için premium keşif.
 */
export async function GET(req: NextRequest) {
  if (!isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "RapidAPI yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !canUseDiscovery(session.role)) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const platform = req.nextUrl.searchParams.get("platform") as SocialPlatform | null;
  const rawType = req.nextUrl.searchParams.get("type") ?? "trending";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const gl = req.nextUrl.searchParams.get("gl")?.trim() || "TR";
  const hl = req.nextUrl.searchParams.get("hl")?.trim() || "tr";
  const count = req.nextUrl.searchParams.get("count")?.trim() || "15";
  const searchType = req.nextUrl.searchParams.get("search_type")?.trim() || "video";
  const igSection = req.nextUrl.searchParams.get("ig_section")?.trim() || "top";
  const ttSortType = req.nextUrl.searchParams.get("tt_sort_type")?.trim() || "0";
  const ttPublishTime = req.nextUrl.searchParams.get("tt_publish_time")?.trim() || "0";
  const ttFollowerCount = req.nextUrl.searchParams.get("tt_follower_count")?.trim() || "0";
  const ttProfileType = req.nextUrl.searchParams.get("tt_profile_type")?.trim() || "0";
  const ttOtherPref = req.nextUrl.searchParams.get("tt_other_pref")?.trim() || "0";
  const ytChannelFilter = req.nextUrl.searchParams.get("yt_channel_filter")?.trim() || "videos_latest";

  if (!platform || !["youtube", "instagram", "tiktok"].includes(platform)) {
    return NextResponse.json({ ok: false, error: "platform gerekli (youtube|instagram|tiktok)" }, { status: 400 });
  }

  const type = normalizeDiscoveryType(platform, rawType);

  const usage = await getMonthlyUsage(platform);
  const plan = SOCIAL_PLANS[platform];
  const safeLimit = Math.floor(plan.monthlyLimit * plan.safeFraction);
  if (usage.requestsUsed >= safeLimit) {
    return NextResponse.json(
      { ok: false, error: "Kota doldu", quotaExhausted: true },
      { status: 429 },
    );
  }

  try {
    const started = Date.now();
    const result = await runSocialDiscovery({
      platform,
      type,
      query: q,
      gl,
      hl,
      count,
      searchType,
      igSection,
      ttRegion: gl,
      ttSortType,
      ttPublishTime,
      ttFollowerCount,
      ttProfileType,
      ttOtherPref,
      ytChannelFilter,
    });

    await incrementUsage(platform, result.apiCalls);

    return NextResponse.json({
      ok: true,
      platform,
      type: rawType,
      query: q || null,
      filters: {
        gl, hl, count, searchType, igSection, ttSortType, ttPublishTime,
        ttFollowerCount, ttProfileType, ttOtherPref, ytChannelFilter,
      },
      items: result.items,
      resultCount: result.items.length,
      apiCalls: result.apiCalls,
      endpoints: result.endpoints,
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "API hatası";
    return NextResponse.json({ ok: false, error: msg, platform }, { status: 502 });
  }
}
