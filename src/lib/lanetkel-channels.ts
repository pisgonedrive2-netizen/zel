/**
 * Videoyolla / kamu yüzü: Lanetkel ajans kanalları.
 * Naz & Ponpon etiketli hesaplar hariç.
 */
import {
  AJANS_DIGER_HESAPLAR,
  YENI_HESAPLAR,
  type YeniHesapPlatform,
} from "@/lib/yeni-hesaplar";

export type PublicChannelPlatform =
  | YeniHesapPlatform
  | "Telegram"
  | "Facebook";

export interface PublicLanetkelChannel {
  platform: PublicChannelPlatform;
  handle: string;
  url: string;
}

export function listPublicLanetkelChannels(): PublicLanetkelChannel[] {
  const fromYeni: PublicLanetkelChannel[] = YENI_HESAPLAR.filter((a) => !a.tag).map((a) => ({
    platform: a.platform,
    handle: a.handle,
    url: a.url,
  }));

  const fromDiger: PublicLanetkelChannel[] = AJANS_DIGER_HESAPLAR.filter(
    (a) => a.platform === "Telegram" || a.platform === "Facebook"
  ).map((a) => ({
    platform: a.platform as "Telegram" | "Facebook",
    handle: a.handle.startsWith("@") ? a.handle : `@${a.handle}`,
    url: a.url,
  }));

  return [...fromYeni, ...fromDiger];
}

export const PUBLIC_CHANNEL_PLATFORM_ORDER: PublicChannelPlatform[] = [
  "Instagram",
  "YouTube",
  "TikTok",
  "Telegram",
  "Facebook",
];
