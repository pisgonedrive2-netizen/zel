"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDays, CheckCircle2, Circle, ListTodo } from "lucide-react";
import { useStore } from "@/store/store";
import { streamerTodayTasks } from "@/lib/streamer-today-tasks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/fmt-date";

export function StreamerTodayTasksCard({ userId }: { userId: string }) {
  const notifications = useStore((s) => s.notifications);
  const todayKey = new Date().toISOString().slice(0, 10);

  const tasks = useMemo(
    () => streamerTodayTasks(notifications, userId, todayKey),
    [notifications, userId, todayKey]
  );

  const unread = tasks.filter((t) => !t.read).length;

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo size={16} className="text-primary" />
              Bugün yapılacaklar
            </CardTitle>
            <CardDescription>
              Yönetici atadığı günlük görevler — tam pano yok, buradan takip edin
            </CardDescription>
          </div>
          {unread > 0 && (
            <Badge className="text-[10px]">{unread} yeni</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Bugün için atanmış görev yok. Yeni hatırlatma gelince burada görünür.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.slice(0, 8).map((t) => (
              <li
                key={t.id}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  t.read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                }`}
              >
                {t.read ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Circle size={16} className="mt-0.5 shrink-0 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{t.message}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CalendarDays size={10} />
                    {fmtDateTime(t.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex justify-end">
          <Link
            href="/yayinci/bildirimler"
            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Tüm bildirimler →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
