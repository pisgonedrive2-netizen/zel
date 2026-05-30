// Yayıncı "7 saatlik" önerilen vardiya şablonu.
// Değişken başlangıç saati (S+0) üzerine bloklar kaydırılır. Mola gün ortasında
// (S+3) zorunludur. Bu şablon haftalık plan (WeeklyPlan) kayıtlarına dönüştürülür.

export interface ShiftBlockDef {
  /** Başlangıçtan (S+0) itibaren saat ofseti. */
  offsetHours: number;
  /** Blok süresi (saat). */
  durationHours: number;
  /** Aktivite adı (WeeklyPlan.activity). */
  activity: string;
  /** Açıklama (WeeklyPlan.notes). */
  description: string;
  kind: "work" | "break";
}

/**
 * Önerilen 7 saatlik şablon (sosyal medya odaklı · 2-3 derin görev).
 * S+0 → S+7 aralığına yayılır; S+3'te 1 saat zorunlu mola.
 */
export const SHIFT_TEMPLATE_7H: ShiftBlockDef[] = [
  {
    offsetHours: 0,
    durationHours: 1,
    activity: "İçerik planlama & senaryo",
    description: "Günün konuları, script, görseller belirlenir",
    kind: "work",
  },
  {
    offsetHours: 1,
    durationHours: 2,
    activity: "Reels / kısa video çekimi",
    description: "1-3 içerik, tek seferde çekilir",
    kind: "work",
  },
  {
    offsetHours: 3,
    durationHours: 1,
    activity: "Mola",
    description: "Zorunlu — gün ortasında verilir",
    kind: "break",
  },
  {
    offsetHours: 4,
    durationHours: 2,
    activity: "Düzenleme & paylaşım",
    description: "Montaj, altyazı, yükleme ve etiketleme",
    kind: "work",
  },
  {
    offsetHours: 6,
    durationHours: 1,
    activity: "İzleyici etkileşimi & analiz",
    description: "Yorumlar, DM, performans bakışı",
    kind: "work",
  },
];

/** Şablonun toplam süresi (saat) — son bloğun bitişi. */
export const SHIFT_TEMPLATE_SPAN_HOURS = SHIFT_TEMPLATE_7H.reduce(
  (max, b) => Math.max(max, b.offsetHours + b.durationHours),
  0
);

/** Mola hariç çalışma süresi (saat). */
export const SHIFT_TEMPLATE_WORK_HOURS = SHIFT_TEMPLATE_7H.filter(
  (b) => b.kind === "work"
).reduce((s, b) => s + b.durationHours, 0);

/** "HH:MM" + saat → "HH:MM" (24 saati aşarsa ertesi güne sarar). */
export function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = (h * 60 + m + Math.round(hours * 60)) % (24 * 60);
  const norm = (total + 24 * 60) % (24 * 60);
  const hh = Math.floor(norm / 60);
  const mm = norm % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface GeneratedShiftBlock {
  startTime: string;
  endTime: string;
  activity: string;
  notes: string;
  kind: "work" | "break";
  /** Bitiş, başlangıç saatine göre ertesi güne sarktıysa true. */
  crossesMidnight: boolean;
}

/**
 * Verilen başlangıç saatine (S+0) göre şablon bloklarını gerçek saatlere
 * dönüştürür. Plan kaydı oluşturmak için kullanılır.
 */
export function buildShiftBlocks(startTime: string): GeneratedShiftBlock[] {
  const [sh] = startTime.split(":").map(Number);
  return SHIFT_TEMPLATE_7H.map((b) => {
    const start = addHoursToTime(startTime, b.offsetHours);
    const end = addHoursToTime(startTime, b.offsetHours + b.durationHours);
    const startHourAbs = (Number.isNaN(sh) ? 0 : sh) + b.offsetHours + b.durationHours;
    return {
      startTime: start,
      endTime: end,
      activity: b.activity,
      notes: b.description,
      kind: b.kind,
      crossesMidnight: startHourAbs > 24,
    };
  });
}
