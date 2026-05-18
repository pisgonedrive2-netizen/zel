"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/auth";
import { logAudit } from "@/store/audit-log";
import { Button } from "@/components/ui/button";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000;
const TICK_MS = 15_000;

/**
 * Hareket yoksa 30 dk sonra oturumu kapatır; 28. dakikada uyarı çubuğu.
 */
export function SessionIdleGuard() {
  const user   = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const lastActivity = useRef(Date.now());
  const [showWarn, setShowWarn] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowWarn(false);
      return;
    }

    const bump = () => {
      lastActivity.current = Date.now();
      setShowWarn(false);
    };

    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const id = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LIMIT_MS) {
        logAudit({
          actorId: user.id,
          actorName: user.name,
          action: "session_idle_logout",
          detail: "30 dk hareket yok",
        });
        setShowWarn(false);
        logout();
        return;
      }
      if (idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS) setShowWarn(true);
      else setShowWarn(false);
    }, TICK_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(id);
    };
  }, [user, logout]);

  if (!user || !showWarn) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[60] w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-xl border border-amber-400/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg dark:border-amber-500/50 dark:bg-amber-950/90 dark:text-amber-50"
    >
      <p className="font-medium">Oturum yakında kapanacak</p>
      <p className="mt-1 text-xs opacity-90">
        Yaklaşık 2 dakika içinde hareket olmazsa güvenlik için çıkış yapılır.
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-2"
        onClick={() => {
          lastActivity.current = Date.now();
          setShowWarn(false);
        }}
      >
        Devam et
      </Button>
    </div>
  );
}
