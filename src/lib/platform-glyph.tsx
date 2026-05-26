import {
  Globe,
  Instagram,
  MessageCircle,
  Music2,
  Send,
  Twitch,
  Youtube,
} from "lucide-react";

export function platformGlyphIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("youtube")) return Youtube;
  if (p.includes("twitch")) return Twitch;
  if (p.includes("instagram")) return Instagram;
  if (p.includes("tiktok")) return Music2;
  if (p.includes("telegram")) return Send;
  if (p.includes("twitter") || p === "x") return MessageCircle;
  return Globe;
}

export function PlatformGlyph({
  platform,
  size = 18,
  className,
}: {
  platform: string;
  size?: number;
  className?: string;
}) {
  const Icon = platformGlyphIcon(platform);
  return <Icon size={size} className={className} />;
}
