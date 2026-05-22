/**
 * Marka / yayıncı izlenme raporu — jsPDF + autoTable (Turkish-safe ASCII fallback).
 */
import { jsPDF } from "jspdf";
import { fmtDateTime } from "@/lib/fmt-date";
import autoTableImport from "jspdf-autotable";
import {
  downloadProfessionalCsv,
  numberedDetailSection,
  summarySection,
  type CsvReport,
} from "@/lib/professional-csv";

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
    owner?: string;
    lastViews: string;
    lastSnapshot: string;
    lastLikes?: string;
    lastComments?: string;
    lastShares?: string;
    engagementRate?: string;
  }>;
  monthlyRows: Array<{
    kaynak: string;
    izlenme: string;
    url: string;
    not: string;
  }>;
  /** Platform bazlı toplam metrikler (opsiyonel). */
  platformBreakdown?: Array<{
    platform: string;
    linkCount: string;
    totalViews: string;
    totalLikes: string;
    totalComments: string;
    totalShares: string;
  }>;
  reels: Array<{
    hafta: string;
    yayıncı?: string;
    platform: string;
    link: string;
    not: string;
  }>;
  /** Kayıt, yatırım ve tutar özeti (opsiyonel). */
  operationStats?: Array<{ label: string; value: string }>;
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

  if (input.operationStats && input.operationStats.length > 0) {
    doc.setFontSize(10);
    doc.text(latin1ish("Operasyon ozeti (kayit / yatirim)"), 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [[latin1ish("Metrik"), latin1ish("Deger")]],
      body: input.operationStats.map((r) => [latin1ish(r.label), latin1ish(r.value)]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [124, 58, 237] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
      ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      : y + 40;
  }

  if (input.links.length > 0) {
    doc.setFontSize(10);
    doc.text(latin1ish("Marka linkleri (etkilesim metrikleri dahil)"), 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [[
        latin1ish("Platform"),
        latin1ish("Yayinci"),
        "Handle",
        latin1ish("Izlenme"),
        latin1ish("Begeni"),
        latin1ish("Yorum"),
        latin1ish("Paylasim"),
        latin1ish("Etk. %"),
        latin1ish("Tarih"),
      ]],
      body: input.links.map((r) => [
        latin1ish(r.platform),
        latin1ish(r.owner ?? "-"),
        latin1ish(r.handle.length > 18 ? r.handle.slice(0, 15) + "..." : r.handle),
        r.lastViews,
        r.lastLikes ?? "-",
        r.lastComments ?? "-",
        r.lastShares ?? "-",
        r.engagementRate ?? "-",
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

  if (input.platformBreakdown && input.platformBreakdown.length > 0) {
    doc.setFontSize(10);
    doc.text(latin1ish("Platform bazli toplam"), 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [[
        latin1ish("Platform"),
        latin1ish("Link"),
        latin1ish("Toplam Izlenme"),
        latin1ish("Toplam Begeni"),
        latin1ish("Toplam Yorum"),
        latin1ish("Toplam Paylasim"),
      ]],
      body: input.platformBreakdown.map((r) => [
        latin1ish(r.platform),
        r.linkCount,
        r.totalViews,
        r.totalLikes,
        r.totalComments,
        r.totalShares,
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [56, 189, 248] },
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
      head: [[latin1ish("Hafta"), latin1ish("Yayinci"), "Platform", "Link", latin1ish("Not")]],
      body: input.reels.map((r) => [
        latin1ish(r.hafta),
        latin1ish(r.yayıncı ?? "-"),
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

export type BrandOperationPdfInput = {
  brandFullName: string;
  monthYm: string;
  monthTitle: string;
  operationStats: Array<{ label: string; value: string }>;
};

/** Operasyon özeti — kayıt, yatırım, çekim ve canlı demo metrikleri. */
export function downloadBrandOperationPdf(input: BrandOperationPdfInput, filenamePrefix?: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = latin1ish(input.brandFullName);
  const mt = latin1ish(input.monthTitle);

  doc.setFontSize(16);
  doc.text("Operasyon ozeti raporu", 14, 16);
  doc.setFontSize(11);
  doc.text(`Marka: ${title}`, 14, 24);
  doc.text(`Donem: ${mt} (${input.monthYm})`, 14, 30);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    latin1ish("Kayit olan uye, yatirim yapan uye, tutarlar ve canli demo bakiyesi."),
    14,
    36
  );
  doc.setTextColor(0);

  if (input.operationStats.length > 0) {
    autoTable(doc, {
      startY: 44,
      head: [[latin1ish("Metrik"), latin1ish("Deger")]],
      body: input.operationStats.map((r) => [latin1ish(r.label), latin1ish(r.value)]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [124, 58, 237] },
      margin: { left: 14, right: 14 },
    });
  } else {
    doc.setFontSize(10);
    doc.text(latin1ish("Bu donem icin kayitli operasyon verisi yok."), 14, 48);
  }

  const slug = (filenamePrefix ?? input.brandFullName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  if (typeof window === "undefined") {
    throw new Error("PDF indirme yalnızca tarayıcıda kullanılabilir.");
  }
  doc.save(`operasyon_${slug}_${input.monthYm}.pdf`);
}

export function downloadBrandOperationCsv(
  input: BrandOperationPdfInput,
  filenamePrefix?: string
): void {
  const slug = (filenamePrefix ?? input.brandFullName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  const sections: CsvReport["sections"] = [
    summarySection("Rapor ozeti", [
      { metric: "Marka", value: input.brandFullName, unit: "" },
      { metric: "Donem", value: `${input.monthTitle} (${input.monthYm})`, unit: "" },
      { metric: "Metrik sayisi", value: input.operationStats.length, unit: "adet" },
    ]),
  ];

  if (input.operationStats.length > 0) {
    sections.push(
      numberedDetailSection(
        "Operasyon metrikleri",
        ["Metrik", "Deger"],
        input.operationStats.map((r) => [r.label, r.value]),
        `Kayit ve yatirim · ${input.monthYm}`
      )
    );
  }

  downloadProfessionalCsv({
    filename: `operasyon_${slug}_${input.monthYm}.csv`,
    metadata: {
      Uygulama: "Foxstream",
      "Rapor turu": "Marka operasyon ozeti",
      Marka: input.brandFullName,
      Donem: `${input.monthTitle} (${input.monthYm})`,
      "Olusturulma (TR)": fmtDateTime(new Date()),
    },
    sections,
  });
}

export function downloadBrandMonthCsv(input: BrandMonthPdfInput, filenamePrefix?: string): void {
  const slug = (filenamePrefix ?? input.brandFullName).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
  const sections: CsvReport["sections"] = [
    summarySection("Rapor ozeti", [
      { metric: "Marka", value: input.brandFullName, unit: "" },
      { metric: "Donem", value: `${input.monthTitle} (${input.monthYm})`, unit: "" },
      { metric: "Link sayisi", value: input.links.length, unit: "adet" },
      { metric: "Aylik izlenme kaydi", value: input.monthlyRows.length, unit: "adet" },
      { metric: "Haftalik reel kaydi", value: input.reels.length, unit: "adet" },
    ]),
  ];

  if (input.operationStats && input.operationStats.length > 0) {
    sections.push(
      numberedDetailSection(
        "Operasyon ozeti",
        ["Metrik", "Deger"],
        input.operationStats.map((r) => [r.label, r.value]),
        `Kayit ve yatirim metrikleri · ${input.monthYm}`,
      ),
    );
  }

  if (input.links.length > 0) {
    sections.push(
      numberedDetailSection(
        "Marka linkleri",
        ["Platform", "Yayinci", "Handle", "URL", "Son_Izlenme", "Begeni", "Yorum", "Paylasim", "Etkilesim_Yuzde", "Snapshot_Tarihi"],
        input.links.map((r) => [
          r.platform,
          r.owner ?? "-",
          r.handle,
          r.url,
          r.lastViews,
          r.lastLikes ?? "-",
          r.lastComments ?? "-",
          r.lastShares ?? "-",
          r.engagementRate ?? "-",
          r.lastSnapshot,
        ]),
        "Aktif marka hesap linkleri + engagement",
      ),
    );
  }

  if (input.platformBreakdown && input.platformBreakdown.length > 0) {
    sections.push(
      numberedDetailSection(
        "Platform bazli toplam",
        ["Platform", "Link_Sayisi", "Toplam_Izlenme", "Toplam_Begeni", "Toplam_Yorum", "Toplam_Paylasim"],
        input.platformBreakdown.map((r) => [
          r.platform,
          r.linkCount,
          r.totalViews,
          r.totalLikes,
          r.totalComments,
          r.totalShares,
        ]),
        `Platform breakdown · ${input.monthYm}`,
      ),
    );
  }

  if (input.monthlyRows.length > 0) {
    sections.push(
      numberedDetailSection(
        "Aylik izlenme kayitlari",
        ["Kaynak", "Izlenme", "URL", "Not"],
        input.monthlyRows.map((r) => [r.kaynak, r.izlenme, r.url, r.not]),
        `Filtre: ay = ${input.monthYm}`,
      ),
    );
  }

  if (input.reels.length > 0) {
    sections.push(
      numberedDetailSection(
        "Haftalik reel / icerik linkleri",
        ["Hafta", "Yayinci", "Platform", "Link", "Not"],
        input.reels.map((r) => [r.hafta, r.yayıncı ?? "-", r.platform, r.link, r.not]),
        `Filtre: ${input.monthYm} donemine dusen haftalar`,
      ),
    );
  }

  downloadProfessionalCsv({
    filename: `izlenme_${slug}_${input.monthYm}.csv`,
    metadata: {
      Uygulama: "Foxstream",
      "Rapor turu": "Marka izlenme",
      Marka: input.brandFullName,
      Donem: `${input.monthTitle} (${input.monthYm})`,
      "Olusturulma (TR)": fmtDateTime(new Date()),
    },
    sections,
  });
}
