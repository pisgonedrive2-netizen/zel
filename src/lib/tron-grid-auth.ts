/** Bilinen şirket TRON kasa cüzdanı (TronGrid senkron / bakiye). */
export const DEFAULT_TRON_KASA_ADDRESS = "TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE";

export function tronGridHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = apiKey?.trim();
  if (key) headers["TRON-PRO-API-KEY"] = key;
  return headers;
}

export function isTronGridAuthError(status: number): boolean {
  return status === 401 || status === 403;
}

/** Geçersiz anahtar 401 dönerse public tier ile tekrar dene. */
export function tronGridHeadersWithFallback(
  apiKey?: string,
  useKey = true
): Record<string, string> {
  return useKey ? tronGridHeaders(apiKey) : tronGridHeaders(undefined);
}
