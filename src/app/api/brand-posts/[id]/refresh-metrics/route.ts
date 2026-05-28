import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findBrandPostById, upsertBrandPost } from "@/lib/db/repository";
import { assertCanWritePost } from "@/lib/deal-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RefreshBody {
  views?: number;
  likes?: number;
  comments?: number;
}

/**
 * POST /api/brand-posts/[id]/refresh-metrics
 *
 * Şimdilik manuel: body içinden { views?, likes?, comments? } gelirse günceller.
 * Boş body → `{ ok: true, refreshed: false, reason: "manual_only" }` döner
 * (otomatik metric çekme ileride Faz F sosyal API helper'ları ile gelecek).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const existing = await findBrandPostById(id);
  if (!existing) {
    return NextResponse.json({ error: "Post bulunamadı" }, { status: 404 });
  }
  const guard = assertCanWritePost(session, existing);
  if (guard) return guard;

  const body = (await req.json().catch(() => null)) as RefreshBody | null;
  const hasViews = body && body.views !== undefined && body.views !== null;
  const hasLikes = body && body.likes !== undefined && body.likes !== null;
  const hasComments = body && body.comments !== undefined && body.comments !== null;

  if (!hasViews && !hasLikes && !hasComments) {
    return NextResponse.json({
      ok: true,
      refreshed: false,
      reason: "manual_only",
      post: existing,
    });
  }

  const nowIso = new Date().toISOString();
  try {
    const saved = await upsertBrandPost({
      ...existing,
      views: hasViews ? Math.max(0, Math.floor(Number(body!.views) || 0)) : existing.views,
      likes: hasLikes ? Math.max(0, Math.floor(Number(body!.likes) || 0)) : existing.likes,
      comments: hasComments
        ? Math.max(0, Math.floor(Number(body!.comments) || 0))
        : existing.comments,
      updatedAt: nowIso,
    });
    return NextResponse.json({ ok: true, refreshed: true, post: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Metric güncellenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
