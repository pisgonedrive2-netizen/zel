/**
 * Yayıncı haftalık plan — içerik tipi (Reels / Vlog / Adult / …) sınıflandırması.
 * Mevcut `WeeklyPlan.activity` string'leri ile geriye uyumlu.
 */

export type PlanContentKind =
  | "reels"
  | "vlog"
  | "adult"
  | "live"
  | "edit"
  | "ad"
  | "meeting"
  | "off"
  | "other";

export interface PlanContentTypeDef {
  kind: PlanContentKind;
  /** WeeklyPlan.activity olarak saklanan değer */
  activity: string;
  label: string;
  shortLabel: string;
  /** Özet / takvim chip renkleri */
  chipClass: string;
  /** İçerik üretimi sayılır mı? (izin/toplantı hariç) */
  countsAsShoot: boolean;
}

export const PLAN_CONTENT_TYPES: PlanContentTypeDef[] = [
  {
    kind: "reels",
    activity: "Reels",
    label: "Reels / Kısa video",
    shortLabel: "Reels",
    chipClass:
      "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-500/40",
    countsAsShoot: true,
  },
  {
    kind: "vlog",
    activity: "Vlog Çekimi",
    label: "Vlog",
    shortLabel: "Vlog",
    chipClass:
      "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-500/40",
    countsAsShoot: true,
  },
  {
    kind: "adult",
    activity: "Yetişkin İçerik",
    label: "Adult içerik",
    shortLabel: "Adult",
    chipClass:
      "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200 dark:bg-fuchsia-950/50 dark:text-fuchsia-200 dark:border-fuchsia-500/40",
    countsAsShoot: true,
  },
  {
    kind: "live",
    activity: "Canlı Yayın",
    label: "Canlı yayın",
    shortLabel: "Live",
    chipClass:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-500/40",
    countsAsShoot: true,
  },
  {
    kind: "other",
    activity: "Site Videoları",
    label: "Site videosu",
    shortLabel: "Site",
    chipClass:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-500/40",
    countsAsShoot: true,
  },
  {
    kind: "ad",
    activity: "Reklam Çekimi",
    label: "Reklam",
    shortLabel: "Reklam",
    chipClass:
      "bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-500/40",
    countsAsShoot: true,
  },
  {
    kind: "edit",
    activity: "Edit / Post-Prod",
    label: "Edit / Post",
    shortLabel: "Edit",
    chipClass:
      "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-500/40",
    countsAsShoot: false,
  },
  {
    kind: "meeting",
    activity: "Toplantı",
    label: "Toplantı",
    shortLabel: "Toplantı",
    chipClass:
      "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-500/40",
    countsAsShoot: false,
  },
  {
    kind: "off",
    activity: "İzin",
    label: "İzin",
    shortLabel: "İzin",
    chipClass:
      "bg-muted text-muted-foreground border-border",
    countsAsShoot: false,
  },
];

/** Form / select için activity listesi (eski "Yayın" → Canlı Yayın ile uyumlu). */
export const PLAN_ACTIVITY_OPTIONS = PLAN_CONTENT_TYPES.map((t) => t.activity);

const ALIASES: Record<string, PlanContentKind> = {
  reels: "reels",
  reel: "reels",
  "kısa video": "reels",
  "kisa video": "reels",
  "reels / kısa video": "reels",
  vlog: "vlog",
  "vlog çekimi": "vlog",
  "vlog cekimi": "vlog",
  adult: "adult",
  "yetişkin içerik": "adult",
  "yetiskin icerik": "adult",
  yetişkin: "adult",
  live: "live",
  yayın: "live",
  yayin: "live",
  "canlı yayın": "live",
  "canli yayin": "live",
  "site videoları": "other",
  "site videolari": "other",
  "reklam çekimi": "ad",
  "reklam cekimi": "ad",
  reklam: "ad",
  "edit / post-prod": "edit",
  edit: "edit",
  toplantı: "meeting",
  toplanti: "meeting",
  "reels / kısa video çekimi": "reels",
  "reels / kisa video cekimi": "reels",
  "içerik planlama & senaryo": "edit",
  "icerik planlama & senaryo": "edit",
  mola: "off",
  "düzenleme & paylaşım": "edit",
  "duzenleme & paylasim": "edit",
  "izleyici etkileşimi & analiz": "other",
  "izleyici etkilesimi & analiz": "other",
};

export function resolvePlanContentType(activity: string): PlanContentTypeDef {
  const key = activity.trim().toLowerCase();
  const kind = ALIASES[key] ?? ALIASES[key.replace(/\s+/g, " ")];
  const found = PLAN_CONTENT_TYPES.find((t) => t.kind === kind);
  if (found) return found;
  const byActivity = PLAN_CONTENT_TYPES.find(
    (t) => t.activity.toLowerCase() === key
  );
  if (byActivity) return byActivity;
  return {
    kind: "other",
    activity,
    label: activity || "Diğer",
    shortLabel: activity.slice(0, 12) || "Diğer",
    chipClass:
      "bg-muted text-foreground border-border",
    countsAsShoot: true,
  };
}

export interface WeekPlanSummary {
  totalPlans: number;
  shootCount: number;
  brandCount: number;
  activeDays: number;
  byType: Array<{ def: PlanContentTypeDef; count: number }>;
  byBrand: Array<{ name: string; count: number }>;
  byDay: Array<{
    date: string;
    shootCount: number;
    brands: string[];
    types: string[];
  }>;
}

export function summarizeWeekPlans(
  plans: Array<{ date: string; activity: string; brandName?: string; status?: string }>,
  weekDays: string[]
): WeekPlanSummary {
  const active = plans.filter((p) => p.status !== "cancelled");
  const shoots = active.filter((p) => resolvePlanContentType(p.activity).countsAsShoot);

  const typeMap = new Map<string, { def: PlanContentTypeDef; count: number }>();
  for (const p of shoots) {
    const def = resolvePlanContentType(p.activity);
    const cur = typeMap.get(def.kind);
    if (cur) cur.count += 1;
    else typeMap.set(def.kind, { def, count: 1 });
  }

  const brandMap = new Map<string, number>();
  for (const p of shoots) {
    const name = (p.brandName ?? "").trim() || "Markasız";
    brandMap.set(name, (brandMap.get(name) ?? 0) + 1);
  }

  const byDay = weekDays.map((date) => {
    const dayShoots = shoots.filter((p) => p.date === date);
    const brands = [
      ...new Set(
        dayShoots
          .map((p) => (p.brandName ?? "").trim())
          .filter(Boolean)
      ),
    ];
    const types = [
      ...new Set(
        dayShoots.map((p) => resolvePlanContentType(p.activity).shortLabel)
      ),
    ];
    return { date, shootCount: dayShoots.length, brands, types };
  });

  return {
    totalPlans: active.length,
    shootCount: shoots.length,
    brandCount: [...brandMap.keys()].filter((k) => k !== "Markasız").length,
    activeDays: byDay.filter((d) => d.shootCount > 0).length,
    byType: [...typeMap.values()].sort((a, b) => b.count - a.count),
    byBrand: [...brandMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    byDay,
  };
}
