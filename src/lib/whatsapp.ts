export function normalizeWhatsAppPhone(phone: string) {
  return phone.replace(/[\s\-()]/g, "");
}

/**
 * Deja el numero como lo espera wa.me para un celular argentino: 549 + caracteristica + numero.
 * "0343 15-456-7890" o "3434567890" -> "5493434567890". Un numero que ya trae 54 se respeta.
 */
export function toWhatsAppNumber(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("54")) return digits.startsWith("549") || digits.length !== 12 ? digits : `549${digits.slice(2)}`;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? `549${digits}` : digits;
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = toWhatsAppNumber(phone);
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function hasArgentinaPrefix(phone: string) {
  return normalizeWhatsAppPhone(phone).startsWith("54");
}
