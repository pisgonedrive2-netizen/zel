/**
 * Foxstream — aylık kasa / maaş / içerik harcaması dışa aktarım yardımcıları.
 *
 * jsPDF varsayılan fontları Latin-1 destekler; Türkçe karakterler için latin1ish
 * fallback uygulanır (ş→s, ı→i, ğ→g, ü→u, ö→o, ç→c). CSV dosyaları UTF-8 BOM ile
 * yazılır, Excel doğru şekilde açar.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { KasaTransaction, ContentExpense } from "@/store/store";

// ── Genel yardımcılar ─────────────────────────────────────────────────────

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
] as const;

export function monthLabelTr(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return ym;
  return `${MONTH_NAMES_TR[idx]} ${y}`;
}

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

function csvEscape(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(filename, new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
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
  const stamp = ascii(`Olusturulma: ${new Date().toLocaleString("tr-TR")}${opts.generatedBy ? " - " + opts.generatedBy : ""}`);
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
  const header = [
    "Tarih", "Saat", "Yön", "Tutar (USDT)", "Network Fee (USDT)",
    "Amaç", "Karşı Taraf", "Kanıt", "Notlar", "Bakiye Sonrası (USDT)",
  ];
  const body: (string | number)[][] = rows.map((t) => [
    t.date.slice(0, 10),
    t.date.slice(11, 16) || "",
    t.direction === "in" ? "Gelen" : "Giden",
    t.amountUsd,
    t.feeUsd,
    t.purpose,
    t.counterparty,
    t.proof,
    t.notes,
    Math.round(t.balanceAfter * 100) / 100,
  ]);
  const footer: (string | number)[][] = [
    [],
    ["Açılış bakiye", "", "", opts.openingBalance ?? 0],
    ["Toplam giriş", "", "", totalIn],
    ["Toplam çıkış", "", "", totalOut],
    ["Toplam fee", "", "", totalFee],
    ["Kapanış bakiye", "", "", Math.round(closing * 100) / 100],
  ];
  downloadCsv(`foxstream-kasa-${ym}.csv`, [header, ...body, ...footer]);
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
  doc.save(`foxstream-kasa-${ym}.pdf`);
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
  plannedTotalOut: number;
  totalPaidOut: number;
  paid: boolean;
  paidDate?: string;
  walletAddress: string;
}

export interface SalaryExportOptions {
  generatedBy?: string;
}

export function exportSalaryMonthCsv(rows: SalaryReportRow[], ym: string): void {
  const header = [
    "Ad", "Rol", "Departman", "Ödeme Günü",
    "Temel Maaş ($)", "Kira Desteği ($)",
    "Devir Avans ($)", "Bu Ay Avans ($)", "Açık Avans Bakiyesi ($)",
    "Ekstra / Prim ($)", "Kesinti ($)",
    "Net Ödenecek ($)", "İçerik Onaylı ($)", "Plan Toplamı ($)", "Ödenen Toplam ($)",
    "Ödeme Durumu", "Ödeme Tarihi", "Cüzdan Adresi",
  ];
  const body: (string | number)[][] = rows.map((r) => [
    r.name, r.role, r.department, r.paymentDay,
    r.baseSalary, r.rentSupport,
    r.carryForward, r.thisMonthAdvance, r.openAdvanceAfter,
    r.totalBonus, r.totalDeduction,
    r.netPayable, r.contentApproved, r.plannedTotalOut, r.totalPaidOut,
    r.paid ? "Ödendi" : "Bekliyor",
    r.paidDate ?? "", r.walletAddress ?? "",
  ]);
  const totalNet = rows.reduce((s, r) => s + r.netPayable, 0);
  const totalPlanned = rows.reduce((s, r) => s + r.plannedTotalOut, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaidOut, 0);
  const footer: (string | number)[][] = [
    [],
    ["TOPLAM", "", "", "", "", "", "", "", "", "", "", totalNet, "", totalPlanned, totalPaid],
  ];
  downloadCsv(`foxstream-maas-${ym}.csv`, [header, ...body, ...footer]);
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
  const totalPlanned = rows.reduce((s, r) => s + r.plannedTotalOut, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaidOut, 0);
  const paidCount = rows.filter((r) => r.paid).length;

  doc.setFontSize(11);
  doc.text(ascii(`Donem: ${monthLabelTr(ym)}`), 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    ascii(
      `Calisan: ${rows.length}    ` +
      `Odenen: ${paidCount}/${rows.length}    ` +
      `Net: ${money(totalNet)}    ` +
      `Icerik onayli: ${money(totalContent)}    ` +
      `Plan: ${money(totalPlanned)}    ` +
      `Odenen toplam: ${money(totalPaid)}`
    ),
    14,
    32
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 38,
    head: [[
      "Ad", "Rol", "Gun", "Temel", "Kira", "Devir", "Avans", "Acik bak.",
      "Prim", "Kesinti", "Net", "Icerik", "Plan", "Odenen", "Durum", "Cuzdan",
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
      money(r.plannedTotalOut),
      money(r.totalPaidOut),
      r.paid ? `Odendi ${r.paidDate ?? ""}` : "Bekliyor",
      r.walletAddress
        ? r.walletAddress.slice(0, 6) + "..." + r.walletAddress.slice(-4)
        : "—",
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
      12: { halign: "right", fontStyle: "bold" },
      13: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  if (rows.length === 0) {
    const y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
    doc.setFontSize(11);
    doc.setTextColor(150);
    doc.text(ascii("Bu ay icin bordrolu calisan yok."), 14, y + 14);
    doc.setTextColor(0);
  }

  drawPdfFooters(doc);
  doc.save(`foxstream-maas-${ym}.pdf`);
}

// ── İçerik harcamaları ───────────────────────────────────────────────────

export interface ContentExpenseExportRow extends ContentExpense {
  /** Yayıncı adı (UI tarafında eklenir). */
  employeeName?: string;
}

