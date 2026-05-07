import type { PresupuestoFormValues } from "@/types/forms";
import { parseNumberish } from "@/lib/utils";
import { createPdf, loadImageDataUrl, sanitizeFileName } from "./common";

function parseMoney(v: string) {
  return Math.max(0, Math.round(parseNumberish(v)));
}

function formatNumberAR(n: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n || 0);
}

function formatMoney(n: number, moneda: "ARS" | "USD") {
  const sym = moneda === "USD" ? "USD " : "$ ";
  return `${sym}${formatNumberAR(n)}`;
}

export async function generatePresupuestoPdf(values: PresupuestoFormValues) {
  const doc = createPdf({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await loadImageDataUrl("/logo-jd-negro.png");
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  const entregaEfectivo = parseMoney(values.entregaEfectivo);
  const usadoToma = parseMoney(values.usadoToma);
  const entregaTotal = entregaEfectivo + usadoToma;
  const tomaCredito = values.tomaCredito === "si";
  const creditoTotal = tomaCredito ? parseMoney(values.creditoTotal) : 0;
  const gastosAdm = parseMoney(values.gastosAdm);
  const transferencia = parseMoney(values.transferencia);
  const creditoIncluyeExtras = tomaCredito && creditoTotal > 0 && (gastosAdm > 0 || transferencia > 0);
  const totalOperacion = entregaTotal + creditoTotal + (creditoIncluyeExtras ? 0 : gastosAdm + transferencia);

  if (logo) {
    doc.addImage(logo, "PNG", margin, y - 6, 14, 14);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Jesus Diaz Automotores", margin + (logo ? 18 : 0), y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Fecha: ${values.fecha}`, pageW - margin, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PRESUPUESTO", pageW / 2, y + 6, { align: "center" });
  y += 16;

  const ensureSpace = (needed: number) => {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSection = (title: string, lines: Array<{ label: string; value: string | string[] }>) => {
    ensureSpace(30);
    doc.setDrawColor(229);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    lines.forEach((line) => {
      ensureSpace(12);
      doc.text(`${line.label}:`, margin, y);
      if (Array.isArray(line.value)) {
        line.value.forEach((entry) => {
          doc.text(entry, margin + 44, y);
          y += 5;
        });
      } else {
        const wrapped = doc.splitTextToSize(line.value || "—", pageW - margin * 2 - 44);
        doc.text(wrapped, margin + 44, y);
        y += wrapped.length * 5;
      }
    });
    y += 4;
  };

  drawSection("Datos del cliente", [
    { label: "Nombre", value: values.nombre || "—" },
    { label: "Telefono", value: values.telefono || "—" },
    { label: "DNI", value: values.dni || "—" },
    { label: "Detalles", value: values.detalles || "—" },
  ]);

  drawSection("Vehiculo", [
    { label: "Modelo", value: values.vehModelo || "—" },
    { label: "Año", value: values.vehAnio || "—" },
    { label: "KM", value: values.vehKm || "—" },
    { label: "Valor de venta", value: parseMoney(values.precioVenta) ? formatMoney(parseMoney(values.precioVenta), values.moneda) : "—" },
  ]);

  const entregaLines: Array<{ label: string; value: string | string[] }> = [];
  if (entregaEfectivo > 0) entregaLines.push({ label: "Efectivo", value: formatMoney(entregaEfectivo, values.moneda) });
  if (values.usadoModelo || values.usadoAnio || values.usadoKm || usadoToma > 0) {
    const usedDetails = [];
    if (values.usadoModelo) usedDetails.push(`Modelo: ${values.usadoModelo}`);
    if (values.usadoAnio) usedDetails.push(`Año: ${values.usadoAnio}`);
    if (values.usadoKm) usedDetails.push(`KM: ${values.usadoKm}`);
    if (usadoToma > 0) usedDetails.push(`Precio de toma: ${formatMoney(usadoToma, values.moneda)}`);
    entregaLines.push({ label: "Vehiculo usado (toma)", value: usedDetails });
  }
  if (entregaLines.length) {
    entregaLines.push({ label: "Entrega total", value: formatMoney(entregaTotal, values.moneda) });
    drawSection("Entrega", entregaLines);
  }

  if (tomaCredito) {
    drawSection("Financiacion", [
      { label: "Total del credito", value: creditoTotal ? formatMoney(creditoTotal, values.moneda) : "—" },
      { label: "Cantidad de cuotas", value: values.cuotasCant || "—" },
    ]);
  }

  drawSection("Gastos", [
    { label: "Gastos administrativos", value: gastosAdm ? formatMoney(gastosAdm, values.moneda) : "—" },
    { label: "Transferencia", value: transferencia ? formatMoney(transferencia, values.moneda) : "—" },
  ]);

  ensureSpace(45);
  doc.setDrawColor(17);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, pageW - margin * 2, 40, 3, 3);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumen de operacion", margin + 4, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const resumen: Array<[string, number]> = [];
  if (entregaEfectivo > 0) resumen.push(["Entrega de efectivo", entregaEfectivo]);
  if (usadoToma > 0) resumen.push(["Toma de auto", usadoToma]);
  if (creditoTotal > 0) resumen.push(["Financiacion", creditoTotal]);
  if (gastosAdm > 0) resumen.push([creditoIncluyeExtras ? "Gastos administrativos (incl.)" : "Gastos administrativos", gastosAdm]);
  if (transferencia > 0) resumen.push([creditoIncluyeExtras ? "Transferencia (incl.)" : "Transferencia", transferencia]);

  resumen.forEach(([label, amount]) => {
    doc.text(`${label}:`, margin + 4, y);
    doc.setFont("helvetica", "bold");
    doc.text(formatMoney(amount, values.moneda), pageW - margin - 4, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 6;
  });

  doc.line(margin + 4, y, pageW - margin - 4, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TOTAL OPERACION:", margin + 4, y);
  doc.text(formatMoney(totalOperacion, values.moneda), pageW - margin - 4, y, { align: "right" });

  doc.save(`presupuesto_${sanitizeFileName(values.nombre || "cliente")}_${values.fecha.replaceAll("-", "")}.pdf`);
}
