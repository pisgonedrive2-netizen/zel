import type { SocialPlatform } from "./config";

export type FeatureCategory = "core" | "content" | "social" | "discovery" | "analytics";

export interface PlatformFeature {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  category: FeatureCategory;
  /** Otomatik link yenilemede kullanılıyor */
  usedInCron: boolean;
  /** Yeni plan / gelişmiş endpoint */
  isPro?: boolean;
}

export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  core: "Temel — otomatik yenileme",
  content: "İçerik & medya",
  social: "Sosyal & etkileşim",
  discovery: "Keşif & arama",
  analytics: "Gelişmiş analitik",
};

export const PLATFORM_FEATURES: Record<SocialPlatform, PlatformFeature[]> = {
  youtube: [
    {
      id: "video_details",
      label: "Video detayı",
      description: "İzlenme, beğeni, yorum — tek video",
      endpoint: "/video/details/",
      category: "core",
      usedInCron: true,
    },
    {
      id: "channel_details",
      label: "Kanal detayı",
      description: "Abone, toplam izlenme, video sayısı",
      endpoint: "/channel/details/",
      category: "core",
      usedInCron: true,
    },
    {
      id: "video_details_v2",
      label: "Video detayı v2",
      description: "Genişletilmiş metadata ve istatistikler",
      endpoint: "/v2/video-details",
      category: "analytics",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "channel_details_v2",
      label: "Kanal detayı v2",
      description: "Kanal profili ve gelişmiş istatistikler",
      endpoint: "/v2/channel-details",
      category: "analytics",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "channel_videos",
      label: "Kanal videoları",
      description: "Son yüklemeler, Shorts ve canlı yayın listesi",
      endpoint: "/channel/videos/",
      category: "content",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "video_comments",
      label: "Video yorumları",
      description: "Yorum listesi ve sayıları",
      endpoint: "/video/comments/",
      category: "social",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "video_related",
      label: "İlgili videolar",
      description: "Önerilen / benzer içerikler",
      endpoint: "/video/related-contents/",
      category: "discovery",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "search",
      label: "Arama",
      description: "Anahtar kelime ile video arama",
      endpoint: "/search/",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "trending",
      label: "Trending",
      description: "Bölgesel trend videolar",
      endpoint: "/v2/trending",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
  ],
  instagram: [
    {
      id: "profile",
      label: "Profil",
      description: "Takipçi, gönderi sayısı, bio",
      endpoint: "/profile",
      category: "core",
      usedInCron: true,
    },
    {
      id: "post",
      label: "Gönderi / Reel",
      description: "İzlenme, beğeni, yorum — shortcode veya URL",
      endpoint: "/post",
      category: "core",
      usedInCron: true,
    },
    {
      id: "resolve_share",
      label: "Paylaşım linki çöz",
      description: "instagram.com/share/… → gerçek URL",
      endpoint: "/resolve_share",
      category: "core",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "user_feed",
      label: "Gönderi akışı",
      description: "Profildeki son gönderiler",
      endpoint: "/feed",
      category: "content",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "user_reels",
      label: "Reels listesi",
      description: "Profildeki Reels içerikleri",
      endpoint: "/reels",
      category: "content",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "post_comments",
      label: "Gönderi yorumları",
      description: "Yorumlar ve etkileşim",
      endpoint: "/comments",
      category: "social",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "media_likers",
      label: "Beğenenler",
      description: "Gönderiyi beğenen kullanıcılar",
      endpoint: "/media_likers",
      category: "social",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "user_stories",
      label: "Hikayeler",
      description: "Aktif story listesi",
      endpoint: "/stories",
      category: "content",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "hashtag_search",
      label: "Hashtag arama",
      description: "Benzer hashtag önerileri ve hacim",
      endpoint: "/hashtag_search",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "hashtag_posts",
      label: "Hashtag gönderileri",
      description: "Etiketteki Reels ve gönderiler",
      endpoint: "/hashtag_section",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "users_search",
      label: "Kullanıcı arama",
      description: "Handle veya marka adıyla profil bulma",
      endpoint: "/users_search",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "user_followers",
      label: "Takipçi listesi",
      description: "Profil takipçileri (sayfalı)",
      endpoint: "/followers",
      category: "social",
      usedInCron: false,
      isPro: true,
    },
  ],
  tiktok: [
    {
      id: "user_info",
      label: "Kullanıcı profili",
      description: "Takipçi, toplam beğeni, video sayısı",
      endpoint: "/user/info",
      category: "core",
      usedInCron: true,
    },
    {
      id: "video_url",
      label: "Video (URL)",
      description: "İzlenme, beğeni, paylaşım — tam link",
      endpoint: "/",
      category: "core",
      usedInCron: true,
    },
    {
      id: "user_posts",
      label: "Kullanıcı videoları",
      description: "Son 10–30 gönderi ve metrikleri",
      endpoint: "/user/posts",
      category: "content",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "video_comments",
      label: "Video yorumları",
      description: "Yorum listesi (max 50)",
      endpoint: "/comment/list",
      category: "social",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "user_followers",
      label: "Takipçiler",
      description: "Profil takipçi listesi",
      endpoint: "/user/followers",
      category: "social",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "search_user",
      label: "Kullanıcı ara",
      description: "Handle ile kullanıcı bulma",
      endpoint: "/user/search",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "video_search",
      label: "Video ara",
      description: "Anahtar kelimeyle video araması",
      endpoint: "/feed/search",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "feed_list",
      label: "Keşfet akışı",
      description: "Bölgesel FYP / keşfet videoları",
      endpoint: "/feed/list",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "challenge_search",
      label: "Challenge ara",
      description: "Hashtag challenge listesi",
      endpoint: "/challenge/search",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "challenge_posts",
      label: "Challenge videoları",
      description: "Hashtag altındaki videolar",
      endpoint: "/challenge/posts",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "trending_videos",
      label: "Trend videolar (deprecated)",
      description: "Eski ads trend endpoint — kullanılmıyor",
      endpoint: "/ads/trends/videos",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "music_detail",
      label: "Müzik detayı",
      description: "Ses parçası ve kullanım istatistikleri",
      endpoint: "/music/info",
      category: "analytics",
      usedInCron: true,
      isPro: true,
    },
    {
      id: "challenge_detail",
      label: "Challenge detayı",
      description: "Hashtag challenge metrikleri",
      endpoint: "/challenge/info",
      category: "discovery",
      usedInCron: true,
      isPro: true,
    },
  ],
};

export function getPlatformFeature(platform: SocialPlatform, featureId: string): PlatformFeature | undefined {
  return PLATFORM_FEATURES[platform].find((f) => f.id === featureId);
}

export function featuresByCategory(platform: SocialPlatform): Map<FeatureCategory, PlatformFeature[]> {
  const map = new Map<FeatureCategory, PlatformFeature[]>();
  for (const f of PLATFORM_FEATURES[platform]) {
    const list = map.get(f.category) ?? [];
    list.push(f);
    map.set(f.category, list);
  }
  return map;
}
