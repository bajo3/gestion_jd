import { displayCase, priceListItemStatus } from "@/lib/priceList";
import type { PriceCurrency, PriceListItem } from "@/types/priceList";
import { createPdf, drawPdfLogo, loadImageDataUrl, savePdf } from "./common";

type Column = { label: string; width: number; align?: "left" | "right" };

// Mismas columnas y orden que la planilla. Suman 277 mm: una hoja A4 apaisada con 10 mm de margen.
const COLUMNS: Column[] = [
  { label: "UNIDAD", width: 34 },
  { label: "AÑO", width: 22 },
  { label: "KM", width: 22 },
  { label: "VERSION", width: 42 },
  { label: "COLOR", width: 20 },
  { label: "COMBUSTIBLE", width: 30 },
  { label: "TRACCION", width: 24 },
  { label: "CAJA", width: 14 },
  { label: "CILINDRADA", width: 24 },
  { label: "PRECIO CONTADO", width: 22, align: "right" },
  { label: "PRECIO LISTA", width: 23, align: "right" },
];

const NAVY: [number, number, number] = [18, 35, 64];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const BAND: [number, number, number] = [241, 245, 249];
const ZEBRA: [number, number, number] = [250, 251, 253];

const MARGIN = 10;
const ROW_HEIGHT = 5.6;
const BRAND_HEIGHT = 7;
const HEADER_HEIGHT = 6.4;

/** "34.500 USD" o "$13.500.000": un solo formato para toda la lista, como se lee en la planilla. */
function formatListPrice(value: number | null, currency: PriceCurrency) {
  if (value === null || !Number.isFinite(value)) return "";
  const amount = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
  return currency === "USD" ? `${amount} USD` : `$${amount}`;
}

function cellText(value: string) {
  return displayCase(value ?? "");
}

/** Agrupa por marca en el orden de la planilla: cada marca queda donde aparece su primera fila. */
function groupInSheetOrder(items: PriceListItem[]) {
  const rank = (item: PriceListItem) => item.sheetRow ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...items].sort((a, b) => rank(a) - rank(b) || a.sortOrder - b.sortOrder);
  const groups = new Map<string, PriceListItem[]>();
  for (const item of sorted) {
    const brand = item.brand.trim() || "Sin marca";
    const current = groups.get(brand);
    if (current) current.push(item);
    else groups.set(brand, [item]);
  }
  return [...groups.entries()];
}

function fit(doc: ReturnType<typeof createPdf>, text: string, width: number) {
  if (doc.getTextWidth(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export type ListaPreciosPdfOptions = {
  /** Suma los vendidos al final de cada marca, tachados, como en la planilla. */
  includeSold?: boolean;
};

/**
 * Arma la lista de precios lista para imprimir: A4 apaisado, una tabla por marca,
 * encabezado repetido en cada hoja y la fecha al pie.
 */
export async function generateListaPreciosPdf(items: PriceListItem[], options: ListaPreciosPdfOptions = {}) {
  const doc = createPdf({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const logo = await loadImageDataUrl("/logo-jd-negro.png");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = COLUMNS.reduce((sum, column) => sum + column.width, 0);
  const left = (pageWidth - tableWidth) / 2;
  const footerY = pageHeight - 6;
  const bottomLimit = pageHeight - 12;
  const printedAt = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

  const visible = items.filter((item) => options.includeSold || priceListItemStatus(item) !== "vendido");
  const groups = groupInSheetOrder(visible);

  let y = MARGIN;
  let pageNumber = 1;

  const drawTitle = () => {
    const logoHeight = drawPdfLogo(doc, logo, left, MARGIN - 1, 38);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text("Lista de precios", pageWidth - left, MARGIN + 5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(`Actualizada al ${printedAt}`, pageWidth - left, MARGIN + 10, { align: "right" });
    y = MARGIN + Math.max(logoHeight, 12) + 3;
  };

  const drawTableHeader = () => {
    doc.setFillColor(...NAVY);
    doc.rect(left, y, tableWidth, HEADER_HEIGHT, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    let x = left;
    for (const column of COLUMNS) {
      if (column.align === "right") doc.text(column.label, x + column.width - 1.8, y + 4.2, { align: "right" });
      else doc.text(column.label, x + 1.8, y + 4.2);
      x += column.width;
    }
    y += HEADER_HEIGHT;
  };

  const drawFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(printedAt, left, footerY);
    doc.text(`Pagina ${pageNumber}`, pageWidth - left, footerY, { align: "right" });
  };

  const newPage = () => {
    drawFooter();
    doc.addPage();
    pageNumber += 1;
    y = MARGIN;
    drawTableHeader();
  };

  // Asegura lugar para lo que sigue; si no entra, salta de hoja y repite el encabezado.
  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) newPage();
  };

  drawTitle();
  drawTableHeader();

  if (!groups.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("No hay vehiculos para imprimir.", left, y + 10);
  }

  for (const [brand, brandItems] of groups) {
    // La marca nunca queda sola al pie de una hoja: se pide lugar para al menos dos filas.
    ensureSpace(BRAND_HEIGHT + ROW_HEIGHT * Math.min(2, brandItems.length));

    doc.setFillColor(...BAND);
    doc.rect(left, y, tableWidth, BRAND_HEIGHT, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...NAVY);
    const brandLabel = brand.toUpperCase();
    doc.text(brandLabel, left + 1.8, y + 4.9);
    doc.setLineWidth(0.25);
    doc.setDrawColor(...NAVY);
    doc.line(left + 1.8, y + 5.5, left + 1.8 + doc.getTextWidth(brandLabel), y + 5.5);
    y += BRAND_HEIGHT;

    brandItems.forEach((item, index) => {
      ensureSpace(ROW_HEIGHT);
      const sold = priceListItemStatus(item) === "vendido";

      if (index % 2 === 1) {
        doc.setFillColor(...ZEBRA);
        doc.rect(left, y, tableWidth, ROW_HEIGHT, "F");
      }

      const cells = [
        cellText(item.unit),
        cellText(item.yearLabel),
        cellText(item.kmLabel),
        cellText(item.version),
        cellText(item.color),
        cellText(item.fuel),
        cellText(item.traction),
        item.gearbox.trim().length <= 3 ? item.gearbox.trim().toUpperCase() : cellText(item.gearbox),
        cellText(item.displacement),
        formatListPrice(item.cashPrice, item.currency),
        formatListPrice(item.listPrice, item.currency),
      ];

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.6);
      doc.setTextColor(...(sold ? MUTED : ([15, 23, 42] as [number, number, number])));
      doc.setDrawColor(...MUTED);
      doc.setLineWidth(0.2);

      let x = left;
      COLUMNS.forEach((column, columnIndex) => {
        const text = fit(doc, cells[columnIndex], column.width - 3.6);
        if (text) {
          const textX = column.align === "right" ? x + column.width - 1.8 : x + 1.8;
          const textY = y + 3.9;
          doc.text(text, textX, textY, { align: column.align === "right" ? "right" : "left" });
          if (sold) {
            const textWidth = doc.getTextWidth(text);
            const startX = column.align === "right" ? textX - textWidth : textX;
            doc.line(startX, textY - 1.05, startX + textWidth, textY - 1.05);
          }
        }
        x += column.width;
      });

      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.15);
      doc.line(left, y + ROW_HEIGHT, left + tableWidth, y + ROW_HEIGHT);
      y += ROW_HEIGHT;
    });

    y += 1.6;
  }

  drawFooter();

  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return savePdf(doc, `lista_de_precios_jd_${stamp}.pdf`);
}
