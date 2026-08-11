"use client";

import { useEffect } from "react";
import { useUiPrefs } from "@/store/ui-prefs";
import { setRuntimeLocale } from "@/lib/i18n/locale-state";

/** html lang özniteliğini TR/RU tercihine göre günceller. */
export function LocaleHtml() {
  const locale = useUiPrefs((s) => s.locale);
  setRuntimeLocale(locale);
  useEffect(() => {
    document.documentElement.lang = locale === "ru" ? "ru" : "tr";
  }, [locale]);
  return null;
}
