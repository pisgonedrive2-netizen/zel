/**
 * Merkezi tarih/saat formatlayıcı — UTC+3 (Europe/Istanbul), 24 saatlik düzen.
 * Uygulama genelinde her zaman bu yardımcıları kullanın;
 * doğrudan toLocaleString/toLocaleDateString kullanmayın.
 */

const TZ = "Europe/Istanbul";

type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "23.05.2026 14:35" */
export function fmtDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleString("tr-TR", {
    timeZone: TZ,
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "23 May 14:35" — sidebar / kısa */
export function fmtDateShort(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleString("tr-TR", {
    timeZone: TZ,
    hour12: false,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "23 Mayıs 2026, 14:35:00" — detay */
export function fmtDateLong(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleString("tr-TR", {
    timeZone: TZ,
    hour12: false,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** "23 Mayıs 2026" — tarih-only, timezone önemsiz ama tutarlılık için */
export function fmtDateOnly(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleDateString("tr-TR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "May 2026" — ay-yıl özeti */
export function fmtMonthYear(ym: string): string {
  const d = new Date(ym + "-01T00:00:00");
  return d.toLocaleDateString("tr-TR", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  });
}

/** "May '26" — kısa ay-yıl */
export function fmtMonthShort(ym: string): string {
  const d = new Date(ym + "-01T00:00:00");
  return d.toLocaleDateString("tr-TR", {
    timeZone: TZ,
    month: "short",
    year: "2-digit",
  });
}
