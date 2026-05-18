/**
 * Marka / yayıncı izlenme raporu — jsPDF + autoTable (Turkish-safe ASCII fallback).
 */
import { jsPDF } from "jspdf";
import autoTableImport from "jspdf-autotable";

type AutoTableFn = (doc: jsPDF, options: Record<string, unknown>) => void;

function resolveAutoTable(): AutoTableFn {
  if (typeof autoTableImport === "function") return autoTableImport as AutoTableFn;
  const mod = autoTableImport as { default?: AutoTableFn; autoTable?: AutoTableFn };
  if (typeof mod.default === "function") return mod.default;
  if (typeof mod.autoTable === "function") return mod.autoTable;
  throw new Error("jspdf-autotable yüklenemedi");
}

const autoTable = resolveAutoTable();

function latin1ish(s: string): string {
  if (!s) return "";
  const map: Record<string, string> = {
    ş: "s",
    Ş: "S",
    ı: "i",
    İ: "I",
    ğ: "g",
    Ğ: "G",
    ü: "u",
    Ü: "U",
    ö: "o",
    Ö: "O",
    ç: "c",
    Ç: "C",
    â: "a",
    Â: "A",
    î: "i",
    Î: "I",
  };
  return [...s].map((c) => map[c] ?? c).join("");
}

export function weekOverlapsMonth(weekStartIso: string, ym: string): boolean {
  const ws = new Date(weekStartIso + "T12:00:00");
  const we = new Date(ws);
  we.setDate(we.getDate() + 6);
  const ms = new Date(ym + "-01T12:00:00");
  const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0, 12, 0, 0);
  return ws.getTime() <= me.getTime() && we.getTime() >= ms.getTime();
}

export type BrandMonthPdfInput = {
  brandFullName: string;
  monthYm: string;
  monthTitle: string;
  links: Array<{
    platform: string;
    handle: string;
    url: string;
    lastViews: string;
    lastSnapshot: string;
  }>;
  monthlyRows: Array<{
    kaynak: string;
    izlenme: string;
    url: string;
    not: string;
  }>;
  reels: Array<{
    hafta: string;
    platform: string;
    link: string;
    not: string;
  }>;
};

export function downloadBrandMonthPdf(input: BrandMonthPdfInput, filenamePrefix?: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = latin1ish(input.brandFullName);
  const mt = latin1ish(input.monthTitle);

  doc.setFontSize(16);
  doc.text("Izlenme raporu / Performance snapshot", 14, 16);
  doc.setFontSize(11);
  doc.text(`Marka: ${title}`, 14, 24);
  doc.text(`Donem: ${mt} (${input.monthYm})`, 14, 30);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Linkler ve o aya ait izlenme ozetleri asagidadir.", 14, 36);
  doc.setTextColor(0);

  let y = 44;

  if (input.links.length > 0) {
    doc.setFontSize(10);
    doc.text(latin1ish("Marka linkleri"), 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [[latin1ish("Platform"), "Handle", "URL", latin1ish("Son izlenme"), latin1ish("Snapshot tarihi")]],
      body: input.links.map((r) => [
        latin1ish(r.platform),
        latin1ish(r.handle),
        r.url.length > 55 ? r.url.slice(0, 52) + "..." : r.url,
        r.lastViews,
        latin1ish(r.lastSnapshot),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
      ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      : y + 40;
  }

  if (input.monthlyRows.length > 0) {
    doc.setFontSize(10);
    doc.text(latin1ish("Aylik izlenme kayitlari"), 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [[latin1ish("Kaynak"), latin1ish("Izlenme"), "URL", latin1ish("Not")]],
      body: input.monthlyRows.map((r) => [
        latin1ish(r.kaynak),
        r.izlenme,
        r.url.length > 40 ? r.url.slice(0, 37) + "..." : r.url,
        latin1ish(r.not),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
      ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      : y + 40;
  }

  if (input.reels.length > 0) {
    doc.setFontSize(10);
    doc.text(latin1ish("Haftalik reel / icerik linkleri"), 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [[latin1ish("Hafta"), "Platform", "Link", latin1ish("Not")]],
      body: input.reels.map((r) => [
        latin1ish(r.hafta),
        latin1ish(r.platform),
        r.link.length > 45 ? r.link.slice(0, 42) + "..." : r.link,
        latin1ish(r.not),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [139, 92, 246] },
      margin: { left: 14, right: 14 },
    });
  }

  const slug = (filenamePrefix ?? input.brandFullName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  if (typeof window === "undefined") {
    throw new Error("PDF indirme yalnızca tarayıcıda kullanılabilir.");
  }
  doc.save(`izlenme_${slug}_${input.monthYm}.pdf`);
}

export function downloadBrandMonthCsv(input: BrandMonthPdfInput, filenamePrefix?: string): void {
  const lines: string[] = [];
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  lines.push(["platform", "handle", "url", "lastViews", "lastSnapshot"].join(","));
  for (const r of input.links) {
    lines.push([esc(r.platform), esc(r.handle), esc(r.url), esc(r.lastViews), esc(r.lastSnapshot)].join(","));
  }
  lines.push("");
  lines.push(["kaynak", "izlenme", "url", "not"].join(","));
  for (const r of input.monthlyRows) {
    lines.push([esc(r.kaynak), esc(r.izlenme), esc(r.url), esc(r.not)].join(","));
  }
  lines.push("");
  lines.push(["hafta", "platform", "link", "not"].join(","));
  for (const r of input.reels) {
    lines.push([esc(r.hafta), esc(r.platform), esc(r.link), esc(r.not)].join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (filenamePrefix ?? input.brandFullName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  a.href = url;
  a.download = `izlenme_${slug}_${input.monthYm}.csv`;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 300);
}
