"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Image as ImageIcon, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  placeholder?: string;
  disabled?: boolean;
}

const IMG_RX = /^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i;

/** URL girdisi + dosya yükleme tek bileşen. Yüklenen dosya Supabase Storage'a gider. */
export function ProofUploader({ value, onChange, folder = "expense", placeholder, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Yükleme başarısız");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yükleme hatası");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "https://... veya soldan dosya yükle"}
          className="font-mono text-xs flex-1"
          disabled={disabled || uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="shrink-0"
        >
          {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
          <span className="ml-1.5 text-xs">Yükle</span>
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange("")}
            disabled={disabled || uploading}
            className="shrink-0 text-red-600 dark:text-red-400"
            aria-label="Kanıtı temizle"
          >
            <X size={14} />
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {value && (
        <div className="border border-border rounded-lg p-2 bg-muted/30 max-h-48 overflow-hidden">
          {IMG_RX.test(value) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="kanıt" className="max-h-44 object-contain mx-auto" />
          ) : (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 break-all inline-flex items-center gap-1"
            >
              <ImageIcon size={11} /> {value}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
