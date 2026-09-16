import { parseNumberish } from "@/lib/utils";
import type { OperacionFinalizadaValues, PresupuestoValues } from "@/types/salesDocuments";
import { createPdf, loadImageDataUrl, sanitizeFileName } from "./common";

type PdfKind = "presupuesto" | "operacion";

function moneyValue(value: string | undefined) {
  return Math.max(0, Math.round(parseNumberish(value ?? "")));
}

function formatMoney(value: number, currency: "ARS" | "USD") {
  return `${currency === "USD" ? "USD " : "$ "}${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

function safeText(value: string | undefined) {
  return value?.trim() || "—";
}

async function generateSalesPdf(values: PresupuestoValues | OperacionFinalizadaValues, kind: PdfKind) {
  const doc = createPdf({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await loadImageDataUrl("/logo-jd-negro.png");
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const navy: [number, number, number] = [18, 35, 64];
  const fuchsia: [number, number, number] = [238, 24, 128];
  let y = 18;

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Gestion JD · ${kind === "presupuesto" ? "Propuesta comercial" : "Documento interno de cierre"}`, margin, pageHeight - 8);
    doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - 17) return;
    footer();
    doc.addPage();
    y = 18;
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(kind === "presupuesto" ? "PRESUPUESTO · JESUS DIAZ AUTOMOTORES" : "OPERACIÓN FINALIZADA · JESUS DIAZ AUTOMOTORES", margin, y);
    doc.setDrawColor(...fuchsia);
    doc.setLineWidth(0.4);
    doc.line(margin, y + 3, pageWidth - margin, y + 3);
    y += 10;
  };

  const section = (title: string, rows: Array<[string, string]>) => {
    ensureSpace(19);
    doc.setFillColor(...navy);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, margin + 4, y + 5.5);
    doc.setTextColor(15, 23, 42);
    y += 14;
    rows.forEach(([label, value]) => {
      const wrapped = doc.splitTextToSize(safeText(value), pageWidth - margin * 2 - 48);
      wrapped.forEach((line, index) => {
        ensureSpace(8);
        doc.setFontSize(9);
        if (index === 0) {
          doc.setFont("helvetica", "bold");
          doc.text(`${label}:`, margin, y);
        }
        doc.setFont("helvetica", "normal");
        doc.text(line, margin + 46, y);
        y += 4.5;
      });
      y += 2;
    });
    y += 3;
  };

  // The source logo is horizontal (roughly 3:1). Keep that aspect ratio so it
  // is not compressed into a square in the generated document.
  if (logo) doc.addImage(logo, "PNG", margin, y - 5, 28, 9.2);
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("JESUS DIAZ AUTOMOTORES", margin + (logo ? 34 : 0), y + 2);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Fecha: ${safeText(values.fecha)}`, pageWidth - margin, y + 2, { align: "right" });
  y += 18;

  doc.setFillColor(...fuchsia);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 17, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(kind === "presupuesto" ? "PRESUPUESTO" : "OPERACIÓN FINALIZADA", pageWidth / 2, y + 7.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const validity = kind === "presupuesto" ? ` · Vigencia: ${safeText((values as PresupuestoValues).vigencia)}` : "";
  doc.text(`Moneda: ${values.moneda}${validity}`, pageWidth / 2, y + 13, { align: "center" });
  doc.setTextColor(15, 23, 42);
  y += 25;

  section("Datos del cliente", [["Nombre", values.nombre], ["Teléfono", values.telefono], ["DNI", values.dni]]);
  section("Vehículo", [
    ["Modelo", values.vehModelo], ["Año", values.vehAnio], ["Kilómetros", values.vehKm],
    ["Precio de venta", moneyValue(values.precioVenta) ? formatMoney(moneyValue(values.precioVenta), values.moneda) : "—"],
  ]);

  const cash = moneyValue(values.entregaEfectivo);
  const tradeIn = moneyValue(values.usadoToma);
  const financed = values.tomaCredito === "si" ? moneyValue(values.creditoTotal) : 0;
  const admin = moneyValue(values.gastosAdm);
  const transfer = moneyValue(values.transferencia);
  const salePrice = moneyValue(values.precioVenta);
  const total = salePrice + admin + transfer;
  const sameCurrency = values.tomaCredito !== "si" || values.creditoMoneda === values.moneda;
  const balance = sameCurrency ? Math.max(0, total - cash - tradeIn - financed) : null;

  section("Entrega y toma", [
    ["Efectivo", cash ? formatMoney(cash, values.moneda) : "—"],
    ["Vehículo en parte de pago", [values.usadoModelo, values.usadoAnio, values.usadoKm].filter(Boolean).join(" · ") || "—"],
    ["Valor de toma", tradeIn ? formatMoney(tradeIn, values.moneda) : "—"],
    ["Entrega total", formatMoney(cash + tradeIn, values.moneda)],
  ]);

  if (values.tomaCredito === "si") {
    section("Financiación", [
      ["Total financiado", financed ? formatMoney(financed, values.creditoMoneda || values.moneda) : "—"],
      ["Fecha de inicio", values.creditoFechaInicio],
      ["Número de cuotas", values.creditoNumeroCuotas || values.cuotasCant],
      ["Día de vencimiento", values.creditoDiaVencimiento],
      ["Detalle", values.cuotasCant],
    ]);
  }

  ensureSpace(58);
  doc.setDrawColor(...fuchsia);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 48, 3, 3);
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumen de la operación", margin + 5, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const summary: Array<[string, string]> = [["Precio de venta + gastos", formatMoney(total, values.moneda)], ["Entrega (efectivo + toma)", formatMoney(cash + tradeIn, values.moneda)], ["Financiación", formatMoney(financed, values.creditoMoneda || values.moneda)], ["Saldo pendiente", balance === null ? "Requiere conversión de moneda" : formatMoney(balance, values.moneda)]];
  summary.forEach(([label, amount], index) => {
    const rowY = y + 15 + index * 7;
    doc.text(label, margin + 5, rowY);
    doc.setFont("helvetica", "bold");
    doc.text(amount, pageWidth - margin - 5, rowY, { align: "right" });
    doc.setFont("helvetica", "normal");
  });
  y += 55;

  section("Condiciones económicas", [["Gastos administrativos", admin ? formatMoney(admin, values.moneda) : "—"], ["Transferencia", transfer ? formatMoney(transfer, values.moneda) : "—"], ["Detalles", values.detalles]]);

  const noteValues = kind === "presupuesto" ? (values as PresupuestoValues) : null;
  if (noteValues?.condiciones || noteValues?.notas || values.detalles) section("Notas y condiciones", [["Condiciones", noteValues?.condiciones ?? ""], ["Notas", noteValues?.notas || values.detalles]]);
  footer();
  const prefix = kind === "presupuesto" ? "presupuesto" : "operacion_finalizada";
  doc.save(`${prefix}_${sanitizeFileName(values.nombre || "cliente")}_${values.fecha.replaceAll("-", "")}.pdf`);
}

export async function generatePresupuestoPdf(values: PresupuestoValues) {
  return generateSalesPdf(values, "presupuesto");
}

export async function generateOperacionFinalizadaPdf(values: OperacionFinalizadaValues) {
  return generateSalesPdf(values, "operacion");
}
