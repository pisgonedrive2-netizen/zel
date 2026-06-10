import type { OrgCapability } from "@/lib/org-capability";

/** Marka paneli navigasyon grupları — sidebar, subnav ve modül ızgarası tek kaynak. */
export type MarkaNavGroup =
  | "Genel"
  | "İş Birliği"
  | "İzlenme"
  | "Büyüme"
  | "Ekip"
  | "Finans"
  | "Hesap";

export type MarkaNavIconKey =
  | "LayoutDashboard"
  | "BarChart3"
  | "Users"
  | "Send"
  | "Handshake"
  | "CalendarDays"
  | "Eye"
  | "Search"
  | "Video"
  | "TrendingUp"
  | "Zap"
  | "Contact"
  | "Shield"
  | "Plug"
  | "FileSpreadsheet"
  | "Briefcase"
  | "Building2"
  | "ClipboardList"
  | "Settings"
  | "Calculator"
  | "FileText"
  | "Banknote"
  | "Wallet"
  | "UserCog"
  | "Bell";

export type MarkaModuleColor = "orange" | "green" | "blue" | "pink" | "violet";

export interface MarkaNavItemDef {
  id: string;
  href: string;
  label: string;
  group: MarkaNavGroup;
  icon: MarkaNavIconKey;
  cap?: OrgCapability;
  /** Modül ızgarası açıklaması */
  description?: string;
  moduleColor?: MarkaModuleColor;
}

export const MARKA_NAV_GROUP_ORDER: MarkaNavGroup[] = [
  "Genel",
  "İş Birliği",
  "İzlenme",
  "Büyüme",
  "Ekip",
  "Finans",
  "Hesap",
];

/** Tüm marka paneli sayfaları — tek doğruluk kaynağı. */
export const MARKA_NAV_ITEMS: MarkaNavItemDef[] = [
  { id: "anasayfa", href: "/marka/anasayfa", label: "Anasayfa", group: "Genel", icon: "LayoutDashboard", description: "Özet KPI ve hızlı erişim", moduleColor: "orange" },
  { id: "operasyon", href: "/marka/operasyon", label: "Operasyon özeti", group: "Genel", icon: "BarChart3", description: "Günlük operasyon ve aktivite", moduleColor: "orange" },
  { id: "uyumluluk", href: "/marka/uyumluluk", label: "Uyumluluk", group: "Genel", icon: "Shield", description: "Regülasyon ve uyumluluk takibi", moduleColor: "orange", cap: "compliance" },
  { id: "entegrasyon", href: "/marka/entegrasyon", label: "Entegrasyon", group: "Genel", icon: "Plug", description: "API ve üçüncü taraf bağlantılar", moduleColor: "orange" },
  { id: "raporlar", href: "/marka/raporlar", label: "Raporlar", group: "Genel", icon: "FileSpreadsheet", description: "Özet ve dışa aktarma raporları", moduleColor: "orange" },

  { id: "havuz", href: "/marka/havuz", label: "Yayıncı havuzu", group: "İş Birliği", icon: "Users", description: "Yayıncıları keşfet ve teklif gönder", moduleColor: "orange" },
  { id: "teklifler", href: "/marka/teklifler", label: "Teklifler", group: "İş Birliği", icon: "Send", description: "Teklifleri ve yanıtları yönet", moduleColor: "orange" },
  { id: "anlasmalar", href: "/marka/anlasmalar", label: "Anlaşmalar", group: "İş Birliği", icon: "Handshake", description: "Aktif iş birliği anlaşmaları", moduleColor: "orange" },
  { id: "takvim", href: "/marka/takvim", label: "Yayıncı takvimi", group: "İş Birliği", icon: "CalendarDays", description: "Haftalık yayın planları", moduleColor: "orange" },

  { id: "izlenmeler", href: "/marka/izlenmeler", label: "İzlenmeler", group: "İzlenme", icon: "Eye", description: "Link ve sosyal platform izlenme takibi", moduleColor: "blue" },
  { id: "kesif", href: "/marka/kesif", label: "Premium keşif", group: "İzlenme", icon: "Search", description: "Trend, hashtag ve rakip arama", moduleColor: "blue" },
  { id: "postlar", href: "/marka/postlar", label: "Postlar", group: "İzlenme", icon: "Video", description: "Yayıncı içerik performansı", moduleColor: "blue" },

  { id: "affiliate", href: "/marka/affiliate", label: "Affiliate", group: "Büyüme", icon: "TrendingUp", description: "Partner komisyon ve FTD takibi", moduleColor: "pink" },
  { id: "kampanyalar", href: "/marka/kampanyalar", label: "Kampanyalar", group: "Büyüme", icon: "Zap", description: "Bonus ve promosyon kampanyaları", moduleColor: "pink", cap: "bonus_ops" },
  { id: "crm", href: "/marka/crm", label: "CRM", group: "Büyüme", icon: "Contact", description: "Lead ve fırsat takibi", moduleColor: "pink", cap: "crm" },

  { id: "personel", href: "/marka/personel", label: "Personel", group: "Ekip", icon: "Briefcase", description: "Personel kayıtları ve roller", moduleColor: "violet", cap: "hr" },
  { id: "departmanlar", href: "/marka/departmanlar", label: "Departmanlar", group: "Ekip", icon: "Building2", description: "Departman yapısı", moduleColor: "violet", cap: "hr" },
  { id: "takip", href: "/marka/takip", label: "Görev & Takip", group: "Ekip", icon: "ClipboardList", description: "Görev atama ve vardiya", moduleColor: "violet", cap: "hr" },
  { id: "ekip", href: "/marka/ekip", label: "Ekip & yetkiler", group: "Ekip", icon: "Settings", description: "Ekip üyeleri ve roller", moduleColor: "violet", cap: "team" },

  { id: "muhasebe", href: "/marka/muhasebe", label: "Muhasebe", group: "Finans", icon: "Calculator", description: "Gelir/gider defteri", moduleColor: "green", cap: "finance" },
  { id: "faturalar", href: "/marka/faturalar", label: "Faturalar", group: "Finans", icon: "FileText", description: "Fatura oluştur ve takip et", moduleColor: "green", cap: "finance" },
  { id: "bordro", href: "/marka/bordro", label: "Bordro", group: "Finans", icon: "Banknote", description: "Marka içi bordro", moduleColor: "green", cap: "finance" },
  { id: "odemeler", href: "/marka/odemeler", label: "Ödeme planı", group: "Finans", icon: "Wallet", description: "Taksit ve ödeme durumu", moduleColor: "green" },

  { id: "profil", href: "/marka/profil", label: "Marka profili", group: "Hesap", icon: "UserCog" },
  { id: "bildirimler", href: "/marka/bildirimler", label: "Bildirimler", group: "Hesap", icon: "Bell" },
];

export function markaNavByGroup(
  items: MarkaNavItemDef[] = MARKA_NAV_ITEMS
): Map<MarkaNavGroup, MarkaNavItemDef[]> {
  const map = new Map<MarkaNavGroup, MarkaNavItemDef[]>();
  for (const g of MARKA_NAV_GROUP_ORDER) map.set(g, []);
  for (const item of items) {
    map.get(item.group)?.push(item);
  }
  return map;
}
