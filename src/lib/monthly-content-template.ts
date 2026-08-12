/**
 * Foxstream — sabit 4 haftalık “Aylık İçerik Planı” şablonu.
 * Takvim UI + WeeklyPlan üretimi bu kaynaktan beslenir.
 */

import { weekDayIsosFromStart, normalizeWeekAnchorIso } from "@/lib/data";
import type { WeeklyPlan } from "@/store/store";

export type MonthlyBrandId =
  | "br-padi"
  | "br-gala"
  | "br-boffice"
  | "br-pipo"
  | "br-hit";

export type MonthlyContentKind =
  | "reels"
  | "adult"
  | "vlog"
  | "kick"
  | "edit"
  | "off"
  | "flex";

export type ReelsMode = "single" | "galagrup";

export interface MonthlyBrandTerms {
  brandId: MonthlyBrandId;
  shortName: string;
  feeUsd: number;
  /** Yayıncı / Ramiz panellerinde ücret asla gösterilmez. */
  feeVisibleToStreamer: false;
  reelsShoot: number;
  reelsPublish: number;
  reelsStock: number;
  specialPolicy: "none" | "fixed" | "unlimited";
  specialQty?: number;
}

export interface MonthlySlot {
  id: string;
  weekIndex: 1 | 2 | 3 | 4;
  /** 0=Pzt … 6=Paz */
  dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  kind: MonthlyContentKind;
  /** Tek marka veya Galagrup listesi */
  brandIds: MonthlyBrandId[];
  quantity: number;
  reelsMode?: ReelsMode;
  title: string;
  notes?: string;
  /** Reels için: ay içi yayın / stok (yalnızca Gala stok satırında kullanılır) */
  stockQty?: number;
}

export interface MonthlyContentTemplate {
  id: string;
  label: string;
  weeks: 4;
  slots: MonthlySlot[];
  brandTerms: MonthlyBrandTerms[];
}

export const GALAGRUP_BRANDS: MonthlyBrandId[] = [
  "br-boffice",
  "br-pipo",
  "br-hit",
  "br-gala",
  "br-padi",
];

export const MONTHLY_BRAND_TERMS: MonthlyBrandTerms[] = [
  {
    brandId: "br-gala",
    shortName: "Gala",
    feeUsd: 25_000,
    feeVisibleToStreamer: false,
    reelsShoot: 7,
    reelsPublish: 5,
    reelsStock: 2,
    specialPolicy: "fixed",
    specialQty: 1,
  },
  {
    brandId: "br-padi",
    shortName: "Padi",
    feeUsd: 5_000,
    feeVisibleToStreamer: false,
    reelsShoot: 12,
    reelsPublish: 12,
    reelsStock: 0,
    specialPolicy: "unlimited",
  },
  {
    brandId: "br-boffice",
    shortName: "Boffice",
    feeUsd: 5_000,
    feeVisibleToStreamer: false,
    reelsShoot: 2,
    reelsPublish: 2,
    reelsStock: 0,
    specialPolicy: "none",
  },
  {
    brandId: "br-pipo",
    shortName: "Pipo",
    feeUsd: 5_000,
    feeVisibleToStreamer: false,
    reelsShoot: 2,
    reelsPublish: 2,
    reelsStock: 0,
    specialPolicy: "none",
  },
  {
    brandId: "br-hit",
    shortName: "Hit",
    feeUsd: 5_000,
    feeVisibleToStreamer: false,
    reelsShoot: 2,
    reelsPublish: 2,
    reelsStock: 0,
    specialPolicy: "none",
  },
];

/** Paket bedelleri — UI’de gösterilmez; maliyet hesabı için. */
export function computeMonthPackageCostUsd(
  terms: MonthlyBrandTerms[] = MONTHLY_BRAND_TERMS,
): number {
  return terms.reduce((sum, row) => sum + row.feeUsd, 0);
}

const DAY = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
} as const;

function slot(
  weekIndex: 1 | 2 | 3 | 4,
  dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  partial: Omit<MonthlySlot, "id" | "weekIndex" | "dayIndex">,
): MonthlySlot {
  return {
    id: `w${weekIndex}-d${dayIndex}-${partial.kind}-${partial.brandIds.join("_") || "none"}`,
    weekIndex,
    dayIndex,
    ...partial,
  };
}

