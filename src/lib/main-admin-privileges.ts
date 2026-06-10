import type { OrgCapability } from "@/lib/org-capability";
import { MAIN_ADMIN_ID, MAIN_ADMIN_USERNAME } from "@/lib/user-guards";
import type { SessionPayload } from "@/lib/session";
import type { AppUser } from "@/store/auth";

/** Tüm org-modül yetkileri — marka paneli capability anahtarları. */
export const ALL_ORG_CAPABILITIES: OrgCapability[] = [
  "finance",
  "hr",
  "crm",
  "team",
  "compliance",
  "affiliate_api",
  "streamer_contracts",
  "bonus_ops",
];

export type MainAdminPrivilegeGroup = {
  id: string;
  title: string;
  description: string;
  items: { key: string; label: string; detail: string }[];
};

/**
 * Ana yönetici (orkun) için platform genelinde açık olan tüm üst düzey yetkiler.
 * Kullanıcılar sayfası ve denetim ekranlarında gösterilir.
 */
export const MAIN_ADMIN_PRIVILEGE_GROUPS: MainAdminPrivilegeGroup[] = [
  {
    id: "platform",
    title: "Platform yönetimi",
    description: "Ajans paneli — tüm modüller, yazma ve silme",
    items: [
      { key: "agency_full", label: "Ajans tam erişim", detail: "Özet, maaşlar, kasa, rapor, takvim, giderler, planlanan" },
      { key: "users_admin", label: "Kullanıcı yönetimi", detail: "Oluşturma, PIN sıfırlama, rol atama (kendi hesabı korumalı)" },
      { key: "notifications", label: "Bildirim merkezi", detail: "Tüm roller için bildirim oluşturma ve yönetim" },
      { key: "backup", label: "Yedekleme", detail: "Tam veri dışa/içe aktarma" },
      { key: "audit_logs", label: "Denetim kayıtları", detail: "Tüm işlem loglarını görüntüleme" },
    ],
  },
  {
    id: "viewership",
    title: "İzlenme & API",
    description: "Marka linkleri, RapidAPI, premium keşif",
    items: [
      { key: "izlenme_all", label: "İzlenme panosu", detail: "Tüm markalar, grafikler, operatörler, API keşif" },
      { key: "link_refresh", label: "Link yenileme", detail: "Tekil/toplu RapidAPI izlenme çekme, cron" },
      { key: "social_discovery", label: "Premium keşif", detail: "YouTube / Instagram / TikTok trend & arama" },
      { key: "link_details", label: "Link detay zenginleştirme", detail: "Engagement, yorumlar, ilgili içerik" },
      { key: "api_probe", label: "API özellik probu", detail: "RapidAPI endpoint test ve kota izleme" },
    ],
  },
  {
    id: "brand_org",
    title: "Marka & organizasyon",
    description: "Tüm kiracılar ve markalar üzerinde tam yetki",
    items: [
      { key: "all_brands", label: "Tüm markalar", detail: "scope_all_brands — mevcut ve yeni tüm markalar" },
      { key: "org_owner", label: "Org sahibi (owner)", detail: "Ekip, ayarlar, onboarding, provision" },
      { key: "brand_impersonate", label: "Marka paneli görünümü", detail: "Herhangi bir markayı admin olarak açma" },
      { key: "streamer_impersonate", label: "Yayıncı paneli görünümü", detail: "Herhangi bir yayıncıyı admin olarak açma" },
      { key: "multi_tenant", label: "Çok kiracılı erişim", detail: "Tüm organization_members kayıtları üzerinde yazma" },
    ],
  },
  {
    id: "finance_ops",
    title: "Finans & bordro",
    description: "Muhasebe, kasa, TRON, içerik harcamaları",
    items: [
      { key: "payroll", label: "Bordro tam", detail: "Maaşlar, avans, ek ödemeler, ödeme raporu" },
      { key: "kasa_tron", label: "Kasa & TRON", detail: "Kasa hareketleri, cüzdan izleme, otomatik senkron" },
      { key: "expenses", label: "Gider & gelir", detail: "İç/dış gelir, sponsor, planlanan kalemler" },
      { key: "brand_finance", label: "Marka muhasebesi", detail: "Fatura, bordro, ödeme planı (tüm markalar)" },
      { key: "content_spend", label: "İçerik harcamaları", detail: "Onay/red, yayıncı harcama eşlemesi" },
    ],
  },
  {
    id: "growth",
    title: "Büyüme & iş birliği",
    description: "Havuz, teklif, anlaşma, affiliate, kampanya",
    items: [
      { key: "pool_b2b", label: "Yayıncı havuzu (B2B)", detail: "Teklif, anlaşma, post, achievement sync" },
      { key: "affiliate", label: "Affiliate", detail: "Partner, günlük istatistik, API entegrasyonu" },
      { key: "campaigns", label: "Kampanyalar", detail: "Bonus operasyonları (bonus_ops)" },
      { key: "compliance", label: "Uyumluluk", detail: "Regülasyon kontrolleri (compliance)" },
      { key: "crm", label: "CRM", detail: "Lead ve fırsat yönetimi (tüm markalar)" },
    ],
  },
  {
    id: "team_hr",
    title: "Ekip & İK",
    description: "Personel, departman, görev, ekip yetkileri",
    items: [
      { key: "hr_full", label: "İK modülleri", detail: "Personel, departman, görev & takip (hr)" },
      { key: "team_mgmt", label: "Ekip yönetimi", detail: "Üye davet, rol atama, scope (team)" },
      { key: "contracts", label: "Yayıncı sözleşmeleri", detail: "streamer_contracts capability" },
      { key: "schedule", label: "Yayın takvimi", detail: "Haftalık plan, marka takvimi, reel refresh" },
    ],
  },
  {
    id: "security",
    title: "Güvenlik & koruma",
    description: "Ana yönetici hesabı özel korumaları",
    items: [
      { key: "undeletable", label: "Silinemez hesap", detail: "Sunucu + UI guard" },
      { key: "no_deactivate", label: "Pasifleştirilemez", detail: "active=false engellenir" },
      { key: "role_locked", label: "Rol kilitli (admin)", detail: "Rol düşürme engellenir" },
      { key: "username_locked", label: "Kullanıcı adı kilitli", detail: "orkun kullanıcı adı değiştirilemez" },
      { key: "cron_seed", label: "Sistem endpoint'leri", detail: "Seed, cron refresh-links (CRON_SECRET)" },
    ],
  },
];

export function isMainAdminPrincipal(
  p: Pick<AppUser, "id" | "username"> | Pick<SessionPayload, "userId" | "username"> | null | undefined
): boolean {
  if (!p) return false;
  const id = "userId" in p ? p.userId : p.id;
  const username = p.username;
  return id === MAIN_ADMIN_ID || username.toLowerCase().trim() === MAIN_ADMIN_USERNAME;
}

export const isMainAdminSession = isMainAdminPrincipal;

/** Ana yönetici tüm org capability'lere sahiptir. */
export function mainAdminHasOrgCapability(_capability: OrgCapability): boolean {
  return true;
}

/** Ana yönetici asla salt-okunur değildir. */
export function mainAdminIsReadOnly(): boolean {
  return false;
}

export function flattenMainAdminPrivileges(): { key: string; label: string; detail: string; group: string }[] {
  return MAIN_ADMIN_PRIVILEGE_GROUPS.flatMap((g) =>
    g.items.map((item) => ({ ...item, group: g.title }))
  );
}
