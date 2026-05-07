import type { CompraVentaFormValues } from "@/types/forms";
import { createPdf, sanitizeFileName } from "./common";

export async function generateCompraVentaPdf(values: CompraVentaFormValues) {
  const doc = createPdf();

  const nombreVendedor = "Jesus Luciano Diaz";
  const domicilioVendedor = "Piedrabuena 1578";
  const cuitVendedor = "20-32498911-1";
  const telefonoVendedor = "2494587046";

  const montoLimpio = values.cantidadNum.replace(/\./g, "").replace(",", ".");
  const montoFormateado = values.cantidadNum
    ? Number(montoLimpio || 0).toLocaleString("es-AR")
    : "________________________";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("BOLETO COMPRA VENTA", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Fecha: ${values.fecha || "________________________"}`, 20, 25);
  doc.line(20, 28, 190, 28);

  doc.setTextColor(0, 102, 204);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Datos del Comprador", 20, 38);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${values.recibido || "________________________"}`, 20, 48);
  doc.text(
    `DNI: ${values.numeroDoc || "____________"}   Telefono: ${values.telefono || "____________"}`,
    20,
    56,
  );
  doc.text(`Domicilio: ${values.domicilio || "___________________________________________"}`, 20, 64);
  doc.text(`Monto recibido: $${montoFormateado}`, 20, 72);
  doc.line(20, 75, 190, 75);

  doc.setTextColor(0, 102, 204);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Datos del Automotor", 20, 85);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Dominio: ${values.dominio || "_________________"}`, 20, 95);
  doc.text(`Marca: ${values.marca || "__________"}   Modelo: ${values.modelo || "__________"}`, 20, 103);
  doc.text(
    `Tipo: ${values.tipo || "__________"}   N° Motor: ${values.nMotor || "__________"}   N° Chasis: ${
      values.nChasis || "__________"
    }`,
    20,
    111,
  );

  const obsTexto = values.observaciones || "Sin observaciones.";
  const obsLineas = doc.splitTextToSize(`Observaciones: ${obsTexto}`, 170);
  doc.text(obsLineas, 20, 119);
  const alturaDespuesObs = 119 + obsLineas.length * 7;
  doc.line(20, alturaDespuesObs + 3, 190, alturaDespuesObs + 3);

  let y = alturaDespuesObs + 13;
  doc.setTextColor(0, 102, 204);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Datos del Vendedor", 20, y);

  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${nombreVendedor}`, 20, y);
  y += 8;
  doc.text(`Domicilio: ${domicilioVendedor}`, 20, y);
  y += 8;
  doc.text(`CUIT: ${cuitVendedor}`, 20, y);
  y += 8;
  doc.text(`Telefono: ${telefonoVendedor}`, 20, y);
  doc.line(20, y + 3, 190, y + 3);

  y += 18;
  doc.text("____________________________", 20, y);
  doc.text("Firma del Comprador", 20, y + 5);
  doc.text(`Aclaracion: ${values.recibido || "________________________"}`, 20, y + 17);

  doc.text("____________________________", 120, y);
  doc.text("Firma del Vendedor", 120, y + 5);
  doc.text("Aclaracion: ____________________________", 120, y + 17);

  const fileName = sanitizeFileName(values.recibido || "sin_nombre", "sin_nombre");
  doc.save(`boleto_${fileName}.pdf`);
}
