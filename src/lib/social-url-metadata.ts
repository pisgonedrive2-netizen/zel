import { resolveLinkDetection } from "@/lib/social-api/platform-detect";
import { fetchRichDetailsForLink } from "@/lib/social-api/clients";

/** Instagram / TikTok / YouTube URL'den yayın tarihi ve platform bilgisi. */
export async function fetchContentUrlMetadata(url: string): Promise<{
  platform: string;
  publishedAt?: string;
  title?: string;
}> {
  const trimmed = url.trim();
  if (!trimmed) return { platform: "" };

  const det = resolveLinkDetection({ url: trimmed, platform: "Instagram" });
  if (!det) {
    return { platform: "" };
  }

  const platform =
    det.platform === "youtube"
      ? "YouTube"
      : det.platform === "instagram"
        ? "Instagram"
        : "TikTok";

  try {
    const rich = await fetchRichDetailsForLink(det);
    return {
      platform,
      publishedAt: rich.publishedAt,
      title: rich.title,
    };
  } catch {
    return { platform };
  }
}
