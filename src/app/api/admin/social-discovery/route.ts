import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled } from "@/lib/env";
import { rapidApiGet } from "@/lib/social-api/clients";
import { getMonthlyUsage, incrementUsage } from "@/lib/social-api/quota";
import { SOCIAL_PLANS, type SocialPlatform } from "@/lib/social-api/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscoveryType = "trending" | "search" | "hashtag" | "user_search";

function canUseDiscovery(role: string): boolean {
  return ["admin", "auditor", "brand", "streamer"].includes(role);
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
  const type = (req.nextUrl.searchParams.get("type") ?? "trending") as DiscoveryType;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const gl = req.nextUrl.searchParams.get("gl")?.trim() || "TR";
  const hl = req.nextUrl.searchParams.get("hl")?.trim() || "tr";
  const countryCode = req.nextUrl.searchParams.get("country_code")?.trim() || gl;
  const count = req.nextUrl.searchParams.get("count")?.trim() || "10";
  const searchType = req.nextUrl.searchParams.get("search_type")?.trim() || "video";

  if (!platform || !["youtube", "instagram", "tiktok"].includes(platform)) {
    return NextResponse.json({ ok: false, error: "platform gerekli (youtube|instagram|tiktok)" }, { status: 400 });
  }

  const usage = await getMonthlyUsage(platform);
  const plan = SOCIAL_PLANS[platform];
  const safeLimit = Math.floor(plan.monthlyLimit * plan.safeFraction);
  if (usage.requestsUsed >= safeLimit) {
    return NextResponse.json(
      { ok: false, error: "Kota doldu", quotaExhausted: true },
      { status: 429 }
    );
  }

  try {
    let raw: unknown;
    if (platform === "youtube") {
      if (type === "search") {
        if (!q) return NextResponse.json({ ok: false, error: "q gerekli" }, { status: 400 });
        raw = await rapidApiGet("youtube", "/search/", {
          q,
          type: searchType,
          gl,
          hl,
        });
      } else {
        try {
          raw = await rapidApiGet("youtube", "/v2/trending", { geo: gl, hl });
        } catch {
          raw = await rapidApiGet("youtube", "/search/", {
            q: "trending",
            type: "video",
            gl,
            hl,
          });
        }
      }
    } else if (platform === "instagram") {
      if (type === "hashtag" || !q) {
        if (!q) return NextResponse.json({ ok: false, error: "q gerekli (hashtag)" }, { status: 400 });
        raw = await rapidApiGet("instagram", "/hashtag_search", { query: q.replace(/^#/, "") });
      } else {
        raw = await rapidApiGet("instagram", "/hashtag_search", { query: q.replace(/^#/, "") });
      }
    } else {
      if (type === "user_search") {
        if (!q) return NextResponse.json({ ok: false, error: "q gerekli" }, { status: 400 });
        raw = await rapidApiGet("tiktok", "/user/search", { keywords: q, count });
      } else if (type === "hashtag") {
        if (!q) return NextResponse.json({ ok: false, error: "q gerekli (challenge)" }, { status: 400 });
        raw = await rapidApiGet("tiktok", "/challenge/info", {
          challenge_name: q.replace(/^#/, ""),
        });
      } else if (type === "search" && q) {
        raw = await rapidApiGet("tiktok", "/user/search", { keywords: q, count });
      } else {
        return NextResponse.json(
          { ok: false, error: "TikTok için search, hashtag veya user_search kullanın" },
          { status: 400 }
        );
      }
      void countryCode;
    }

    await incrementUsage(platform, 1);
    return NextResponse.json({
      ok: true,
      platform,
      type,
      query: q || null,
      filters: { gl, hl, countryCode, count, searchType },
      data: raw,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "API hatası";
    return NextResponse.json({ ok: false, error: msg, platform }, { status: 502 });
  }
}
