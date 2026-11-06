"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModeratorPostRollup } from "@/lib/hesap-gunluk-aktivite-shared";

type Summary = {
  windowDays: number;
  endDay: string;
  people: ModeratorPostRollup[];
};

function cadence(videos: number, days: number): string {
  if (videos <= 0 || days <= 0) return "bu aralıkta video yok";
  if (days >= 20) return "neredeyse her gün";
  if (days >= 12) return "haftada birkaç gün";
  if (days >= 4) return "seyrek";
  return "çok seyrek";
}

export function ModeratorPostingCard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/hesap-gunluk-aktivite?summary=moderators", {
          credentials: "include",
        });
        const json = (await res.json()) as Summary & { ok?: boolean; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Paylaşım özeti alınamadı");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Paylaşım özeti alınamadı");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clapperboard size={14} />
          Naz ve Ponpon paylaşım sıklığı
        </CardTitle>
        <CardDescription>
          {data
            ? `Son ${data.windowDays} gün · Instagram, TikTok, YouTube video taraması`
            : "Hesap taramasından video günleri"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.people.map((person) => (
              <div key={person.tag} className="rounded-lg border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">{person.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {person.videos} video · {person.daysWithVideo}/{data.windowDays} gün
                  </p>
                </div>
                <div className="mt-2 space-y-2">
                  {person.platforms.map((platform) => (
                    <div key={platform.platform}>
                      <p className="text-sm">
                        <span className="font-medium">{platform.platform}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {platform.videos} video · {cadence(platform.videos, platform.daysWithVideo)}
                          {platform.lastPostDay ? ` · son ${platform.lastPostDay}` : ""}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {platform.accounts
                          .map((a) => `${a.handle} ${a.videos}`)
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Link href="/izlenme/yeni-hesaplar" className="text-xs text-muted-foreground underline">
            Hesap takvimi
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
