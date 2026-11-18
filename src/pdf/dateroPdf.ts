import type { DateroFormValues } from "@/types/forms";
import { createPdf, drawPdfLogo, loadImageDataUrl, sanitizeFileName, savePdf } from "./common";

/** Abre la foto guardada y devuelve sus datos y medidas para ubicarla en la hoja. */
async function loadPhoto(url?: string) {
  if (!url) return null;
  const dataUrl = await loadImageDataUrl(url);
  if (!dataUrl) return null;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = dataUrl;
    });
    return { dataUrl, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return null;
  }
}

export async function generateDateroPdf(values: DateroFormValues) {
  const doc = createPdf();

  const L = 20;
  const R = 190;
  const W = R - L;
  let y = 18;
  const ROW_H = 8;
  const LINE_DY = 3.6;
  const VALUE_DY = 1.4;
  const LABEL_W = 58;
  const PAGE_BOTTOM = 270;

  const newPageIfNeeded = (rows = 1) => {
    if (y + rows * ROW_H > PAGE_BOTTOM) {
      doc.addPage();
      y = 20;
    }
  };

  const section = (title: string) => {
    newPageIfNeeded(3);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(L - 1.5, y - 5, W + 3, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, L, y + 2);
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(L - 1.5, y - 4, L - 1.5 + W + 3, y - 4);
    doc.setDrawColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
  };

  const field = (label: string, value = "") => {
    newPageIfNeeded(1);
    const lineX1 = L + LABEL_W + 2;
    const lineY = y + LINE_DY;
    const valY = y + VALUE_DY;

    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, L, y);
    doc.setLineWidth(0.3);
    doc.setDrawColor(160, 160, 160);
    doc.line(lineX1, lineY, R, lineY);
    doc.setDrawColor(0);

    if (value) {
      doc.setFont("helvetica", "normal");
      doc.text(value, lineX1 + 1.2, valY);
    }

    y += ROW_H;
  };

  const multilineField = (label: string, value = "", boxH = 24) => {
    newPageIfNeeded(4);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, L, y);
    y += 4;
    doc.setLineWidth(0.3);
    doc.setDrawColor(160, 160, 160);
    doc.roundedRect(L, y, W, boxH, 1.8, 1.8);
    doc.setDrawColor(0);

    if (value) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(value, W - 6);
      doc.text(lines.slice(0, 10), L + 3, y + 6);
      doc.setFontSize(12);
    }

    y += boxH + 8;
  };

  const logo = await loadImageDataUrl("/logo-jd-negro.png");
  drawPdfLogo(doc, logo, L, 8, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("DATOS PARA LA TRANSFERENCIA DE UNA UNIDAD", 105, 26, { align: "center" });
  y = 36;

  section("Datos del Comprador");
  field("Apellido y Nombre", values.nombre);
  field("DNI", values.dni);
  field("Fecha de Nacimiento", values.fechaNacimiento);
  field("Lugar", values.lugar);
  field("Direccion Real", values.direccionReal);
  field("Direccion segun DNI", values.direccionDni);
  field("Localidad", values.localidad);
  field("Codigo Postal", values.codigoPostal);
  field("Provincia", values.provincia);
  field("Telefono", values.telefono);
  field("Celular", values.celular);
  field("Email", values.email);
  field("Instagram", values.instagram);
  field("CUIL/CUIT", values.cuil);
  field("Condicion Fiscal", values.condicionFiscal);
  field("Estado Civil", values.estadoCivil);
  multilineField("Detalles", values.detalles, 26);

  section("Datos del Conyuge");
  field("Apellido y Nombre", values.conyugeNombre);
  field("DNI", values.conyugeDni);

  section("Datos Finales");
  field("Fecha de la operacion", values.fechaOperacion);
  field("Toma credito", values.tomaCredito === "si" ? "Si" : "No");
  if (values.tomaCredito === "si") {
    field("Total del credito $", values.creditoTotal);
    field("Cantidad y valor de cuotas", values.creditoCuotas);
  }

  if (values.entregaPpa === "si") {
    section("Auto que entrega");
    field("Dominio", values.ppaDominio.toUpperCase());
    field("Marca", values.ppaMarca);
    field("Modelo", values.ppaModelo);
    field("Año", values.ppaAnio);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Dominio: ${values.dominio.toUpperCase()}`, 105, 270, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("Generado por Jesus Diaz Automotores", 105, 285, { align: "center" });
  doc.setTextColor(0);

  // Hoja aparte con las fotos del DNI, lista para imprimir junto al datero.
  const photos = (
    await Promise.all([
      loadPhoto(values.dniFrenteUrl).then((photo) => (photo ? { title: "DNI frente", ...photo } : null)),
      loadPhoto(values.dniDorsoUrl).then((photo) => (photo ? { title: "DNI dorso", ...photo } : null)),
    ])
  ).filter((photo): photo is NonNullable<typeof photo> => Boolean(photo));

  if (photos.length) {
    doc.addPage();
    drawPdfLogo(doc, logo, L, 8, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DOCUMENTO DEL COMPRADOR", 105, 26, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text([values.nombre, values.dni ? `DNI ${values.dni}` : ""].filter(Boolean).join(" - "), 105, 33, { align: "center" });

    // Un poco mas grande que el DNI real (85 x 54 mm) para que se lea bien al imprimir.
    const maxW = 105;
    const maxH = 75;
    let top = 42;
    for (const photo of photos) {
      const scale = Math.min(maxW / photo.width, maxH / photo.height);
      const width = photo.width * scale;
      const height = photo.height * scale;
      const x = 105 - width / 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(photo.title, x, top);
      doc.addImage(photo.dataUrl, "JPEG", x, top + 3, width, height);
      top += height + 14;
    }
  }

  return savePdf(doc, `datero_${sanitizeFileName(values.nombre || "sin_nombre")}.pdf`);
}
