"use client";

import { useState } from "react";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/store/auth";
import { t } from "@/lib/i18n/t";
import { useUiPrefs } from "@/store/ui-prefs";

const ROLE_TR: Record<string, string> = {
  admin: "Yönetici",
  streamer: "Yayıncı",
  auditor: "Denetçi",
  brand: "Marka",
};

/**
 * Ana yönetici (Orkun) başka bir hesaba "denetim için" girdiğinde, hangi sayfada
 * olursa olsun en üstte görünen kalıcı uyarı şeridi. Tek tıkla kendi hesabına döner.
 */
export function ImpersonationBar() {
  const user = useAuth((s) => s.user);
  const stopImpersonation = useAuth((s) => s.stopImpersonation);
  const locale = useUiPrefs((s) => s.locale);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!user?.impersonatorId) return null;

  const onExit = async () => {
    setBusy(true);
    setErr(null);
    const r = await stopImpersonation();
    if (!r.ok) {
      setErr(r.error);
      setBusy(false);
    }
    // Başarılıysa sayfa yeniden yüklenir; busy kalsın.
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 border-b border-rose-400/60 bg-rose-600/95 px-3 py-1.5 text-xs text-white shadow-md backdrop-blur sm:text-sm"
    >
      <ShieldAlert size={15} className="shrink-0" />
      <span className="min-w-0 truncate">
        <strong>{t("Denetim modu", locale)}</strong> ·{" "}
        <span className="font-semibold">{user.name}</span>{" "}
        ({t(ROLE_TR[user.role] ?? user.role, locale)}) {t("hesabındasınız", locale)}
        {user.impersonatorName ? ` — ${user.impersonatorName} ${t("olarak", locale)}` : ""}
        {err ? ` · ${err}` : ""}
      </span>
      <button
        type="button"
        onClick={() => void onExit()}
        disabled={busy}
        className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-medium hover:bg-white/25 disabled:opacity-60"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
        {t("Kendi hesabıma dön", locale)}
      </button>
    </div>
  );
}
