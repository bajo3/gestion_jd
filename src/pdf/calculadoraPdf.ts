import type { Installment } from "@/lib/installments";
import { formatCurrency } from "@/lib/utils";
import { createPdf, drawPdfLogo, loadImageDataUrl, savePdf } from "./common";

const NAVY: [number, number, number] = [18, 35, 64];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const BAND: [number, number, number] = [241, 245, 249];

export type CalculadoraPdfData = {
  valorAuto: number;
  montoFinanciado: number;
  entrega: number;
  porcentajeQuebranto: number;
  quebrantoNeto: number;
  ivaQuebranto: number;
  quebrantoFinal: number;
  porcentajePatentamiento: number;
  patentamiento: number;
  totalInicial: number;
  plazo: string;
  tna: string;
  campana: string;
  cuotas: Installment[];
};

const MARGIN = 14;
const ROW = 6.2;

/** PDF de la operacion estimada: la cuenta del quebranto y el detalle de cada cuota. */
export async function generateCalculadoraPdf(data: CalculadoraPdfData) {
  const doc = createPdf({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const logo = await loadImageDataUrl("/logo-jd-negro.png");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const right = pageWidth - MARGIN;
  let y = MARGIN;

  drawPdfLogo(doc, logo, MARGIN, y, 38);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...NAVY);
  doc.text("Operacion estimada 0 km", right, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(new Date().toLocaleDateString("es-AR"), right, y + 11.5, { align: "right" });
  y += 20;

  const line = (label: string, value: string, strong = false) => {
    if (strong) {
      doc.setFillColor(...BAND);
      doc.rect(MARGIN, y - 4.4, right - MARGIN, ROW, "F");
    }
    doc.setFont("helvetica", strong ? "bold" : "normal").setFontSize(10).setTextColor(...(strong ? NAVY : MUTED));
    doc.text(label, MARGIN + 2, y);
    doc.setFont("helvetica", "bold").setTextColor(...NAVY);
    doc.text(value, right - 2, y, { align: "right" });
    y += ROW;
  };

  line("Valor del vehiculo", formatCurrency(data.valorAuto));
  line("Monto financiado", `- ${formatCurrency(data.montoFinanciado)}`);
  line("Entrega", formatCurrency(data.entrega), true);
  line(`Quebranto (${data.porcentajeQuebranto}%)`, `+ ${formatCurrency(data.quebrantoNeto)}`);
  if (data.ivaQuebranto) line("IVA del quebranto", `+ ${formatCurrency(data.ivaQuebranto)}`);
  line("Quebranto final", formatCurrency(data.quebrantoFinal), true);
  if (data.patentamiento) line(`Patentamiento (${data.porcentajePatentamiento}%)`, `+ ${formatCurrency(data.patentamiento)}`);
  line("Total inicial estimado", formatCurrency(data.totalInicial), true);
  y += 2;
  if (data.plazo) line("Plazo", data.plazo);
  if (data.tna) line("TNA", data.tna);
  if (data.campana) line("Campana", data.campana);
  y += 4;

  if (data.cuotas.length) {
    const columns = [
      { label: "CUOTA", width: 22, align: "left" as const },
      { label: "CAPITAL", width: 40, align: "right" as const },
      { label: "INTERES", width: 40, align: "right" as const },
      { label: "VALOR CUOTA", width: 40, align: "right" as const },
      { label: "SALDO", width: 40, align: "right" as const },
    ];
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const startX = MARGIN + (right - MARGIN - tableWidth) / 2;

    const header = () => {
      doc.setFillColor(...NAVY);
      doc.rect(startX, y - 4.4, tableWidth, ROW, "F");
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(255, 255, 255);
      let x = startX;
      for (const column of columns) {
        doc.text(column.label, column.align === "right" ? x + column.width - 2 : x + 2, y, { align: column.align });
        x += column.width;
      }
      y += ROW;
    };

    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY);
    doc.text(`Detalle de ${data.cuotas.length} cuotas`, startX, y);
    y += 6;
    header();

    data.cuotas.forEach((cuota, index) => {
      if (y > pageHeight - MARGIN - 8) {
        doc.addPage();
        y = MARGIN + 4;
        header();
      }
      if (index % 2 === 1) {
        doc.setFillColor(...BAND);
        doc.rect(startX, y - 4.4, tableWidth, ROW, "F");
      }
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...NAVY);
      const cells = [
        String(cuota.number),
        formatCurrency(cuota.capital),
        formatCurrency(cuota.interest),
        formatCurrency(cuota.total),
        formatCurrency(cuota.balance),
      ];
      let x = startX;
      columns.forEach((column, i) => {
        doc.text(cells[i], column.align === "right" ? x + column.width - 2 : x + 2, y, { align: column.align });
        x += column.width;
      });
      y += ROW;
    });

    doc.setDrawColor(...LINE).line(startX, y - 3.6, startX + tableWidth, y - 3.6);
    const totalPaid = data.cuotas.reduce((sum, cuota) => sum + cuota.total, 0);
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...NAVY);
    doc.text(`Total a pagar en cuotas: ${formatCurrency(totalPaid)}`, startX + tableWidth - 2, y + 1, { align: "right" });
  }

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  doc.text("Valores estimados, sujetos a confirmacion de la financiera.", MARGIN, pageHeight - 8);

  return savePdf(doc, `operacion_0km_${new Date().toISOString().slice(0, 10)}.pdf`);
}
