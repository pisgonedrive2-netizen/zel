import { NextResponse } from "next/server";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findBrandPostById, upsertBrandPost } from "@/lib/db/repository";
import { assertCanWritePost } from "@/lib/deal-access";
import { refreshPostMetrics } from "@/lib/social-api/post-metrics-refresh";

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
 * İki mod:
 *  - Manuel: body içinde { views?, likes?, comments? } gelirse o değerleri yazar.
 *  - Otomatik: boş body → RapidAPI ile (Instagram / TikTok / YouTube) izlenme çeker
 *    ve sonucu son-ölçüm (last_*) kolonlarına yazar. 1 RapidAPI kotası harcar.
 *
 * Yetki:
 *  - admin / auditor: her postu yenileyebilir
 *  - marka kullanıcısı: yalnızca kendi markasının postu
 *  - yayıncı: yalnızca kendi (employeeId) postu
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

  const body = (await req.json().catch(() => null)) as RefreshBody | null;
  const hasViews = body && body.views !== undefined && body.views !== null;
  const hasLikes = body && body.likes !== undefined && body.likes !== null;
  const hasComments = body && body.comments !== undefined && body.comments !== null;

  // ── Manuel mod: body değerleri verilmişse doğrudan yaz (yazma yetkisi gerekir).
  if (hasViews || hasLikes || hasComments) {
    const guard = assertCanWritePost(session, existing);
    if (guard) return guard;

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
      return NextResponse.json({ ok: true, refreshed: true, mode: "manual", post: saved });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Metric güncellenemedi";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Otomatik mod: RapidAPI ile izlenme çek.
  if (!isRapidApiEnabled()) {
    return NextResponse.json(
      { ok: false, error: "RapidAPI yapılandırılmamış — otomatik izlenme çekilemiyor." },
      { status: 503 }
    );
  }

  const isAdmin = session.role === "admin" || session.role === "auditor";
  const result = await refreshPostMetrics(id, {
    isAdmin,
    brandId: session.brandId,
    brandIds: session.brandIds,
    employeeId: session.employeeId,
  });
  return NextResponse.json({ ok: result.ok, mode: "auto", result }, { status: result.ok ? 200 : 200 });
}
