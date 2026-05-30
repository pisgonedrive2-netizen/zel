"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Download, FileUp } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Field, FormActions, Textarea } from "@/components/ui/field";
import { ApiError } from "@/lib/streamer-pool-api";
import {
  affiliateCsvTemplate,
  importAffiliateCsv,
  type CsvImportResult,
} from "@/lib/affiliate-api";

export function CsvImportModal({
  open,
  onClose,
  brandId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
  onImported: () => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setFile(null);
      setError(null);
      setResult(null);
      setBusy(false);
      setCopied(false);
    }
  }, [open]);

  const template = affiliateCsvTemplate();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Panoya kopyalanamadı.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([template + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "affiliate-sablon.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const source = file ?? text.trim();
    if (!source || (typeof source === "string" && !source)) {
      setError("CSV dosyası seçin veya metin yapıştırın.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await importAffiliateCsv(brandId, source);
      setResult(res);
      await onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İçe aktarım başarısız.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="CSV içe aktar" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-foreground">Gerekli başlık</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[12px] text-foreground hover:bg-accent"
              >
                {copied ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? "Kopyalandı" : "Şablon kopyala"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[12px] text-foreground hover:bg-accent"
              >
                <Download size={13} /> İndir
              </button>
            </div>
          </div>
          <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-background px-3 py-2 text-[11px] text-muted-foreground">
            {template}
          </pre>
          <p className="mt-2 text-[11px] text-muted-foreground">
            <code>partner_external_ref</code> partnerin dış referansıyla eşleştirilir,
            eşleşmeyen satırlar atlanır. Tarih <code>YYYY-MM-DD</code> olmalı,{" "}
            <code>currency</code> opsiyoneldir.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="CSV metni" hint="Başlık satırı dahil yapıştırın (dosya seçtiyseniz yok sayılır)">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={template}
              disabled={!!file}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] text-foreground hover:bg-accent"
            >
              <FileUp size={14} /> Dosya seç
            </button>
            {file && (
              <span className="text-[12px] text-muted-foreground">
                {file.name}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-pink-600 hover:underline dark:text-pink-400"
                >
                  kaldır
                </button>
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-lg border border-emerald-300/60 bg-emerald-50/60 px-3 py-2.5 text-[13px] dark:border-emerald-500/40 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 size={15} /> İçe aktarım tamamlandı
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-emerald-900/90 dark:text-emerald-100/90 tabular-nums">
              <span>Eklenen: {result.inserted}</span>
              <span>Güncellenen: {result.updated}</span>
              <span>Atlanan: {result.skipped}</span>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto rounded-md bg-background/70 px-2.5 py-1.5 text-[12px] text-muted-foreground">
                {result.errors.slice(0, 50).map((er, i) => (
                  <div key={i}>
                    Satır {er.line}: {er.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <FormActions
          onCancel={onClose}
          submitLabel={busy ? "İçe aktarılıyor…" : "İçe aktar"}
          hideSubmit={!!result}
        />
      </form>
    </Modal>
  );
}
