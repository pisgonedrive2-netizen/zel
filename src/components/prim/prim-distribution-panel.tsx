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
  /** Compact: sadece kişi kartları (özet için) */
  compact?: boolean;
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
  compact = false,
}: Props) {
  const cfg = result.config;
  const totalEffective = result.recipients.reduce((s, r) => s + r.effectivePoints, 0);
  const personCount = result.recipients.length;

  const cards = (
    <div className="grid gap-3 sm:grid-cols-2">
      {personCount === 0 ? (
        <p className="col-span-full py-6 text-center text-sm italic text-muted-foreground">
          Henüz kimse yok. Bordrodan ekle veya yeni kişi oluştur.
        </p>
      ) : (
        result.recipients.map((r) => {
          const isCustom = r.employeeId.startsWith("prim-person-");
          const displayName = recipientMeta[r.employeeId]?.name?.trim() || r.name;
          const payPower = Math.round(r.effectivePoints * 10) / 10;
          return (
            <div
              key={r.employeeId}
              className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    isCustom
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  )}
                >
                  {(r.nickname || displayName).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={recipientMeta[r.employeeId]?.name ?? ""}
                    onChange={(e) => onSetField(r.employeeId, "name", e.target.value)}
                    placeholder={r.name}
                    className="h-8 text-sm font-medium"
                  />
                  <p className="text-[10px] capitalize text-muted-foreground">
                    {r.kind} · pay {pct(r.sharePct)} · güç {payPower}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {fmtPrimUsd(r.totalUsd)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    taban {fmtPrimUsd(r.baseShareUsd)}
                    {r.poolShareUsd > 0 && ` · havuz ${fmtPrimUsd(r.poolShareUsd)}`}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Puan (pay)</label>
                  <div className="mt-0.5 flex items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => onSetPoints(r.employeeId, r.points - 0.5)}
                    >
                      −
                    </Button>
                    <NumberInput
                      value={r.points}
                      onChange={(v) => onSetPoints(r.employeeId, v)}
                      min={0}
                      step={0.5}
                      className="h-8 w-full text-center text-xs"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => onSetPoints(r.employeeId, r.points + 0.5)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Kalite</label>
                  <Select
                    value={String(r.qualityMultiplier)}
                    onChange={(e) => onSetQuality(r.employeeId, Number(e.target.value))}
                    className="mt-0.5 h-8 text-xs"
                    options={PRIM_QUALITY_PRESETS.map((q) => ({
                      value: String(q.value),
                      label: q.label,
                    }))}
                  />
                </div>
              </div>

              <div className="mt-2 flex justify-end">
                {isCustom ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs text-red-600"
                    onClick={() => onRemoveCustom(r.employeeId)}
                  >
                    <Trash2 size={12} /> Sil
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={() => onExclude(r.employeeId)}
                  >
                    <EyeOff size={12} /> Çıkar
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (compact) {
    return (
      <Card id="prim-dagitim" className="scroll-mt-36 border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus size={16} className="text-amber-600" />
            Kim ne alır? · {monthLabel}
          </CardTitle>
          <CardDescription className="text-xs">
            {personCount} kişi · toplam {fmtPrimUsd(result.totalPrimUsd)} ·{" "}
            {PRIM_DISTRIBUTION_LABELS[cfg.distributionMode ?? "weighted"]}
          </CardDescription>
        </CardHeader>
        <CardContent>{cards}</CardContent>
      </Card>
    );
  }

  return (
    <div id="prim-dagitim" className="scroll-mt-36 space-y-4">
      <Card className="border-amber-500/25 bg-amber-500/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus size={16} className="text-amber-600" />
            Prim dağıtım listesi — {monthLabel}
          </CardTitle>
          <CardDescription>
            Puan × kalite = pay gücü. Formül:{" "}
            <span className="font-mono text-[10px]">
              kişi primi = toplam × (puan×kalite) ÷ Σ
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200">
              <Divide size={13} /> Bölüşüm
            </div>
            <p className="text-muted-foreground">
              3 kişi, puanlar 2+1+1 → 2 puanlı kişi havuzun %50&apos;sini alır.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-muted-foreground">Mod:</label>
            <Select
              value={cfg.distributionMode ?? "weighted"}
              onChange={(e) => onDistributionMode(e.target.value as PrimDistributionMode)}
              className="h-8 w-auto min-w-[160px] text-xs"
              options={Object.entries(PRIM_DISTRIBUTION_LABELS).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
            <span className="ml-auto text-[11px] text-muted-foreground">
              Toplam:{" "}
              <strong className="tabular-nums text-amber-600">
                {fmtPrimUsd(result.totalPrimUsd)}
              </strong>
            </span>
          </div>
        </CardContent>
      </Card>

      {payrollCandidates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bordrodan ekle</CardTitle>
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
        </CardHeader>
        <CardContent>{cards}</CardContent>
      </Card>

      {excludedRecipients.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Listeden çıkarılanlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {excludedRecipients.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left hover:text-foreground"
                  onClick={() => onIncludePayroll(r.id)}
                >
                  <EyeIcon size={12} /> {r.name}
                  {r.nickname ? ` · ${r.nickname}` : ""} — tekrar ekle
                </button>
                {r.isCustom && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-600"
                    onClick={() => onRemoveCustom(r.id)}
                  >
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
          <CardTitle className="flex items-center gap-2 text-sm">
            <Pencil size={14} /> Yeni kişi ekle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Ad soyad</label>
              <Input
                value={newPersonName}
                onChange={(e) => onNewPersonName(e.target.value)}
                placeholder="Örn. Ali"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Nick</label>
              <Input
                value={newPersonNick}
                onChange={(e) => onNewPersonNick(e.target.value)}
                placeholder="İsteğe bağlı"
                className="h-8 text-xs"
              />
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
              <label className="text-[10px] text-muted-foreground">Puan</label>
              <NumberInput
                value={newPersonPoints}
                onChange={onNewPersonPoints}
                min={0.5}
                step={0.5}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                className="h-8 w-full gap-1"
                onClick={onAddCustom}
                disabled={!newPersonName.trim()}
              >
                <Plus size={13} /> Listeye ekle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
