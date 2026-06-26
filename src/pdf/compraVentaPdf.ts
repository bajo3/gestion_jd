import type { CompraVentaFormValues } from "@/types/forms";
import { createPdf, drawPdfLogo, loadImageDataUrl, sanitizeFileName } from "./common";

function legalUpper(value: string, fallback: string) {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return normalized || fallback;
}

function buildSinGarantiaClause(values: CompraVentaFormValues) {
  const comprador = legalUpper(values.recibido, "________________________");
  const vehiculo = legalUpper(
    [values.marca, values.modelo, values.tipo, values.dominio ? `DOMINIO ${values.dominio}` : ""]
      .filter(Boolean)
      .join(" "),
    "",
  );
  const vehiculoTexto = vehiculo ? ` ${vehiculo}` : "";

  return [
    `CLAUSULA NUMERO ___ ESTADO DEL VEHICULO Y AUSENCIA DE GARANTIA. EL COMPRADOR DECLARA QUE HA REVISADO MINUCIOSAMENTE EL VEHICULO${vehiculoTexto} OBJETO DE ESTE CONTRATO, POR SI MISMO Y/O MEDIANTE UN MECANICO DE SU CONFIANZA.`,
    "MANIFIESTA SU TOTAL CONFORMIDAD Y ACEPTA RECIBIRLO EN EL ESTADO MECANICO, DE CARROCERIA, ELECTRICO, DE TAPICERIA Y DE FUNCIONAMIENTO EN GENERAL EN QUE SE ENCUENTRA, EL CUAL LE RESULTA PLENAMENTE CONOCIDO.",
    "EN VIRTUD DE QUE LA VENTA SE REALIZA DE FORMA EXCEPCIONAL AL RIGUROSO PRECIO DE COSTO DE TOMA POR PARTE DE LA AGENCIA, LAS PARTES ACUERDAN EXPRESAMENTE QUE LA VENDEDORA JESUS DIAZ AUTOMOTORES NO OTORGA NINGUN TIPO DE GARANTIA DE FUNCIONAMIENTO, RENDIMIENTO NI DURABILIDAD.",
    `EL COMPRADOR ${comprador} RENUNCIA EXPRESAMENTE A RECLAMAR A LA AGENCIA JESUS DIAZ AUTOMOTORES POR CUALQUIER DESPERFECTO, ROTURA, VICIO OCULTO O DEFECTO REDHIBITORIO QUE PUDIERA SURGIR CON POSTERIORIDAD A LA FIRMA DEL PRESENTE, ASUMIENDO DE FORMA EXCLUSIVA LOS COSTOS DE CUALQUIER REPARACION FUTURA.`,
  ].join(" ");
}

export async function generateCompraVentaPdf(values: CompraVentaFormValues) {
  const doc = createPdf();
  const logo = await loadImageDataUrl("/logo-jd-negro.png");

  const nombreVendedor = "Jesus Luciano Diaz";
  const domicilioVendedor = "Piedrabuena 1578";
  const cuitVendedor = "20-32498911-1";
  const telefonoVendedor = "2494587046";

  const L = 20;
  const R = 190;
  const W = R - L;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bottom = pageH - 10;
  let y = 20;

  const montoLimpio = values.cantidadNum.replace(/\./g, "").replace(",", ".");
  const montoFormateado = values.cantidadNum
    ? Number(montoLimpio || 0).toLocaleString("es-AR")
    : "________________________";

  const drawHeader = (showTitle = true) => {
    drawPdfLogo(doc, logo, L, 8, 42);

    if (showTitle) {
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("BOLETO COMPRA VENTA", pageW / 2, 17, {
        align: "center",
      });
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(L, 27, R, 27);
    doc.setDrawColor(0, 0, 0);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= bottom) return;
    doc.addPage();
    drawHeader(false);
    y = 36;
  };

  const section = (title: string) => {
    ensureSpace(16);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(L, y - 6, W, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(title, L + 3, y);
    y += 10;
  };

  const row = (label: string, value: string, x = L) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(`${label}:`, x, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "________________________", x + doc.getTextWidth(`${label}: `) + 3, y);
  };

  const paragraph = (text: string, fontSize = 10.5, lineHeight = 5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, W - 6);
    const needed = lines.length * lineHeight + 6;
    ensureSpace(needed);
    doc.text(lines, L + 3, y);
    y += needed;
  };

  drawHeader();
  y = 37;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Fecha: ${values.fecha || "________________________"}`, L, y);
  y += 12;

  section("Datos del comprador");
  row("Nombre", values.recibido);
  y += 8;
  row("DNI", values.numeroDoc || "____________");
  row("Telefono", values.telefono || "____________", 105);
  y += 8;
  row("Domicilio", values.domicilio);
  y += 8;
  row("Monto recibido", `$${montoFormateado}`);
  y += 14;

  section("Datos del automotor");
  row("Dominio", values.dominio || "________________");
  y += 8;
  row("Marca", values.marca || "__________");
  row("Modelo", values.modelo || "__________", 105);
  y += 8;
  row("Tipo", values.tipo || "__________");
  y += 8;
  row("Nro Motor", values.nMotor || "__________");
  row("Nro Chasis", values.nChasis || "__________", 105);
  y += 13;

  section("Observaciones");
  paragraph(values.observaciones || "Sin observaciones.");

  if (values.sinGarantia) {
    section("Clausula sin garantia");
    paragraph(buildSinGarantiaClause(values), 9, 4.35);
  }

  section("Datos del vendedor");
  row("Nombre", nombreVendedor);
  y += 8;
  row("Domicilio", domicilioVendedor);
  y += 8;
  row("CUIT", cuitVendedor);
  row("Telefono", telefonoVendedor, 105);
  y += 6;

  if (y > pageH - 12) {
    doc.addPage();
    drawHeader(false);
    y = 36;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.line(L, y, L + 70, y);
  doc.line(120, y, R, y);
  doc.text("Firma del Comprador", L, y + 5);
  doc.text("Firma del Vendedor", 120, y + 5);
  y += 14;
  doc.text(`Aclaracion: ${values.recibido || "________________________"}`, L, y);
  doc.text("Aclaracion: ____________________________", 120, y);

  const fileName = sanitizeFileName(values.recibido || "sin_nombre", "sin_nombre");
  doc.save(`boleto_${fileName}.pdf`);
}
