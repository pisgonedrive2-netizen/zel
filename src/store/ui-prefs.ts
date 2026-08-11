"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isAppLocale, type AppLocale } from "@/lib/i18n/locale";
import { setRuntimeLocale } from "@/lib/i18n/locale-state";

/**
 * Kullanıcıya özel (tarayıcı bazlı) arayüz tercihleri.
 *
 * screenShareMode: "Ekran paylaşımı / gizli mod". Açıkken para ile ilgili
 * hassas menü öğeleri (Prim Havuzu, Maaşlar, Kasa, Giderler vb.) sidebar'dan
 * gizlenir. Böylece ekran paylaşırken finansal bilgiler görünmez. Sayfalara
 * doğrudan URL ile erişim engellenmez — yalnızca menüde gizlenir.
 */
interface UiPrefsState {
  screenShareMode: boolean;
  setScreenShareMode: (v: boolean) => void;
  toggleScreenShareMode: () => void;
  /** Prim havuzu: basit görünüm — gelişmiş sekmeler (senaryo/kurallar) gizlenir. */
  primSimpleView: boolean;
  setPrimSimpleView: (v: boolean) => void;
  togglePrimSimpleView: () => void;
  /** Arayüz dili — TR varsayılan, RU seçeneği admin + landing. */
  locale: AppLocale;
  setLocale: (v: AppLocale) => void;
}

export const useUiPrefs = create<UiPrefsState>()(
  persist(
    (set) => ({
      screenShareMode: false,
      setScreenShareMode: (v) => set({ screenShareMode: v }),
      toggleScreenShareMode: () => set((s) => ({ screenShareMode: !s.screenShareMode })),
      primSimpleView: true,
      setPrimSimpleView: (v) => set({ primSimpleView: v }),
      togglePrimSimpleView: () => set((s) => ({ primSimpleView: !s.primSimpleView })),
      locale: "tr",
      setLocale: (v) => {
        const locale = isAppLocale(v) ? v : "tr";
        setRuntimeLocale(locale);
        set({ locale });
      },
    }),
    {
      name: "lanetkel-ui-prefs-v1",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UiPrefsState>;
        return {
          ...current,
          ...p,
          locale: isAppLocale(p.locale) ? p.locale : current.locale,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state?.locale) setRuntimeLocale(state.locale);
      },
    },
  ),
);
