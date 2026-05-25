/** API yenileme hatası gönderi/link artık yok mu? */
export function isPostOrLinkGoneError(message?: string | null): boolean {
  if (!message?.trim()) return false;
  const m = message.toLowerCase();
  return (
    /\b404\b/.test(m) ||
    m.includes("not found") ||
    m.includes("bulunamad") ||
    m.includes("mevcut değil") ||
    m.includes("mevcut degil") ||
    m.includes("does not exist") ||
    m.includes("doesn't exist") ||
    m.includes("no longer") ||
    m.includes("removed") ||
    m.includes("deleted") ||
    m.includes("unavailable") ||
    m.includes("invalid media") ||
    m.includes("invalid shortcode") ||
    (m.includes("private") && (m.includes("post") || m.includes("media"))) ||
    (m.includes("post") && m.includes("exist"))
  );
}

export function postGoneErrorLabel(message?: string | null): string {
  if (!message?.trim()) return "Gönderi bulunamadı";
  const short = message.length > 80 ? `${message.slice(0, 77)}…` : message;
  return short;
}
