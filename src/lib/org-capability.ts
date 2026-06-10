// İstemci tarafı org-rol yetki yardımcıları (next/server import etmez).
// Sunucu tarafı eşi: src/lib/org-access.ts → hasOrgCapability.
//
// Önemli ayrım:
//  - GÖRÜNÜRLÜK (bu dosya): owner/admin/denetçi/görüntüleyici tüm modülleri görür;
//    işlevsel roller (finance/hr/marketing) yalnızca kendi modüllerini görür.
//  - YAZMA (org-access.ts): denetçi/görüntüleyici hiçbir şeyi yazamaz (salt-okunur).

import { READ_ONLY_ORG_ROLES, TEAM_MANAGER_ORG_ROLES } from "@/lib/org-roles";
import { isMainAdminPrincipal } from "@/lib/main-admin-privileges";
import type { OrgRole } from "@/store/store";

export type OrgCapability =
  | "finance"
  | "hr"
  | "crm"
  | "team"
  | "compliance"
  | "affiliate_api"
  | "streamer_contracts"
  | "bonus_ops";

/**
 * Marka kullanıcısının org rolüne göre bir modülü GÖRÜP göremeyeceği (nav görünürlüğü).
 * - orgRole tanımsızsa (eski/backfill oturumları) geriye dönük uyum için TÜM modüller görünür.
 * - owner/admin: tümü.
 * - auditor/viewer: tümünü görür (salt-okunur denetim/görüntüleme).
 * - finance: muhasebe/fatura + crm; hr: personel/takip; marketing: crm.
 * - team (ekip yönetimi): yalnızca owner/admin.
 */
export function clientHasOrgCapability(
  orgRole: string | undefined | null,
  capability: OrgCapability,
  opts?: { isMainAdmin?: boolean }
): boolean {
  if (opts?.isMainAdmin) return true;
  if (capability === "team") {
    if (!orgRole) return true; // eski oturum geri uyumu
    return TEAM_MANAGER_ORG_ROLES.has(orgRole as OrgRole);
  }
  if (!orgRole) return true;
  if (orgRole === "owner" || orgRole === "admin") return true;
  // Denetçi & görüntüleyici tüm modülleri salt-okunur görür.
  if (READ_ONLY_ORG_ROLES.has(orgRole as OrgRole)) return true;
  if (capability === "finance") return orgRole === "finance";
  if (capability === "hr") return orgRole === "hr";
  if (capability === "crm") return orgRole === "marketing" || orgRole === "finance";
  if (capability === "compliance") {
    return orgRole === "marketing" || orgRole === "admin" || orgRole === "owner";
  }
  if (capability === "affiliate_api" || capability === "bonus_ops") {
    return orgRole === "marketing" || orgRole === "finance" || orgRole === "admin" || orgRole === "owner";
  }
  if (capability === "streamer_contracts") {
    return orgRole === "marketing" || orgRole === "hr" || orgRole === "admin" || orgRole === "owner";
  }
  return false;
}

/** Marka kullanıcısı salt-okunur mu? (denetçi/görüntüleyici → yazma kontrolleri gizlenir) */
export function clientIsReadOnly(
  orgRole: string | undefined | null,
  opts?: { isMainAdmin?: boolean }
): boolean {
  if (opts?.isMainAdmin) return false;
  if (!orgRole) return false;
  return READ_ONLY_ORG_ROLES.has(orgRole as OrgRole);
}

/** Ekip & ayar yönetebilir mi? */
export function clientCanManageTeam(
  orgRole: string | undefined | null,
  opts?: { isMainAdmin?: boolean }
): boolean {
  if (opts?.isMainAdmin) return true;
  if (!orgRole) return true;
  return TEAM_MANAGER_ORG_ROLES.has(orgRole as OrgRole);
}

/** AppUser veya session ile capability — ana yönetici her modülü görür. */
export function clientHasOrgCapabilityForUser(
  orgRole: string | undefined | null,
  capability: OrgCapability,
  user: { id: string; username: string } | null | undefined
): boolean {
  return clientHasOrgCapability(orgRole, capability, {
    isMainAdmin: isMainAdminPrincipal(user ?? null),
  });
}
