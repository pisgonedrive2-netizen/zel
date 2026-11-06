"use client";

import { cn } from "@/lib/utils";
import type { PublicChannelPlatform } from "@/lib/lanetkel-channels";

export const PLATFORM_ICON_SRC: Record<PublicChannelPlatform, string> = {
  Instagram: "/video-yolla/icons3d/instagram.webp",
  YouTube: "/video-yolla/icons3d/youtube.webp",
  TikTok: "/video-yolla/icons3d/tiktok.webp",
  Telegram: "/video-yolla/icons3d/telegram.webp",
  Facebook: "/video-yolla/icons3d/facebook.webp",
};

/** 3D platform ikonu — arka planı temiz (şeffaf) görsel. */
export function Platform3dIcon({
  platform,
  size = 48,
  className,
}: {
  platform: PublicChannelPlatform;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PLATFORM_ICON_SRC[platform]}
      alt={platform}
      width={size}
      height={size}
      draggable={false}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
