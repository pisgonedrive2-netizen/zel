export const APP_LOCALES = ["tr", "ru"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const LOCALE_LABEL: Record<AppLocale, string> = {
  tr: "TR",
  ru: "RU",
};

export const LOCALE_NAME: Record<AppLocale, string> = {
  tr: "Türkçe",
  ru: "Русский",
};

export function isAppLocale(v: unknown): v is AppLocale {
  return v === "tr" || v === "ru";
}
