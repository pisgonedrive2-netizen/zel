"use client";

import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrkunOverview } from "@/components/orkun/orkun-overview";
import { OrkunArchivePanel } from "@/components/orkun/orkun-archive-panel";
import { OrkunTrashPanel } from "@/components/orkun/orkun-trash-panel";
import { OrkunLocksPanel } from "@/components/orkun/orkun-locks-panel";
import { OrkunFinanceTools } from "@/components/orkun/orkun-finance-tools";
import { OrkunConflictRepair } from "@/components/orkun/orkun-conflict-repair";
import { OrkunSecurityPanel } from "@/components/orkun/orkun-security-panel";
import { OrkunImpersonationTrail } from "@/components/orkun/orkun-impersonation-trail";
import { OrkunPermissionsPanel } from "@/components/orkun/orkun-permissions-panel";
import { SystemBackupStatusCard } from "@/components/admin/system-backup-status-card";
import { OrkunBackupRestoreCard } from "@/components/orkun/orkun-backup-restore";

/** Arşiv + çöp — Faz 1 / Faz 3 görünürlük panelleri. */
export function OrkunArchivePlaceholder() {
  return (
    <div id="archive" className="space-y-4">
      <OrkunArchivePanel />
      <OrkunTrashPanel />
    </div>
  );
}

export function OrkunShell() {
  return (
    <div className="space-y-3">
      <PageHeader
        title="Orkun"
        description="Ana yönetici komuta merkezi — yalnızca Orkun."
        icon={<LayoutGrid className="size-5 text-muted-foreground shrink-0" />}
      />

      <Tabs defaultValue="genel" className="gap-3">
        <TabsList className="h-auto flex-wrap justify-start w-full sm:w-fit">
          <TabsTrigger value="genel">Genel</TabsTrigger>
          <TabsTrigger value="arsiv">Arşiv</TabsTrigger>
          <TabsTrigger value="kilitler">Kilitler</TabsTrigger>
          <TabsTrigger value="yetkiler">Yetkiler</TabsTrigger>
          <TabsTrigger value="yedek">Yedek</TabsTrigger>
          <TabsTrigger value="tehlikeli">Tehlikeli</TabsTrigger>
        </TabsList>

        <TabsContent value="genel" className="mt-1">
          <OrkunOverview />
        </TabsContent>
        <TabsContent value="arsiv" className="mt-1">
          <OrkunArchivePlaceholder />
        </TabsContent>
        <TabsContent value="kilitler" className="mt-1 space-y-3">
          <OrkunLocksPanel />
        </TabsContent>
        <TabsContent value="yetkiler" className="mt-1">
          <OrkunPermissionsPanel />
        </TabsContent>
        <TabsContent value="yedek" className="mt-1 space-y-3">
          <SystemBackupStatusCard />
          <OrkunBackupRestoreCard />
          <OrkunImpersonationTrail />
          <OrkunSecurityPanel />
        </TabsContent>
        <TabsContent value="tehlikeli" className="mt-1 space-y-3">
          <OrkunFinanceTools
            onDone={() => {
              if (
                typeof window !== "undefined" &&
                window.confirm(
                  "Harcama ayları güncellendi. Store’u tazelemek için sayfa yenilensin mi?"
                )
              ) {
                window.location.reload();
              }
            }}
          />
          <OrkunConflictRepair />
        </TabsContent>
      </Tabs>
    </div>
  );
}
