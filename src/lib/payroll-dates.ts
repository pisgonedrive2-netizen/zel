/**
 * Maaş bordrosu ayı (YYYY-MM) ile ödeme günü etiketini (örn. "1-5", "17")
 * birlikte gösteren metinler — kullanıcıların "Mayıs mı Haziran mı?" karışmasını önler.
 *
 * **İş kuralı (2026 sürümü):** Bordrosu çıkarılan ayın **nakit ödemesi bir sonraki
 * takvim ayının** içinde yapılır. Örnek:
 *   - Mayıs 2026 bordrosu → ödeme 1–5 Haziran 2026.
 *   - Aralık 2026 bordrosu → ödeme 1–5 Ocak 2027.
 *
 * `paymentDay` değeri ("1-5", "17") **gün** bilgisidir, ay bilgisi içermez;
 * ay her zaman bordro ayının bir sonrasıdır.
 */

const AY_UZUN = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
] as const;

export function payrollMonthLongTitle(ym: string): string {
  const [y, mo] = ym.split("-").map(Number);
  if (!y || !mo || mo < 1 || mo > 12) return ym;
  return `${AY_UZUN[mo - 1]} ${y}`;
}

/** Bordro ayını bir sonraki takvim ayına kaydırır (yıl geçişini de doğru yapar). */
export function nextYearMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Bordro ayının nakit olarak ödeneceği takvim ayı (uzun başlık). */
export function payrollPaymentMonthLongTitle(ym: string): string {
  return payrollMonthLongTitle(nextYearMonth(ym));
}

/** "1-5" → { start: 1, end: 5 } · "17" → { start: 17, end: 17 } */
export function parsePaymentWindow(paymentDay: string): { start: number; end: number } | null {
  const p = paymentDay.trim();
  if (!p || p === "—") return null;
  if (p.includes("-")) {
    const [a, b] = p.split("-").map((s) => parseInt(s.trim(), 10));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { start: Math.min(a, b), end: Math.max(a, b) };
    }
    return null;
  }
  const d = parseInt(p, 10);
  return Number.isFinite(d) ? { start: d, end: d } : null;
}

/**
 * Bordrosu yapılan ayın ödeme penceresi metni — **bir sonraki takvim ayı**
 * üzerinden yazılır. Örn. ym=2026-05, paymentDay="1-5" → "1–5 Haziran 2026".
 */
export function paymentWindowCalendarPhrase(ym: string, paymentDay: string): string {
  const w = parsePaymentWindow(paymentDay);
  if (!w) return "Takvim tanımsız";
  const paymentYm = nextYearMonth(ym);
  const [py, pm] = paymentYm.split("-").map(Number);
  if (!py || !pm) return paymentDay;
  const ay = AY_UZUN[pm - 1];
  if (w.start === w.end) return `${w.start} ${ay} ${py}`;
  return `${w.start}–${w.end} ${ay} ${py}`;
}

/** Kart / satır alt metni: bordro ayı + ödeme penceresi (sonraki ay) açıkça. */
export function payrollDueCaption(ym: string, paymentDay: string): string {
  const bordro = payrollMonthLongTitle(ym);
  const pencere = paymentWindowCalendarPhrase(ym, paymentDay);
  return `${bordro} bordrosu · ödeme: ${pencere}`;
}

/** Kısa: tek satır özet (Mayıs · ödeme 1–5 Haziran 2026). */
export function payrollDueShort(ym: string, paymentDay: string): string {
  return `${payrollMonthLongTitle(ym)} · ödeme ${paymentWindowCalendarPhrase(ym, paymentDay)}`;
}

/**
 * Hatırlatma penceresi: Ödeme **bir sonraki ay** olduğundan pencere
 * `nextYearMonth(ym)` üzerinden hesaplanır. Hatırlatma, ödeme tarihinden 3 gün
 * önce başlar ve ödeme ayının sonuna kadar açık kalır (hâlâ ödenmediyse).
 */
export function isInPayrollReminderWindow(
  ym: string,
  paymentDay: string,
  now = new Date(),
  daysBefore = 3
): boolean {
  const w = parsePaymentWindow(paymentDay);
  if (!w) return false;
  const paymentYm = nextYearMonth(ym);
  const [py, pm] = paymentYm.split("-").map(Number);
  if (!py || !pm) return false;
  const windowStart = new Date(py, pm - 1, w.start);
  const remindStart = new Date(windowStart);
  const lead = Math.max(0, Math.min(daysBefore, 30));
  remindStart.setDate(remindStart.getDate() - lead);
  remindStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(py, pm, 0, 23, 59, 59, 999);
  return now >= remindStart && now <= monthEnd;
}
