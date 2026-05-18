/**
 * Foxstream — Excel / AI uyumlu yapılandırılmış CSV raporları.
 *
 * Her dosya: rapor bilgisi → özet tablosu → detay tablosu (tutarlı sütun sayısı).
 * Bölümler arasında boş satır; alt toplamlar aynı sütun hizasında.
 */

export type CsvCell = string | number | boolean | null | undefined;

export type CsvSection = {
  /** Bölüm başlığı (ör. "Hareketler", "Özet") */
  title: string;
  /** Kısa açıklama / filtre notu */
  description?: string;
  columns: string[];
  rows: CsvCell[][];
};

export type CsvReport = {
  filename: string;
  metadata: Record<string, string>;
  sections: CsvSection[];
};

function formatCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Evet" : "Hayır";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  return String(v).replace(/[\r\n]+/g, " ").trim();
}

function csvEscape(v: CsvCell): string {
  return `"${formatCell(v).replace(/"/g, '""')}"`;
}

function padRow(row: CsvCell[], columnCount: number): string[] {
  const out = row.map((c) => formatCell(c));
  while (out.length < columnCount) out.push("");
  return out.slice(0, columnCount);
}

/** Tek rapor gövdesini satır dizisine çevirir. */
export function buildProfessionalCsvRows(report: CsvReport): string[][] {
  const out: string[][] = [];

  out.push(["=== RAPOR BILGISI ==="]);
  out.push(["Alan", "Deger"]);
  for (const [key, value] of Object.entries(report.metadata)) {
    out.push([key, value]);
  }
  out.push([]);

  for (const section of report.sections) {
    const colCount = section.columns.length;
    out.push([`=== ${section.title.toUpperCase()} ===`]);
    if (section.description) {
      out.push(["Aciklama", section.description]);
    }
    out.push([...section.columns]);
    for (const row of section.rows) {
      out.push(padRow(row, colCount));
    }
    out.push([]);
  }

  return out;
}

export function buildProfessionalCsv(report: CsvReport): string {
  const rows = buildProfessionalCsvRows(report);
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

function assertBrowserDownload(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Indirme yalnizca tarayicida kullanilabilir.");
  }
}

export function downloadProfessionalCsv(report: CsvReport): void {
  assertBrowserDownload();
  const csv = buildProfessionalCsv(report);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = report.filename.endsWith(".csv") ? report.filename : `${report.filename}.csv`;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 300);
}

/** Özet bölümü: Metrik | Tutar | Birim | Not */
export function summarySection(
  title: string,
  rows: { metric: string; value: CsvCell; unit?: string; note?: string }[],
  description?: string,
): CsvSection {
  return {
    title,
    description,
    columns: ["Metrik", "Deger", "Birim", "Not"],
    rows: rows.map((r) => [r.metric, r.value, r.unit ?? "", r.note ?? ""]),
  };
}

/** Detay satırlarına sıra numarası ekler. */
export function numberedDetailSection(
  title: string,
  columns: string[],
  rows: CsvCell[][],
  description?: string,
): CsvSection {
  return {
    title,
    description,
    columns: ["Sira No", ...columns],
    rows: rows.map((row, i) => [i + 1, ...row]),
  };
}

/** Alt toplam satırı — ilk sütunda etiket, belirtilen indekslere değer. */
export function totalRow(
  columnCount: number,
  label: string,
  values: Record<number, CsvCell>,
): CsvCell[] {
  const row: CsvCell[] = new Array(columnCount).fill("");
  row[0] = label;
  for (const [idx, val] of Object.entries(values)) {
    const i = Number(idx);
    if (i >= 0 && i < columnCount) row[i] = val;
  }
  return row;
}
