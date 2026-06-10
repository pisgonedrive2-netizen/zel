/** RapidAPI keşif filtreleri — ülke, dil, sonuç sayısı. */

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
