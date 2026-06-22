"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
    }),
    { name: "lanetkel-ui-prefs-v1" },
  ),
);
