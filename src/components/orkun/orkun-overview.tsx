"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Trophy,
  Wallet,
  Users,
  Clapperboard,
  KeyRound,
  ArrowUpRight,
} from "lucide-react";
import { MAIN_ADMIN_PRIVILEGE_GROUPS } from "@/lib/main-admin-privileges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrkunAdminFeed } from "@/components/orkun/orkun-admin-feed";

const QUICK_LINKS = [
  { href: "/ozet", label: "Özet", icon: LayoutDashboard },
  { href: "/prim", label: "Prim Havuzu", icon: Trophy },
  { href: "/kasa", label: "Kasa", icon: Wallet },
  { href: "/maaslar", label: "Maaşlar", icon: Users },
  { href: "/icerik-harcamalari", label: "İçerik Harcamaları", icon: Clapperboard },
  { href: "/kullanicilar", label: "Kullanıcılar", icon: KeyRound },
] as const;

export function OrkunOverview() {
  const totalItems = MAIN_ADMIN_PRIVILEGE_GROUPS.reduce(
    (n, g) => n + g.items.length,
    0,
  );

  return (
    <div id="overview" className="space-y-4">
      <section className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">Hızlı erişim</h2>
          <Badge variant="secondary">{QUICK_LINKS.length} sayfa</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              <span className="font-medium truncate">{label}</span>
              <ArrowUpRight className="size-3.5 ml-auto shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">Ana yönetici yetkileri</h2>
          <Badge variant="outline">
            {MAIN_ADMIN_PRIVILEGE_GROUPS.length} grup · {totalItems} yetki
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {MAIN_ADMIN_PRIVILEGE_GROUPS.map((group) => (
            <Card key={group.id} className="gap-3 py-4 shadow-none">
              <CardHeader className="px-4 pb-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{group.title}</CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    {group.items.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs">{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pt-0">
                <ul className="space-y-1.5">
                  {group.items.map((item) => (
                    <li
                      key={item.key}
                      className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5"
                    >
                      <p className="text-xs font-medium text-foreground leading-tight">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {item.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <OrkunAdminFeed />
    </div>
  );
}
