/** Sayı inputlarında `0` görünürken silinememe sorununu önler. */

export function numberInputDisplay(value: number | undefined | null): string {
  if (value === undefined || value === null || value === 0) return "";
  return String(value);
}

export function parseNumberInput(raw: string, fallback = 0): number {
  const t = raw.trim();
  if (t === "" || t === "-" || t === ".") return fallback;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOptionalNumberInput(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "" || t === "-" || t === ".") return undefined;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}
