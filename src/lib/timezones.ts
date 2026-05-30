// Takvim saat dilimi yardımcıları.
//
// Slot / plan saatleri "HH:MM" düz metin olarak saklanır ve KAYNAK olarak
// Türkiye saati (Europe/Istanbul) kabul edilir. Bu modül, görüntüleme amacıyla
// bu saatleri başka ülkelerin yerel saatine çevirir (DST dahil, anlık ofsetle).

export const BASE_TIMEZONE = "Europe/Istanbul";

export interface CalendarTimezone {
  /** IANA timezone id. */
  tz: string;
  /** Ülke / şehir etiketi. */
  label: string;
  /** Bayrak emoji (görsel ipucu). */
  flag: string;
}

/** Takvimde seçilebilen ülke/saat dilimleri (iGaming pazarlarına göre seçildi). */
export const CALENDAR_TIMEZONES: CalendarTimezone[] = [
  { tz: "Europe/Istanbul", label: "Türkiye", flag: "🇹🇷" },
  { tz: "Europe/London", label: "İngiltere (Londra)", flag: "🇬🇧" },
  { tz: "Europe/Berlin", label: "Almanya (Berlin)", flag: "🇩🇪" },
  { tz: "Europe/Amsterdam", label: "Hollanda (Amsterdam)", flag: "🇳🇱" },
  { tz: "Europe/Paris", label: "Fransa (Paris)", flag: "🇫🇷" },
  { tz: "Europe/Madrid", label: "İspanya (Madrid)", flag: "🇪🇸" },
  { tz: "Europe/Moscow", label: "Rusya (Moskova)", flag: "🇷🇺" },
  { tz: "Europe/Kyiv", label: "Ukrayna (Kiev)", flag: "🇺🇦" },
  { tz: "Asia/Dubai", label: "BAE (Dubai)", flag: "🇦🇪" },
  { tz: "Asia/Baku", label: "Azerbaycan (Bakü)", flag: "🇦🇿" },
  { tz: "Asia/Tashkent", label: "Özbekistan (Taşkent)", flag: "🇺🇿" },
  { tz: "Asia/Kolkata", label: "Hindistan (Delhi)", flag: "🇮🇳" },
  { tz: "America/New_York", label: "ABD (New York)", flag: "🇺🇸" },
  { tz: "America/Sao_Paulo", label: "Brezilya (São Paulo)", flag: "🇧🇷" },
];

/** Bir IANA saat diliminin, verilen anda UTC'ye göre ofsetini (dakika) döner. */
export function timezoneOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(at);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    let hour = Number(map.hour);
    if (hour === 24) hour = 0; // bazı ortamlar 24 döndürebilir
    const asUTC = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      hour,
      Number(map.minute),
      Number(map.second)
    );
    return Math.round((asUTC - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

export interface ConvertedTime {
  /** Hedef saat diliminde "HH:MM". */
  time: string;
  /** Gün kayması: -1 (önceki gün), 0 (aynı gün), +1 (ertesi gün). */
  dayShift: number;
}

/**
 * Türkiye saatindeki "HH:MM"yi hedef saat dilimine çevirir.
 * Hedef = BASE ise aynen döner.
 */
export function convertFromBase(
  hhmm: string,
  targetTz: string,
  at: Date = new Date()
): ConvertedTime {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return { time: hhmm, dayShift: 0 };
  if (targetTz === BASE_TIMEZONE) return { time: normalizeHHMM(hhmm), dayShift: 0 };

  const baseMinutes = Number(m[1]) * 60 + Number(m[2]);
  const diff = timezoneOffsetMinutes(targetTz, at) - timezoneOffsetMinutes(BASE_TIMEZONE, at);
  let total = baseMinutes + diff;
  let dayShift = 0;
  while (total < 0) {
    total += 1440;
    dayShift -= 1;
  }
  while (total >= 1440) {
    total -= 1440;
    dayShift += 1;
  }
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return { time: `${hh}:${mm}`, dayShift };
}

function normalizeHHMM(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** İnsan-okur ofset etiketi, BASE'e göre (ör. "+2sa", "−1sa 30dk", "aynı"). */
export function offsetLabelFromBase(targetTz: string, at: Date = new Date()): string {
  if (targetTz === BASE_TIMEZONE) return "TR ile aynı";
  const diff = timezoneOffsetMinutes(targetTz, at) - timezoneOffsetMinutes(BASE_TIMEZONE, at);
  if (diff === 0) return "TR ile aynı";
  const sign = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `TR ${sign}${h ? `${h}sa` : ""}${mm ? ` ${mm}dk` : ""}`.trim();
}

/** "HH:MM" + gün kayması rozeti (ör. "02:00 (+1)"). */
export function formatConverted(c: ConvertedTime): string {
  if (c.dayShift === 0) return c.time;
  return `${c.time} (${c.dayShift > 0 ? "+" : ""}${c.dayShift}g)`;
}
