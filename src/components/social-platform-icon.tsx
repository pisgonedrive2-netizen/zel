"use client";

import { useId } from "react";
import { Globe, Send, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SocialPlatform } from "@/lib/social-api/config";

/** Platform adına göre kart/kenarlık vurgu sınıfı. */
export function platformAccentClass(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes("youtube")) return "border-red-300/70 bg-red-50/50 dark:border-red-500/40 dark:bg-red-950/25";
  if (p.includes("instagram")) return "border-pink-300/70 bg-pink-50/50 dark:border-pink-500/40 dark:bg-pink-950/25";
  if (p.includes("tiktok")) return "border-purple-300/70 bg-purple-50/50 dark:border-purple-500/40 dark:bg-purple-950/25";
  if (p.includes("kick")) return "border-emerald-300/70 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-950/25";
  if (p.includes("twitch")) return "border-violet-300/70 bg-violet-50/50 dark:border-violet-500/40 dark:bg-violet-950/25";
  if (p.includes("telegram")) return "border-sky-300/70 bg-sky-50/50 dark:border-sky-500/40 dark:bg-sky-950/25";
  return "border-border bg-muted/30";
}

/** YouTube, Instagram, TikTok, Kick, Twitch ve diğer platform ikonları. */
export function SocialPlatformIcon({
  platform,
  size = 20,
  className,
}: {
  platform: SocialPlatform | string;
  size?: number;
  className?: string;
}) {
  const p = String(platform).toLowerCase();
  if (p === "youtube" || p.includes("youtube")) {
    return <YouTubeIcon size={size} className={className} />;
  }
  if (p === "instagram" || p.includes("instagram")) {
    return <InstagramIcon size={size} className={className} />;
  }
  if (p === "tiktok" || p.includes("tiktok")) {
    return <TikTokIcon size={size} className={className} />;
  }
  if (p.includes("kick")) {
    return <KickIcon size={size} className={className} />;
  }
  if (p.includes("twitch")) {
    return <TwitchIcon size={size} className={className} />;
  }
  if (p.includes("telegram")) {
    return (
      <Send
        size={size}
        className={cn("shrink-0 text-sky-500", className)}
        aria-hidden
      />
    );
  }
  if (p.includes("twitter") || p === "x" || p.includes("x.com")) {
    return (
      <MessageCircle
        size={size}
        className={cn("shrink-0 text-foreground", className)}
        aria-hidden
      />
    );
  }
  if (p.includes("discord")) {
    return <DiscordIcon size={size} className={className} />;
  }
  return (
    <Globe
      size={size}
      className={cn("shrink-0 text-muted-foreground", className)}
      aria-hidden
    />
  );
}

function YouTubeIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        fill="#FF0000"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8z"
      />
      <path fill="#FFF" d="M9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
    </svg>
  );
}

function InstagramIcon({ size, className }: { size: number; className?: string }) {
  const gradId = useId();
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="50%" stopColor="#D62976" />
          <stop offset="75%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" fill={`url(#${gradId})`} />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="#fff" />
    </svg>
  );
}

function KickIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="4" fill="#53FC18" />
      <path
        fill="#0f0f0f"
        d="M9.2 8.5v7h2.1v-2.4c.9 1.1 2.3 1.8 3.9 1.8V13c-1.1 0-2.1-.5-2.8-1.3V8.5H9.2zm5.5 0c1.6 0 2.9 1.3 2.9 2.9s-1.3 2.9-2.9 2.9-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9z"
      />
    </svg>
  );
}

function TwitchIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <path fill="#9146FF" d="M4 3h16v12.5l-3.5 3.5H13l-2 2v-2H8v2H4V3zm12 9.5 2-2V6h-2v6.5zm-4 0 2-2V6h-2v6.5zM8 6H6v6.5h2V6z" />
    </svg>
  );
}

function DiscordIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <path
        fill="#5865F2"
        d="M18.9 5.5c-1.4-1-2.9-1.6-4.5-2-.2.4-.4.9-.5 1.3-1.7-.25-3.3-.25-5 0-.1-.4-.3-.9-.5-1.3-1.6.4-3.1 1-4.5 2C2.5 9.8 2 12.1 2.2 14.3c1.8 1.3 3.5 2.1 5.2 2.6.4-.6.8-1.1 1.1-1.7-.6-.2-1.2-.5-1.7-.8.1-.1.2-.2.3-.3 3.2 1.5 6.7 1.5 9.8 0 .1.1.2.2.3.3-.5.3-1.1.6-1.7.8.3.6.7 1.2 1.1 1.7 1.7-.5 3.4-1.3 5.2-2.6.3-2.6-.4-4.9-1.9-6.8zM9.7 13.1c-.9 0-1.6-.8-1.6-1.7s.7-1.7 1.6-1.7 1.6.8 1.6 1.7-.7 1.7-1.6 1.7zm4.6 0c-.9 0-1.6-.8-1.6-1.7s.7-1.7 1.6-1.7 1.6.8 1.6 1.7-.7 1.7-1.6 1.7z"
      />
    </svg>
  );
}

function TikTokIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        fill="#000"
        className="dark:fill-white"
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .55.04.8.1V9.01a6.27 6.27 0 0 0-.8-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"
      />
      <path
        fill="#25F4EE"
        d="M16.14 2.44v6.34a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07 4.83 4.83 0 0 1-3.77-4.25z"
        opacity="0.9"
      />
    </svg>
  );
}
