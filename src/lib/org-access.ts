import { NextResponse } from "next/server";
import type { SessionPayload } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isMainAdminSession } from "@/lib/user-guards";
import { READ_ONLY_ORG_ROLES, TEAM_MANAGER_ORG_ROLES } from "@/lib/org-roles";
import type { OrgRole } from "@/store/store";

/**
 * Multi-tenant erişim sözleşmesi (Faz 0+). affiliate-access.ts'in genel sürümü:
 * brand kullanıcısı session.brandIds içindeki TÜM markalarına erişebilir
 * (çok markalı org desteği). Admin tümü; auditor okuma; streamer kısıtlı.
 */

export type AccessAction = "read" | "write";

export function canReadBrandData(session: SessionPayload): boolean {
  return (
    session.role === "admin" ||
    session.role === "auditor" ||
    session.role === "brand"
  );
}

/** Org rolü salt-okunur mu? (marka denetçisi / görüntüleyici → yazamaz) */
export function isBrandReadOnly(session: SessionPayload): boolean {
  if (isMainAdminSession(session)) return false;
  if (session.role !== "brand") return false;
  const role = (session.orgRole ?? "") as OrgRole;
  return READ_ONLY_ORG_ROLES.has(role);
}

export function canWriteBrandData(session: SessionPayload): boolean {
  if (isMainAdminSession(session) || session.role === "admin") return true;
  // Marka denetçisi/görüntüleyicisi salt-okunur: yazma yok.
  if (session.role === "brand") return !isBrandReadOnly(session);
  return false;
}

/** Marka ekibini & ayarlarını yönetebilir mi? (owner/admin org rolü veya platform admini) */
export function canManageOrgTeam(session: SessionPayload): boolean {
  if (isMainAdminSession(session) || session.role === "admin") return true;
  if (session.role !== "brand") return false;
  return TEAM_MANAGER_ORG_ROLES.has((session.orgRole ?? "") as OrgRole);
}

/** Brand kullanıcısının erişebildiği marka id'leri (brandIds → brandId fallback). */
export function accessibleBrandIds(session: SessionPayload): string[] {
  if (session.brandIds && session.brandIds.length > 0) return session.brandIds;
  if (session.brandId) return [session.brandId];
  return [];
}

/**
 * brandId'nin oturum için erişilebilir olduğunu doğrular. Admin/auditor her zaman
 * geçer (auditor write hariç). Brand kullanıcısı yalnızca kendi org markalarına.
 * Uymazsa NextResponse döner; aksi halde null.
 */
export function ensureBrandAccess(
  session: SessionPayload,
  brandId: string | null | undefined,
  action: AccessAction = "read"
): NextResponse | null {
  if (action === "write" && !canWriteBrandData(session)) {
    return NextResponse.json({ error: "Yazma yetkisi yok" }, { status: 403 });
  }
  if (action === "read" && !canReadBrandData(session)) {
    return NextResponse.json({ error: "Okuma yetkisi yok" }, { status: 403 });
  }
  if (session.role === "brand") {
    const ids = accessibleBrandIds(session);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Marka oturumu eksik" }, { status: 403 });
    }
    if (brandId && !ids.includes(brandId)) {
      return NextResponse.json(
        { error: "Bu marka için yetkili değilsiniz" },
        { status: 403 }
      );
    }
  }
  return null;
}

/**
 * Brand role için efektif brandId — body'de yoksa ilk erişilebilir markayı kullanır.
 * Admin için requested döner (boş olabilir).
 */
export function resolveBrandId(
  session: SessionPayload,
  requested?: string | null
): string | undefined {
  if (session.role === "brand") {
    const ids = accessibleBrandIds(session);
    if (requested && ids.includes(requested)) return requested;
    return ids[0];
  }
  return requested?.trim() ? requested.trim() : undefined;
}

/** Brand role yazma filtresi: yalnızca erişilebilir markalar (admin tümü). */
export function brandWriteFilter(
  session: SessionPayload,
  requested?: string | null
): { brandIds: string[] | null } {
  if (session.role === "brand") return { brandIds: accessibleBrandIds(session) };
  if (requested) return { brandIds: [requested] };
  return { brandIds: null };
}

/** org_role bazlı yetki: belirli modüllere kimler yazabilir? */
export function hasOrgCapability(
  session: SessionPayload,
  capability:
    | "finance"
    | "hr"
    | "crm"
    | "admin"
    | "compliance"
    | "affiliate_api"
    | "streamer_contracts"
    | "bonus_ops"
): boolean {
  if (isMainAdminSession(session) || session.role === "admin") return true;
  if (session.role !== "brand") return false;
  const role = session.orgRole ?? "";
  // Salt-okunur roller (denetçi/görüntüleyici) hiçbir yazma modülüne sahip değildir.
  if (READ_ONLY_ORG_ROLES.has(role as OrgRole)) return false;
  if (capability === "admin") return role === "owner" || role === "admin";
  if (role === "owner" || role === "admin") return true;
  if (capability === "finance") return role === "finance";
  if (capability === "hr") return role === "hr";
  if (capability === "crm") return role === "marketing" || role === "finance";
  if (capability === "compliance") {
    return role === "marketing" || role === "admin" || role === "owner";
  }
  if (capability === "affiliate_api" || capability === "bonus_ops") {
    return role === "marketing" || role === "finance" || role === "admin" || role === "owner";
  }
  if (capability === "streamer_contracts") {
    return role === "marketing" || role === "hr" || role === "admin" || role === "owner";
  }
  return false;
}

/** Org capability yoksa 403 döner. */
export function ensureOrgCapability(
  session: SessionPayload,
  capability: Parameters<typeof hasOrgCapability>[1]
): NextResponse | null {
  if (!hasOrgCapability(session, capability)) {
    return NextResponse.json({ error: "Bu modül için yetkiniz yok" }, { status: 403 });
  }
  return null;
}

/** Marka kaynağına erişim (admin/auditor serbest, brand accessibleBrandIds). */
export function canAccessBrandId(
  session: SessionPayload,
  brandId: string | null | undefined
): boolean {
  if (session.role === "admin" || session.role === "auditor") return true;
  if (session.role === "brand" && brandId) {
    return accessibleBrandIds(session).includes(brandId);
  }
  return false;
}

/** Audit log — best effort. */
export async function writeAudit(
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
