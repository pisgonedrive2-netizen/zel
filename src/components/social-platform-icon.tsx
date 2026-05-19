"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { SocialPlatform } from "@/lib/social-api/config";

/** YouTube, Instagram, TikTok resmi marka renkli ikonları. */
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
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded bg-muted text-[10px] font-bold", className)}
      style={{ width: size, height: size }}
    >
      ?
    </span>
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
