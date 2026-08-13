import type { ContentExpense, KasaTransaction } from "@/store/store";

const ICEXP_TAG_RE = /\[ICEXP:[^\]]+\]/gi;
const ICEXP_LOOSE_RE = /\bICEXP\s*:\s*[0-9a-f-]{8,}\b/gi;
const ICEXP_BARE_RE = /^\[?ICEXP:([0-9a-f-]{8,})\]?$/i;
const HTTP_RE = /^https?:\/\//i;

/** Not / proof içinden içerik harcaması id’si. */
export function parseContentExpenseIdFromKasaBlob(
  ...parts: Array<string | undefined | null>
): string | null {
  const blob = parts.filter(Boolean).join(" ");
  if (!blob) return null;
  const bare = blob.trim().match(ICEXP_BARE_RE);
  if (bare?.[1]) return bare[1];
  const tagged = blob.match(/\[ICEXP:([^\]]+)\]/i);
  if (tagged?.[1]) return tagged[1];
  const loose = blob.match(/\bICEXP\s*:\s*([0-9a-f-]{8,})\b/i);
  return loose?.[1] ?? null;
}

/** UI notundan ICEXP etiketlerini temizle. */
export function stripICexpTags(notes: string): string {
  return notes
    .replace(ICEXP_TAG_RE, "")
    .replace(ICEXP_LOOSE_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Kanıt alanında gösterilmemesi gereken dahili etiket. */
export function isICexpProofValue(value: string): boolean {
  const v = value.trim();
  if (!v || HTTP_RE.test(v)) return false;
  return /ICEXP\s*:/i.test(v) || ICEXP_BARE_RE.test(v);
}

export type KasaProofItem = {
  href: string;
  kind: "image" | "link" | "txid";
  source: "expense" | "kasa";
  label: string;
};

export type ResolvedKasaProofs = {
  contentExpenseId?: string;
  expenseUrl?: string;
  extra?: { href: string; kind: "image" | "link" | "txid" };
  items: KasaProofItem[];
};

function kindOf(href: string): KasaProofItem["kind"] {
  if (
    /\.(png|jpe?g|gif|webp)(\?|$)/i.test(href) ||
    /supabase\.co\/storage/i.test(href) ||
    /gyazo\.com/i.test(href) ||
    /imgur\.com/i.test(href)
  ) {
    return "image";
  }
  if (HTTP_RE.test(href)) return "link";
  return "txid";
}

/** Gyazo sayfa linkini görsel URL’sine çevir. */
export function previewSrcForProof(href: string): string {
  const g = href.match(/gyazo\.com\/([0-9a-f]{32})/i);
  if (g) return `https://i.gyazo.com/${g[1]}.png`;
  return href;
}

function linkedContentExpense(
  tx: Pick<KasaTransaction, "id" | "proof" | "notes">,
  contentExpenses: ContentExpense[],
): ContentExpense | undefined {
  const taggedId = parseContentExpenseIdFromKasaBlob(tx.proof, tx.notes);
  return (
    contentExpenses.find((e) => e.kasaTxId === tx.id) ??
    (taggedId ? contentExpenses.find((e) => e.id === taggedId) : undefined)
  );
}

/**
 * Kasa satırındaki kanıtlar: Ramiz’in harcama SS’si + kasaya eklenen ekstra görsel/TXID.
 * İkisi aynı URL ise tek kez gösterilir.
 */
export function listKasaProofs(
  tx: Pick<KasaTransaction, "id" | "proof" | "notes">,
  contentExpenses: ContentExpense[],
): ResolvedKasaProofs {
  const expense = linkedContentExpense(tx, contentExpenses);
  const expenseUrl = expense?.screenshotUrl?.trim() || undefined;
  const proof = (tx.proof ?? "").trim();
  const extraRaw = proof && !isICexpProofValue(proof) ? proof : "";
  const extraIsDuplicate =
    !!extraRaw && !!expenseUrl && extraRaw === expenseUrl;

  const items: KasaProofItem[] = [];
  if (expenseUrl && HTTP_RE.test(expenseUrl)) {
    items.push({
      href: expenseUrl,
      kind: "image",
      source: "expense",
      label: "Harcama SS",
    });
  }

  let extra: ResolvedKasaProofs["extra"];
  if (extraRaw && !extraIsDuplicate) {
    extra = { href: extraRaw, kind: kindOf(extraRaw) };
    items.push({
      href: extraRaw,
      kind: extra.kind,
      source: "kasa",
      label: extra.kind === "txid" ? "TXID" : "Ek görsel",
    });
  }

  return {
    contentExpenseId: expense?.id,
    expenseUrl: expenseUrl && HTTP_RE.test(expenseUrl) ? expenseUrl : undefined,
    extra,
    items,
  };
}

/** ICEXP etiketini kanıt alanından notlara taşı — UI’de görünmesin. */
export function sanitizeKasaICexpProof<T extends { proof?: string; notes?: string }>(tx: T): T {
  const proof = (tx.proof ?? "").trim();
  if (!isICexpProofValue(proof)) return tx;
  const notes = /ICEXP/i.test(tx.notes ?? "")
    ? tx.notes
    : [tx.notes?.trim(), proof].filter(Boolean).join(" ");
  return { ...tx, proof: "", notes };
}

/** Formdaki ekstra kanıt — harcama SS’si ile aynıysa boş bırak (ikinci görsel eklensin). */
export function extraProofForForm(
  tx: Pick<KasaTransaction, "id" | "proof" | "notes"> | undefined,
  contentExpenses: ContentExpense[],
): string {
  if (!tx) return "";
  const listed = listKasaProofs(tx, contentExpenses);
  return listed.extra?.href ?? "";
}
