/**
 * Kayıt talebi formu ve API — Faz A (Self-Serve Marka Kaydı) aktif.
 * Dışarıdan gelen marka temsilcileri `/api/brand-registrations` üzerinden
 * başvuru yapabilir; admin `/api/brand-registrations/:id/{approve,reject}`
 * ile yanıtlar. UI tarafı `REGISTRATION_ENABLED` bayrağına bakar.
 */
export const REGISTRATION_ENABLED = true;
