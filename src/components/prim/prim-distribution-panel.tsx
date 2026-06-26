"use client";

import {
  Plus, Trash2, EyeOff, Eye as EyeIcon, UserPlus, Pencil, Divide,
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
  return `${Math.round(n * 1000) / 10}%`;
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
  const totalEffective = result.recipients.reduce((s, r) => s + r.effectivePoints, 0);
  const personCount = result.recipients.length;

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/25 bg-amber-500/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus size={16} className="text-amber-600" />
            Prim dağıtım listesi — {monthLabel}
          </CardTitle>
          <CardDescription>
            Kişi ekle, <strong className="text-foreground">puan (pay ağırlığı)</strong> ve kalite belirle.
            Toplam prim listedeki kişilere bölünür — herkesin payı:{" "}
            <strong className="text-foreground">(puan × kalite) ÷ toplam efektif puan</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200 mb-1">
              <Divide size={13} /> Bölüşüm formülü
            </div>
            <p className="text-foreground/90">
              <span className="font-mono text-[10px] bg-background/60 px-1 rounded">
                kişi primi = toplam prim × (senin puanın × kalite) ÷ Σ(puan × kalite)
              </span>
            </p>
            <p className="text-muted-foreground mt-1">
              Örnek: 3 kişi, puanlar 2 + 1 + 1 → toplam 4 efektif puan. 2 puanlı kişi havuzun{" "}
              <strong className="text-foreground">%50</strong>&apos;sini alır.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-muted-foreground">Bölüşüm modu:</label>
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

          {cfg.distributionMode !== "equal" && personCount > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              <span>Kişi: <strong>{personCount}</strong></span>
              <span>Toplam puan: <strong>{result.totalPoints}</strong></span>
              <span>Efektif puan: <strong>{totalEffective}</strong></span>
              <span>1 efektif puan: <strong className="text-amber-600">{fmtPrimUsd(result.perPointUsd)}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Aktif dağıtım ({personCount})</CardTitle>
          <CardDescription className="text-xs">
            Puan = pay ağırlığı (2 puan, 1 puana göre 2 kat prim). Kalite çarpanı bunun üstüne uygulanır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {personCount === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              Henüz kimse yok. Bordrodan ekle veya aşağıdan yeni kişi oluştur.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left">
                    <th className="px-3 py-2 font-semibold text-muted-foreground">İsim</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground w-24">Puan (pay)</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground w-28">Kalite (×)</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-16">Pay %</th>
                    <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-24">Prim</th>
                    <th className="px-3 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {result.recipients.map((r) => {
                    const isCustom = r.employeeId.startsWith("prim-person-");
                    const displayName = recipientMeta[r.employeeId]?.name?.trim() || r.name;
                    return (
                      <tr key={r.employeeId} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                              isCustom ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" : "bg-amber-100 text-amber-700",
                            )}>
                              {(r.nickname || displayName).slice(0, 1).toUpperCase()}
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
                                placeholder="Nick (isteğe bağlı)"
                                className="h-7 text-xs"
                              />
                              <p className="text-[10px] text-muted-foreground capitalize">
                                {r.kind}
                                {r.points !== Math.round(r.points * 10) / 10 && " · çıkış ayı oransal"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-0.5">
                            <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => onSetPoints(r.employeeId, r.points - 0.5)}>−</Button>
                            <NumberInput
                              value={r.points}
                              onChange={(v) => onSetPoints(r.employeeId, v)}
                              min={0}
                              step={0.5}
                              className="h-7 w-14 text-xs text-center"
                            />
                            <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => onSetPoints(r.employeeId, r.points + 0.5)}>+</Button>
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
                        <td className="px-3 py-2 align-top text-right font-semibold tabular-nums text-foreground/80">
                          {pct(r.sharePct)}
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
                          <div className="flex justify-end">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Pencil size={14} /> Yeni kişi ekle</CardTitle>
          <CardDescription className="text-xs">
            İsim ve puan gir — havuz {personCount > 0 ? `${personCount + 1} kişiye` : "kişilere"} puan oranında bölünür.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Ad soyad</label>
              <Input value={newPersonName} onChange={(e) => onNewPersonName(e.target.value)} placeholder="Örn. Ali" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Nick</label>
              <Input value={newPersonNick} onChange={(e) => onNewPersonNick(e.target.value)} placeholder="İsteğe bağlı" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Rol</label>
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
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Puan (pay ağırlığı)</label>
              <NumberInput value={newPersonPoints} onChange={onNewPersonPoints} min={0.5} step={0.5} className="h-8 text-xs" />
            </div>
            <div className="flex items-end">
              <Button type="button" size="sm" variant="default" className="h-8 w-full gap-1" onClick={onAddCustom} disabled={!newPersonName.trim()}>
                <Plus size={13} /> Listeye ekle
              </Button>
            </div>
          </div>
          {newPersonName.trim() && newPersonPoints > 0 && totalEffective > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Tahmini pay: yaklaşık{" "}
              <strong className="text-amber-600">
                {pct((newPersonPoints * 1) / (totalEffective + newPersonPoints * 1))}
              </strong>{" "}
              (mevcut {personCount} kişi + yeni, kalite ×1 varsayımı)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
