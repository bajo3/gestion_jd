import type { AutorizacionFormValues } from "@/types/forms";
import { createPdf, drawPdfLogo, loadImageDataUrl, savePdf } from "./common";

export async function generateAutorizacionPdf(values: AutorizacionFormValues) {
  const doc = createPdf();
  const logo = await loadImageDataUrl("/logo-jd-negro.png");
  const lugarFecha = [values.lugar, values.fecha].filter(Boolean).join(", ");

  const mandatarioNombre = "Valeria Lujan Diaz";
  const mandatarioMatricula = "M201727276055394DN";
  const mandatarioDomicilio = "Piedrabuena 1578";
  const mandatarioLocalidad = "Tandil";
  const propietarioNombre = values.propietarioNombre || values.autorizado || values.titular;

  const L = 20;
  const R = 190;
  const W = R - L;

  const writeBlock = (text: string, y: number, width = W, lineHeight = 5) => {
    const lines = doc.splitTextToSize(text, width);
    doc.text(lines, L, y);
    return y + lines.length * lineHeight;
  };

  drawPdfLogo(doc, logo, L, 8, 42);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PERMISO DE AUTORIZACION PARA CIRCULAR", 105, 30, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Ley Nro 20.167", L, 40);
  doc.text(`Valido por: ${values.diasValidos} dias`, 120, 40);
  doc.text(`Lugar y Fecha: ${lugarFecha}`, L, 47);

  let y = 57;
  y = writeBlock(`Hacemos constar por la presente que autorizamos al/la Sr./Sra. ${values.autorizado}`, y);
  y = writeBlock(
    `a conducir por todo el territorio de la Republica Argentina el automotor de titularidad del Sr./Sra. ${values.titular}`,
    y + 2,
  );

  y += 5;
  y = writeBlock(`Marca: ${values.marca}   Modelo: ${values.modelo}   Tipo: ${values.tipo}   Anio: ${values.anio}`, y);
  y = writeBlock(`Motor Nro: ${values.motor}   Chasis Nro: ${values.chasis}`, y + 2);
  y = writeBlock(`Dominio Nro: ${values.dominio}   Ubicacion: ${values.domicilioAuto}`, y + 2);

  y += 5;
  y = writeBlock(
    "La presente autorizacion no exime al autorizado/a de su responsabilidad derivada de danios y perjuicios a terceros, sean personas o cosas con el automotor de referencia.",
    y,
  );
  y = writeBlock(
    "Se expide este documento conjuntamente con su actual propietario/a de quien se ha recibido, al solo efecto de realizar las gestiones de la respectiva documentacion.",
    y + 2,
  );
  y = writeBlock(
    "Cedula de identificacion del mencionado automotor, que lo autoriza a circular de acuerdo a lo establecido por la ley del Automotor en vigencia que se cita abajo, sirviendo por lo tanto, la presente autorizacion como prueba fehaciente de la imposibilidad de suministrarla.",
    y + 2,
  );

  if (values.otrasCaracteristicas) {
    y = writeBlock(`* Otras caracteristicas: ${values.otrasCaracteristicas}`, y + 5);
  }

  const firmaY = Math.max(y + 10, 153);
  doc.line(L, firmaY, 90, firmaY);
  doc.line(120, firmaY, R, firmaY);

  if (propietarioNombre) {
    doc.setFontSize(10.5);
    doc.text(propietarioNombre, 55, firmaY - 2, { align: "center", maxWidth: 68 });
    doc.setFontSize(11);
  }

  doc.text("Propietario Actual", 55, firmaY + 5, { align: "center" });
  doc.text(mandatarioNombre, 155, firmaY - 2, { align: "center", maxWidth: 68 });
  doc.text("Mandataria Interviniente", 155, firmaY + 5, { align: "center" });

  let datosY = firmaY + 15;
  doc.text(`D.N.I: ${values.propietarioDni}`, L, datosY);
  doc.text(`Nro de Matricula: ${mandatarioMatricula}`, 130, datosY);
  datosY += 7;
  doc.text(`Domicilio: ${values.propietarioDomicilio}`, L, datosY);
  doc.text(`Domicilio: ${mandatarioDomicilio}`, 130, datosY);
  datosY += 7;
  doc.text(`Localidad: ${values.propietarioLocalidad}`, L, datosY);
  doc.text(`Localidad: ${mandatarioLocalidad}`, 130, datosY);

  doc.setFontSize(9);
  let footerY = Math.max(datosY + 13, 195);
  footerY = writeBlock(
    "DECRETO LEY 6582/58 RATIFICADO POR LEY 14467, MODIFICADO POR DECRETO LEY NRO 5120/63 Y LEY 20.167",
    footerY,
    W,
    4.5,
  );
  writeBlock(
    '(*) En caso de no presentarse Cedula de Identificacion se dejara constancia en el presente documento de que "NO JUSTIFICA" dicha carencia "FEHACIENTEMENTE LA IMPOSIBILIDAD MATERIAL DE SUMINISTRARLA".',
    footerY + 1,
    W,
    4.5,
  );

  return savePdf(doc, "autorizacion_para_circular.pdf");
}