/** Kanonik şablon — Yetişkin = 6 (W3 Cmt adult yok). */
export function createFoxstreamMonthlyTemplate(): MonthlyContentTemplate {
  const slots: MonthlySlot[] = [];

  for (const w of [1, 2, 3, 4] as const) {
    // Perşembe edit (ortak)
    slots.push(
      slot(w, DAY.thu, {
        kind: "edit",
        brandIds: [],
        quantity: 1,
        title: "Edit · Montaj · Kostüm · Mekan",
        notes: "Ortak prep / post-prod günü",
      }),
    );
    // Pazar izin
    slots.push(
      slot(w, DAY.sun, {
        kind: "off",
        brandIds: [],
        quantity: 1,
        title: "İzin",
      }),
    );
    // Salı — Padişah adult
    slots.push(
      slot(w, DAY.tue, {
        kind: "adult",
        brandIds: ["br-padi"],
        quantity: 1,
        title: "Padişah Yetişkin İçeriği",
      }),
    );
    // Cuma — Padişah vlog
    slots.push(
      slot(w, DAY.fri, {
        kind: "vlog",
        brandIds: ["br-padi"],
        quantity: 1,
        title: "Padişah Vlog",
      }),
    );
  }

  // Pazartesi reels
  slots.push(
    slot(1, DAY.mon, {
      kind: "reels",
      brandIds: ["br-padi"],
      quantity: 5,
      reelsMode: "single",
      title: "5 Padişah Reels",
    }),
  );
  slots.push(
    slot(2, DAY.mon, {
      kind: "reels",
      brandIds: [...GALAGRUP_BRANDS],
      quantity: 5,
      reelsMode: "galagrup",
      title: "5 Galagrup Reels",
      notes: "Her birine 1 adet",
    }),
  );
  slots.push(
    slot(3, DAY.mon, {
      kind: "reels",
      brandIds: ["br-padi"],
      quantity: 5,
      reelsMode: "single",
      title: "5 Padişah Reels",
    }),
  );
  slots.push(
    slot(4, DAY.mon, {
      kind: "reels",
      brandIds: [...GALAGRUP_BRANDS],
      quantity: 5,
      reelsMode: "galagrup",
      title: "5 Galagrup Reels",
      notes: "Her birine 1 adet",
    }),
  );

  // Çarşamba
  slots.push(
    slot(1, DAY.wed, {
      kind: "vlog",
      brandIds: ["br-gala"],
      quantity: 1,
      title: "Galabet Vlog",
    }),
  );
  slots.push(
    slot(2, DAY.wed, {
      kind: "kick",
      brandIds: ["br-gala"],
      quantity: 1,
      title: "Galabet Kick Yayını",
    }),
  );
  slots.push(
    slot(3, DAY.wed, {
      kind: "vlog",
      brandIds: ["br-gala"],
      quantity: 1,
      title: "Galabet Vlog",
    }),
  );
  slots.push(
    slot(4, DAY.wed, {
      kind: "kick",
      brandIds: ["br-padi"],
      quantity: 1,
      title: "Padişah Kick Yayını",
    }),
  );

  // Cumartesi — adult W1/W2 Gala; W3 serbest; W4 Galabet 5 reels
  slots.push(
    slot(1, DAY.sat, {
      kind: "adult",
      brandIds: ["br-gala"],
      quantity: 1,
      title: "Galabet Yetişkin İçeriği",
    }),
  );
  slots.push(
    slot(2, DAY.sat, {
      kind: "adult",
      brandIds: ["br-gala"],
      quantity: 1,
      title: "Galabet Yetişkin İçeriği",
    }),
  );
  slots.push(
    slot(3, DAY.sat, {
      kind: "flex",
      brandIds: [],
      quantity: 1,
      title: "Serbest",
      notes: "Özel içerik / esnek kota — ay içinde kararlaştırılır",
    }),
  );
  slots.push(
    slot(4, DAY.sat, {
      kind: "reels",
      brandIds: ["br-gala"],
      quantity: 5,
      reelsMode: "single",
      title: "Galabet 5 Reels",
      notes: "Tek marka · 5 çekim (Galagrup değil)",
      stockQty: 2,
    }),
  );

  return {
    id: "foxstream-monthly-v1",
    label: "Aylık İçerik Planı",
    weeks: 4,
    slots,
    brandTerms: MONTHLY_BRAND_TERMS,
  };
}

export const KIND_TO_ACTIVITY: Record<MonthlyContentKind, string> = {
  reels: "Reels",
  adult: "Yetişkin İçerik",
  vlog: "Vlog Çekimi",
  kick: "Canlı Yayın",
  edit: "Edit / Post-Prod",
  off: "İzin",
  flex: "İçerik planlama & senaryo",
};

export const SHORT_NAME: Record<MonthlyBrandId, string> = {
  "br-padi": "Padi",
  "br-gala": "Gala",
  "br-boffice": "Boffice",
  "br-pipo": "Pipo",
  "br-hit": "Hit",
};

