import type { KasaTransaction } from "@/store/store";

const MUTABAKAT_RE = /\[mutabakat\]|mutabakat/i;

/** Fiili harcama / kasa düzeltmesi — bordro veya ICEXP bağlantısı yok. */
export function isKasaMutabakatTransaction(
  t: Pick<KasaTransaction, "purpose" | "notes">,
): boolean {
  return MUTABAKAT_RE.test(`${t.purpose ?? ""} ${t.notes ?? ""}`);
}

/** Kopyala-yapıştır amaç satırı (Ekim içerik kayıtsız tutar). */
export const KASA_MUTABAKAT_PURPOSE_EKIM_2026_ICERIK =
  "[Mutabakat] Ekim 2026 içerik — fiili harcama (kayıtsız kalemler)";
