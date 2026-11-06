"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClipFarmData } from "@/lib/clip-farm/server";

export type ClipAdminState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "setup"; sql: string }
  | { status: "ready"; data: ClipFarmData };

export function useClipAdmin() {
  const [state, setState] = useState<ClipAdminState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/clip", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) setState({ status: "error", error: json.error ?? "Yüklenemedi" });
      else if (!json.ready) setState({ status: "setup", sql: json.setupSql });
      else setState({ status: "ready", data: json as ClipFarmData });
    } catch {
      setState({ status: "error", error: "Bağlantı hatası" });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = useCallback(
    async <T = Record<string, unknown>>(payload: Record<string, unknown>, okMessage?: string): Promise<(T & { ok: boolean; error?: string }) | null> => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin/clip", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setToast(json.error ?? "İşlem başarısız");
          return null;
        }
        if (okMessage) setToast(okMessage);
        await reload();
        return json;
      } catch {
        setToast("Bağlantı hatası");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [reload]
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return { state, reload, act, busy, toast };
}
