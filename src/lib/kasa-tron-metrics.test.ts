import { describe, expect, it } from "vitest";
import {
  computeTronPanelMetrics,
  kasaPaymentBalance,
  kasaSelectOptionLabel,
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
});
