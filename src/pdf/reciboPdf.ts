import type { ReciboFormValues } from "@/types/forms";
import { parseNumberish } from "@/lib/utils";
import { createPdf, loadImageDataUrl, sanitizeFileName } from "./common";

function toSpanish(n: number): string {
  const u = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve"];
  const d = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const c = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  if (n === 0) return "cero";
  if (n === 100) return "cien";
  if (n < 20) return u[n];
  if (n < 30) return n === 20 ? "veinte" : `veinti${toSpanish(n - 20)}`;
  if (n < 100) {
    const D = Math.floor(n / 10);
    const U = n % 10;
    return d[D] + (U ? ` y ${u[U]}` : "");
  }
  if (n < 1000) {
    const C = Math.floor(n / 100);
    const R = n % 100;
    return c[C] + (R ? ` ${toSpanish(R)}` : "");
  }
  if (n < 1_000_000) {
    const M = Math.floor(n / 1000);
    const R = n % 1000;
    return (M === 1 ? "mil" : `${toSpanish(M)} mil`) + (R ? ` ${toSpanish(R)}` : "");
  }
  const MI = Math.floor(n / 1_000_000);
  const R = n % 1_000_000;
  return (MI === 1 ? "un millon" : `${toSpanish(MI)} millones`) + (R ? ` ${toSpanish(R)}` : "");
}

export function amountToLetters(amount: number) {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  if (whole === 0) return `cero pesos con ${String(cents).padStart(2, "0")}/100`;
  return `${toSpanish(whole)} ${whole === 1 ? "peso" : "pesos"} con ${String(cents).padStart(2, "0")}/100`;
}

export async function generateReciboPdf(values: ReciboFormValues) {
  const doc = createPdf();

  const currency = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(Number(n || 0));

  const logo = await loadImageDataUrl("/logo-jd-negro.png");

  const drawField = (y: number, label: string, value = "") => {
    const L = 15;
    const R = 195;
    const LABEL_W = 62;
    const lineX1 = L + LABEL_W + 4;
    const lineY = y + 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${label}:`, L + LABEL_W, y, { align: "right" });
    doc.setLineWidth(0.3);
    doc.setDrawColor(160, 160, 160);
    doc.line(lineX1, lineY, R, lineY);
    doc.setDrawColor(0);
    if (value) {
      doc.setFont("helvetica", "normal");
      doc.text(value, lineX1 + 1.6, y - 0.2);
    }
  };

  const drawSection = (y: number, title: string) => {
    const L = 15;
    const W = 180;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(L - 1.5, y - 5, W + 3, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, L, y + 2);
    doc.setDrawColor(200, 200, 200);
    doc.line(L - 1.5, y + 5, L - 1.5 + W + 3, y + 5);
  };

  async function drawReceiptBlock(yStart: number, original: boolean) {
    let y = yStart;
    if (logo) {
      doc.addImage(logo, "PNG", 15, yStart - 4, 22, 10);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RECIBO", 105, yStart + 2, { align: "center" });
    doc.setFontSize(10);
    doc.text(original ? "ORIGINAL" : "DUPLICADO", 195, yStart + 2, { align: "right" });
    y = yStart + 14;

    drawField(y, "N°", values.reciboNro);
    y += 8;
    drawField(y, "Fecha", values.fecha);
    y += 8;
    drawField(y, "Tipo", values.tipo);
    y += 8;

    drawSection(y, "Quien paga");
    y += 10;
    drawField(y, "Apellido y Nombre / Razon Social", values.cliente);
    y += 8;
    drawField(y, "DNI / CUIT", values.doc);
    y += 8;
    drawField(y, "Domicilio", values.domicilio);
    y += 8;
    drawField(y, "Localidad / Provincia", values.localidad);
    y += 8;

    drawSection(y, "Concepto / Detalle");
    y += 10;
    const detailLines = doc.splitTextToSize(values.concepto || "—", 105);
    for (let i = 0; i < Math.max(3, detailLines.length); i += 1) {
      drawField(y, i === 0 ? "Detalle" : "", detailLines[i] ?? "");
      y += 8;
    }

    drawSection(y, "Importe");
    y += 10;
    const amount = parseNumberish(values.monto);
    drawField(y, "Monto (ARS)", currency(amount));
    y += 8;
    drawField(y, "En letras", values.montoLetras || amountToLetters(amount));
    y += 8;
    drawField(y, "Forma de pago", values.forma);
    y += 8;
    drawField(y, "Detalle del pago", values.detallePago);
    y += 8;

    drawSection(y, "Vehiculo (opcional)");
    y += 10;
    drawField(y, "Marca / Modelo", values.vehiculo);
    y += 8;
    drawField(y, "Dominio", values.vehiculoDominio.toUpperCase());
    y += 8;

    drawSection(y, "Observaciones");
    y += 10;
    const obsLines = doc.splitTextToSize(values.obs || "—", 105);
    for (let i = 0; i < Math.max(2, obsLines.length); i += 1) {
      drawField(y, i === 0 ? "Obs." : "", obsLines[i] ?? "");
      y += 8;
    }

    const firmaY = y + 14;
    doc.line(35, firmaY, 95, firmaY);
    doc.text("Firma / Aclaracion", 40, firmaY + 5);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Generado por Jesus Diaz Automotores", 105, y + 28, { align: "center" });
    doc.setTextColor(0);
  }

  await drawReceiptBlock(20, true);
  if (values.duplicado === "si") {
    doc.addPage();
    await drawReceiptBlock(20, false);
  }

  doc.save(`recibo_${values.reciboNro}_${sanitizeFileName(values.cliente || "sin_nombre")}.pdf`);
}
