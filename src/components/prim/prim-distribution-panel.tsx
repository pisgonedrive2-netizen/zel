"use client";

import {
  Plus, Trash2, EyeOff, Eye as EyeIcon, UserPlus, Pencil,
} from "lucide-react";
import {
  PRIM_DISTRIBUTION_LABELS,
  PRIM_QUALITY_PRESETS,
  fmtPrimUsd,
  type PrimPoolResult,
  type PrimRecipientMeta,
  type PrimDistributionMode,
} from "@/lib/prim-pool";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, NumberInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export type PayrollCandidate = {
  id: string;
  name: string;
  nickname?: string;
  kind: string;
  isCustom: boolean;
};

type Props = {
  monthLabel: string;
  result: PrimPoolResult;
  excludedRecipients: PayrollCandidate[];
  payrollCandidates: PayrollCandidate[];
  recipientMeta: Record<string, PrimRecipientMeta>;
  newPersonName: string;
  newPersonNick: string;
  newPersonKind: string;
  newPersonPoints: number;
  onNewPersonName: (v: string) => void;
  onNewPersonNick: (v: string) => void;
  onNewPersonKind: (v: string) => void;
  onNewPersonPoints: (v: number) => void;
  onAddCustom: () => void;
  onIncludePayroll: (id: string) => void;
  onSetPoints: (id: string, v: number) => void;
  onSetQuality: (id: string, v: number) => void;
  onSetField: (id: string, field: "name" | "nickname", value: string) => void;
  onExclude: (id: string) => void;
  onRemoveCustom: (id: string) => void;
  onDistributionMode: (mode: PrimDistributionMode) => void;
};

