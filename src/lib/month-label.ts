/** Ay etiketleri — dışa aktarım menüsü gibi hafif modüller için (jsPDF bağımlılığı yok). */

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
] as const;

export function monthLabelTr(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return ym;
  return `${MONTH_NAMES_TR[idx]} ${y}`;
}

/** Tarih listesinden benzersiz YYYY-MM ay anahtarları (yeniden eskiye). */
export function listAvailableMonths(dates: string[]): string[] {
  const set = new Set<string>();
  for (const d of dates) {
    if (typeof d === "string" && /^\d{4}-\d{2}/.test(d)) set.add(d.slice(0, 7));
  }
  const now = new Date();
  set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
