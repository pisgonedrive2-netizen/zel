/** API / store: düz metin PIN — newPin veya pin alanından (hash değil). */
export function resolvePlainPin(input: {
  newPin?: string | null;
  pin?: string | null;
}): string | undefined {
  const fromNew = input.newPin?.trim();
  if (fromNew) return validatePlainPin(fromNew);
  const fromPin = input.pin?.trim();
  if (!fromPin || fromPin === "***") return undefined;
  return validatePlainPin(fromPin);
}

/** Açık PIN güncellemesi — boş veya maskelenmiş değerleri reddeder. */
export function validatePlainPin(pin: string): string | undefined {
  const t = pin.trim();
  if (!t || t === "***") return undefined;
  if (t.length < 4) return undefined;
  return t;
}
