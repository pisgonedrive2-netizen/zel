"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import {
  Rocket, Star, Crown, Trophy, Boxes, Youtube, Clapperboard, FileText,
  Megaphone, Check, Play, ShieldCheck, TrendingUp, Plus, Minus, Radio, Share2, Globe, Send, Info, type LucideIcon,
} from "lucide-react";

const ORANGE = "#FF6B00";

// Lanetkel resmi Telegram — tüm "Teklif al" CTA'ları buraya yönlenir.
const TELEGRAM_URL = "https://t.me/lanetkelresmi";
function goTelegram() {
  if (typeof window !== "undefined") window.open(TELEGRAM_URL, "_blank", "noopener,noreferrer");
}

// ── İçerik türü etiketleri ──────────────────────────────────────────────────
const CONTENT_TAGS = {
  youtube: {
    label: "YouTube",
    color: "#EF4444",
    icon: Youtube,
    desc: "Minimum 10 dakikalık vlog — gezi, deneyim veya günlük tarzı, marka entegrasyonu doğal akışta.",
  },
  reel: {
    label: "Reel",
    color: "#EC4899",
    icon: Clapperboard,
    desc: "Marka tişörtü ile eğlenceli / komik kısa içerik — trend sesler ve akılda kalıcı hook.",
  },
  normal: {
    label: "Adult İçerik",
    color: "#3B82F6",
    icon: FileText,
    desc: "Senaryolu yetişkin içerik konsepti — markaya özel kurgu, çekim ve montaj dahil.",
  },
  live: {
    label: "Live Yayın",
    color: "#22C55E",
    icon: Radio,
    desc: "Canlı yayın — markaya özel bahis/etkinlik anı, izleyiciyle gerçek zamanlı etkileşim.",
  },
  campaign: {
    label: "Özel Kampanya",
    color: "#FF6B00",
    icon: Megaphone,
    desc: "Markaya özel konsept kampanya prodüksiyonu — fikir, çekim ve çok kanallı yayın.",
  },
} as const;

type ContentTagKey = keyof typeof CONTENT_TAGS;
type PackageItem = { tag: ContentTagKey; count: number };

/**
 * Hover'da içerik açıklaması gösteren tooltip sarmalayıcı (onboarding hissi).
 * Saf CSS hover + dokunmatikte focus ile de açılır.
 */
