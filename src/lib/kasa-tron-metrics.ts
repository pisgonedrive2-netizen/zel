import {
  DEFAULT_KASA_ID,
  calcKasaBalance,
  type Kasa,
  type KasaTransaction,
} from "@/store/store";

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

/** Bir TRON hareketi Genel Kasa giderine dahil edilebilir mi? (çıkış hareketi). */
export function isTronGenelEligible(t: KasaTransaction): boolean {
  return t.direction === "out";
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

  // TRON çıkış (harcama) hareketleri ve bunların Genel Kasa'ya dahil edilenleri.
  const tronOutRows = tronRows.filter(isTronGenelEligible);
  const includedRows = tronOutRows.filter((t) => t.countInGenel);
  const includedTronOut = includedRows.reduce((s, t) => s + t.amountUsd + t.feeUsd, 0);

  const harcamaKasa = balanceFor(genelRows);

  return {
    tronKasa,
    genelKasa,
    tronTotal: balanceFor(tronRows),
    ramizWallet: balanceFor(autoRows.length > 0 ? autoRows : tronRows),
    harcamaKasa,
    /** Genel Kasa bakiyesi + dahil edilen TRON harcamaları düşülmüş hali. */
    harcamaKasaWithTron: harcamaKasa - includedTronOut,
    /** Genel Kasa'ya dahil edilmiş TRON harcamalarının toplamı. */
    includedTronOut,
    includedTronCount: includedRows.length,
    tronOutCount: tronOutRows.length,
    tronTxCount: tronRows.length,
    autoTxCount: autoRows.length,
    harcamaTxCount: genelRows.length,
    tronAddress: tronKasa.tronAddress?.trim() ?? "",
  };
}

export type KasaDisplayBalance = {
  /** Kullanıcıya gösterilen net bakiye (işletme / cüzdan mantığına göre). */
  balance: number;
  /** Ham defter bakiyesi (o kasadaki tüm hareketler). */
  ledgerBalance: number;
  /** Kısa açıklama (TRON düşümü vb.). */
  sublabel?: string;
};

/**
 * Kasa seçici ve özet kartlarda gösterilecek bakiye.
 * Genel Kasa: dahil edilmiş TRON giderleri düşülmüş işletme bakiyesi.
 * TRON cüzdan: zincir üzerindeki toplam (giriş − çıkış).
 */
export function getKasaDisplayBalance(
  kasa: Kasa,
  kasas: Kasa[],
  kasaTransactions: KasaTransaction[],
  panel: ReturnType<typeof computeTronPanelMetrics> | null,
): KasaDisplayBalance {
  const ledgerBalance = calcKasaBalance(kasaTransactions, undefined, kasa.id);

  if (panel?.genelKasa?.id === kasa.id) {
    const balance = panel.harcamaKasaWithTron;
    const sublabel =
      panel.includedTronOut > 0
        ? `defter ${formatUsdtShort(ledgerBalance)} · TRON −${formatUsdtShort(panel.includedTronOut)}`
        : undefined;
    return { balance, ledgerBalance, sublabel };
  }

  if (panel?.tronKasa?.id === kasa.id) {
    return {
      balance: panel.tronTotal,
      ledgerBalance,
      sublabel: `Ramiz cüzdan ${formatUsdtShort(panel.ramizWallet)}`,
    };
  }

  return { balance: ledgerBalance, ledgerBalance };
}

function formatUsdtShort(n: number): string {
  return (
    n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) +
    " USDT"
  );
}

/** Tüm kasaların gösterim bakiyelerinin toplamı (çift sayım yapmaz). */
export function sumKasaDisplayBalances(
  kasas: Kasa[],
  kasaTransactions: KasaTransaction[],
): number {
  const panel = computeTronPanelMetrics(kasas, kasaTransactions);
  return kasas
    .filter((k) => !k.archived)
    .reduce(
      (s, k) => s + getKasaDisplayBalance(k, kasas, kasaTransactions, panel).balance,
      0,
    );
}
