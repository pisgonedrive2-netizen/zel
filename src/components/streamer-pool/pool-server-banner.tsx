"use client";

import { AlertCircle } from "lucide-react";

/**
 * Backend Faz G/H tabloları/route'ları henüz dağıtılmadıysa kullanıcıya
 * gösterilecek bilgilendirici banner. UI sayfaları fetch hatası alınca
 * `isPoolNotReadyError` ile bu banner'ı render eder.
 */
export function PoolServerBanner({
  message,
}: {
  message?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
      <div className="space-y-1">
        <p className="font-semibold">Sistem hazırlanıyor</p>
        <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-100/80">
          {message ??
            "Yönetici migrasyonu uyguladıktan ve API yayına alındıktan sonra veriler burada görünecek. Şu an boş bir görünümdesiniz."}
        </p>
      </div>
    </div>
  );
}
