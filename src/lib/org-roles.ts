// Org rolleri için paylaşılan etiket/açıklama metadatası (client-safe).
// Hem marka ekip sayfası hem de admin görünümleri buradan okur.

import type { OrgRole } from "@/store/store";

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Marka sahibi",
  admin: "Yönetici",
  finance: "Muhasebe",
  marketing: "Pazarlama / CRM",
  hr: "İnsan kaynakları",
  viewer: "Görüntüleyici",
  auditor: "Denetçi",
};

export const ORG_ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Tüm yetki · ekip & ayar yönetimi · sahip",
  admin: "Tüm modüller + ekip yönetimi",
  finance: "Muhasebe, faturalar ve CRM erişimi",
  marketing: "CRM ve iş birliği akışı",
  hr: "Personel, görev ve vardiya yönetimi",
  viewer: "Yalnızca görüntüleme (salt-okunur)",
  auditor: "Denetim · tüm veriyi görür, değiştiremez",
};

/** Marka sahibi/yöneticisinin ekip için atayabileceği roller (owner hariç). */
export const ASSIGNABLE_ORG_ROLES: OrgRole[] = [
  "admin",
  "finance",
  "marketing",
  "hr",
  "auditor",
  "viewer",
];

/** Salt-okunur org rolleri — bu roldeki marka kullanıcıları yazma yapamaz. */
export const READ_ONLY_ORG_ROLES: ReadonlySet<OrgRole> = new Set<OrgRole>([
  "viewer",
  "auditor",
]);

/** Ekip & ayar yönetebilen org rolleri. */
export const TEAM_MANAGER_ORG_ROLES: ReadonlySet<OrgRole> = new Set<OrgRole>([
  "owner",
  "admin",
]);

export function orgRoleLabel(role: string | undefined | null): string {
  if (!role) return "—";
  return ORG_ROLE_LABELS[role as OrgRole] ?? role;
}
