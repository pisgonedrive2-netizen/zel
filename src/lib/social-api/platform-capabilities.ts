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
      usedInCron: false,
      isPro: true,
    },
    {
      id: "channel_details_v2",
      label: "Kanal detayı v2",
      description: "Kanal profili ve gelişmiş istatistikler",
      endpoint: "/v2/channel-details",
      category: "analytics",
      usedInCron: false,
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
      usedInCron: false,
      isPro: true,
    },
    {
      id: "video_related",
      label: "İlgili videolar",
      description: "Önerilen / benzer içerikler",
      endpoint: "/video/related-contents/",
      category: "discovery",
      usedInCron: false,
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
      endpoint: "/trending/",
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
      usedInCron: false,
      isPro: true,
    },
    {
      id: "user_feed",
      label: "Gönderi akışı",
      description: "Profildeki son gönderiler",
      endpoint: "/feed",
      category: "content",
      usedInCron: false,
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
      description: "Etiket keşfi ve hacim",
      endpoint: "/hashtag_search",
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
      usedInCron: false,
      isPro: true,
    },
    {
      id: "video_comments",
      label: "Video yorumları",
      description: "Yorum listesi (max 50)",
      endpoint: "/comment/list",
      category: "social",
      usedInCron: false,
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
      id: "trending_videos",
      label: "Trend videolar",
      description: "Keşfet / trend akışı",
      endpoint: "/ads/trends/videos",
      category: "discovery",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "music_detail",
      label: "Müzik detayı",
      description: "Ses parçası ve kullanım istatistikleri",
      endpoint: "/music/detail",
      category: "analytics",
      usedInCron: false,
      isPro: true,
    },
    {
      id: "challenge_detail",
      label: "Challenge detayı",
      description: "Hashtag challenge metrikleri",
      endpoint: "/challenge/detail",
      category: "discovery",
      usedInCron: false,
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
