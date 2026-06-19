/** RapidAPI keşif filtreleri — ülke, dil, sonuç sayısı. */

import type { SocialPlatform } from "@/lib/social-api/config";

export const DISCOVERY_COUNTRIES: { code: string; label: string }[] = [
  { code: "TR", label: "Türkiye" },
  { code: "US", label: "ABD" },
  { code: "GB", label: "İngiltere" },
  { code: "DE", label: "Almanya" },
  { code: "FR", label: "Fransa" },
  { code: "ES", label: "İspanya" },
  { code: "IT", label: "İtalya" },
  { code: "NL", label: "Hollanda" },
  { code: "BR", label: "Brezilya" },
  { code: "MX", label: "Meksika" },
  { code: "AR", label: "Arjantin" },
  { code: "IN", label: "Hindistan" },
  { code: "JP", label: "Japonya" },
  { code: "KR", label: "Güney Kore" },
  { code: "SA", label: "Suudi Arabistan" },
  { code: "AE", label: "BAE" },
  { code: "RU", label: "Rusya" },
  { code: "PL", label: "Polonya" },
  { code: "SE", label: "İsveç" },
  { code: "AU", label: "Avustralya" },
  { code: "CA", label: "Kanada" },
];

export const DISCOVERY_LANGUAGES: { code: string; label: string }[] = [
  { code: "tr", label: "Türkçe" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
  { code: "ru", label: "Русский" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

export const DISCOVERY_RESULT_COUNTS = [5, 10, 15, 20, 30] as const;

export const YOUTUBE_SEARCH_TYPES = [
  { value: "video", label: "Video" },
  { value: "channel", label: "Kanal" },
  { value: "playlist", label: "Playlist" },
] as const;

export const YOUTUBE_CHANNEL_FILTERS = [
  { value: "videos_latest", label: "Son videolar" },
  { value: "videos_shorts", label: "Shorts" },
  { value: "live_streams", label: "Canlı yayınlar" },
] as const;

export const RESULT_SORT_OPTIONS = [
  { value: "default", label: "API sırası" },
  { value: "views_desc", label: "İzlenme ↓" },
  { value: "views_asc", label: "İzlenme ↑" },
  { value: "likes_desc", label: "Beğeni ↓" },
  { value: "title_asc", label: "Başlık A→Z" },
] as const;

export const MIN_VIEWS_FILTERS = [
  { value: "0", label: "Tümü" },
  { value: "1000", label: "1K+" },
  { value: "10000", label: "10K+" },
  { value: "100000", label: "100K+" },
  { value: "1000000", label: "1M+" },
] as const;

export const INSTAGRAM_HASHTAG_SECTIONS = [
  { value: "top", label: "En popüler" },
  { value: "recent", label: "En yeni" },
] as const;

export const TIKTOK_SORT_TYPES = [
  { value: "0", label: "İlgililik" },
  { value: "1", label: "Beğeni sayısı" },
  { value: "3", label: "Yayın tarihi" },
] as const;

export const TIKTOK_PUBLISH_TIMES = [
  { value: "0", label: "Tüm zamanlar" },
  { value: "1", label: "Son 24 saat" },
  { value: "7", label: "Bu hafta" },
  { value: "30", label: "Bu ay" },
  { value: "90", label: "Son 3 ay" },
  { value: "180", label: "Son 6 ay" },
] as const;

export const TIKTOK_USER_FOLLOWER_FILTERS = [
  { value: "0", label: "Tüm takipçi aralıkları" },
  { value: "1", label: "0 – 1K" },
  { value: "2", label: "1K – 10K" },
  { value: "3", label: "10K – 100K" },
  { value: "4", label: "100K+" },
] as const;

export const TIKTOK_USER_PROFILE_TYPES = [
  { value: "0", label: "Tüm profiller" },
  { value: "1", label: "Yalnızca doğrulanmış" },
] as const;

export const TIKTOK_USER_SEARCH_MODES = [
  { value: "0", label: "Genel arama" },
  { value: "1", label: "Yalnızca kullanıcı adı" },
] as const;

export const DISCOVERY_QUERY_PRESETS: Record<SocialPlatform, string[]> = {
  youtube: ["casino stream", "slot", "igaming", "sweet bonanza", "rulet", "blackjack"],
  instagram: ["reels", "casino", "igaming", "slot", "canlı yayın", "bonus"],
  tiktok: ["fyp", "casino", "slot", "igaming", "canlı", "bonus hunt"],
};

export type PanelDiscoveryType =
  | "trending"
  | "search"
  | "hashtag"
  | "hashtag_discover"
  | "user_search"
  | "user_profile"
  | "user_feed"
  | "user_reels"
  | "user_posts"
  | "user_followers"
  | "user_stories"
  | "related_videos"
  | "channel_videos"
  | "channel_details"
  | "video_details"
  | "post_lookup"
  | "resolve_share"
  | "video_lookup"
  | "music_detail"
  | "challenge_info";

export interface DiscoveryModeOption {
  id: PanelDiscoveryType;
  label: string;
  needsQuery: boolean;
  placeholder: string;
  hint?: string;
  apiLabel?: string;
}

export const PLATFORM_DISCOVERY_MODES: Record<SocialPlatform, DiscoveryModeOption[]> = {
  youtube: [
    {
      id: "trending",
      label: "Trend videolar",
      needsQuery: false,
      placeholder: "",
      hint: "Bölgesel trend listesi",
      apiLabel: "/v2/trending",
    },
    {
      id: "search",
      label: "Video ara",
      needsQuery: true,
      placeholder: "Anahtar kelime",
      hint: "Video, kanal veya playlist araması",
      apiLabel: "/search/",
    },
    {
      id: "related_videos",
      label: "İlgili videolar",
      needsQuery: true,
      placeholder: "Video ID veya YouTube URL",
      hint: "Bir videoya benzer içerik önerileri",
      apiLabel: "/video/related-contents/",
    },
    {
      id: "channel_videos",
      label: "Kanal videoları",
      needsQuery: true,
      placeholder: "Kanal ID (UC…) veya @handle",
      hint: "Kanalın son yüklemeleri",
      apiLabel: "/channel/videos/",
    },
  ],
  instagram: [
    {
      id: "hashtag",
      label: "Hashtag gönderileri",
      needsQuery: true,
      placeholder: "Hashtag (ör. reels)",
      hint: "Etiketteki Reels ve gönderiler",
      apiLabel: "/hashtag_section",
    },
    {
      id: "hashtag_discover",
      label: "Hashtag bul",
      needsQuery: true,
      placeholder: "İlgili hashtag",
      hint: "Benzer hashtag ve hacim",
      apiLabel: "/hashtag_search",
    },
    {
      id: "user_search",
      label: "Kullanıcı ara",
      needsQuery: true,
      placeholder: "Kullanıcı adı veya marka",
      hint: "Profil keşfi",
      apiLabel: "/users_search",
    },
    {
      id: "user_profile",
      label: "Profil özeti",
      needsQuery: true,
      placeholder: "@kullaniciadi",
      hint: "Takipçi, gönderi sayısı, bio",
      apiLabel: "/profile",
    },
    {
      id: "user_feed",
      label: "Profil gönderileri",
      needsQuery: true,
      placeholder: "@kullaniciadi",
      hint: "Son gönderi akışı",
      apiLabel: "/feed",
    },
    {
      id: "user_reels",
      label: "Profil Reels",
      needsQuery: true,
      placeholder: "@kullaniciadi",
      hint: "Profildeki Reels listesi",
      apiLabel: "/reels",
    },
    {
      id: "post_lookup",
      label: "Gönderi / Reel",
      needsQuery: true,
      placeholder: "Shortcode veya Instagram URL",
      hint: "Tek gönderi metrikleri",
      apiLabel: "/post",
    },
    {
      id: "resolve_share",
      label: "Paylaşım linki çöz",
      needsQuery: true,
      placeholder: "instagram.com/share/reel/…",
      hint: "Paylaşım linkinden gerçek URL",
      apiLabel: "/resolve_share",
    },
    {
      id: "user_stories",
      label: "Hikayeler",
      needsQuery: true,
      placeholder: "@kullaniciadi",
      hint: "Aktif story listesi",
      apiLabel: "/stories",
    },
    {
      id: "user_followers",
      label: "Takipçiler",
      needsQuery: true,
      placeholder: "@kullaniciadi",
      hint: "Profil takipçi listesi",
      apiLabel: "/followers",
    },
  ],
  tiktok: [
    {
      id: "trending",
      label: "Keşfet akışı",
      needsQuery: false,
      placeholder: "",
      hint: "Bölgesel FYP videoları",
      apiLabel: "/feed/list",
    },
    {
      id: "search",
      label: "Video ara",
      needsQuery: true,
      placeholder: "Anahtar kelime",
      hint: "Kelime, sıralama ve zaman filtresi",
      apiLabel: "/feed/search",
    },
    {
      id: "hashtag",
      label: "Challenge videoları",
      needsQuery: true,
      placeholder: "Challenge adı (ör. fyp)",
      hint: "Hashtag altındaki videolar",
      apiLabel: "/challenge/posts",
    },
    {
      id: "hashtag_discover",
      label: "Challenge bul",
      needsQuery: true,
      placeholder: "Challenge ara",
      hint: "Benzer challenge listesi",
      apiLabel: "/challenge/search",
    },
    {
      id: "user_search",
      label: "Kullanıcı ara",
      needsQuery: true,
      placeholder: "TikTok kullanıcı adı",
      hint: "Takipçi ve doğrulama filtresi",
      apiLabel: "/user/search",
    },
    {
      id: "user_profile",
      label: "Profil özeti",
      needsQuery: true,
      placeholder: "@kullaniciadi",
      hint: "Takipçi, beğeni, video sayısı",
      apiLabel: "/user/info",
    },
    {
      id: "user_posts",
      label: "Kullanıcı videoları",
      needsQuery: true,
      placeholder: "@kullaniciadi",
      hint: "Profildeki son videolar",
      apiLabel: "/user/posts",
    },
    {
      id: "video_lookup",
      label: "Video (URL)",
      needsQuery: true,
      placeholder: "TikTok video URL",
      hint: "Tam linkten izlenme ve beğeni",
      apiLabel: "/",
    },
    {
      id: "music_detail",
      label: "Müzik detayı",
      needsQuery: true,
      placeholder: "TikTok müzik URL veya adı",
      hint: "Ses parçası ve kullanım istatistikleri",
      apiLabel: "/music/info",
    },
    {
      id: "challenge_info",
      label: "Challenge detayı",
      needsQuery: true,
      placeholder: "Challenge adı (ör. fyp)",
      hint: "Hashtag challenge metrikleri",
      apiLabel: "/challenge/info",
    },
    {
      id: "user_followers",
      label: "Takipçiler",
      needsQuery: true,
      placeholder: "@kullaniciadi",
      hint: "Profil takipçi listesi",
      apiLabel: "/user/followers",
    },
  ],
};
