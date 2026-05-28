import { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BrandDeal, BrandOffer, BrandPost } from "@/store/store";

/**
 * Faz G + H — Yayıncı Havuzu, Teklif, Anlaşma ve Post erişim sözleşmesi.
 *
 * Roller:
 *   - admin    → tüm offer/deal/post yazabilir
 *   - auditor  → hepsini okur, yazamaz
 *   - brand    → sadece kendi `brandId`'sine ait satırlara yazabilir/okur
 *   - streamer → sadece `employeeId`'sine bağlı offer/deal/post (kendi pool profili)
 */

export type DealAction = "read" | "write";

export interface OfferLike {
  brandId: string;
  employeeId: string;
}

export interface DealLike {
  brandId: string;
  employeeId: string;
}

export interface PostLike {
  brandId: string;
  employeeId?: string;
}

function deny(message: string, status = 403): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function canRead(session: SessionPayload): boolean {
  return (
    session.role === "admin" ||
    session.role === "auditor" ||
    session.role === "brand" ||
    session.role === "streamer"
  );
}

function canWriteRole(session: SessionPayload): boolean {
  return (
    session.role === "admin" || session.role === "brand" || session.role === "streamer"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Offer
// ─────────────────────────────────────────────────────────────────────────────

export function assertCanReadOffer(
  session: SessionPayload,
  offer: OfferLike
): NextResponse | null {
  if (!canRead(session)) return deny("Okuma yetkisi yok");
  if (session.role === "admin" || session.role === "auditor") return null;
  if (session.role === "brand") {
    if (!session.brandId || session.brandId !== offer.brandId) {
      return deny("Bu teklif için yetkili değilsiniz");
    }
    return null;
  }
  if (session.role === "streamer") {
    if (!session.employeeId || session.employeeId !== offer.employeeId) {
      return deny("Bu teklif için yetkili değilsiniz");
    }
    return null;
  }
  return deny("Okuma yetkisi yok");
}

export function assertCanWriteOffer(
  session: SessionPayload,
  offer: OfferLike
): NextResponse | null {
  if (!canWriteRole(session)) return deny("Yazma yetkisi yok");
  if (session.role === "admin") return null;
  if (session.role === "brand") {
    if (!session.brandId || session.brandId !== offer.brandId) {
      return deny("Bu teklif için yetkili değilsiniz");
    }
    return null;
  }
  if (session.role === "streamer") {
    if (!session.employeeId || session.employeeId !== offer.employeeId) {
      return deny("Bu teklif için yetkili değilsiniz");
    }
    return null;
  }
  return deny("Yazma yetkisi yok");
}

// ─────────────────────────────────────────────────────────────────────────────
// Deal
// ─────────────────────────────────────────────────────────────────────────────

export function assertCanReadDeal(
  session: SessionPayload,
  deal: DealLike
): NextResponse | null {
  return assertCanReadOffer(session, { brandId: deal.brandId, employeeId: deal.employeeId });
}

export function assertCanWriteDeal(
  session: SessionPayload,
  deal: DealLike
): NextResponse | null {
  if (!canWriteRole(session)) return deny("Yazma yetkisi yok");
  if (session.role === "admin") return null;
  if (session.role === "brand") {
    if (!session.brandId || session.brandId !== deal.brandId) {
      return deny("Bu anlaşma için yetkili değilsiniz");
    }
    return null;
  }
  if (session.role === "streamer") {
    if (!session.employeeId || session.employeeId !== deal.employeeId) {
      return deny("Bu anlaşma için yetkili değilsiniz");
    }
    return null;
  }
  return deny("Yazma yetkisi yok");
}

// ─────────────────────────────────────────────────────────────────────────────
// Post
// ─────────────────────────────────────────────────────────────────────────────

export function assertCanReadPost(
  session: SessionPayload,
  post: PostLike
): NextResponse | null {
  if (!canRead(session)) return deny("Okuma yetkisi yok");
  if (session.role === "admin" || session.role === "auditor") return null;
  if (session.role === "brand") {
    if (!session.brandId || session.brandId !== post.brandId) {
      return deny("Bu post için yetkili değilsiniz");
    }
    return null;
  }
  if (session.role === "streamer") {
    if (!session.employeeId || session.employeeId !== post.employeeId) {
      return deny("Bu post için yetkili değilsiniz");
    }
    return null;
  }
  return deny("Okuma yetkisi yok");
}

export function assertCanWritePost(
  session: SessionPayload,
  post: PostLike
): NextResponse | null {
  if (!canWriteRole(session)) return deny("Yazma yetkisi yok");
  if (session.role === "admin") return null;
  if (session.role === "brand") {
    if (!session.brandId || session.brandId !== post.brandId) {
      return deny("Bu post için yetkili değilsiniz");
    }
    return null;
  }
  if (session.role === "streamer") {
    if (!session.employeeId || (post.employeeId && session.employeeId !== post.employeeId)) {
      return deny("Bu post için yetkili değilsiniz");
    }
    return null;
  }
  return deny("Yazma yetkisi yok");
}

// ─────────────────────────────────────────────────────────────────────────────
// Counterpart user lookup — bir offer'a karşı tarafa bildirim gönderirken
// app_users tablosundan ilgili user'ı çözümler.
// ─────────────────────────────────────────────────────────────────────────────
export interface NotifyTarget {
  userId: string;
  role: "brand" | "streamer" | "admin" | "auditor";
}

/**
 * Bir offer için karşı taraf (initiator değil) hedefini çözümler.
 * - initiator='brand' ise → yayıncının app_user'ı (employee_id ile)
 * - initiator='streamer' ise → markanın app_user'ı (brand_id ile)
 *
 * Birden fazla eşleşen kullanıcı varsa ilkini döner. Bulunmazsa null.
 */
export async function resolveCounterpartTarget(
  offer: Pick<BrandOffer, "initiator" | "brandId" | "employeeId">
): Promise<NotifyTarget | null> {
  if (offer.initiator === "brand") {
    const { data, error } = await getSupabaseAdmin()
      .from("app_users")
      .select("id, role")
      .eq("employee_id", offer.employeeId)
      .eq("active", true)
      .limit(1);
    if (error) return null;
    const row = (data ?? [])[0] as { id?: string; role?: string } | undefined;
    if (!row?.id) return null;
    return { userId: String(row.id), role: (row.role as NotifyTarget["role"]) ?? "streamer" };
  }
  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("id, role")
    .eq("brand_id", offer.brandId)
    .eq("active", true)
    .limit(1);
  if (error) return null;
  const row = (data ?? [])[0] as { id?: string; role?: string } | undefined;
  if (!row?.id) return null;
  return { userId: String(row.id), role: (row.role as NotifyTarget["role"]) ?? "brand" };
}

/**
 * Marka için (brand_id) app_users.id çözümler — yeni post bildirimi gibi
 * tek-yönlü akışlarda kullanılır.
 */
export async function resolveBrandUser(brandId: string): Promise<NotifyTarget | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("id, role")
    .eq("brand_id", brandId)
    .eq("active", true)
    .limit(1);
  if (error) return null;
  const row = (data ?? [])[0] as { id?: string; role?: string } | undefined;
  if (!row?.id) return null;
  return { userId: String(row.id), role: (row.role as NotifyTarget["role"]) ?? "brand" };
}

/**
 * Audit log — best effort. Başarısızlık akışı kesmez.
 */
export async function writeDealAudit(
  session: SessionPayload,
  action: string,
  detail: string
): Promise<void> {
  try {
    await getSupabaseAdmin().from("audit_logs").insert({
      actor_id: session.userId,
      actor_name: session.name,
      action,
      detail,
    });
  } catch {
    /* audit log opsiyonel */
  }
}

// Re-export brand/deal/post types just for convenience in consumers (optional)
export type { BrandOffer, BrandDeal, BrandPost };
