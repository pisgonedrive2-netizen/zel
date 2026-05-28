import { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Affiliate API erişim sözleşmesi (Faz C).
 *
 * Roller:
 *   - admin    → tüm brand'ler üzerinde okuma/yazma
 *   - auditor  → tüm brand'leri okuyabilir, yazamaz
 *   - brand    → sadece kendi `brandId`'si üzerinde okuma/yazma
 *   - streamer → kendi `employeeId`'sine bağlı partner'ları okuyabilir, yazamaz
 */

export type AffiliateAction = "read" | "write";

export function canReadAffiliate(session: SessionPayload): boolean {
  return (
    session.role === "admin" ||
    session.role === "auditor" ||
    session.role === "brand" ||
    session.role === "streamer"
  );
}

export function canWriteAffiliate(session: SessionPayload): boolean {
  return session.role === "admin" || session.role === "brand";
}

/**
 * Brand role için body/query'deki brandId'nin session.brandId ile eşleştiğini
 * doğrular. Admin/auditor için her zaman true. Streamer için false (yazma yok).
 * Eşleşmezse NextResponse (403) döner; aksi halde null.
 */
export function ensureBrandScope(
  session: SessionPayload,
  brandId: string | null | undefined,
  action: AffiliateAction = "read"
): NextResponse | null {
  if (action === "write" && !canWriteAffiliate(session)) {
    return NextResponse.json({ error: "Yazma yetkisi yok" }, { status: 403 });
  }
  if (action === "read" && !canReadAffiliate(session)) {
    return NextResponse.json({ error: "Okuma yetkisi yok" }, { status: 403 });
  }
  if (session.role === "brand") {
    if (!session.brandId) {
      return NextResponse.json({ error: "Marka oturumu eksik" }, { status: 403 });
    }
    if (brandId && brandId !== session.brandId) {
      return NextResponse.json(
        { error: "Bu marka için yetkili değilsiniz" },
        { status: 403 }
      );
    }
  }
  return null;
}

/**
 * Brand role için efektif brandId — body'de yoksa session.brandId'yi kullanır.
 * Admin için boş bırakılabilir.
 */
export function resolveBrandId(
  session: SessionPayload,
  requested?: string | null
): string | undefined {
  if (session.role === "brand") return session.brandId;
  return requested?.trim() ? requested.trim() : undefined;
}

/**
 * Audit log — best effort. Başarısızlık API akışını kesmez.
 */
export async function writeAffiliateAudit(
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