export function PrimDistributionPanel({
  monthLabel,
  result,
  excludedRecipients,
  payrollCandidates,
  recipientMeta,
  newPersonName,
  newPersonNick,
  newPersonKind,
  newPersonPoints,
  onNewPersonName,
  onNewPersonNick,
  onNewPersonKind,
  onNewPersonPoints,
  onAddCustom,
  onIncludePayroll,
  onSetPoints,
  onSetQuality,
  onSetField,
  onExclude,
  onRemoveCustom,
  onDistributionMode,
}: Props) {
  const cfg = result.config;

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/25 bg-amber-500/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus size={16} className="text-amber-600" />
            Prim dağıtım listesi — {monthLabel}
          </CardTitle>
          <CardDescription>
            Kim prim alacak? Puan ve kalite belirle, listeden çıkar veya yeni kişi ekle.
            Havuz bu listedeki kişilere <strong className="text-foreground">puan × kalite</strong> ile bölünür.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-muted-foreground">Bölüşüm:</label>
            <Select
              value={cfg.distributionMode ?? "weighted"}
              onChange={(e) => onDistributionMode(e.target.value as PrimDistributionMode)}
              className="h-8 w-auto min-w-[160px] text-xs"
              options={Object.entries(PRIM_DISTRIBUTION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
            <span className="text-[11px] text-muted-foreground ml-auto">
              Toplam prim: <strong className="text-amber-600 tabular-nums">{fmtPrimUsd(result.totalPrimUsd)}</strong>
            </span>
          </div>

          {cfg.distributionMode !== "equal" && (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              <span>Puan: <strong>{result.totalPoints}</strong></span>
              <span>Efektif: <strong>{result.recipients.reduce((s, r) => s + r.effectivePoints, 0)}</strong></span>
              <span>1 efektif puan: <strong className="text-amber-600">{fmtPrimUsd(result.perPointUsd)}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bordrodan dahil edilebilecekler */}
      {payrollCandidates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bordrodan listeye ekle</CardTitle>
            <CardDescription className="text-xs">
              Bu ay bordrolu ama prim listesinde olmayan kişiler
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {payrollCandidates.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => onIncludePayroll(c.id)}
              >
                <Plus size={12} /> {c.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Aktif liste */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Aktif dağıtım ({result.recipients.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              Henüz kimse yok. Bordrodan ekle veya aşağıdan yeni kişi oluştur.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left">
                    <th className="px-3 py-2 font-semibold text-muted-foreground">Kişi</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground w-20">Puan</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground w-28">Kalite</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-24">Prim</th>
                    <th className="px-3 py-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {result.recipients.map((r) => {
                    const isCustom = r.employeeId.startsWith("prim-person-");
                    return (
                      <tr key={r.employeeId} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                              isCustom ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" : "bg-amber-100 text-amber-700",
                            )}>
                              {(r.nickname || r.name).slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0 space-y-1">
                              <Input
                                value={recipientMeta[r.employeeId]?.name ?? ""}
                                onChange={(e) => onSetField(r.employeeId, "name", e.target.value)}
                                placeholder={r.name}
                                className="h-7 text-xs"
                              />
                              <Input
                                value={recipientMeta[r.employeeId]?.nickname ?? ""}
                                onChange={(e) => onSetField(r.employeeId, "nickname", e.target.value)}
                                placeholder="Nick"
                                className="h-7 text-xs"
                              />
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {r.kind}
                                {r.points !== Math.round(r.points) && " · çıkış ayı oransal"}
                                {" · "}pay {pct(r.sharePct)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-0.5">
                            <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => onSetPoints(r.employeeId, r.points - 1)}>−</Button>
                            <NumberInput
                              value={r.points}
                              onChange={(v) => onSetPoints(r.employeeId, v)}
                              min={0}
                              step={1}
                              className="h-7 w-14 text-xs text-center"
                            />
                            <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => onSetPoints(r.employeeId, r.points + 1)}>+</Button>
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-1">{r.effectivePoints} efektif</p>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Select
                            value={String(r.qualityMultiplier)}
                            onChange={(e) => onSetQuality(r.employeeId, Number(e.target.value))}
                            className="h-7 text-xs"
                            options={PRIM_QUALITY_PRESETS.map((q) => ({
                              value: String(q.value),
                              label: q.label,
                            }))}
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <p className="font-bold tabular-nums text-amber-600">{fmtPrimUsd(r.totalUsd)}</p>
                          {(r.poolShareUsd > 0 || r.viewBonusUsd > 0) && (
                            <p className="text-[9px] text-muted-foreground">
                              {fmtPrimUsd(r.baseShareUsd)}
                              {r.poolShareUsd > 0 && ` +${fmtPrimUsd(r.poolShareUsd)}`}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex justify-end gap-0.5">
                            {isCustom ? (
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => onRemoveCustom(r.employeeId)} aria-label="Sil">
                                <Trash2 size={13} />
                              </Button>
                            ) : (
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onExclude(r.employeeId)} aria-label="Listeden çıkar">
                                <EyeOff size={13} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prim dışı */}
      {excludedRecipients.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Listeden çıkarılanlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {excludedRecipients.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <button type="button" className="flex items-center gap-2 hover:text-foreground flex-1 text-left" onClick={() => onIncludePayroll(r.id)}>
                  <EyeIcon size={12} /> {r.name}{r.nickname ? ` · ${r.nickname}` : ""} — tekrar ekle
                </button>
                {r.isCustom && (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => onRemoveCustom(r.id)}>
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Yeni kişi */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Pencil size={14} /> Yeni kişi ekle / düzenle</CardTitle>
          <CardDescription className="text-xs">Bordro dışı (freelance, editör vb.) prim alacak kişiler</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <Input value={newPersonName} onChange={(e) => onNewPersonName(e.target.value)} placeholder="Ad soyad" className="h-8 text-xs" />
            <Input value={newPersonNick} onChange={(e) => onNewPersonNick(e.target.value)} placeholder="Nick" className="h-8 text-xs" />
            <Select
              value={newPersonKind}
              onChange={(e) => onNewPersonKind(e.target.value)}
              className="h-8 text-xs"
              options={[
                { value: "streamer", label: "Yayıncı" },
                { value: "moderator", label: "Moderatör" },
                { value: "editor", label: "Editör" },
                { value: "other", label: "Diğer" },
              ]}
            />
            <NumberInput value={newPersonPoints} onChange={onNewPersonPoints} min={1} step={1} className="h-8 text-xs" />
            <Button type="button" size="sm" variant="default" className="h-8 gap-1" onClick={onAddCustom}>
              <Plus size={13} /> Ekle
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
