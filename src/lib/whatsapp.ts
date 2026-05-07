export function normalizeWhatsAppPhone(phone: string) {
  return phone.replace(/[\s\-()]/g, "");
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function hasArgentinaPrefix(phone: string) {
  return normalizeWhatsAppPhone(phone).startsWith("54");
}
