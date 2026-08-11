"use client";

import { APP_LOCALES, LOCALE_LABEL, LOCALE_NAME } from "@/lib/i18n/locale";
import { useUiPrefs } from "@/store/ui-prefs";
import { cn } from "@/lib/utils";

type Variant = "sidebar" | "landing";

export function LocaleToggle({
  variant = "sidebar",
  collapsed = false,
}: {
  variant?: Variant;
  collapsed?: boolean;
}) {
  const locale = useUiPrefs((s) => s.locale);
  const setLocale = useUiPrefs((s) => s.setLocale);

  const landing = variant === "landing";

  return (
    <div
      role="group"
      aria-label={locale === "ru" ? "Язык" : "Dil"}
      className={cn(
        "inline-flex items-center rounded-md border p-0.5",
        landing
          ? "border-white/20 bg-black/40"
          : "border-border bg-background",
        collapsed && "w-full justify-center",
      )}
    >
      {APP_LOCALES.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            title={LOCALE_NAME[code]}
            className={cn(
              "rounded px-2 py-1 text-[11px] font-bold tracking-wide transition",
              collapsed && "px-1.5",
              landing
                ? active
                  ? "bg-white text-black"
                  : "text-white/55 hover:text-white"
                : active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LOCALE_LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}
