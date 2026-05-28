import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  deleteBrandPost,
  findBrandPostById,
  upsertBrandPost,
} from "@/lib/db/repository";
import { assertCanWritePost, writeDealAudit } from "@/lib/deal-access";
import { pickEnum } from "@/lib/brand-offer-shared";
import type { BrandPost } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PLATFORM: BrandPost["platform"][] = [
  "instagram",
  "tiktok",
  "youtube",
  "kick",
  "twitter",
  "telegram",
  "other",
];
const ALLOWED_POST_TYPE: BrandPost["postType"][] = [
  "post",
  "reel",
  "story",
  "vlog",
  "stream",
  "vod",
  "tweet",
  "other",
];
const ALLOWED_STATUS: BrandPost["status"][] = ["draft", "live", "removed", "expired"];

interface PatchBody {
  caption?: string;
  postedAt?: string;
  screenshotUrl?: string;
  views?: number;
  likes?: number;
  comments?: number;
  status?: BrandPost["status"];
  platform?: BrandPost["platform"];
  postType?: BrandPost["postType"];
  dealId?: string | null;
}

/** PATCH /api/brand-posts/[id] */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const nowIso = new Date().toISOString();
  const next: BrandPost = {
    ...existing,
    ...(body.caption !== undefined ? { caption: String(body.caption ?? "") } : {}),
    ...(body.postedAt !== undefined
      ? { postedAt: body.postedAt ? String(body.postedAt) : undefined }
      : {}),
    ...(body.screenshotUrl !== undefined
      ? { screenshotUrl: body.screenshotUrl?.trim() || undefined }
      : {}),
    ...(body.views !== undefined
      ? { views: Math.max(0, Math.floor(Number(body.views) || 0)) }
      : {}),
    ...(body.likes !== undefined
      ? { likes: Math.max(0, Math.floor(Number(body.likes) || 0)) }
      : {}),
    ...(body.comments !== undefined
      ? { comments: Math.max(0, Math.floor(Number(body.comments) || 0)) }
      : {}),
    ...(body.status !== undefined
      ? { status: pickEnum(body.status, ALLOWED_STATUS, existing.status) }
      : {}),
    ...(body.platform !== undefined
      ? { platform: pickEnum(body.platform, ALLOWED_PLATFORM, existing.platform) }
      : {}),
    ...(body.postType !== undefined
      ? { postType: pickEnum(body.postType, ALLOWED_POST_TYPE, existing.postType) }
      : {}),
    ...(body.dealId !== undefined
      ? { dealId: body.dealId === null ? undefined : String(body.dealId).trim() || undefined }
      : {}),
    updatedAt: nowIso,
  };

  try {
    const saved = await upsertBrandPost(next);
    return NextResponse.json({ post: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Post güncellenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/brand-posts/[id] */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  try {
    await deleteBrandPost(id);
    await writeDealAudit(
      session,
      "post_deleted",
      `post=${id} brand=${existing.brandId} deal=${existing.dealId ?? "-"}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Post silinemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
