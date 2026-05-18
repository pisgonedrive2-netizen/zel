"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { monthLabelTr } from "@/lib/monthly-exports";

interface Props {
  month: string;
  availableMonths: string[];
  onExportPdf: (ym: string) => void;
  onExportCsv: (ym: string) => void;
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

  useEffect(() => {
    setSelected((prev) => (months.includes(prev) ? prev : month));
  }, [month, months]);

  const runExport = (kind: "pdf" | "csv") => {
    const ym = selected || month;
    try {
      if (kind === "pdf") onExportPdf(ym);
      else onExportCsv(ym);
    } catch (err) {
      console.error("Export failed:", err);
      window.alert(
        `Dışa aktarma başarısız: ${err instanceof Error ? err.message : "bilinmeyen hata"}`
      );
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        type="button"
        className={cn(buttonVariants({ variant, size }), "gap-1.5", className)}
      >
        <Download size={14} />
        {label}
        <ChevronDown size={12} className="opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Ay seç
        </DropdownMenuLabel>
        <div className="px-2 pb-2 pt-1" onPointerDown={(e) => e.stopPropagation()}>
          <select
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
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Dışa aktar
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => runExport("pdf")} className="gap-2 cursor-pointer">
          <FileText size={14} className="text-red-600 dark:text-red-400" />
          <div className="flex flex-col">
            <span className="text-sm">PDF olarak indir</span>
            <span className="text-[10px] text-muted-foreground">Yazdırılabilir profesyonel rapor</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => runExport("csv")} className="gap-2 cursor-pointer">
          <FileSpreadsheet size={14} className="text-green-600 dark:text-green-400" />
          <div className="flex flex-col">
            <span className="text-sm">CSV olarak indir</span>
            <span className="text-[10px] text-muted-foreground">Excel uyumlu, UTF-8 BOM ile</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
