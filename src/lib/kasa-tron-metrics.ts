import {
  DEFAULT_KASA_ID,
  calcKasaBalance,
  type Kasa,
  type KasaTransaction,
} from "@/store/store";
import { fmt } from "@/lib/data";

export type TronPanelMetrics = ReturnType<typeof computeTronPanelMetrics>;

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
  const candidates = kasas.filter(
    (k) => Boolean(k.tronAddress?.trim()) && !k.archived,
  );
  if (candidates.length === 0) return null;

  const usdtKasas = candidates.filter((k) => k.kind === "usdt");
  const pool =
    usdtKasas.length > 0
      ? usdtKasas
      : candidates.filter(
          (k) => !/test/i.test(k.name) && !k.id.toLowerCase().includes("test"),
        );
  const ranked = pool.length > 0 ? pool : candidates;

  const txCount = new Map<string, number>();
  for (const t of kasaTransactions) {
    txCount.set(t.kasaId, (txCount.get(t.kasaId) ?? 0) + 1);
  }
  ranked.sort((a, b) => {
    const byCount = (txCount.get(b.id) ?? 0) - (txCount.get(a.id) ?? 0);
    if (byCount !== 0) return byCount;
    if (a.kind === "usdt" && b.kind !== "usdt") return -1;
    if (b.kind === "usdt" && a.kind !== "usdt") return 1;
    return a.name.localeCompare(b.name);
  });
  return ranked[0] ?? null;
}

/** TRON cüzdan hareketi Genel Kasa ile eşleştirilebilir mi? (gelen veya giden). */
export function isTronGenelToggleable(
  t: KasaTransaction,
  tronKasaId?: string,
): boolean {
  return Boolean(
    tronKasaId &&
      t.kasaId === tronKasaId &&
      (t.direction === "in" || t.direction === "out"),
  );
}

/** @deprecated Out-only alias; yeni kod `isTronGenelToggleable` kullanmalı. */
export function isTronGenelEligible(t: KasaTransaction): boolean {
  return t.direction === "out";
}

function tronGenelSignedAmount(t: KasaTransaction): number {
  if (t.direction === "in") return t.amountUsd;
  return t.amountUsd + t.feeUsd;
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

  const tronOutRows = tronRows.filter((t) => t.direction === "out");
  const tronInRows = tronRows.filter((t) => t.direction === "in");
  const includedOutRows = tronOutRows.filter((t) => t.countInGenel);
  const includedInRows = tronInRows.filter((t) => t.countInGenel);
  const includedTronOut = includedOutRows.reduce((s, t) => s + tronGenelSignedAmount(t), 0);
  const includedTronIn = includedInRows.reduce((s, t) => s + tronGenelSignedAmount(t), 0);

  const harcamaKasa = balanceFor(genelRows);

  return {
    tronKasa,
    genelKasa,
    tronTotal: balanceFor(tronRows),
    ramizWallet: balanceFor(autoRows.length > 0 ? autoRows : tronRows),
    harcamaKasa,
    /** Genel Kasa bakiyesi + dahil TRON gelir − dahil TRON gider. */
    harcamaKasaWithTron: harcamaKasa - includedTronOut + includedTronIn,
    /** Genel Kasa'ya dahil edilmiş TRON giderlerinin toplamı. */
    includedTronOut,
    /** Genel Kasa'ya dahil edilmiş TRON gelirlerinin toplamı. */
    includedTronIn,
    includedTronCount: includedOutRows.length + includedInRows.length,
    includedTronOutCount: includedOutRows.length,
    includedTronInCount: includedInRows.length,
    tronOutCount: tronOutRows.length,
    tronInCount: tronInRows.length,
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
    const parts: string[] = [];
    if (panel.includedTronOut > 0) {
      parts.push(`TRON gider −${formatUsdtShort(panel.includedTronOut)}`);
    }
    if (panel.includedTronIn > 0) {
      parts.push(`TRON gelir +${formatUsdtShort(panel.includedTronIn)}`);
    }
    const sublabel =
      parts.length > 0
        ? `defter ${formatUsdtShort(ledgerBalance)} · ${parts.join(" · ")}`
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

/** Ödeme formlarında kullanılacak kullanılabilir bakiye (Genel Kasa'da TRON düşümü dahil). */
export function kasaPaymentBalance(
  kasaId: string,
  kasas: Kasa[],
  kasaTransactions: KasaTransaction[],
  panel: TronPanelMetrics | null = computeTronPanelMetrics(kasas, kasaTransactions),
): number {
  const kasa = kasas.find((k) => k.id === kasaId);
  if (!kasa) return 0;
  return getKasaDisplayBalance(kasa, kasas, kasaTransactions, panel).balance;
}

/** Kasa seçici etiketi — kasa sayfasındaki işletme bakiyesi ile uyumlu. */
export function kasaSelectOptionLabel(
  kasa: Kasa,
  kasas: Kasa[],
  kasaTransactions: KasaTransaction[],
  panel: TronPanelMetrics | null = computeTronPanelMetrics(kasas, kasaTransactions),
): string {
  const { balance, ledgerBalance } = getKasaDisplayBalance(kasa, kasas, kasaTransactions, panel);
  if (panel?.genelKasa?.id === kasa.id && balance !== ledgerBalance) {
    const hints: string[] = [];
    if ((panel.includedTronOut ?? 0) > 0) hints.push(`gider −${fmt(panel.includedTronOut)}`);
    if ((panel.includedTronIn ?? 0) > 0) hints.push(`gelir +${fmt(panel.includedTronIn)}`);
    if (hints.length > 0) return `${kasa.name} · ${fmt(balance)} (TRON ${hints.join(", ")})`;
  }
  return `${kasa.name} · ${fmt(balance)}`;
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