export function exportContentExpensesCsv(
  rows: ContentExpenseExportRow[],
  ym: string
): void {
  const header = [
    "Tarih", "Ay", "Yayıncı", "Marka", "Kategori", "Açıklama",
    "Tutar (USD)", "Tutar (THB)", "Durum", "İnceleme Notu", "Ödeme Tarihi", "Notlar",
  ];
  const body: (string | number)[][] = rows.map((e) => {
    const review =
      e.reviewStatus === "approved" ? "Onayli" :
      e.reviewStatus === "rejected" ? "Reddedildi" :
      e.reviewStatus === "needs_info" ? "Bilgi istendi" :
      e.reviewStatus === "cancelled" ? "Iptal" :
      e.reviewStatus === "pending" ? "Inceleme" : "Manuel";
    return [
      e.date, e.month, e.employeeName ?? "", e.brandName, e.category,
      e.description, e.amountUsd, e.amountThb ?? "",
      `${review}${e.paid ? " - Odendi" : ""}`,
      e.reviewerNote ?? "",
      e.paidDate ?? "",
      e.notes ?? "",
    ];
  });
  const total = rows.reduce((s, r) => s + r.amountUsd, 0);
  const paid = rows.filter((r) => r.paid).reduce((s, r) => s + r.amountUsd, 0);
  const footer: (string | number)[][] = [
    [],
    ["TOPLAM", "", "", "", "", "", total],
    ["ODENDI", "", "", "", "", "", paid],
  ];
  downloadCsv(`foxstream-icerik-harcamalari-${ym}.csv`, [header, ...body, ...footer]);
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
  const total = rows.reduce((s, r) => s + r.amountUsd, 0);
  const paid = rows.filter((r) => r.paid).reduce((s, r) => s + r.amountUsd, 0);
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
  doc.save(`foxstream-icerik-${ym}.pdf`);
}

// ── Tekil ay listesi (UI seçici için) ────────────────────────────────────

/** Verilen tarihler ve mevcut aydan, kayıtların kapsadığı YYYY-MM listesi. */
export function listAvailableMonths(dates: string[]): string[] {
  const set = new Set<string>();
  for (const d of dates) {
    if (typeof d === "string" && /^\d{4}-\d{2}/.test(d)) set.add(d.slice(0, 7));
  }
  const now = new Date();
  set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
