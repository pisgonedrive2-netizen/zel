import type { AppUser, Role } from "@/store/auth";
import type { SessionPayload } from "@/lib/session";
import { isMainAdmin, isMainAdminSession } from "@/lib/user-guards";

/**
 * İnce ayarlı (granular) yetki sistemi.
 *
 * Rol (admin/auditor/…) kaba erişimi belirler; `permissions` ise kullanıcı
 * bazında bunu ezer. `permissions` yoksa (undefined) rol varsayılanları
 * uygulanır → mevcut davranış korunur. Ana yönetici (Orkun) her zaman tam
 * yetkilidir.
 *
 * Bir yönetici (admin) hesabı açıp neleri görüp göremeyeceğini tek tek
 * seçebilmek için tasarlandı: hangi sayfalar, cüzdan bilgisi, izlenmeler,
 * işlem günlüğü (son log kayıtları), geçmiş ödemeler, prim sistemi vb.
 */

export type Capability =
  // ── Sayfa erişimleri ──────────────────────────────────────────────
  | "page.ozet"
  | "page.prim"
  | "page.gorevler"
  | "page.maaslar"
  | "page.rapor"
  | "page.kasa"
  | "page.takvim"
  | "page.izlenme"
  | "page.icerik"
  | "page.dis_gelir"
  | "page.ic_gelir"
  | "page.giderler"
  | "page.planlanan"
  | "page.kullanicilar"
  | "page.bildirimler"
  | "page.denetci"
  // ── Hassas veri görünürlüğü ──────────────────────────────────────
  | "data.ramiz_wallet"
  | "data.audit_log"
  | "data.audit_admin_actions"
  // ── İşlem / yazma yetkileri ──────────────────────────────────────
  | "write.payroll"
  | "write.kasa"
  | "write.content_review"
  | "users.manage"
  | "users.impersonate";

/** Kullanıcı bazlı yetki override haritası (sparse). */
export type UserPermissions = Partial<Record<Capability, boolean>>;

export type CapabilityGroup =
  | "Sayfalar"
  | "Hassas veri"
  | "İşlemler";

export type CapabilityMeta = {
  key: Capability;
  label: string;
  description: string;
  group: CapabilityGroup;
};

