import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess } from "@/lib/org-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
const ALLOWED_POST_STATUS: BrandPost["status"][] = ["draft", "live", "removed", "expired"];

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

/** brand_posts satırını istemci dostu BrandPost'a çevir (inline; mappers.ts'e bağımlı değil). */
function rowToPost(r: Record<string, unknown>): BrandPost {
  return {
    id: String(r.id ?? ""),
    brandId: String(r.brand_id ?? ""),
    employeeId: r.employee_id ? String(r.employee_id) : undefined,
    dealId: r.deal_id ? String(r.deal_id) : undefined,
    platform: pickEnum(r.platform, ALLOWED_PLATFORM, "other"),
    postType: pickEnum(r.post_type, ALLOWED_POST_TYPE, "post"),
    url: String(r.url ?? ""),
    caption: String(r.caption ?? ""),
    postedAt: r.posted_at ? String(r.posted_at) : undefined,
    screenshotUrl: r.screenshot_url ? String(r.screenshot_url) : undefined,
    views: Number(r.views ?? 0),
    likes: Number(r.likes ?? 0),
    comments: Number(r.comments ?? 0),
    status: pickEnum(r.status, ALLOWED_POST_STATUS, "live"),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

interface RawDeliverable {
  type: string;
  count: number;
  platform?: string;
}

function parseDeliverables(value: unknown): RawDeliverable[] {
  if (!Array.isArray(value)) return [];
  const out: RawDeliverable[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const type = String(obj.type ?? "").trim();
    const count = Math.max(0, Math.floor(Number(obj.count) || 0));
    const platform = obj.platform ? String(obj.platform).trim() : undefined;
    if (!type && !platform) continue;
    out.push({ type, count, platform: platform || undefined });
  }
  return out;
}

/**
 * Bir deliverable ile post eşleşiyor mu?
 * - Platform belirtilmişse post.platform aynı olmalı.
 * - Deliverable `type` bilinen bir post tipiyse post.postType aynı olmalı;
 *   serbest/jenerik bir tipse yalnızca platform üzerinden eşleşir.
 */
function deliverableMatchesPost(deliverable: RawDeliverable, post: BrandPost): boolean {
  const platformOk = !deliverable.platform || post.platform === deliverable.platform;
  const knownType = (ALLOWED_POST_TYPE as readonly string[]).includes(deliverable.type);
  const typeOk = !knownType || post.postType === deliverable.type;
  return platformOk && typeOk;
}

interface DeliverableProgress {
  type: string;
  platform: string | null;
  target: number;
  matched: number;
  posts: BrandPost[];
}

/**
 * GET /api/marka/anlasmalar/[id]/posts
 *
 * Bir anlaşmaya (brand_deal) ait postları döndürür ve her deliverable için
 * hedef vs gerçekleşen ilerlemeyi hesaplar. Eşleştirme `brand_posts.deal_id`
 * üzerinden yapılır; deliverable bazında platform + post tipi ile gruplanır.
 * Auth: oturum + marka erişim kontrolü (org-access).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { id: dealId } = await ctx.params;
  if (!dealId) {
    return NextResponse.json({ error: "Anlaşma id gerekli" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  try {
    // 1) Anlaşmayı çek — marka erişimi için brand_id + deliverables gerekir.
    const { data: dealRow, error: dealErr } = await sb
      .from("brand_deals")
      .select("id, brand_id, deliverables")
      .eq("id", dealId)
      .maybeSingle();
    if (dealErr) {
      return NextResponse.json({ error: dealErr.message }, { status: 500 });
    }
    if (!dealRow) {
      return NextResponse.json({ error: "Anlaşma bulunamadı" }, { status: 404 });
    }

    const brandId = String((dealRow as Record<string, unknown>).brand_id ?? "");
    const guard = ensureBrandAccess(session, brandId, "read");
    if (guard) return guard;

    // 2) Anlaşmaya bağlı postlar (deal_id eşleşmesi).
    const { data: postRows, error: postErr } = await sb
      .from("brand_posts")
      .select("*")
      .eq("deal_id", dealId);
    if (postErr) {
      return NextResponse.json({ error: postErr.message }, { status: 500 });
    }

    const posts = (postRows ?? []).map((r) => rowToPost(r as Record<string, unknown>));
    posts.sort((a, b) =>
      (b.postedAt ?? b.createdAt).localeCompare(a.postedAt ?? a.createdAt)
    );

    // 3) Deliverable bazında eşleştirme + ilerleme.
    const rawDeliverables = parseDeliverables(
      (dealRow as Record<string, unknown>).deliverables
    );
    const deliverables: DeliverableProgress[] = rawDeliverables.map((d) => {
      const matchedPosts = posts.filter((p) => deliverableMatchesPost(d, p));
      return {
        type: d.type,
        platform: d.platform ?? null,
        target: d.count,
        matched: matchedPosts.length,
        posts: matchedPosts,
      };
    });

    // Hiçbir deliverable'a eşleşmeyen postlar (bilgi amaçlı).
    const matchedIds = new Set(
      deliverables.flatMap((d) => d.posts.map((p) => p.id))
    );
    const unmatchedPosts = posts.filter((p) => !matchedIds.has(p.id));

    return NextResponse.json({
      dealId,
      totalPosts: posts.length,
      deliverables,
      posts,
      unmatchedPosts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlaşma postları yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
