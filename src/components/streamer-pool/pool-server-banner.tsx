"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

export type PoolOfflineLink = {
  href: string;
  label: string;
};

const DEFAULT_OFFLINE_LINKS: PoolOfflineLink[] = [
  { href: "/izlenme", label: "İzlenme panosu" },
  { href: "/marka/izlenmeler", label: "Marka izlenmeleri" },
  { href: "/yayinci/marka-linkleri", label: "Yayıncı marka linkleri" },
];

/**
 * Backend Faz G/H tabloları/route'ları henüz dağıtılmadıysa kullanıcıya
 * gösterilecek bilgilendirici banner. UI sayfaları fetch hatası alınca
 * `isPoolNotReadyError` ile bu banner'ı render eder.
 */
export function PoolServerBanner({
  message,
  links = DEFAULT_OFFLINE_LINKS,
}: {
  message?: string;
  links?: PoolOfflineLink[];
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
      <div className="space-y-2">
        <p className="font-semibold">Sistem hazırlanıyor</p>
        <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-100/80">
          {message ??
            "Yönetici migrasyonu uyguladıktan ve API yayına alındıktan sonra veriler burada görünecek. Şu an boş bir görünümdesiniz."}
        </p>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center rounded-md border border-amber-400/50 bg-white/60 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-white dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