/** İnsan-okunur yetki kataloğu (yetki editörü bunu kullanır). */
export const CAPABILITY_CATALOG: CapabilityMeta[] = [
  // Sayfalar
  { key: "page.ozet", group: "Sayfalar", label: "Özet paneli", description: "Şirket geneli özet & KPI panosu." },
  { key: "page.prim", group: "Sayfalar", label: "Prim sistemi", description: "Prim havuzu hesap & dağıtım sayfası." },
  { key: "page.maaslar", group: "Sayfalar", label: "Maaşlar / Bordro", description: "Çalışan maaşları ve bordro." },
  { key: "page.rapor", group: "Sayfalar", label: "Ödeme raporu (geçmiş ödemeler)", description: "Aylık ödeme durumu ve geçmiş ödemeler." },
  { key: "page.kasa", group: "Sayfalar", label: "Kasa", description: "Kasa bakiyeleri ve işlemler." },
  { key: "page.icerik", group: "Sayfalar", label: "İçerik harcamaları", description: "İçerik/yayın harcamaları." },
  { key: "page.dis_gelir", group: "Sayfalar", label: "Dış gelir (geçmiş)", description: "Sponsor / dış gelir kayıtları." },
  { key: "page.ic_gelir", group: "Sayfalar", label: "İç gelir", description: "İç gelir / proje gelirleri." },
  { key: "page.giderler", group: "Sayfalar", label: "Giderler", description: "Genel giderler." },
  { key: "page.planlanan", group: "Sayfalar", label: "Planlanan", description: "Planlanan gelir/gider." },
  { key: "page.izlenme", group: "Sayfalar", label: "İzlenmeler", description: "İzlenme özeti, grafikler, operatörler, API." },
  { key: "page.takvim", group: "Sayfalar", label: "Yayın takvimi", description: "Haftalık yayın takvimi." },
  { key: "page.gorevler", group: "Sayfalar", label: "Görevler", description: "Görev takip panosu." },
  { key: "page.kullanicilar", group: "Sayfalar", label: "Kullanıcı yönetimi", description: "Kullanıcılar sayfası (yeni bir alt yetki ile düzenleme kontrol edilir)." },
  { key: "page.bildirimler", group: "Sayfalar", label: "Bildirim merkezi", description: "Bildirim akışı." },
  { key: "page.denetci", group: "Sayfalar", label: "Denetim özeti", description: "Denetim (auditor) ana paneli." },
  // Hassas veri
  { key: "data.ramiz_wallet", group: "Hassas veri", label: "Cüzdan bilgisi (Ramiz / TRON)", description: "Ramiz'e ait TRON cüzdan adresi, TRON kasası ve otomatik işlemler. Kapalıysa maskelenir." },
  { key: "data.audit_log", group: "Hassas veri", label: "İşlem günlüğü (son log kayıtları)", description: "Kullanıcılar sayfasındaki işlem günlüğü tablosu." },
  { key: "data.audit_admin_actions", group: "Hassas veri", label: "Günlükte yönetici eylemleri", description: "İşlem günlüğünde diğer yöneticilerin eylemlerini de görür." },
  // İşlemler
  { key: "write.payroll", group: "İşlemler", label: "Bordro düzenleme", description: "Maaş/ödeme kalemlerini işaretleme & düzenleme (kapalı = salt-okunur)." },
  { key: "write.kasa", group: "İşlemler", label: "Kasa işlemleri", description: "Kasa işlemi ekleme/düzenleme (kapalı = salt-okunur)." },
  { key: "write.content_review", group: "İşlemler", label: "İçerik harcaması onayı", description: "İçerik harcamalarını onaylama/reddetme & ödendi işaretleme." },
  { key: "users.manage", group: "İşlemler", label: "Kullanıcı yönetimi (yazma)", description: "Kullanıcı ekleme/düzenleme/silme, PIN sıfırlama." },
  { key: "users.impersonate", group: "İşlemler", label: "Hesaba giriş (denetim)", description: "Başka bir kullanıcının hesabına denetim için girme." },
];

export const ALL_CAPABILITIES: Capability[] = CAPABILITY_CATALOG.map((c) => c.key);

/** Impersonation (denetim) oturumunda asla açılmayan hassas yetkiler. */
const IMPERSONATION_BLOCKED: ReadonlySet<Capability> = new Set<Capability>([
  "page.prim",
  "page.ozet",
  "data.ramiz_wallet",
  "users.impersonate",
]);

/**
 * Rol varsayılanları — `permissions` verilmediğinde uygulanır. Mevcut davranışı
 * birebir korur:
 *  • admin (Orkun dışı, örn. Ediz): prim/özet/cüzdan/impersonate KAPALI, gerisi açık.
 *  • auditor: salt-okunur denetim rotaları.
 *  • Orkun (ana yönetici): rol varsayılanına bakılmaz, her zaman tam yetkili.
 */
export const ROLE_DEFAULT_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set<Capability>([
    "page.gorevler", "page.maaslar", "page.rapor", "page.kasa", "page.takvim",
    "page.izlenme", "page.icerik", "page.dis_gelir", "page.ic_gelir",
    "page.giderler", "page.planlanan", "page.kullanicilar", "page.bildirimler",
    "page.denetci",
    "data.audit_log", "data.audit_admin_actions",
    "write.payroll", "write.kasa", "write.content_review", "users.manage",
    // page.ozet, page.prim, data.ramiz_wallet, users.impersonate → yalnızca ana yönetici (varsayılan kapalı)
  ]),
  auditor: new Set<Capability>([
    "page.denetci", "page.bildirimler", "page.kasa", "page.icerik",
    "page.maaslar", "page.rapor", "page.giderler", "page.dis_gelir", "page.izlenme",
    // salt-okunur: write.* yok, users.* yok, prim/özet/cüzdan yok
  ]),
  streamer: new Set<Capability>([]),
  brand: new Set<Capability>([]),
};

type CapabilitySubject = {
  isMainAdmin: boolean;
  role: Role | null;
  impersonating: boolean;
  permissions?: UserPermissions | null;
};

