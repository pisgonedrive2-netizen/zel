import { DEFAULT_KASA_ID, type Kasa, type KasaTransaction } from "@/store/store";

function balanceFor(rows: KasaTransaction[]) {
  return rows.reduce(
    (b, t) => (t.direction === "in" ? b + t.amountUsd : b - t.amountUsd - t.feeUsd),
    0
  );
}

export function findGenelKasa(kasas: Kasa[]) {
  return (
    kasas.find((k) => k.id === DEFAULT_KASA_ID) ??
    kasas.find((k) => k.isDefault && !k.tronAddress && !k.archived) ??
    kasas.find((k) => !k.archived && !k.tronAddress) ??
    null
  );
}

export function findPrimaryTronKasa(kasas: Kasa[], kasaTransactions: KasaTransaction[]) {
  const candidates = kasas.filter((k) => Boolean(k.tronAddress));
  if (candidates.length === 0) return null;
  const txCount = new Map<string, number>();
  for (const t of kasaTransactions) {
    txCount.set(t.kasaId, (txCount.get(t.kasaId) ?? 0) + 1);
  }
  candidates.sort((a, b) => {
    const byCount = (txCount.get(b.id) ?? 0) - (txCount.get(a.id) ?? 0);
    if (byCount !== 0) return byCount;
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  return candidates[0] ?? null;
}

/** TRON paneli: Ramiz cüzdanı (otomatik) + harcama kasası (Genel Kasa) ayrı gösterilir. */
export function computeTronPanelMetrics(kasas: Kasa[], kasaTransactions: KasaTransaction[]) {
  const tronKasa = findPrimaryTronKasa(kasas, kasaTransactions);
  const genelKasa = findGenelKasa(kasas);
  if (!tronKasa) return null;

  const tronRows = kasaTransactions.filter((t) => t.kasaId === tronKasa.id);
  const autoRows = tronRows.filter((t) => t.autoImported);
  const genelRows = genelKasa
    ? kasaTransactions.filter((t) => t.kasaId === genelKasa.id)
    : [];

  return {
    tronKasa,
    genelKasa,
    tronTotal: balanceFor(tronRows),
    ramizWallet: balanceFor(autoRows.length > 0 ? autoRows : tronRows),
    harcamaKasa: balanceFor(genelRows),
    tronTxCount: tronRows.length,
    autoTxCount: autoRows.length,
    harcamaTxCount: genelRows.length,
    tronAddress: tronKasa.tronAddress?.trim() ?? "",
  };
}
