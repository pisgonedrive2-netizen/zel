import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveFreeThumbs } from "@/lib/social-api/free-thumbnails";
import { creatorByKey } from "@/lib/clip-farm/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_URLS = 40;

/**
 * POST /api/admin/link-thumbs { urls, clipKey? } — RapidAPI kotası harcamadan kapak.
 * Oturum yoksa video yolla anahtarı ile yalnızca o kişinin gönderdiği linkler.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { urls?: unknown; clipKey?: unknown };
  let urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === "string" && u.length < 600).slice(0, MAX_URLS)
    : [];

  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    const creator = typeof body.clipKey === "string" ? await creatorByKey(body.clipKey).catch(() => null) : null;
    if (!creator) return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
    const { data } = await getSupabaseAdmin().from("clip_submissions").select("url").eq("creator_id", creator.id);
    const own = new Set((data ?? []).map((r) => String(r.url)));
    urls = urls.filter((u) => own.has(u));
  }

  if (urls.length === 0) return NextResponse.json({ ok: true, thumbs: {} });
  const thumbs = await resolveFreeThumbs(urls);
  return NextResponse.json({ ok: true, thumbs });
}
