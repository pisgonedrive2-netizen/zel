/** Marka linkinin içerik mi, profil hesabı mı, boş kabuk mu olduğunu ayırt eder. */

export type BrandLinkKind = "content" | "profile" | "shell" | "other";

function safeUrl(raw: string): URL | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    return new URL(/^https?:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

/** URL’siz platform placeholder (bl-br-*-instagram vb.). */
export function isBrandLinkShell(url: string | null | undefined): boolean {
  return !(url ?? "").trim();
}

/** Instagram / TikTok / YouTube profil veya kanal sayfası (tek içerik değil). */
export function isBrandLinkProfileUrl(url: string | null | undefined): boolean {
  const u = safeUrl(url ?? "");
  if (!u) return false;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "") || "/";

  if (host.includes("instagram.com") || host === "instagr.am") {
    if (/\/(reel|p|tv)\//i.test(path)) return false;
    return /^\/[A-Za-z0-9._]+$/.test(path);
  }

  if (
    host.includes("tiktok.com") ||
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com"
  ) {
    if (/\/video\//.test(path)) return false;
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return false;
    return /^\/@[^/]+$/.test(path);
  }

  if (host.includes("youtube.com") || host === "youtu.be") {
    if (host === "youtu.be") return false;
    if (u.searchParams.get("v") || /\/shorts\//.test(path)) return false;
    return (
      /^\/@/.test(path) ||
      /^\/channel\//.test(path) ||
      /^\/c\//.test(path) ||
      /^\/user\//.test(path)
    );
  }

  return false;
}

/** Tek video / reel / shorts içeriği (kısa TikTok linkleri dahil). */
export function isBrandLinkContentUrl(url: string | null | undefined): boolean {
  const u = safeUrl(url ?? "");
  if (!u) return false;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "") || "/";

  if (host.includes("instagram.com") || host === "instagr.am") {
    return /\/(reel|p|tv)\//i.test(path);
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return true;
  if (host.includes("tiktok.com")) return /\/video\//.test(path);
  if (host === "youtu.be") return true;
  if (host.includes("youtube.com")) {
    return Boolean(u.searchParams.get("v") || /\/shorts\//.test(path));
  }
  // Diğer siteler (manuel yetişkin vb.) içerik sayılır
  return true;
}

export function classifyBrandLinkUrl(url: string | null | undefined): BrandLinkKind {
  if (isBrandLinkShell(url)) return "shell";
  if (isBrandLinkProfileUrl(url)) return "profile";
  if (isBrandLinkContentUrl(url)) return "content";
  return "other";
}

export const BRAND_LINK_KIND_LABEL: Record<BrandLinkKind, string> = {
  content: "İçerik",
  profile: "Profil",
  shell: "Boş",
  other: "Diğer",
};

/** İzlenme listelerinde varsayılan: boş kabukları gösterme. */
export function isDisplayableBrandLink(link: { url?: string | null; status?: string }): boolean {
  if (link.status === "inactive") return false;
  return !isBrandLinkShell(link.url);
}