export interface MonthPlanKpis {
  totalReelsShoot: number;
  totalAdult: number;
  totalVlog: number;
  totalEdit: number;
  totalKick: number;
  reelsByBrand: Record<string, number>;
  galaStock: number;
  galaPublish: number;
}

export function computeMonthPlanKpis(slots: MonthlySlot[]): MonthPlanKpis {
  const reelsByBrand: Record<string, number> = {};
  let totalAdult = 0;
  let totalVlog = 0;
  let totalEdit = 0;
  let totalKick = 0;
  let galaStock = 0;

  for (const s of slots) {
    if (s.kind === "adult") totalAdult += s.quantity;
    if (s.kind === "vlog") totalVlog += s.quantity;
    if (s.kind === "edit") totalEdit += s.quantity;
    if (s.kind === "kick") totalKick += s.quantity;
    if (s.kind === "reels") {
      if (s.reelsMode === "galagrup") {
        for (const b of s.brandIds) {
          reelsByBrand[b] = (reelsByBrand[b] ?? 0) + 1;
        }
      } else {
        const b = s.brandIds[0];
        if (b) reelsByBrand[b] = (reelsByBrand[b] ?? 0) + s.quantity;
      }
      if (s.stockQty && s.brandIds.includes("br-gala")) {
        galaStock += s.stockQty;
      }
    }
  }

  // Gala stok: kanonik 2 (W4 Cmt notundan) — slot.stockQty yoksa terms’ten
  if (galaStock === 0 && (reelsByBrand["br-gala"] ?? 0) >= 7) galaStock = 2;
  const galaShoot = reelsByBrand["br-gala"] ?? 0;
  const galaPublish = Math.max(0, galaShoot - galaStock);
  const totalReelsShoot = Object.values(reelsByBrand).reduce((a, b) => a + b, 0);

  return {
    totalReelsShoot,
    totalAdult,
    totalVlog,
    totalEdit,
    totalKick,
    reelsByBrand,
    galaStock,
    galaPublish,
  };
}

export interface MonthPlanRuleWarning {
  code: string;
  /** TR şablon — UI’de t() + params ile doldurulur */
  template: string;
  params?: Record<string, string | number>;
  severity: "warn" | "error";
}

/** Arka plan kuralları — UI’de soft uyarı. */
export function validateMonthPlanRules(slots: MonthlySlot[]): MonthPlanRuleWarning[] {
  const kpis = computeMonthPlanKpis(slots);
  const out: MonthPlanRuleWarning[] = [];

  if (kpis.totalAdult !== 6) {
    out.push({
      code: "adult_count",
      severity: "warn",
      template: "Yetişkin içerik {n} (hedef 6: Padişah Salı×4 + Gala Cmt W1–W2).",
      params: { n: kpis.totalAdult },
    });
  }
  for (const id of ["br-boffice", "br-pipo", "br-hit"] as const) {
    const n = kpis.reelsByBrand[id] ?? 0;
    if (n !== 2) {
      out.push({
        code: `side_reels_${id}`,
        severity: "warn",
        template: "{brand} reels {n} (hedef 2 — yalnızca Galagrup Pazartesileri).",
        params: { brand: SHORT_NAME[id], n },
      });
    }
  }
  const padi = kpis.reelsByBrand["br-padi"] ?? 0;
  if (padi !== 12) {
    out.push({
      code: "padi_reels",
      severity: "warn",
      template: "Padişah reels {n} (hedef 12).",
      params: { n: padi },
    });
  }
  const gala = kpis.reelsByBrand["br-gala"] ?? 0;
  if (gala !== 7) {
    out.push({
      code: "gala_reels",
      severity: "warn",
      template: "Gala reels çekim {n} (hedef 7 → 5 paylaşım + 2 stok).",
      params: { n: gala },
    });
  }
  if (kpis.totalReelsShoot !== 25) {
    out.push({
      code: "total_reels",
      severity: "warn",
      template: "Toplam reels çekim {n} (hedef 25).",
      params: { n: kpis.totalReelsShoot },
    });
  }
  return out;
}

/** Şablon haftasını gerçek takvim haftasına bağla (ayın 1. Pazartesinden). */
export function monthWeekStartsFromAnchor(anchorMonday: string): string[] {
  const base = normalizeWeekAnchorIso(anchorMonday);
  const out: string[] = [];
  let cur = base;
  for (let i = 0; i < 4; i++) {
    out.push(cur);
    const d = new Date(cur + "T12:00:00");
    d.setDate(d.getDate() + 7);
    cur = d.toISOString().slice(0, 10);
  }
  return out;
}