function capabilityGranted(subject: CapabilitySubject, cap: Capability): boolean {
  if (subject.impersonating && IMPERSONATION_BLOCKED.has(cap)) return false;
  if (subject.isMainAdmin && !subject.impersonating) return true;
  const perms = subject.permissions;
  if (perms && Object.prototype.hasOwnProperty.call(perms, cap)) {
    return perms[cap] === true;
  }
  if (!subject.role) return false;
  return ROLE_DEFAULT_CAPABILITIES[subject.role]?.has(cap) ?? false;
}

type UserLike = Pick<AppUser, "id" | "username" | "impersonatorId"> & {
  role?: Role | null;
  permissions?: UserPermissions | null;
};

/** İstemci tarafı: AppUser üzerinden yetki kontrolü. */
export function hasCapability(
  user: UserLike | null | undefined,
  cap: Capability,
): boolean {
  return capabilityGranted(
    {
      isMainAdmin: isMainAdmin(user),
      role: user?.role ?? null,
      impersonating: !!user?.impersonatorId,
      permissions: user?.permissions,
    },
    cap,
  );
}

/** Belirli bir rol + permissions için yetki (canAccess gibi role'ün ayrı geldiği yerler). */
export function hasCapabilityFor(
  args: { isMainAdmin?: boolean; role: Role | null; impersonating?: boolean; permissions?: UserPermissions | null },
  cap: Capability,
): boolean {
  return capabilityGranted(
    {
      isMainAdmin: args.isMainAdmin ?? false,
      role: args.role,
      impersonating: args.impersonating ?? false,
      permissions: args.permissions,
    },
    cap,
  );
}

/** Sunucu tarafı: oturum (JWT) üzerinden yetki kontrolü. */
export function hasCapabilitySession(
  session: SessionPayload | null | undefined,
  cap: Capability,
): boolean {
  return capabilityGranted(
    {
      isMainAdmin: isMainAdminSession(session),
      role: session?.role ?? null,
      impersonating: !!session?.impersonatorId,
      permissions: session?.permissions,
    },
    cap,
  );
}

/** Tam yetki haritası (editörde mevcut durumu göstermek için). */
export function resolveCapabilities(user: UserLike | null | undefined): Record<Capability, boolean> {
  const out = {} as Record<Capability, boolean>;
  for (const cap of ALL_CAPABILITIES) out[cap] = hasCapability(user, cap);
  return out;
}

/** Rota → gerektirdiği sayfa yetkisi. Eşleşme yoksa undefined (kısıtsız). */
const ROUTE_CAPABILITY: Array<[string, Capability]> = [
  ["/ozet", "page.ozet"],
  ["/prim", "page.prim"],
  ["/gorevler", "page.gorevler"],
  ["/maaslar", "page.maaslar"],
  ["/rapor", "page.rapor"],
  ["/kasa", "page.kasa"],
  ["/takvim", "page.takvim"],
  ["/izlenme", "page.izlenme"],
  ["/icerik-harcamalari", "page.icerik"],
  ["/dis-gelir", "page.dis_gelir"],
  ["/ic-gelir", "page.ic_gelir"],
  ["/giderler", "page.giderler"],
  ["/planlanan", "page.planlanan"],
  ["/kullanicilar", "page.kullanicilar"],
  ["/bildirimler", "page.bildirimler"],
  ["/denetci", "page.denetci"],
];

export function routeCapability(pathname: string): Capability | undefined {
  for (const [prefix, cap] of ROUTE_CAPABILITY) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return cap;
  }
  return undefined;
}

/** Serbest/temizlenmiş permissions objesi (yalnızca bilinen anahtarlar, boolean). */
export function sanitizePermissions(raw: unknown): UserPermissions | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const src = raw as Record<string, unknown>;
  const out: UserPermissions = {};
  let count = 0;
  for (const cap of ALL_CAPABILITIES) {
    if (Object.prototype.hasOwnProperty.call(src, cap) && typeof src[cap] === "boolean") {
      out[cap] = src[cap] as boolean;
      count++;
    }
  }
  return count > 0 ? out : undefined;
}
