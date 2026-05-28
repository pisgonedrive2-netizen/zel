import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  fetchBrandPosts,
  findBrandDealById,
  findBrandPostByUrl,
  upsertBrandPost,
} from "@/lib/db/repository";
import {
  assertCanReadPost,
  assertCanWritePost,
  resolveBrandUser,
  writeDealAudit,
} from "@/lib/deal-access";
import {
  insertNotificationSafe,
  newNotifId,
  pickEnum,
} from "@/lib/brand-offer-shared";
import type { AppNotification, BrandPost } from "@/store/store";

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

function newPostId(): string {
  return `bp-${crypto.randomUUID().slice(0, 10)}`;
}

/** GET /api/brand-posts?brandId=&dealId=&employeeId=&platform=&status= */
export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const url = new URL(req.url);
  const queryBrandId = url.searchParams.get("brandId")?.trim() || undefined;
  const queryEmployeeId = url.searchParams.get("employeeId")?.trim() || undefined;
  const dealId = url.searchParams.get("dealId")?.trim() || undefined;
  const platformParam = url.searchParams.get("platform")?.trim();
  const statusParam = url.searchParams.get("status")?.trim();
  const platform =
    platformParam && (ALLOWED_PLATFORM as readonly string[]).includes(platformParam)
      ? (platformParam as BrandPost["platform"])
      : undefined;
  const status =
    statusParam && (ALLOWED_STATUS as readonly string[]).includes(statusParam)
      ? (statusParam as BrandPost["status"])
      : undefined;

  try {
    if (session.role === "admin" || session.role === "auditor") {
      const posts = await fetchBrandPosts({
        brandId: queryBrandId,
        employeeId: queryEmployeeId,
        dealId,
        platform,
        status,
      });
      return NextResponse.json({ posts });
    }
    if (session.role === "brand") {
      if (!session.brandId) {
        return NextResponse.json({ error: "Marka oturumu eksik" }, { status: 403 });
      }
      const posts = await fetchBrandPosts({
        brandId: session.brandId,
        employeeId: queryEmployeeId,
        dealId,
        platform,
        status,
      });
      return NextResponse.json({ posts });
    }
    if (session.role === "streamer") {
      if (!session.employeeId) {
        return NextResponse.json({ error: "Yayıncı oturumu eksik" }, { status: 403 });
      }
      const posts = await fetchBrandPosts({
        employeeId: session.employeeId,
        brandId: queryBrandId,
        dealId,
        platform,
        status,
      });
      return NextResponse.json({ posts });
    }
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Post listesi yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface PostBody {
  id?: string;
  brandId?: string;
  employeeId?: string;
  dealId?: string;
  platform?: BrandPost["platform"];
  postType?: BrandPost["postType"];
  url?: string;
  caption?: string;
  postedAt?: string;
  screenshotUrl?: string;
  views?: number;
  likes?: number;
  comments?: number;
  status?: BrandPost["status"];
}

/**
 * POST /api/brand-posts — URL paste ile yeni post.
 * UNIQUE (brand_id, url) çakışmasında mevcut satırı döner (ok: true, existed: true).
 */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (session.role === "auditor") {
    return NextResponse.json({ error: "Auditor post oluşturamaz" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const url = String(body.url ?? "").trim();
  if (!url) return NextResponse.json({ error: "url gerekli" }, { status: 400 });

  // Marka ve employee zorunlulukları role'a göre çözümlenir.
  const brandId =
    session.role === "brand" ? session.brandId ?? "" : String(body.brandId ?? "").trim();
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  let employeeId: string | undefined;
  if (session.role === "streamer") {
    employeeId = session.employeeId;
  } else {
    employeeId = body.employeeId?.trim() || undefined;
  }

  const guard = assertCanWritePost(session, { brandId, employeeId });
  if (guard) return guard;

  // dealId verildiyse: deal var mı + brand/employee uyuşuyor mu?
  let resolvedDealId: string | undefined = body.dealId?.trim() || undefined;
  if (resolvedDealId) {
    const deal = await findBrandDealById(resolvedDealId);
    if (!deal) {
      return NextResponse.json({ error: "Anlaşma bulunamadı" }, { status: 404 });
    }
    if (deal.brandId !== brandId) {
      return NextResponse.json(
        { error: "Anlaşma bu markaya ait değil" },
        { status: 403 }
      );
    }
    if (employeeId && deal.employeeId !== employeeId) {
      return NextResponse.json(
        { error: "Anlaşma bu yayıncıya ait değil" },
        { status: 403 }
      );
    }
    // Yayıncı dealdeki employeeId üzerinden post atıyorsa employeeId'yi doldur.
    if (!employeeId) employeeId = deal.employeeId;
  }

  // UNIQUE (brand_id, url) çakışma kontrolü.
  const existing = await findBrandPostByUrl(brandId, url);
  if (existing) {
    return NextResponse.json({ ok: true, existed: true, post: existing });
  }

  const nowIso = new Date().toISOString();
  const id =
    typeof body.id === "string" && /^bp-[a-z0-9-]+$/i.test(body.id) ? body.id : newPostId();
  const post: BrandPost = {
    id,
    brandId,
    employeeId,
    dealId: resolvedDealId,
    platform: pickEnum(body.platform, ALLOWED_PLATFORM, "other"),
    postType: pickEnum(body.postType, ALLOWED_POST_TYPE, "post"),
    url,
    caption: String(body.caption ?? ""),
    postedAt: typeof body.postedAt === "string" ? body.postedAt : undefined,
    screenshotUrl: body.screenshotUrl?.trim() || undefined,
    views: Math.max(0, Math.floor(Number(body.views) || 0)),
    likes: Math.max(0, Math.floor(Number(body.likes) || 0)),
    comments: Math.max(0, Math.floor(Number(body.comments) || 0)),
    status: pickEnum(body.status, ALLOWED_STATUS, "live"),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const saved = await upsertBrandPost(post);
    await writeDealAudit(
      session,
      "post_created",
      `post=${saved.id} brand=${saved.brandId} deal=${saved.dealId ?? "-"} platform=${saved.platform}`
    );

    if (session.role === "streamer") {
      const target = await resolveBrandUser(brandId).catch(() => null);
      if (target) {
        const notif: AppNotification = {
          id: newNotifId(),
          type: "general",
          title: `Yeni içerik gönderildi`,
          message: `Yayıncı yeni bir ${saved.platform} ${saved.postType} ekledi: ${saved.url}`,
          forRole: "brand",
          forUserId: target.userId,
          refId: saved.id,
          triggeredBy: session.userId,
          createdAt: nowIso,
          read: false,
          href: "/marka/postlar",
        };
        await insertNotificationSafe(notif);
      }
    }

    return NextResponse.json({ ok: true, existed: false, post: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Post kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
