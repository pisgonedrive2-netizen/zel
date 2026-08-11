"use client";

import { useCallback } from "react";
import { useUiPrefs } from "@/store/ui-prefs";
import { t } from "./t";
import type { AppLocale } from "./locale";

export function useT() {
  const locale = useUiPrefs((s) => s.locale) as AppLocale;
  return useCallback((text: string) => t(text, locale), [locale]);
}

export function useLocale(): AppLocale {
  return useUiPrefs((s) => s.locale) as AppLocale;
}
