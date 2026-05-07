import { parseNumberish } from "@/lib/utils";

export function formatMoneyInput(value: string | number | null | undefined) {
  const numeric = parseNumberish(value ?? "");
  if (!numeric) return "";
  return numeric.toLocaleString("es-AR");
}

export function normalizeMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("es-AR");
}
