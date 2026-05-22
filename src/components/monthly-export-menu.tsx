"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { monthLabelTr } from "@/lib/month-label";

interface Props {
  month: string;
  availableMonths: string[];
  onExportPdf: (ym: string) => void | Promise<void>;
  onExportCsv: (ym: string) => void | Promise<void>;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function MonthlyExportMenu({
  month,
  availableMonths,
  onExportPdf,
  onExportCsv,
  label = "İndir",
  size = "sm",
  variant = "outline",
  className,
}: Props) {
  const months = availableMonths.length > 0 ? availableMonths : [month];
  const [selected, setSelected] = useState(month);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  useEffect(() => {
    setSelected((prev) => (months.includes(prev) ? prev : month));
  }, [month, months]);

  const runExport = async (kind: "pdf" | "csv") => {
    const ym = selected || month;
    setBusy(kind);
    try {
      if (kind === "pdf") await onExportPdf(ym);
      else await onExportCsv(ym);
      setOpen(false);
    } catch (err) {
      console.error("Export failed:", err);
      window.alert(
        `Dışa aktarma başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        type="button"
        disabled={!!busy}
        className={cn(buttonVariants({ variant, size }), "gap-1.5", className)}
      >
        <Download size={14} />
        {busy ? "Hazırlanıyor…" : label}
        <ChevronDown size={12} className="opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-1">
            Ay seç
          </DropdownMenuLabel>
          <div className="px-1 pb-2" onPointerDown={(e) => e.stopPropagation()}>
            <select
              aria-label="Rapor ayı seç"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-background text-sm px-2"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabelTr(m)} ({m})
                </option>
              ))}
            </select>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium px-1">
            Dışa aktar
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!!busy}
            className="items-start gap-2 py-2 cursor-pointer"
            onClick={() => void runExport("pdf")}
          >
            <FileText size={14} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium">PDF olarak indir</span>
              <span className="text-[10px] text-muted-foreground">Yazdırılabilir profesyonel rapor</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!!busy}
            className="items-start gap-2 py-2 cursor-pointer"
            onClick={() => void runExport("csv")}
          >
            <FileSpreadsheet size={14} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium">Excel (CSV) olarak indir</span>
              <span className="text-[10px] text-muted-foreground">Excel uyumlu, UTF-8 BOM ile</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
