/** API / store: düz metin PIN — newPin veya pin alanından (hash değil). */
export function resolvePlainPin(input: {
  newPin?: string | null;
  pin?: string | null;
}): string | undefined {
  const fromNew = input.newPin?.trim();
  if (fromNew) return fromNew;
  const fromPin = input.pin?.trim();
  if (!fromPin || fromPin === "***") return undefined;
  return fromPin;
}
