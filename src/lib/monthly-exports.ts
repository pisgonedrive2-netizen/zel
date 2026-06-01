/**
 * Foxstream — aylık kasa / maaş / içerik harcaması dışa aktarım yardımcıları.
 *
 * jsPDF varsayılan fontları Latin-1 destekler; Türkçe karakterler için latin1ish
 * fallback uygulanır (ş→s, ı→i, ğ→g, ü→u, ö→o, ç→c). CSV dosyaları UTF-8 BOM ile
 * yazılır, Excel doğru şekilde açar.
 */
import { jsPDF } from "jspdf";
import { fmtDateTime } from "@/lib/fmt-date";
import autoTableImport from "jspdf-autotable";

import type { KasaTransaction, ContentExpense } from "@/store/store";
import { settlementLabel } from "@/lib/content-expense";
import { listAvailableMonths, monthLabelTr } from "@/lib/month-label";
import {
  downloadProfessionalCsv,
  numberedDetailSection,
  summarySection,
  totalRow,
  type CsvReport,
} from "@/lib/professional-csv";

export { listAvailableMonths, monthLabelTr };

// jspdf-autotable v5: bundler'a göre default veya named export gelebilir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AutoTableFn = (doc: jsPDF, options: any) => void;

function resolveAutoTable(): AutoTableFn {
  if (typeof autoTableImport === "function") {
    return autoTableImport as AutoTableFn;
  }
  const mod = autoTableImport as {
    default?: AutoTableFn;
    autoTable?: AutoTableFn;
  };
  if (typeof mod.default === "function") return mod.default;
  if (typeof mod.autoTable === "function") return mod.autoTable;
  throw new Error("jspdf-autotable yüklenemedi — PDF dışa aktarımı kullanılamıyor.");
}

const autoTable = resolveAutoTable();

// ── Genel yardımcılar ─────────────────────────────────────────────────────

/** Türkçe karakterleri ASCII'ye düşürür — jsPDF varsayılan fontu için. */
function ascii(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  const text = String(s);
  const map: Record<string, string> = {
    ş: "s", Ş: "S", ı: "i", İ: "I", ğ: "g", Ğ: "G",
    ü: "u", Ü: "U", ö: "o", Ö: "O", ç: "c", Ç: "C",
    â: "a", Â: "A", î: "i", Î: "I", û: "u", Û: "U",
  };
  return [...text].map((c) => map[c] ?? c).join("");
}

function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function moneyUsdt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " USDT";
}

function reportMeta(rapor: string, ym: string, extra?: Record<string, string>): CsvReport["metadata"] {
  return {
    Uygulama: "Foxstream",
    "Rapor turu": rapor,
    Donem: `${monthLabelTr(ym)} (${ym})`,
    "Olusturulma (TR)": fmtDateTime(new Date()),
    "Para birimi": "USDT",
    ...extra,
  };
}

function assertBrowserDownload(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("İndirme yalnızca tarayıcıda kullanılabilir.");
  }
}

function downloadBlob(filename: string, blob: Blob): void {
  assertBrowserDownload();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Safari / bazı mobil tarayıcılar: revoke önce olursa indirme iptal olabilir.
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 300);
}

function savePdf(doc: jsPDF, filename: string): void {
  assertBrowserDownload();
  doc.save(filename);
}

function safeSlug(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
}

/** Professional PDF header + footer applier. */
function drawPdfChrome(
  doc: jsPDF,
  opts: { title: string; subtitle: string; month: string; generatedBy?: string }
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("FOXSTREAM", 14, 11);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(ascii(opts.title), 14, 16);
  doc.setFontSize(9);
  const right = ascii(`${opts.subtitle} - ${monthLabelTr(opts.month)}`);
  const rightWidth = doc.getTextWidth(right);
  doc.text(right, pageWidth - 14 - rightWidth, 11);
  const stamp = ascii(`Olusturulma: ${fmtDateTime(new Date())}${opts.generatedBy ? " - " + opts.generatedBy : ""}`);
  const stampW = doc.getTextWidth(stamp);
  doc.text(stamp, pageWidth - 14 - stampW, 16);
  doc.setTextColor(0, 0, 0);
}

function drawPdfFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const left = ascii("Foxstream Mali Yonetim Paneli - foxstreaming.vercel.app");
    doc.text(left, 14, pageHeight - 6);
    const right = ascii(`Sayfa ${i}/${total}`);
    const rw = doc.getTextWidth(right);
    doc.text(right, pageWidth - 14 - rw, pageHeight - 6);
  }
  doc.setTextColor(0, 0, 0);
}

// ── Kasa ──────────────────────────────────────────────────────────────────

export interface KasaExportOptions {
  /** Aydan önce kalan kasa devir (USDT). PDF/CSV özetinde gösterilir. */
  openingBalance?: number;
  /** Aktif kullanıcı (PDF kabağına yazılır). */
  generatedBy?: string;
}

function filterKasaByMonth(tx: KasaTransaction[], ym: string): KasaTransaction[] {
  return tx
    .filter((t) => t.date.startsWith(ym))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function summarizeKasa(tx: KasaTransaction[], opening: number) {
  let bal = opening;
  const rows = tx.map((t) => {
    bal = t.direction === "in" ? bal + t.amountUsd : bal - t.amountUsd - t.feeUsd;
    return { ...t, balanceAfter: bal };
  });
  const totalIn = tx.filter((t) => t.direction === "in").reduce((s, t) => s + t.amountUsd, 0);
  const totalOut = tx.filter((t) => t.direction === "out").reduce((s, t) => s + t.amountUsd, 0);
  const totalFee = tx.reduce((s, t) => s + t.feeUsd, 0);
  return { rows, totalIn, totalOut, totalFee, closing: bal };
}

export function exportKasaMonthCsv(
  all: KasaTransaction[],
  ym: string,
  opts: KasaExportOptions = {}
): void {
  const tx = filterKasaByMonth(all, ym);
  const { rows, totalIn, totalOut, totalFee, closing } = summarizeKasa(tx, opts.openingBalance ?? 0);
  const opening = opts.openingBalance ?? 0;

  const detailCols = [
    "Tarih",
    "Saat",
    "Yon",
    "Tutar_USDT",
    "Network_Fee_USDT",
    "Amac",
    "Karsi_Taraf",
    "Kanit_URL",
    "Notlar",
    "Bakiye_Sonrasi_USDT",
  ];
  const detailRows = rows.map((t) => [
    t.date.slice(0, 10),
    t.date.slice(11, 16) || "",
    t.direction === "in" ? "Gelen" : "Giden",
    Math.round(t.amountUsd * 100) / 100,
    Math.round(t.feeUsd * 100) / 100,
    t.purpose,
    t.counterparty,
    t.proof,
    t.notes,
    Math.round(t.balanceAfter * 100) / 100,
  ]);

  const colCount = detailCols.length + 1;
  const detail = numberedDetailSection(
    "Kasa hareketleri",
    detailCols,
    [
      ...detailRows,
      totalRow(colCount, "TOPLAM / OZET", {
        1: "",
        4: totalIn,
        5: totalFee,
      }),
    ],
    `Filtre: tarih ${ym}-* | ${rows.length} hareket | Excel: baslik satirina filtre uygulayin`,
  );

  const report: CsvReport = {
    filename: `foxstream-kasa-${ym}.csv`,
    metadata: reportMeta("Kasa aylik hareketleri", ym, {
      Filtre: `Ay = ${ym}`,
      "Kayit sayisi": String(rows.length),
      "Olusturan": opts.generatedBy ?? "",
    }),
    sections: [
      summarySection("Finansal ozet", [
        { metric: "Acilis bakiyesi", value: opening, unit: "USDT" },
        { metric: "Toplam giris", value: totalIn, unit: "USDT" },
        { metric: "Toplam cikis", value: totalOut, unit: "USDT" },
        { metric: "Toplam network fee", value: totalFee, unit: "USDT" },
        { metric: "Kapanis bakiyesi", value: Math.round(closing * 100) / 100, unit: "USDT" },
      ]),
      detail,
    ],
  };
  downloadProfessionalCsv(report);
}

// ── Kasa: serbest tarih aralığı ───────────────────────────────────────────

export interface KasaRangeExportOptions {
  /** Aralık başlangıcından önceki devir bakiye (USDT). */
  openingBalance?: number;
  generatedBy?: string;
}

/** [from, to] (YYYY-MM-DD), her ikisi de dahil. */
function filterKasaByRange(tx: KasaTransaction[], from: string, to: string): KasaTransaction[] {
  return tx
    .filter((t) => {
      const d = t.date.slice(0, 10);
      return d >= from && d <= to;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function exportKasaRangeCsv(
  all: KasaTransaction[],
  from: string,
  to: string,
  opts: KasaRangeExportOptions = {}
): void {
  const tx = filterKasaByRange(all, from, to);
  const { rows, totalIn, totalOut, totalFee, closing } = summarizeKasa(tx, opts.openingBalance ?? 0);
  const opening = opts.openingBalance ?? 0;
  const rangeLabel = `${from} → ${to}`;

  const detailCols = [
    "Tarih", "Saat", "Yon", "Tutar_USDT", "Network_Fee_USDT",
    "Amac", "Karsi_Taraf", "Kanit_URL", "Notlar", "Bakiye_Sonrasi_USDT",
  ];
  const detailRows = rows.map((t) => [
    t.date.slice(0, 10),
    t.date.slice(11, 16) || "",
    t.direction === "in" ? "Gelen" : "Giden",
    Math.round(t.amountUsd * 100) / 100,
    Math.round(t.feeUsd * 100) / 100,
    t.purpose,
    t.counterparty,
    t.proof,
    t.notes,
    Math.round(t.balanceAfter * 100) / 100,
  ]);

  const colCount = detailCols.length + 1;
  const detail = numberedDetailSection(
    "Kasa hareketleri",
    detailCols,
    [
      ...detailRows,
      totalRow(colCount, "TOPLAM / OZET", { 1: "", 4: totalIn, 5: totalFee }),
    ],
    `Filtre: ${rangeLabel} | ${rows.length} hareket`,
  );

  downloadProfessionalCsv({
    filename: `foxstream-kasa-${from}_${to}.csv`,
    metadata: {
      Uygulama: "Foxstream",
      "Rapor turu": "Kasa hareketleri (tarih araligi)",
      Donem: rangeLabel,
      "Olusturulma (TR)": fmtDateTime(new Date()),
      "Para birimi": "USDT",
      "Kayit sayisi": String(rows.length),
      "Olusturan": opts.generatedBy ?? "",
    },
    sections: [
      summarySection("Finansal ozet", [
        { metric: "Acilis bakiyesi", value: opening, unit: "USDT" },
        { metric: "Toplam giris", value: totalIn, unit: "USDT" },
        { metric: "Toplam cikis", value: totalOut, unit: "USDT" },
        { metric: "Toplam network fee", value: totalFee, unit: "USDT" },
        { metric: "Kapanis bakiyesi", value: Math.round(closing * 100) / 100, unit: "USDT" },
      ]),
      detail,
    ],
  });
}

export function exportKasaRangePdf(
  all: KasaTransaction[],
  from: string,
  to: string,
  opts: KasaRangeExportOptions = {}
): void {
  const tx = filterKasaByRange(all, from, to);
  const { rows, totalIn, totalOut, totalFee, closing } = summarizeKasa(tx, opts.openingBalance ?? 0);
  const rangeLabel = `${from} - ${to}`;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("FOXSTREAM", 14, 11);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(ascii("Kasa Hareketleri (Tarih Araligi)"), 14, 16);
  const right = ascii(`Kasa Raporu - ${rangeLabel}`);
  doc.text(right, pageWidth - 14 - doc.getTextWidth(right), 11);
  const stamp = ascii(`Olusturulma: ${fmtDateTime(new Date())}${opts.generatedBy ? " - " + opts.generatedBy : ""}`);
  doc.text(stamp, pageWidth - 14 - doc.getTextWidth(stamp), 16);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(11);
  doc.text(ascii(`Aralik: ${rangeLabel}`), 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    ascii(
      `Acilis bakiye: ${moneyUsdt(opts.openingBalance ?? 0)}    ` +
      `Toplam giris: ${moneyUsdt(totalIn)}    ` +
      `Toplam cikis: ${moneyUsdt(totalOut)}    ` +
      `Fee: ${moneyUsdt(totalFee)}    ` +
      `Kapanis bakiye: ${moneyUsdt(closing)}`
    ),
    14, 32
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 38,
    head: [["Tarih", "Saat", "Yon", "Tutar", "Fee", "Amac", "Karsi Taraf", "Bakiye"]],
    body: rows.map((t) => [
      t.date.slice(0, 10),
      t.date.slice(11, 16) || "—",
      t.direction === "in" ? "Gelen" : "Giden",
      moneyUsdt(t.amountUsd),
      t.feeUsd > 0 ? moneyUsdt(t.feeUsd) : "—",
      ascii(t.purpose),
      ascii(t.counterparty || "—"),
      moneyUsdt(t.balanceAfter),
    ]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: {
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  if (rows.length === 0) {
    const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
    doc.setFontSize(11);
    doc.setTextColor(150);
    doc.text(ascii("Bu aralik icin kayitli kasa hareketi yok."), 14, y + 14);
    doc.setTextColor(0);
  }

  drawPdfFooters(doc);
  savePdf(doc, `foxstream-kasa-${from}_${to}.pdf`);
}

export function exportKasaMonthPdf(
  all: KasaTransaction[],
  ym: string,
  opts: KasaExportOptions = {}
): void {
  const tx = filterKasaByMonth(all, ym);
  const { rows, totalIn, totalOut, totalFee, closing } = summarizeKasa(tx, opts.openingBalance ?? 0);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawPdfChrome(doc, {
    title: "Kasa Aylık Hareketleri",
    subtitle: "Kasa Raporu",
    month: ym,
    generatedBy: opts.generatedBy,
  });

  doc.setFontSize(11);
  doc.text(ascii(`Donem: ${monthLabelTr(ym)}`), 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    ascii(
      `Acilis bakiye: ${moneyUsdt(opts.openingBalance ?? 0)}    ` +
      `Toplam giris: ${moneyUsdt(totalIn)}    ` +
      `Toplam cikis: ${moneyUsdt(totalOut)}    ` +
      `Fee: ${moneyUsdt(totalFee)}    ` +
      `Kapanis bakiye: ${moneyUsdt(closing)}`
    ),
    14,
    32
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 38,
    head: [["Tarih", "Saat", "Yon", "Tutar", "Fee", "Amac", "Karsi Taraf", "Bakiye"]],
    body: rows.map((t) => [
      t.date.slice(0, 10),
      t.date.slice(11, 16) || "—",
      t.direction === "in" ? "Gelen" : "Giden",
      moneyUsdt(t.amountUsd),
      t.feeUsd > 0 ? moneyUsdt(t.feeUsd) : "—",
      ascii(t.purpose),
      ascii(t.counterparty || "—"),
      moneyUsdt(t.balanceAfter),
    ]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: {
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  if (rows.length === 0) {
    const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
    doc.setFontSize(11);
    doc.setTextColor(150);
    doc.text(ascii("Bu ay icin kayitli kasa hareketi yok."), 14, y + 14);
    doc.setTextColor(0);
  }

  drawPdfFooters(doc);
  savePdf(doc, `foxstream-kasa-${ym}.pdf`);
}

// ── Maaş raporu ───────────────────────────────────────────────────────────

export interface SalaryReportRow {
  name: string;
  role: string;
  department: string;
  paymentDay: string;
  baseSalary: number;
  rentSupport: number;
  carryForward: number;
  thisMonthAdvance: number;
  openAdvanceAfter: number;
  totalBonus: number;
  totalDeduction: number;
  netPayable: number;
  contentApproved: number;
  /** Bordroya işlenmiş (maaşa masraf) içerik toplamı. */
  contentPayrollSettled: number;
  plannedTotalOut: number;
  totalPaidOut: number;
  paid: boolean;
  paidDate?: string;
  walletAddress: string;
}

export interface SalaryContentExportLine {
  employeeName: string;
  date: string;
  brandName: string;
  category: string;
  description: string;
  amountUsd: number;
  settlement: string;
}

export interface SalaryUpcomingRow {
  name: string;
  role: string;
  paymentDay: string;
  payrollStartMonth: string;
  estimatedNet: number;
}

export interface SalaryExportOptions {
  generatedBy?: string;
  contentLines?: SalaryContentExportLine[];
  upcomingRows?: SalaryUpcomingRow[];
}

export function exportSalaryMonthCsv(rows: SalaryReportRow[], ym: string): void {
  const totalNet = rows.reduce((s, r) => s + r.netPayable, 0);
  const totalBase = rows.reduce((s, r) => s + r.baseSalary, 0);
  const totalPlanned = rows.reduce((s, r) => s + r.plannedTotalOut, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaidOut, 0);
  const totalContent = rows.reduce((s, r) => s + r.contentApproved, 0);
  const totalContentPayroll = rows.reduce((s, r) => s + (r.contentPayrollSettled ?? 0), 0);
  const paidCount = rows.filter((r) => r.paid).length;

  const detailCols = [
    "Ad_Soyad",
    "Rol",
    "Departman",
    "Odeme_Gunu",
    "Temel_Maas_USDT",
    "Kira_Destegi_USDT",
    "Devir_Avans_USDT",
    "Bu_Ay_Avans_USDT",
    "Acik_Avans_Bakiye_USDT",
    "Ekstra_Prim_USDT",
    "Kesinti_USDT",
    "Net_Odenecek_USDT",
    "Icerik_Onayli_USDT",
    "Icerik_Bordro_USDT",
    "Plan_Toplami_USDT",
    "Odenen_Toplam_USDT",
    "Odeme_Durumu",
    "Odeme_Tarihi",
    "Cuzdan_Adresi",
  ];
  const detailRows = rows.map((r) => [
    r.name,
    r.role,
    r.department,
    r.paymentDay,
    r.baseSalary,
    r.rentSupport,
    r.carryForward,
    r.thisMonthAdvance,
    r.openAdvanceAfter,
    r.totalBonus,
    r.totalDeduction,
    r.netPayable,
    r.contentApproved,
    r.contentPayrollSettled ?? 0,
    r.plannedTotalOut,
    r.totalPaidOut,
    r.paid ? "Odendi" : "Bekliyor",
    r.paidDate ?? "",
    r.walletAddress ?? "",
  ]);

  const colCount = detailCols.length + 1;
  const detail = numberedDetailSection(
    "Bordro detay",
    detailCols,
    [
      ...detailRows,
      totalRow(colCount, "GENEL TOPLAM", {
        1: `${rows.length} calisan`,
        5: totalBase,
        12: Math.round(totalNet * 100) / 100,
        13: Math.round(totalContent * 100) / 100,
        14: Math.round(totalContentPayroll * 100) / 100,
        15: Math.round(totalPlanned * 100) / 100,
        16: Math.round(totalPaid * 100) / 100,
        17: `${paidCount}/${rows.length} odendi`,
      }),
    ],
    `Filtre: bordro aktif calisanlar | donem ${ym}`,
  );

  downloadProfessionalCsv({
    filename: `foxstream-maas-${ym}.csv`,
    metadata: reportMeta("Aylik maas bordrosu", ym, {
      "Calisan sayisi": String(rows.length),
      "Odenen / toplam": `${paidCount} / ${rows.length}`,
    }),
    sections: [
      summarySection("Bordro ozeti", [
        { metric: "Calisan sayisi", value: rows.length, unit: "kisi" },
        { metric: "Temel maas toplami", value: Math.round(totalBase * 100) / 100, unit: "USDT" },
        { metric: "Net odenecek toplam", value: Math.round(totalNet * 100) / 100, unit: "USDT" },
        { metric: "Icerik onayli toplam", value: Math.round(totalContent * 100) / 100, unit: "USDT" },
        { metric: "Icerik bordro toplam", value: Math.round(totalContentPayroll * 100) / 100, unit: "USDT" },
        { metric: "Plan toplami", value: Math.round(totalPlanned * 100) / 100, unit: "USDT" },
        { metric: "Odenen toplam", value: Math.round(totalPaid * 100) / 100, unit: "USDT" },
      ]),
      detail,
    ],
  });
}

/** Bordro PDF/CSV için ay içi içerik harcaması satırları. */
export function buildSalaryContentExportLines(
  ym: string,
  employees: Array<{ id: string; name: string }>,
  expenses: ContentExpense[],
): SalaryContentExportLine[] {
  const byId = new Map(employees.map((e) => [e.id, e.name]));
  return expenses
    .filter(
      (e) =>
        e.month === ym &&
        byId.has(e.employeeId) &&
        e.reviewStatus !== "cancelled" &&
        e.reviewStatus !== "rejected",
    )
    .sort((a, b) => {
      const na = byId.get(a.employeeId) ?? "";
      const nb = byId.get(b.employeeId) ?? "";
      if (na !== nb) return na.localeCompare(nb, "tr");
      return b.date.localeCompare(a.date);
    })
    .map((e) => ({
      employeeName: byId.get(e.employeeId) ?? e.employeeId,
      date: e.date,
      brandName: e.brandName,
      category: e.category,
      description: e.description,
      amountUsd: e.amountUsd,
      settlement: settlementLabel(e),
    }));
}

export function exportSalaryMonthPdf(
  rows: SalaryReportRow[],
  ym: string,
  opts: SalaryExportOptions = {}
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawPdfChrome(doc, {
    title: "Aylik Maas Bordrosu",
    subtitle: "Bordro",
    month: ym,
    generatedBy: opts.generatedBy,
  });

  const totalNet = rows.reduce((s, r) => s + r.netPayable, 0);
  const totalContent = rows.reduce((s, r) => s + r.contentApproved, 0);
  const totalContentPayroll = rows.reduce((s, r) => s + (r.contentPayrollSettled ?? 0), 0);
  const totalPlanned = rows.reduce((s, r) => s + r.plannedTotalOut, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaidOut, 0);
  const paidCount = rows.filter((r) => r.paid).length;
  const contentLines = opts.contentLines ?? [];
  const upcomingRows = opts.upcomingRows ?? [];

  doc.setFontSize(11);
  doc.text(ascii(`Donem: ${monthLabelTr(ym)}`), 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    ascii(
      `Calisan: ${rows.length}    ` +
      `Odenen: ${paidCount}/${rows.length}    ` +
      `Net: ${money(totalNet)}    ` +
      `Icerik bek.: ${money(totalContent)}    ` +
      `Icerik bordro: ${money(totalContentPayroll)}    ` +
      `Plan: ${money(totalPlanned)}    ` +
      `Odenen: ${money(totalPaid)}`
    ),
    14,
    32
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 38,
    head: [[
      "Ad", "Rol", "Gun", "Temel", "Kira", "Devir", "Avans", "Acik",
      "Prim", "Kes.", "Net", "Ic bek", "Ic brd", "Plan", "Odenen", "Durum",
    ]],
    body: rows.map((r) => [
      ascii(r.name),
      ascii(r.role),
      r.paymentDay,
      money(r.baseSalary),
      r.rentSupport > 0 ? money(r.rentSupport) : "—",
      r.carryForward > 0 ? money(r.carryForward) : "—",
      r.thisMonthAdvance > 0 ? money(r.thisMonthAdvance) : "—",
      r.openAdvanceAfter > 0 ? money(r.openAdvanceAfter) : "—",
      r.totalBonus > 0 ? money(r.totalBonus) : "—",
      r.totalDeduction > 0 ? money(r.totalDeduction) : "—",
      money(r.netPayable),
      r.contentApproved > 0 ? money(r.contentApproved) : "—",
      (r.contentPayrollSettled ?? 0) > 0 ? money(r.contentPayrollSettled ?? 0) : "—",
      money(r.plannedTotalOut),
      money(r.totalPaidOut),
      r.paid ? `Odendi ${r.paidDate ?? ""}` : "Bekliyor",
    ]),
    styles: { fontSize: 7, cellPadding: 1.4 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right", fontStyle: "bold" },
      11: { halign: "right" },
      12: { halign: "right" },
      13: { halign: "right", fontStyle: "bold" },
      14: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  let nextY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(150);
    doc.text(ascii("Bu ay icin bordrolu calisan yok."), 14, nextY + 14);
    doc.setTextColor(0);
    nextY += 20;
  }

  if (upcomingRows.length > 0) {
    if (nextY > 170) {
      doc.addPage();
      nextY = 20;
    }
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(ascii("Ilk bordrosu bu aydan sonra baslayacaklar"), 14, nextY + 8);
    autoTable(doc, {
      startY: nextY + 12,
      head: [["Ad", "Rol", "Odeme gunu", "Ilk bordro ayi", "Tahmini net (1-5)"]],
      body: upcomingRows.map((u) => [
        ascii(u.name),
        ascii(u.role),
        u.paymentDay,
        ascii(monthLabelTr(u.payrollStartMonth)),
        money(u.estimatedNet),
      ]),
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    nextY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY;
  }

  if (contentLines.length > 0) {
    doc.addPage();
    drawPdfChrome(doc, {
      title: "Icerik Harcamalari",
      subtitle: "Bordro eki",
      month: ym,
      generatedBy: opts.generatedBy,
    });
    doc.setFontSize(11);
    doc.text(ascii(`Donem: ${monthLabelTr(ym)} · ${contentLines.length} kalem`), 14, 26);
    const contentTotal = contentLines.reduce((s, l) => s + l.amountUsd, 0);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(ascii(`Toplam: ${money(contentTotal)}`), 14, 32);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 38,
      head: [["Yayinci", "Tarih", "Marka", "Kategori", "Aciklama", "USD", "Odeme"]],
      body: contentLines.map((l) => [
        ascii(l.employeeName),
        l.date,
        ascii(l.brandName),
        ascii(l.category),
        ascii(l.description.slice(0, 72)),
        money(l.amountUsd),
        ascii(l.settlement),
      ]),
      styles: { fontSize: 7, cellPadding: 1.4 },
      headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 243, 255] },
      columnStyles: {
        5: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });
  }

  drawPdfFooters(doc);
  savePdf(doc, `foxstream-maas-${ym}.pdf`);
}

// ── İçerik harcamaları ───────────────────────────────────────────────────

export interface ContentExpenseExportRow extends ContentExpense {
  /** Yayıncı adı (UI tarafında eklenir). */
  employeeName?: string;
}

function contentReviewLabel(e: ContentExpenseExportRow): string {
  if (e.reviewStatus === "approved") return "Onaylandi";
  if (e.reviewStatus === "rejected") return "Reddedildi";
  if (e.reviewStatus === "needs_info") return "Bilgi_istendi";
  if (e.reviewStatus === "cancelled") return "Iptal";
  if (e.reviewStatus === "pending") return "Incelemede";
  return "Manuel";
}

export function exportContentExpensesCsv(
  rows: ContentExpenseExportRow[],
  ym: string
): void {
  const activeRows = rows.filter(
    (r) => r.reviewStatus !== "cancelled" && r.reviewStatus !== "rejected",
  );
  const total = activeRows.reduce((s, r) => s + r.amountUsd, 0);
  const paid = activeRows.filter((r) => r.paid).reduce((s, r) => s + r.amountUsd, 0);
  const approved = activeRows.filter((r) => r.reviewStatus === "approved").reduce((s, r) => s + r.amountUsd, 0);

  const detailCols = [
    "Tarih",
    "Ay",
    "Yayinci",
    "Marka",
    "Kategori",
    "Aciklama",
    "Tutar_USD",
    "Tutar_THB",
    "Inceleme_Durumu",
    "Odeme_Durumu",
    "Inceleme_Notu",
    "Odeme_Tarihi",
    "Notlar",
  ];
  const detailRows = rows.map((e) => [
    e.date,
    e.month,
    e.employeeName ?? "",
    e.brandName,
    e.category,
    e.description,
    Math.round(e.amountUsd * 100) / 100,
    e.amountThb ?? "",
    contentReviewLabel(e),
    e.paid ? "Odendi" : "Odenmedi",
    e.reviewerNote ?? "",
    e.paidDate ?? "",
    e.notes ?? "",
  ]);

  const colCount = detailCols.length + 1;
  const detail = numberedDetailSection(
    "Harcama kayitlari",
    detailCols,
    [
      ...detailRows,
      totalRow(colCount, "TOPLAM (aktif kayitlar)", {
        7: Math.round(total * 100) / 100,
      }),
      totalRow(colCount, "TOPLAM (onayli)", {
        7: Math.round(approved * 100) / 100,
      }),
      totalRow(colCount, "TOPLAM (odenen)", {
        7: Math.round(paid * 100) / 100,
      }),
    ],
    `Filtre: ay=${ym} | iptal/red toplamlara dahil degil | ${rows.length} satir`,
  );

  downloadProfessionalCsv({
    filename: `foxstream-icerik-harcamalari-${ym}.csv`,
    metadata: reportMeta("Icerik harcamalari", ym, {
      Filtre: `Ay = ${ym}`,
      "Toplam kayit": String(rows.length),
      "Aktif kayit (toplamda)": String(activeRows.length),
    }),
    sections: [
      summarySection("Finansal ozet", [
        { metric: "Aktif harcama toplami", value: Math.round(total * 100) / 100, unit: "USD", note: "Iptal/red haric" },
        { metric: "Onayli toplam", value: Math.round(approved * 100) / 100, unit: "USD" },
        { metric: "Odenen toplam", value: Math.round(paid * 100) / 100, unit: "USD" },
        { metric: "Bekleyen (aktif-odenen)", value: Math.round((total - paid) * 100) / 100, unit: "USD" },
      ]),
      detail,
    ],
  });
}

export function exportContentExpensesPdf(
  rows: ContentExpenseExportRow[],
  ym: string,
  opts: SalaryExportOptions = {}
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawPdfChrome(doc, {
    title: "Icerik Harcamalari",
    subtitle: "Icerik raporu",
    month: ym,
    generatedBy: opts.generatedBy,
  });
  const activeRows = rows.filter(
    (r) => r.reviewStatus !== "cancelled" && r.reviewStatus !== "rejected",
  );
  const total = activeRows.reduce((s, r) => s + r.amountUsd, 0);
  const paid = activeRows.filter((r) => r.paid).reduce((s, r) => s + r.amountUsd, 0);
  doc.setFontSize(11);
  doc.text(ascii(`Donem: ${monthLabelTr(ym)}`), 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    ascii(`Kayit: ${rows.length}    Toplam: ${money(total)}    Odenen: ${money(paid)}`),
    14,
    32
  );
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 38,
    head: [["Tarih", "Yayinci", "Marka", "Kategori", "Aciklama", "USD", "Durum"]],
    body: rows.map((e) => [
      e.date,
      ascii(e.employeeName ?? ""),
      ascii(e.brandName),
      ascii(e.category),
      ascii(e.description),
      money(e.amountUsd),
      e.paid
        ? "Odendi"
        : e.reviewStatus === "approved"
        ? "Onayli"
        : e.reviewStatus === "rejected"
        ? "Reddedildi"
        : e.reviewStatus === "needs_info"
        ? "Bilgi istendi"
        : e.reviewStatus === "pending"
        ? "Inceleme"
        : "—",
    ]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: { 5: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });
  drawPdfFooters(doc);
  savePdf(doc, `foxstream-icerik-${ym}.pdf`);
}
