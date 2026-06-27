import { describe, expect, it } from "vitest";
import {
  canViewRamizWallet,
  filterKasaTransactionsForRamizViewer,
  isRamizTronAddress,
  maskRamizCounterparty,
  RAMIZ_EMPLOYEE_ID,
  sanitizeEmployeesForRamizViewer,
  TRON_KASA_ID,
} from "./ramiz-wallet-access";
import type { KasaTransaction } from "@/store/store";

describe("ramiz-wallet-access", () => {
  it("yalnızca orkun görebilir", () => {
    expect(canViewRamizWallet({ id: "u-admin", username: "orkun" })).toBe(true);
    expect(canViewRamizWallet({ id: "u-ediz", username: "ediz" })).toBe(false);
  });

  it("diğer adminler ve denetçi göremez", () => {
    expect(canViewRamizWallet({ id: "u-other", username: "admin2" })).toBe(false);
    expect(canViewRamizWallet({ id: "u-denetci", username: "denetci" })).toBe(false);
    expect(canViewRamizWallet({ id: "u-ramiz", username: "ramiz" })).toBe(false);
  });

  it("impersonation oturumunda tron görünmez", () => {
    expect(
      canViewRamizWallet({
        id: "u-ramiz",
        username: "ramiz",
        impersonatorId: "u-admin",
      }),
    ).toBe(false);
  });

  it("otomatik TRON işlemlerini filtreler", () => {
    const txs: KasaTransaction[] = [
      {
        id: "t1",
        kasaId: TRON_KASA_ID,
        date: "2026-06-01",
        direction: "in",
        amountUsd: 100,
        feeUsd: 0,
        purpose: "TRON",
        counterparty: "TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE",
        proof: "",
        notes: "",
        autoImported: true,
      },
      {
        id: "t2",
        kasaId: "kasa-genel",
        date: "2026-06-02",
        direction: "out",
        amountUsd: 50,
        feeUsd: 0,
        purpose: "Harcama",
        counterparty: "TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE",
        proof: "",
        notes: "",
      },
    ];
    const filtered = filterKasaTransactionsForRamizViewer(txs, false);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("t2");
    expect(filtered[0].counterparty).toBe("TRON cüzdan");
  });

  it("ramiz adresini tanır", () => {
    expect(isRamizTronAddress("TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE")).toBe(true);
    expect(maskRamizCounterparty("TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE")).toBe(
      "TRON cüzdan",
    );
  });

  it("ramiz çalışan cüzdanı bootstrap'ta boşaltılır", () => {
    const out = sanitizeEmployeesForRamizViewer(
      [{ id: RAMIZ_EMPLOYEE_ID, walletAddress: "TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE" } as never],
      false,
    );
    expect(out[0].walletAddress).toBe("");
  });
});
