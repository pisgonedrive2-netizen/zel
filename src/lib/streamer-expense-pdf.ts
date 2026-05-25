/**
 * Yayıncı paneli — kişisel harcama raporu PDF (detaylı).
 */
import { jsPDF } from "jspdf";
import autoTableImport from "jspdf-autotable";
import { fmtDateTime } from "@/lib/fmt-date";
import { monthLabelTr } from "@/lib/month-label";
import type { ContentExpense } from "@/store/store";
import { isActiveContentExpense } from "@/lib/content-expense";

type AutoTableFn = (doc: jsPDF, options: Record<string, unknown>) => void;

function resolveAutoTable(): AutoTableFn {
  if (typeof autoTableImport === "function") {
    return autoTableImport as AutoTableFn;
  }
  const mod = autoTableImport as { default?: AutoTableFn; autoTable?: AutoTableFn };
  if (typeof mod.default === "function") return mod.default;
  if (typeof mod.autoTable === "function") return mod.autoTable;
  throw new Error("jspdf-autotable yüklenemedi");
}

const autoTable = resolveAutoTable();

function ascii(s: string | number | null | undefined): string {
  if (s == null) return "";
  const text = String(s);
  const map: Record<string, string> = {
    ş: "s", Ş: "S", ı: "i", İ: "I", ğ: "g", Ğ: "G",
    ü: "u", Ü: "U", ö: "o", Ö: "O", ç: "c", Ç: "C",
  };
  return [...text].map((c) => map[c] ?? c).join("");
}

function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(e: ContentExpense): string {
  if (e.reviewStatus === "approved") return e.paid ? "Onaylandi / Odendi" : "Onaylandi";
  if (e.reviewStatus === "rejected") return "Reddedildi";
  if (e.reviewStatus === "needs_info") return "Bilgi istendi";
  if (e.reviewStatus === "cancelled") return "Iptal / Geri cekildi";
  if (e.reviewStatus === "pending") return "Incelemede";
  return e.paid ? "Odendi" : "—";
}

function threadSummary(e: ContentExpense): string {
  const t = e.reviewThread ?? [];
  if (t.length === 0) return e.reviewerNote ? ascii(e.reviewerNote).slice(0, 80) : "";
  return t
    .map((m) => `${m.authorRole === "streamer" ? "Yayinci" : "Yonetici"}: ${ascii(m.message).slice(0, 60)}`)
    .join(" | ")
    .slice(0, 120);
}

export interface StreamerExpensePdfInput {
  employeeName: string;
  monthYm: string;
  expenses: ContentExpense[];
  generatedAt?: Date;
}

export function downloadStreamerExpensesPdf(input: StreamerExpensePdfInput): void {
  if (typeof window === "undefined") {
    throw new Error("PDF indirme yalnizca tarayicida kullanilabilir.");
  }

  const { employeeName, monthYm } = input;
  const rows = [...input.expenses]
    .filter((e) => e.month === monthYm)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const active = rows.filter(isActiveContentExpense);
  const pending = rows.filter((e) => e.reviewStatus === "pending");
  const approved = rows.filter((e) => e.reviewStatus === "approved");
  const paid = active.filter((e) => e.paid);
  const needsInfo = rows.filter((e) => e.reviewStatus === "needs_info");

  const sum = (list: ContentExpense[]) => list.reduce((s, e) => s + e.amountUsd, 0);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FOXSTREAM", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(ascii("Yayinci harcama raporu (detayli)"), pageWidth - 14, 12, { align: "right" });

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(ascii(employeeName), 14, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(ascii(`Donem: ${monthLabelTr(monthYm)} (${monthYm})`), 14, 34);
  doc.text(
    ascii(`Olusturulma: ${fmtDateTime(input.generatedAt ?? new Date())}`),
    14,
    39
  );

  autoTable(doc, {
    startY: 44,
    theme: "plain",
    body: [
      ["Toplam kayit", String(rows.length)],
      ["Aktif harcama", money(sum(active))],
      ["Incelemede", `${pending.length} · ${money(sum(pending))}`],
      ["Onayli", `${approved.length} · ${money(sum(approved))}`],
      ["Odenen", `${paid.length} · ${money(sum(paid))}`],
      ["Bilgi istendi", `${needsInfo.length} · ${money(sum(needsInfo))}`],
    ],
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 70;

  autoTable(doc, {
    startY: finalY + 4,
    head: [[
      "Tarih",
      "Marka",
      "Kategori",
      "Aciklama",
      "USD",
      "THB",
      "Durum",
      "Inceleme / Mesaj",
      "Kanıt",
    ]],
    body: rows.map((e) => [
      e.date,
      ascii(e.brandName),
      ascii(e.category),
      ascii(e.description).slice(0, 48),
      money(e.amountUsd),
      e.amountThb != null ? String(e.amountThb) : "—",
      statusLabel(e),
      threadSummary(e) || "—",
      e.screenshotUrl ? "Var" : "—",
    ]),
    styles: { fontSize: 7, cellPadding: 1.4, overflow: "linebreak" },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      4: { halign: "right", fontStyle: "bold" },
      3: { cellWidth: 42 },
      7: { cellWidth: 38 },
    },
    margin: { left: 10, right: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      ascii(`Foxstream · ${employeeName} · ${monthYm} · Sayfa ${i}/${pageCount}`),
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  const slug = ascii(employeeName).replace(/\s+/g, "_").slice(0, 24);
  doc.save(`harcamalarim_${slug}_${monthYm}.pdf`);
}
