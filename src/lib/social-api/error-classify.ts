/**
 * RapidAPI yenileme hatalarını sınıflandırma.
 *
 * Bir linkin `last_check_error` değeri her zaman "link bozuk" anlamına gelmez.
 * RapidAPI sağlayıcısı saniye/dakika başına hız limiti uyguladığında (HTTP 429,
 * "rate limit", "reached requests limit" vb.) çağrı GEÇİCİ olarak başarısız
 * olur — link sağlıklıdır, sadece o an throttle yenmiştir. Bu tür hatalar bir
 * sonraki başarılı yenilemede temizlenir ve "kalıcı link hatası" gibi
 * sayılmamalıdır.
 */
export function isTransientApiError(message?: string | null): boolean {
  if (!message?.trim()) return false;
  const m = message.toLowerCase();
  return (
    /\b429\b/.test(m) ||
    m.includes("rate limit") ||
    m.includes("rate-limit") ||
    m.includes("ratelimit") ||
    m.includes("too many requests") ||
    m.includes("reached requests limit") ||
    m.includes("exceeded the rate") ||
    m.includes("temporarily") ||
    m.includes("try again") ||
    // Ağ / zaman aşımı kaynaklı geçici hatalar (link bozuk değil)
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("etimedout") ||
    m.includes("econnreset") ||
    m.includes("aborted") ||
    m.includes("network error") ||
    m.includes("fetch failed")
  );
}