export function slotToWeeklyPlanInputs(
  slot: MonthlySlot,
  opts: {
    employeeId: string;
    weekStart: string;
    date: string;
    createdBy?: string;
  },
): Omit<WeeklyPlan, "id">[] {
  const activity = KIND_TO_ACTIVITY[slot.kind];
  const base = {
    employeeId: opts.employeeId,
    weekStart: opts.weekStart,
    date: opts.date,
    activity,
    status: "planned" as const,
    createdBy: opts.createdBy,
    createdAt: new Date().toISOString(),
  };

  if (slot.kind === "reels" && slot.reelsMode === "galagrup") {
    return slot.brandIds.map((b) => ({
      ...base,
      brandName: SHORT_NAME[b],
      notes: `Galagrup · 1 adet${slot.notes ? ` · ${slot.notes}` : ""}`,
    }));
  }

  if (slot.kind === "reels" && slot.quantity > 1) {
    return [
      {
        ...base,
        brandName: slot.brandIds[0] ? SHORT_NAME[slot.brandIds[0]] : undefined,
        notes: `${slot.quantity}× Reels${slot.notes ? ` · ${slot.notes}` : ""}${
          slot.stockQty ? ` · stok:${slot.stockQty}` : ""
        }`,
      },
    ];
  }

  if (slot.kind === "kick") {
    return [
      {
        ...base,
        brandName: slot.brandIds[0] ? SHORT_NAME[slot.brandIds[0]] : undefined,
        notes: `Kick Yayını${slot.notes ? ` · ${slot.notes}` : ""}`,
      },
    ];
  }

  if (slot.kind === "edit" || slot.kind === "off" || slot.kind === "flex") {
    return [
      {
        ...base,
        brandName: undefined,
        notes: slot.notes ?? slot.title,
      },
    ];
  }

  return [
    {
      ...base,
      brandName: slot.brandIds[0] ? SHORT_NAME[slot.brandIds[0]] : undefined,
      notes: slot.notes ?? "",
    },
  ];
}

/** Belirli şablon haftasını WeeklyPlan girdilerine çevir. */
export function expandTemplateWeekToPlans(
  slots: MonthlySlot[],
  weekIndex: 1 | 2 | 3 | 4,
  weekStart: string,
  employeeId: string,
  createdBy?: string,
): Omit<WeeklyPlan, "id">[] {
  const days = weekDayIsosFromStart(normalizeWeekAnchorIso(weekStart));
  const weekSlots = slots.filter((s) => s.weekIndex === weekIndex);
  const out: Omit<WeeklyPlan, "id">[] = [];
  for (const s of weekSlots) {
    const date = days[s.dayIndex];
    if (!date) continue;
    out.push(
      ...slotToWeeklyPlanInputs(s, {
        employeeId,
        weekStart: normalizeWeekAnchorIso(weekStart),
        date,
        createdBy,
      }),
    );
  }
  return out;
}

/** Şablon haftasını bir sonraki şablon haftasına kopyala (slot düzeni). */
export function copyTemplateWeekSlots(
  slots: MonthlySlot[],
  fromWeek: 1 | 2 | 3 | 4,
  toWeek: 1 | 2 | 3 | 4,
): MonthlySlot[] {
  if (fromWeek === toWeek) return slots;
  const withoutTarget = slots.filter((s) => s.weekIndex !== toWeek);
  const copied = slots
    .filter((s) => s.weekIndex === fromWeek)
    .map((s) => ({
      ...s,
      id: `w${toWeek}-d${s.dayIndex}-${s.kind}-${s.brandIds.join("_") || "none"}-${Date.now().toString(36)}`,
      weekIndex: toWeek,
    }));
  return [...withoutTarget, ...copied];
}

export function findSlot(
  slots: MonthlySlot[],
  weekIndex: number,
  dayIndex: number,
): MonthlySlot | undefined {
  return slots.find((s) => s.weekIndex === weekIndex && s.dayIndex === dayIndex);
}

export function upsertSlot(slots: MonthlySlot[], next: MonthlySlot): MonthlySlot[] {
  const i = slots.findIndex(
    (s) => s.weekIndex === next.weekIndex && s.dayIndex === next.dayIndex,
  );
  if (i < 0) return [...slots, next];
  const copy = slots.slice();
  copy[i] = next;
  return copy;
}

export function clearSlot(
  slots: MonthlySlot[],
  weekIndex: 1 | 2 | 3 | 4,
  dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6,
): MonthlySlot[] {
  return slots.filter((s) => !(s.weekIndex === weekIndex && s.dayIndex === dayIndex));
}
