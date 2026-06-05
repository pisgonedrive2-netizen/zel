import type { KasaTransaction } from "@/store/store";

/** Genel Kasa ekranında listelenecek hareketler: defter + dahil TRON giderleri. */
export function transactionsForGenelKasaView(
  kasaTransactions: KasaTransaction[],
  genelKasaId: string,
  tronKasaId: string | undefined
): KasaTransaction[] {
  const genelRows = kasaTransactions.filter((t) => t.kasaId === genelKasaId);
  if (!tronKasaId) return [...genelRows].sort((a, b) => a.date.localeCompare(b.date));

  const tronIncluded = kasaTransactions.filter(
    (t) =>
      t.kasaId === tronKasaId &&
      t.direction === "out" &&
      Boolean(t.countInGenel)
  );

  return [...genelRows, ...tronIncluded].sort((a, b) => a.date.localeCompare(b.date));
}

export function isTronReflectedInGenelView(
  t: KasaTransaction,
  genelKasaId: string | undefined,
  tronKasaId: string | undefined
): boolean {
  if (!genelKasaId || !tronKasaId) return false;
  return (
    t.kasaId === tronKasaId &&
    t.direction === "out" &&
    Boolean(t.countInGenel)
  );
}

export function runningBalanceRows(rows: KasaTransaction[]) {
  let bal = 0;
  return rows.map((t) => {
    bal =
      t.direction === "in"
        ? bal + t.amountUsd
        : bal - t.amountUsd - t.feeUsd;
    return { ...t, balanceAfter: bal };
  });
}
