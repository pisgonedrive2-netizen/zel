import { describe, expect, it } from "vitest";
import {
  computeKasaOperatingMetrics,
  computeTronPanelMetrics,
  kasaPaymentBalance,
  kasaSelectOptionLabel,
  sumOperatingKasaLedgerBalance,
} from "./kasa-tron-metrics";
import type { Kasa, KasaTransaction } from "@/store/store";

const genelKasa: Kasa = {
  id: "kasa-genel",
  name: "Genel Kasa",
  kind: "general",
  currency: "USDT",
  isDefault: true,
  archived: false,
  orderIndex: 0,
  notes: "",
};

const tronKasa: Kasa = {
  id: "kasa-tron",
  name: "Ramiz USDT",
  kind: "usdt",
  currency: "USDT",
  isDefault: false,
  archived: false,
  orderIndex: 1,
  notes: "",
  tronAddress: "TXabc",
};

describe("kasa payment balance", () => {
  it("Genel Kasa ödeme bakiyesi dahil TRON giderlerini düşer", () => {
    const kasaTransactions: KasaTransaction[] = [
      {
        id: "in-1",
        kasaId: "kasa-genel",
        date: "2026-06-01T10:00",
        direction: "in",
        amountUsd: 10_000,
        feeUsd: 0,
        purpose: "Giriş",
        counterparty: "",
        proof: "",
        notes: "",
      },
      {
        id: "tron-out",
        kasaId: "kasa-tron",
        date: "2026-06-02T10:00",
        direction: "out",
        amountUsd: 2_000,
        feeUsd: 4,
        purpose: "TRON harcama",
        counterparty: "",
        proof: "",
        notes: "",
        countInGenel: true,
        autoImported: true,
      },
    ];
    const kasas = [genelKasa, tronKasa];
    const panel = computeTronPanelMetrics(kasas, kasaTransactions);
    expect(kasaPaymentBalance("kasa-genel", kasas, kasaTransactions, panel)).toBe(7996);
    expect(kasaSelectOptionLabel(genelKasa, kasas, kasaTransactions, panel)).toContain("TRON");
  });

  it("Genel Kasa ödeme bakiyesi dahil TRON gelirlerini ekler", () => {
    const kasaTransactions: KasaTransaction[] = [
      {
        id: "in-genel",
        kasaId: "kasa-genel",
        date: "2026-06-01T10:00",
        direction: "in",
        amountUsd: 5_000,
        feeUsd: 0,
        purpose: "Giriş",
        counterparty: "",
        proof: "",
        notes: "",
      },
      {
        id: "tron-in",
        kasaId: "kasa-tron",
        date: "2026-06-03T10:00",
        direction: "in",
        amountUsd: 1_000,
        feeUsd: 0,
        purpose: "TRON gelen",
        counterparty: "",
        proof: "",
        notes: "",
        countInGenel: true,
        autoImported: true,
      },
    ];
    const kasas = [genelKasa, tronKasa];
    const panel = computeTronPanelMetrics(kasas, kasaTransactions);
    expect(kasaPaymentBalance("kasa-genel", kasas, kasaTransactions, panel)).toBe(6_000);
  });

  it("Toplam Kasa KPI: TRON cüzdanını saymaz, Genel'e dahil TRON gelir/giderini nettler", () => {
    // Gerçek senaryo: Genel Kasa giderleri TRON gelirleriyle finanse edilir.
    // Genel ledger −27.091,81 + dahil TRON gelir 27.226 − dahil TRON gider 134 ≈ 0.
    const kasaTransactions: KasaTransaction[] = [
      {
        id: "genel-out",
        kasaId: "kasa-genel",
        date: "2026-06-01T10:00",
        direction: "out",
        amountUsd: 27_091.81,
        feeUsd: 0,
        purpose: "Genel gider",
        counterparty: "",
        proof: "",
        notes: "",
      },
      {
        id: "tron-in",
        kasaId: "kasa-tron",
        date: "2026-06-02T10:00",
        direction: "in",
        amountUsd: 27_226,
        feeUsd: 0,
        purpose: "TRON gelen",
        counterparty: "",
        proof: "",
        notes: "",
        countInGenel: true,
        autoImported: true,
      },
      {
        id: "tron-out",
        kasaId: "kasa-tron",
        date: "2026-06-03T10:00",
        direction: "out",
        amountUsd: 134,
        feeUsd: 0,
        purpose: "TRON harcama",
        counterparty: "",
        proof: "",
        notes: "",
        countInGenel: true,
        autoImported: true,
      },
    ];
    const kasas = [genelKasa, tronKasa];
    const panel = computeTronPanelMetrics(kasas, kasaTransactions);
    // İşletme toplamı ≈ 0 (TRON cüzdan bakiyesi sayılmaz).
    expect(
      sumOperatingKasaLedgerBalance(kasas, kasaTransactions, panel),
    ).toBeCloseTo(0.19, 2);
    // Sunucu metriği de aynı sonucu verir (TRON gizli oturumlar için).
    const metrics = computeKasaOperatingMetrics(kasas, kasaTransactions);
    expect(metrics.operatingTotal).toBeCloseTo(0.19, 2);
    expect(metrics.genelDisplayBalance).toBeCloseTo(0.19, 2);
  });
});