function WithTip({
  text,
  color,
  children,
}: {
  text: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span className="group/tip relative inline-flex cursor-help" tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-max max-w-[240px] rounded-lg border bg-[#0c0c0c] px-3 py-2 text-left text-[11px] font-medium leading-snug text-white/85 shadow-xl shadow-black/50 group-hover/tip:block group-focus/tip:block"
        style={{ borderColor: `${color}66` }}
      >
        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
          Ne yapılır?
        </span>
        {text}
      </span>
    </span>
  );
}

type ContentPackage = {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  price: string;
  priceUsd: number;
  priceUnit: string;
  priceNote?: string;
  /** true ise sabit fiyat gösterilmez; "Özel teklif" olarak sunulur. */
  priceOnRequest?: boolean;
  tagline: string;
  guaranteedViews: string;
  cpm: string;
  items: PackageItem[];
  featured?: boolean;
  badge?: string;
};

// ── 5 marka ─────────────────────────────────────────────────────────────────
const BRAND_BADGES: { name: string; color: string }[] = [
  { name: "Padişahbet", color: "#F59E0B" },
  { name: "Galabet", color: "#EF4444" },
  { name: "Betpipo", color: "#8B5CF6" },
  { name: "Hitbet", color: "#22C55E" },
  { name: "Betoffice", color: "#3B82F6" },
];

// ── İzlenme momentumu (genel/anonim — marka adı & tekil sayı göstermeden) ────
// Soyut bar yükseklikleri; sadece üretim hacmini/ivmeyi hissettirir.
const REACH_BARS: number[] = [100, 64, 88, 52, 76, 44, 92, 58, 70, 48, 82, 60];

// ── İçeriklerimizin organik paylaşıldığı global platformlar (markalı wordmark) ─
// Sistemde "Diğer" altında takip edemediğimiz repost domain'lerinden derlendi.
// Logolar telifsiz CSS wordmark olarak stilize edildi (görsel asset değil).
type SharePlatform = { name: string; bg: string; node: React.ReactNode };
const SHARE_PLATFORMS: SharePlatform[] = [
  {
    name: "Pornhub",
    bg: "#0b0b0b",
    node: (
      <>
        <span className="text-white">Porn</span>
        <span className="ml-0.5 rounded-[3px] bg-[#FF9000] px-1 text-black">hub</span>
      </>
    ),
  },
  {
    name: "YouPorn",
    bg: "#0b0b0b",
    node: (
      <>
        <span className="rounded-[3px] bg-[#E10070] px-1 text-white">You</span>
        <span className="ml-0.5 text-white">Porn</span>
      </>
    ),
  },
  {
    name: "RedTube",
    bg: "#0b0b0b",
    node: (
      <>
        <span className="text-white">Red</span>
        <span className="ml-0.5 rounded-[3px] bg-[#E70000] px-1 text-white">Tube</span>
      </>
    ),
  },
  {
    name: "Tube8",
    bg: "#0b0b0b",
    node: (
      <>
        <span className="text-white">Tube</span>
        <span className="ml-0.5 text-[#FF7A00]">8</span>
      </>
    ),
  },
  {
    name: "Eporner",
    bg: "#0b0b0b",
    node: <span className="font-extrabold tracking-tight text-[#FF8C1A]">EPORNER</span>,
  },
  {
    name: "Reddit",
    bg: "#FF4500",
    node: <span className="text-white">reddit</span>,
  },
  {
    name: "Hdalemi",
    bg: "#0b0b0b",
    node: (
      <>
        <span className="rounded-[3px] bg-[#22C55E] px-1 text-black">HD</span>
        <span className="ml-0.5 text-white">alemi</span>
      </>
    ),
  },
  {
    name: "Doeda",
    bg: "#0b0b0b",
    node: <span className="font-extrabold tracking-tight text-[#8B5CF6]">doeda</span>,
  },
];

// ── İçerik galerisi (sistemdeki gerçek EN ÇOK İZLENEN YouTube içerikleri) ────
// 600+ takipli link tarandı; thumbnail erişilebilirliği doğrulandı (hepsi 200).
const GALLERY: { id: string; brand: string; views: string; color: string }[] = [
  { id: "lsk5wAFGGpo", brand: "Padişahbet", views: "38.6M", color: "#F59E0B" },
  { id: "JVvF8iOLVgc", brand: "Padişahbet", views: "943K", color: "#F59E0B" },
  { id: "rcSNWCZHX0k", brand: "Padişahbet", views: "447K", color: "#F59E0B" },
  { id: "0EDxE8_kSPw", brand: "Padişahbet", views: "407K", color: "#F59E0B" },
  { id: "L7ti4aLci_I", brand: "Galabet", views: "241K", color: "#EF4444" },
  { id: "QUKxtLR4yac", brand: "Hitbet", views: "124K", color: "#22C55E" },
  { id: "4x0pAS9_Aac", brand: "Betpipo", views: "116K", color: "#8B5CF6" },
  { id: "hZkisAqRajs", brand: "Betpipo", views: "114K", color: "#8B5CF6" },
  { id: "EAxFRXmu0Wo", brand: "Padişahbet", views: "111K", color: "#F59E0B" },
  { id: "Z2INrWxc-Vs", brand: "Betpipo", views: "107K", color: "#8B5CF6" },
  { id: "bBIPsxLhVfw", brand: "Hitbet", views: "90K", color: "#22C55E" },
  { id: "R01WRD0gwjc", brand: "Betoffice", views: "90K", color: "#3B82F6" },
];

// ── Add-on'lar (à la carte, seçilebilir) ────────────────────────────────────
const ADDONS: { key: string; label: string; price: number; color: string; icon: LucideIcon }[] = [
  { key: "youtube", label: "Ekstra YouTube", price: 5000, color: "#EF4444", icon: Youtube },
  { key: "normal", label: "Ekstra Adult İçerik", price: 7000, color: "#3B82F6", icon: FileText },
  { key: "live", label: "Live Yayın", price: 1500, color: "#22C55E", icon: Radio },
  { key: "reel", label: "Ekstra Reel", price: 3000, color: "#EC4899", icon: Clapperboard },
  { key: "story", label: "Story serisi", price: 2000, color: "#F59E0B", icon: Play },
];

/** USD biçimlendir — $3.500 (TR binlik ayracı). */
function fmtUsd(n: number): string {
  return `$${n.toLocaleString("tr-TR")}`;
}

// ── Paketler ────────────────────────────────────────────────────────────────
const CONTENT_PACKAGES: ContentPackage[] = [
  {
    id: "starter",
    name: "Starter",
    icon: Rocket,
    color: "#38BDF8",
    price: "$5.500",
    priceUsd: 5500,
    priceUnit: "/ marka / ay",
    tagline: "YouTube olmadan hızlı başlangıç — reel ve adult içerik odaklı.",
    guaranteedViews: "250K",
    cpm: "≈ $6,9",
    items: [
      { tag: "reel", count: 2 },
      { tag: "normal", count: 1 },
    ],
  },
  {
    id: "standard",
    name: "Standard",
    icon: Star,
    color: ORANGE,
    price: "$10.000",
    priceUsd: 10000,
    priceUnit: "/ marka / ay",
    tagline: "Referans paket — 4 reel + adult içerik, YouTube yok.",
    guaranteedViews: "1M",
    cpm: "≈ $4,0",
    featured: true,
    badge: "En çok tercih",
    items: [
      { tag: "reel", count: 4 },
      { tag: "normal", count: 1 },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    icon: Crown,
    color: "#A855F7",
    price: "$16.500",
    priceUsd: 16500,
    priceUnit: "/ marka / ay",
    tagline: "1 YouTube + geniş reel kapsamı + canlı yayın.",
    guaranteedViews: "2.5M",
    cpm: "≈ $2,8",
    items: [
      { tag: "youtube", count: 1 },
      { tag: "reel", count: 6 },
      { tag: "normal", count: 2 },
      { tag: "live", count: 1 },
    ],
  },
  {
    id: "elite",
    name: "Elite",
    icon: Trophy,
    color: "#FACC15",
    price: "$25.000",
    priceUsd: 25000,
    priceUnit: "/ marka / ay",
    tagline: "2 YouTube + maksimum kapsama ve özel kampanya prodüksiyonu.",
    guaranteedViews: "6M",
    cpm: "≈ $1,7",
    items: [
      { tag: "youtube", count: 2 },
      { tag: "reel", count: 8 },
      { tag: "normal", count: 4 },
      { tag: "live", count: 2 },
      { tag: "campaign", count: 1 },
    ],
  },
];

const MULTI_PACKAGE: ContentPackage = {
  id: "multi",
  name: "Multi-marka",
  icon: Boxes,
  color: "#22C55E",
  price: "$40.000",
  priceUsd: 40000,
  priceUnit: "/ 5 marka / ay",
  priceOnRequest: true,
  tagline: "5 markanın tamamı için Standard paket — reel + adult içerik, YouTube yok.",
  guaranteedViews: "5M",
  cpm: "≈ $3,2",
  badge: "%20 indirim",
  items: [
    { tag: "reel", count: 20 },
    { tag: "normal", count: 5 },
  ],
};

function totalPieces(items: PackageItem[]): number {
  return items.reduce((s, it) => s + it.count, 0);
}

// ── Sayaç animasyonu ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 1400, bounce: 0 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  useEffect(() => {
    return spring.on("change", (v) => setDisplay(v.toFixed(decimals)));
  }, [spring, decimals]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

// ── Erişim momentumu (genel/anonim görsel) ───────────────────────────────────
function ReachPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const maxBar = Math.max(...REACH_BARS);
  return (
    <div ref={ref} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp size={16} className="text-orange-400" />
        <h3 className="text-sm font-semibold text-white">Aylık toplam erişim</h3>
        <span className="ml-auto text-[11px] text-white/40">Canlı veri · Haz 2026</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          <AnimatedNumber value={90} suffix="M+" />
        </span>
        <span className="text-sm font-medium text-white/50">izlenme / ay</span>
      </div>

      {/* Soyut momentum barları — marka adı/sayı yok */}
      <div className="mt-5 flex h-28 items-end gap-1.5 sm:gap-2">
        {REACH_BARS.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-md"
            style={{ background: "linear-gradient(180deg, #FF8A33, #FF6B00)" }}
            initial={{ height: 0, opacity: 0.4 }}
            animate={inView ? { height: `${(h / maxBar) * 100}%`, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: i * 0.06, ease: "easeOut" }}
          />
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-white/45">
        Yüzlerce içerik linki ve onlarca platform üzerinden ölçülen{" "}
        <span className="font-semibold text-white/70">organik erişim</span>. Rakamlar aylık toplamı yansıtır.
      </p>
    </div>
  );
}

// ── İçerik galerisi (sadece ilk 4 · tıklayınca yerinde video oynar) ─────────
function ContentGallery() {
  const [playing, setPlaying] = useState<string | null>(null);
  const items = GALLERY.slice(0, 4);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((g, i) => {
        const isPlaying = playing === g.id;
        return (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            whileHover={isPlaying ? undefined : { y: -4 }}
            onClick={() => !isPlaying && setPlaying(g.id)}
            className={`group relative aspect-[9/13] overflow-hidden rounded-xl border border-white/10 bg-black ${
              isPlaying ? "" : "cursor-pointer"
            }`}
          >
            {isPlaying ? (
              <iframe
                src={`https://www.youtube.com/embed/${g.id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                title={`${g.brand} içeriği`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${g.id}/hqdefault.jpg`}
                  alt={`${g.brand} içeriği`}
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.fallback) {
                      img.dataset.fallback = "1";
                      img.src = `https://i.ytimg.com/vi/${g.id}/mqdefault.jpg`;
                    } else {
                      img.style.display = "none";
                    }
                  }}
                  className="absolute inset-0 h-full w-full scale-[1.35] object-cover transition duration-500 group-hover:scale-[1.45]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-white/25">
                    <Play size={18} className="ml-0.5 fill-white text-white" />
                  </span>
                </div>
                <span
                  className="absolute left-2 top-2 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm"
                  style={{ background: `${g.color}cc`, color: "#000" }}
                >
                  {g.brand}
                </span>
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                  <Play size={11} className="fill-white/80 text-white/80" />
                  <span className="text-xs font-bold tabular-nums text-white drop-shadow">{g.views}</span>
                  <span className="text-[10px] text-white/60">izlenme</span>
                </div>
              </>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Paket kartı ──────────────────────────────────────────────────────────────
function PackageCard({
  pkg,
  index,
  selected,
  onPick,
}: {
  pkg: ContentPackage;
  index: number;
  selected: boolean;
  onPick: () => void;
}) {
  const Icon = pkg.icon;
  const featured = pkg.featured;
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: featured ? -16 : -8 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-colors ${
        selected
          ? "border-orange-400 bg-orange-500/[0.08] ring-2 ring-orange-400/60"
          : featured
            ? "border-orange-400/50 bg-gradient-to-b from-orange-500/[0.10] to-white/[0.02] shadow-xl shadow-orange-900/20 ring-1 ring-orange-400/30 lg:-translate-y-3 lg:scale-[1.03]"
            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      {selected && (
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          <Check size={11} strokeWidth={3} /> Seçildi
        </span>
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50"
        style={{ background: pkg.color }}
      />

      {pkg.badge && (
        <span
          className="absolute right-3 top-3 z-10 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: featured ? pkg.color : `${pkg.color}22`, color: featured ? "#000" : pkg.color }}
        >
          {pkg.badge}
        </span>
      )}

      <div className="relative z-[1] flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${pkg.color}1f`, color: pkg.color }}>
          <Icon size={22} strokeWidth={2.1} />
        </span>
        <div>
          <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
          <span className="text-[11px] text-white/45">{totalPieces(pkg.items)} prodüksiyon / ay</span>
        </div>
      </div>

      <div className="relative z-[1] mt-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold tracking-tight text-white">{pkg.price}</span>
          <span className="text-xs font-medium text-white/50">{pkg.priceUnit}</span>
        </div>
        {pkg.priceNote && <p className="mt-1 text-[11px] font-medium" style={{ color: pkg.color }}>{pkg.priceNote}</p>}
      </div>

      {/* Garantili izlenme + CPM */}
      <div className="relative z-[1] mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-1 text-[11px] font-semibold text-emerald-300">
          <ShieldCheck size={12} /> {pkg.guaranteedViews} garanti izlenme
        </span>
        <span className="inline-flex items-center rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-white/55">
          CPM {pkg.cpm}
        </span>
      </div>

      <p className="relative z-[1] mt-3 text-sm leading-relaxed text-white/60">{pkg.tagline}</p>

      <ul className="relative z-[1] mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
        {pkg.items.map((it) => {
          const tag = CONTENT_TAGS[it.tag];
          const TagIcon = tag.icon;
          return (
            <li key={it.tag}>
              <WithTip text={tag.desc} color={tag.color}>
                <span className="flex items-center gap-2.5 rounded-md py-0.5 transition group-hover/tip:opacity-100">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: `${tag.color}1f`, color: tag.color }}>
                    <TagIcon size={13} strokeWidth={2.2} />
                  </span>
                  <span className="text-sm text-white/80">
                    <span className="font-semibold text-white">{it.count}×</span> {tag.label}
                  </span>
                  <Info size={11} className="text-white/30" />
                </span>
              </WithTip>
            </li>
          );
        })}
      </ul>

      <div className="relative z-[1] mt-4 flex flex-wrap gap-1.5">
        {pkg.items.map((it) => {
          const tag = CONTENT_TAGS[it.tag];
          return (
            <span key={`tag-${it.tag}`} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${tag.color}1c`, color: tag.color }}>
              {tag.label}
            </span>
          );
        })}
      </div>

      <div className="relative z-[1] mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPick}
          style={selected ? { backgroundColor: ORANGE } : featured ? { backgroundColor: pkg.color } : undefined}
          className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition active:scale-[0.98] ${
            selected
              ? "text-white shadow-lg shadow-orange-900/30 ring-1 ring-orange-600/40 hover:brightness-110"
              : featured
                ? "text-white shadow-lg shadow-orange-900/30 ring-1 ring-orange-600/40 hover:brightness-110"
                : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
          }`}
        >
          <Check size={15} strokeWidth={2.4} /> {selected ? "Seçildi" : "Seç"}
        </button>
        <button
          type="button"
          onClick={goTelegram}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-transparent px-4 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <Send size={13} /> Teklif al
        </button>
      </div>
    </motion.div>
  );
}

// ── Seçilebilir add-on'lar ───────────────────────────────────────────────────
function AddonSelector({
  selectedPkg,
  onCommit,
  onNeedPackage,
}: {
  selectedPkg: ContentPackage | null;
  onCommit: (qty: Record<string, number>) => void;
  onNeedPackage: () => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const set = (key: string, delta: number) =>
    setQty((q) => {
      const next = Math.max(0, (q[key] ?? 0) + delta);
      return { ...q, [key]: next };
    });
  const total = ADDONS.reduce((s, a) => s + (qty[a.key] ?? 0) * a.price, 0);
  const count = ADDONS.reduce((s, a) => s + (qty[a.key] ?? 0), 0);

  const handleCommit = () => {
    if (!selectedPkg) {
      onNeedPackage();
      return;
    }
    onCommit(qty);
  };

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Plus size={15} className="text-orange-400" />
        <h3 className="text-sm font-semibold text-white">Pakete ek seç (à la carte)</h3>
        <span className="ml-auto text-[11px] text-white/40">
          {selectedPkg ? `Seçili paket: ${selectedPkg.name}` : "Önce yukarıdan paket seç"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {ADDONS.map((a) => {
          const AddIcon = a.icon;
          const n = qty[a.key] ?? 0;
          const active = n > 0;
          return (
            <div
              key={a.key}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                active ? "border-white/25 bg-white/[0.06]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${a.color}1f`, color: a.color }}>
                <AddIcon size={15} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/85">{a.label}</p>
                <p className="text-[11px] font-bold" style={{ color: a.color }}>{fmtUsd(a.price)}<span className="font-normal text-white/40"> / adet</span></p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => set(a.key, -1)}
                  disabled={n === 0}
                  aria-label={`${a.label} azalt`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-sm font-bold tabular-nums text-white">{n}</span>
                <button
                  type="button"
                  onClick={() => set(a.key, 1)}
                  aria-label={`${a.label} arttır`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toplam + CTA */}
      <div className="mt-4 flex flex-col items-stretch gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-white/50">Seçilen ek ({count} kalem):</span>
          <span className="text-2xl font-extrabold tracking-tight text-white">{fmtUsd(total)}</span>
          <span className="text-xs text-white/40">/ ay</span>
        </div>
        <button
          type="button"
          onClick={handleCommit}
          disabled={count === 0}
          style={count > 0 ? { backgroundColor: ORANGE } : undefined}
          className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold transition active:scale-[0.98] ${
            count > 0
              ? "text-white shadow-lg shadow-orange-900/30 ring-1 ring-orange-600/40 hover:brightness-110"
              : "cursor-not-allowed border border-white/10 bg-white/5 text-white/40"
          }`}
        >
          <Check size={15} strokeWidth={2.4} />
          {count === 0 ? "Ek seç" : selectedPkg ? "Seçimi teklife ekle" : "Önce paket seç"}
        </button>
      </div>
    </div>
  );
}

// ── Teklif özeti (seçili paket + eklenen add-on'lar) ─────────────────────────
function OfferSummary({
  selectedPkg,
  addons,
  onClear,
}: {
  selectedPkg: ContentPackage;
  addons: Record<string, number>;
  onClear: () => void;
}) {
  const addonLines = ADDONS.filter((a) => (addons[a.key] ?? 0) > 0);
  const addonTotal = addonLines.reduce((s, a) => s + (addons[a.key] ?? 0) * a.price, 0);
  const grand = selectedPkg.priceUsd + addonTotal;
  const PkgIcon = selectedPkg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-4 overflow-hidden rounded-2xl border border-orange-400/40 bg-gradient-to-br from-orange-500/[0.10] to-white/[0.02] p-5 ring-1 ring-orange-400/20 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <Check size={16} className="text-orange-400" />
        <h3 className="text-sm font-semibold text-white">Teklif özetin</h3>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-[11px] font-medium text-white/45 transition hover:text-white/80"
        >
          Temizle
        </button>
      </div>

      {/* Paket satırı */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${selectedPkg.color}1f`, color: selectedPkg.color }}>
          <PkgIcon size={16} strokeWidth={2.1} />
        </span>
        <span className="flex-1 text-sm font-semibold text-white">{selectedPkg.name} paketi</span>
        <span className="text-sm font-bold tabular-nums text-white">{selectedPkg.priceOnRequest ? "Özel teklif" : fmtUsd(selectedPkg.priceUsd)}</span>
      </div>

      {/* Add-on satırları */}
      {addonLines.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {addonLines.map((a) => {
            const n = addons[a.key] ?? 0;
            const AddIcon = a.icon;
            return (
              <div key={a.key} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${a.color}1f`, color: a.color }}>
                  <AddIcon size={14} strokeWidth={2.2} />
                </span>
                <span className="flex-1 text-sm text-white/80">
                  <span className="font-semibold text-white">{n}×</span> {a.label}
                </span>
                <span className="text-sm font-medium tabular-nums text-white/70">{fmtUsd(n * a.price)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Toplam + Teklif al */}
      <div className="mt-4 flex flex-col items-stretch gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-white/50">Toplam:</span>
          {selectedPkg.priceOnRequest ? (
            <span className="text-2xl font-extrabold tracking-tight text-white">Özel teklif</span>
          ) : (
            <>
              <span className="text-3xl font-extrabold tracking-tight text-white">{fmtUsd(grand)}</span>
              <span className="text-xs text-white/40">{selectedPkg.priceUnit}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={goTelegram}
          style={{ backgroundColor: ORANGE }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 ring-1 ring-orange-600/40 transition hover:brightness-110 active:scale-[0.98]"
        >
          <Send size={15} /> Teklif al · Telegram
        </button>
      </div>
    </motion.div>
  );
}

// ── Bölüm ─────────────────────────────────────────────────────────────────────
export function LandingPackages() {
  const pkg = MULTI_PACKAGE;
  const MultiIcon = pkg.icon;

  const ALL_PACKAGES = [...CONTENT_PACKAGES, MULTI_PACKAGE];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [committedAddons, setCommittedAddons] = useState<Record<string, number>>({});
  const selectedPkg = ALL_PACKAGES.find((p) => p.id === selectedId) ?? null;

  const packagesRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const pick = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };
  const scrollToPackages = () => packagesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  const handleCommit = (qty: Record<string, number>) => {
    setCommittedAddons(qty);
    setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  return (
    <section id="paketler" className="relative w-full overflow-hidden border-t border-white/5 bg-[#09090b] px-4 py-16 sm:px-6 sm:py-20">
      {/* Yumuşak ışıma */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,107,0,0.16) 0%, transparent 60%)" }}
      />
      <div className="relative z-10 mx-auto max-w-[1240px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-orange-400">İçerik paketleri</span>
          <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
            Markana uygun <span className="text-orange-400">içerik paketini</span> seç.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/60 sm:text-base">
            Garantili izlenmeli aylık paketler — YouTube, Reel, adult içerik ve canlı yayın.
            Türkiye pazarına özel fiyatlandırma.
          </p>
        </motion.div>

        {/* 5 marka rozeti */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {BRAND_BADGES.map((b, i) => (
            <motion.span
              key={b.name}
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: `${b.color}55`, background: `${b.color}14`, color: b.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.color }} />
              {b.name}
            </motion.span>
          ))}
        </div>

        {/* Erişim paneli + stat sayaçları (genel/yuvarlanmış) */}
        <div className="mb-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ReachPanel />
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: 90, suffix: "M+", label: "Aylık içerik izlenmesi", dec: 0 },
              { v: 5, suffix: "", label: "Aktif marka", dec: 0 },
              { v: 400, suffix: "+", label: "İçerik linki", dec: 0 },
              { v: 38, suffix: "M+", label: "En viral tek içerik", dec: 0 },
            ].map((s) => (
              <div key={s.label} className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
                <p className="text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
                  <AnimatedNumber value={s.v} suffix={s.suffix} decimals={s.dec} />
                </p>
                <p className="mt-1 text-[10px] leading-tight text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* İçerik galerisi */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Play size={15} className="fill-orange-400 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">Ürettiğimiz içeriklerden kesitler</h3>
            <span className="ml-auto text-[11px] text-white/40">Gerçek içerikler · tıkla & izle</span>
          </div>
          <ContentGallery />
        </div>

        {/* Organik paylaşım platformları — takip edemediğimiz global mecralar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="mb-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
        >
          <div className="mb-1 flex items-center gap-2">
            <Share2 size={15} className="text-orange-400" />
            <h3 className="text-sm font-semibold text-white">İçeriklerimiz başka nerelerde paylaşılıyor?</h3>
          </div>
          <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-white/55">
            Ürettiğimiz içerikler, takip ettiğimiz hesapların çok ötesinde — kullanıcılar tarafından
            onlarca global platformda organik olarak yeniden paylaşılıyor. Bu, ölçtüğümüz rakamların
            <span className="font-semibold text-white/75"> görünenden çok daha geniş</span> bir kitleye ulaştığını gösterir.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {SHARE_PLATFORMS.map((p, i) => (
              <motion.span
                key={p.name}
                title={p.name}
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                whileHover={{ y: -3, scale: 1.04 }}
                className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm font-bold leading-none shadow-sm ring-1 ring-white/5"
                style={{ background: p.bg }}
              >
                {p.node}
              </motion.span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-white/15 bg-transparent px-3 py-2 text-xs font-medium text-white/45">
              <Globe size={13} className="text-white/35" />
              +40 platform daha
            </span>
          </div>
        </motion.div>

        {/* Paket kartları */}
        <div ref={packagesRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTENT_PACKAGES.map((p, i) => (
            <PackageCard key={p.id} pkg={p} index={i} selected={selectedId === p.id} onPick={() => pick(p.id)} />
          ))}
        </div>

        {/* Multi-marka geniş kart */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="relative mt-4 overflow-hidden rounded-2xl border border-green-400/40 bg-gradient-to-r from-green-500/[0.10] via-white/[0.02] to-white/[0.02] p-6 ring-1 ring-green-400/20"
        >
          <div aria-hidden className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-3xl" style={{ background: pkg.color }} />
          <div className="relative z-[1] flex flex-col items-start gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `${pkg.color}1f`, color: pkg.color }}>
                <MultiIcon size={24} strokeWidth={2.1} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">{pkg.name}</h3>
                  {pkg.badge && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: pkg.color, color: "#000" }}>
                      {pkg.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-white/60">{pkg.tagline}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                    <ShieldCheck size={12} /> {pkg.guaranteedViews} garanti izlenme
                  </span>
                  {pkg.items.map((it) => {
                    const tag = CONTENT_TAGS[it.tag];
                    return (
                      <WithTip key={`m-${it.tag}`} text={tag.desc} color={tag.color}>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${tag.color}1c`, color: tag.color }}>
                          {it.count}× {tag.label}
                          <Info size={9} className="opacity-50" />
                        </span>
                      </WithTip>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col items-start gap-3 lg:w-auto lg:items-end">
              <div className="text-left lg:text-right">
                {pkg.priceOnRequest ? (
                  <>
                    <span className="text-2xl font-extrabold tracking-tight text-white">Özel teklif</span>
                    <p className="mt-1 text-[11px] font-medium" style={{ color: pkg.color }}>5 marka paketine özel fiyat · görüşelim</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5 lg:justify-end">
                      <span className="text-3xl font-extrabold tracking-tight text-white">{pkg.price}</span>
                      <span className="text-xs font-medium text-white/50">{pkg.priceUnit}</span>
                    </div>
                    {pkg.priceNote && <p className="mt-1 text-[11px] font-medium" style={{ color: pkg.color }}>{pkg.priceNote}</p>}
                  </>
                )}
              </div>
              <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
                <button
                  type="button"
                  onClick={() => pick(pkg.id)}
                  style={{ backgroundColor: selectedId === pkg.id ? ORANGE : pkg.color, color: selectedId === pkg.id ? "#fff" : "#000" }}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold shadow-lg transition hover:brightness-110 active:scale-[0.98] lg:w-auto"
                >
                  <Check size={15} strokeWidth={2.4} /> {selectedId === pkg.id ? "Seçildi" : "5 markayı seç"}
                </button>
                <button
                  type="button"
                  onClick={goTelegram}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98] lg:w-auto"
                >
                  <Send size={14} /> Teklif al
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Add-on'lar — seçilebilir */}
        <AddonSelector selectedPkg={selectedPkg} onCommit={handleCommit} onNeedPackage={scrollToPackages} />

        {/* Teklif özeti — seçili paket + eklenen add-on'lar */}
        <div ref={summaryRef}>
          {selectedPkg && (
            <OfferSummary
              selectedPkg={selectedPkg}
              addons={committedAddons}
              onClear={() => {
                setSelectedId(null);
                setCommittedAddons({});
              }}
            />
          )}
        </div>

        {/* Performans güvencesi */}
        <div className="mt-4 flex flex-col items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-5 sm:flex-row sm:items-center">
          <ShieldCheck size={20} className="shrink-0 text-emerald-400" />
          <p className="text-sm leading-relaxed text-white/70">
            <span className="font-semibold text-white">Performans güvencesi:</span> Paketin garantili izlenmesine
            ulaşılamazsa, eksik kalan kısım bir sonraki ay <span className="font-semibold text-emerald-300">ücretsiz ek prodüksiyonla</span> telafi edilir.
            Hedef aşımında üretilen ekstra erişim markaya bonus olarak raporlanır.
          </p>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-[11px] leading-relaxed text-white/40">
          Fiyatlar marka başına aylık tutardır (USD). Tüm paketlere içerik raporu, post takibi ve affiliate ölçümü dahildir.
          Türkiye pazarına özel; bahis/eğlence nişi için optimize edilmiştir.
        </p>
      </div>
    </section>
  );
}
