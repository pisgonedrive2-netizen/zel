import type { ContentExpense, KasaTransaction } from "@/store/store";

const ICEXP_TAG_RE = /\[ICEXP:([^\]]+)\]/g;
const ICEXP_BARE_RE = /^\[?ICEXP:([0-9a-f-]{8,})\]?$/i;

/** Not / proof içinden içerik harcaması id’si. */
export function parseContentExpenseIdFromKasaBlob(
  ...parts: Array<string | undefined | null>
): string | null {
  const blob = parts.filter(Boolean).join(" ");
  if (!blob) return null;
  const bare = blob.trim().match(ICEXP_BARE_RE);
  if (bare?.[1]) return bare[1];
  const m = blob.match(/\[ICEXP:([^\]]+)\]/);
  return m?.[1] ?? null;
}

/** UI notundan ICEXP etiketlerini temizle. */
export function stripICexpTags(notes: string): string {
  return notes.replace(ICEXP_TAG_RE, "").replace(/\s{2,}/g, " ").trim();
}

export type ResolvedKasaProof = {
  /** Açılabilir kanıt URL’si (screenshot / dekont / http). */
  url?: string;
  /** Ham proof (TXID vb.) — URL değilse. */
  raw?: string;
  contentExpenseId?: string;
  /** Kaynak: kasa proof alanı veya içerik harcaması screenshot. */
  source: "proof" | "expense" | "none";
};

/**
 * Kasa satırının kanıtını çöz.
 * İçerik harcaması ödemelerinde proof boş / ICEXP tag olabilir;
 * asıl SS `contentExpenses.screenshotUrl` üzerindedir.
 */
export function resolveKasaProof(
  tx: Pick<KasaTransaction, "id" | "proof" | "notes">,
  contentExpenses: ContentExpense[],
): ResolvedKasaProof {
  const proof = (tx.proof ?? "").trim();
  const taggedId = parseContentExpenseIdFromKasaBlob(proof, tx.notes);
  const byTx = contentExpenses.find((e) => e.kasaTxId === tx.id);
  const byTag = taggedId
    ? contentExpenses.find((e) => e.id === taggedId)
    : undefined;
  const expense = byTx ?? byTag;

  const isICexpOnly = !!proof && !!parseContentExpenseIdFromKasaBlob(proof) && !/^https?:\/\//i.test(proof);

  if (proof && /^https?:\/\//i.test(proof) && !isICexpOnly) {
    return {
      url: proof,
      contentExpenseId: expense?.id,
      source: "proof",
    };
  }

  const shot = expense?.screenshotUrl?.trim();
  if (shot && /^https?:\/\//i.test(shot)) {
    return {
      url: shot,
      contentExpenseId: expense?.id,
      source: "expense",
    };
  }

  if (proof && !isICexpOnly) {
    return { raw: proof, contentExpenseId: expense?.id, source: "proof" };
  }

  return {
    contentExpenseId: expense?.id,
    source: expense ? "expense" : "none",
  };
}
