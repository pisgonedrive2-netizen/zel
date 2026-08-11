import { isAppLocale, type AppLocale } from "./locale";

declare global {
  interface Window {
    __FOX_LOCALE__?: AppLocale;
  }
}

let runtimeLocale: AppLocale = "tr";

export function setRuntimeLocale(locale: AppLocale) {
  runtimeLocale = locale;
  if (typeof window !== "undefined") {
    window.__FOX_LOCALE__ = locale;
    document.cookie = `fox_locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
  }
}

export function getRuntimeLocale(): AppLocale {
  if (typeof window !== "undefined") {
    const w = window.__FOX_LOCALE__;
    if (isAppLocale(w)) return w;
  }
  return runtimeLocale;
}
