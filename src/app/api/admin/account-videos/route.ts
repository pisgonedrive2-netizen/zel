import { NextRequest, NextResponse, after } from "next/server";
import { persistThumbForUrl } from "@/lib/social-api/free-thumbnails";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled } from "@/lib/env";
import {
  fetchProfilePostsForAccount,
  type ProfilePostItem,
} from "@/lib/social-api/streamer-profile-posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; items: ProfilePostItem[] }>();

/** GET /api/admin/account-videos?platform=YouTube&handle=lanetkelben */
export async function GET(req: NextRequest) {
  if (!isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "RapidAPI yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const platform = req.nextUrl.searchParams.get("platform")?.trim() ?? "";
  const handle = req.nextUrl.searchParams.get("handle")?.trim().replace(/^@/, "") ?? "";
  if (!platform || !handle) {
    return NextResponse.json({ ok: false, error: "platform ve handle gerekli" }, { status: 400 });
  }

  const key = `${platform.toLowerCase()}|${handle.toLowerCase()}`;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const hit = cache.get(key);
  if (hit && !fresh && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, items: hit.items, cachedAt: new Date(hit.at).toISOString() });
  }

  try {
    const items = await fetchProfilePostsForAccount({
      platform,
      handle,
      url: "",
      maxItems: 40,
    });
    if (items.length > 0) cache.set(key, { at: Date.now(), items });
    after(async () => {
      for (const item of items) {
        if (item.url && item.thumbnailUrl) await persistThumbForUrl(item.url, item.thumbnailUrl);
      }
    });
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Videolar alınamadı";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
