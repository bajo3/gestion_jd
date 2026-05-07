import type { TestDriveFormValues } from "@/types/forms";
import { createPdf, loadImageDataUrl, sanitizeFileName } from "./common";

export async function generateTestDrivePdf(values: TestDriveFormValues) {
  const doc = createPdf();
  const logoDataURL = await loadImageDataUrl("/logo-jd-negro.png");

  const L = 15;
  const R = 195;
  const W = R - L;
  const ROW_H = 8;

  function drawSectionTitle(y: number, title: string) {
    doc.setFillColor(240, 240, 240);
    doc.rect(L, y - 5, W, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, L + 2, y + 1);
  }

  function drawFieldRow(y: number, fields: Array<{ label: string; value: string }>) {
    const gap = 4;
    const colW = (W - gap * (fields.length - 1)) / fields.length;
    fields.forEach((field, index) => {
      const x = L + index * (colW + gap);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${field.label}:`, x, y);
      const labelWidth = doc.getTextWidth(`${field.label}: `);
      const lineX1 = x + labelWidth + 2;
      const lineX2 = x + colW - 2;
      const lineY = y + 1.5;
      doc.setLineWidth(0.3);
      doc.setDrawColor(160, 160, 160);
      doc.line(lineX1, lineY, lineX2, lineY);
      doc.setDrawColor(0);
      if (field.value) {
        doc.setFont("helvetica", "normal");
        doc.text(String(field.value), lineX1 + 1, y);
      }
    });
  }

  function drawCheckRow(y: number, checks: Array<{ label: string; checked: boolean }>) {
    const gap = 4;
    const colW = (W - gap * (checks.length - 1)) / checks.length;
    checks.forEach((check, index) => {
      const x = L + index * (colW + gap);
      doc.rect(x, y - 3, 4, 4);
      if (check.checked) {
        doc.setLineWidth(0.7);
        doc.line(x + 0.5, y - 2.5, x + 3.5, y + 0.5);
        doc.line(x + 3.5, y - 2.5, x + 0.5, y + 0.5);
        doc.setLineWidth(0.3);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(check.label, x + 6, y);
    });
  }

  function drawSignatureField(x: number, y: number, width: number, label: string, value: string) {
    if (value) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(String(value), x + 1, y - 1);
    }
    doc.line(x, y, x + width, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label, x, y + 4);
  }

  const yStart = 20;
  if (logoDataURL) {
    doc.addImage(logoDataURL, "PNG", L, yStart, 30, 12);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FORMULARIO TEST DRIVE", 105, yStart + 7, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Responsabilidad civil y constancia de uso", 105, yStart + 13, { align: "center" });
  let y = yStart + 30;

  drawSectionTitle(y, "DATOS GENERALES");
  y += 8;
  drawFieldRow(y, [
    { label: "Fecha", value: values.fecha },
    { label: "Hora de salida", value: values.horaSalida },
  ]);
  y += ROW_H;
  drawFieldRow(y, [
    { label: "Hora de llegada", value: values.horaLlegada },
    { label: "Concesionario", value: values.concesionario },
  ]);
  y += ROW_H + 4;

  drawSectionTitle(y, "DATOS DEL VEHICULO");
  y += 8;
  drawFieldRow(y, [
    { label: "Marca", value: values.marca },
    { label: "Modelo", value: values.modelo },
    { label: "Version", value: values.version },
  ]);
  y += ROW_H;
  drawFieldRow(y, [
    { label: "Dominio / Patente", value: values.dominio },
    { label: "Color", value: values.color },
    { label: "Recorrido autorizado", value: values.recorrido },
  ]);
  y += ROW_H;
  drawFieldRow(y, [
    { label: "Kilometraje inicial", value: values.kmInicial },
    { label: "Kilometraje final", value: values.kmFinal },
  ]);
  y += ROW_H;
  drawFieldRow(y, [
    { label: "Combustible inicial", value: values.combustibleInicial },
    { label: "Combustible final", value: values.combustibleFinal },
  ]);
  y += ROW_H + 4;

  drawSectionTitle(y, "ESTADO DEL VEHICULO");
  y += 8;
  drawCheckRow(y, [
    { label: "Sin daños visibles", checked: values.sinDanos },
    { label: "Rayones", checked: values.rayones },
    { label: "Golpes", checked: values.golpes },
  ]);
  y += ROW_H;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Observaciones / detalles del estado del vehiculo:", L, y);
  y += 4;
  const obsLines = doc.splitTextToSize(values.observaciones || "", W - 4);
  const obsHeight = Math.max(obsLines.length * 5 + 4, 24);
  doc.setDrawColor(160, 160, 160);
  doc.rect(L, y, W, obsHeight);
  doc.setDrawColor(0);
  doc.setFont("helvetica", "normal");
  doc.text(obsLines, L + 2, y + 5);
  y += obsHeight + 6;

  drawSectionTitle(y, "DOCUMENTACION VERIFICADA");
  y += 8;
  drawCheckRow(y, [
    { label: "DNI", checked: values.docDni },
    { label: "Licencia vigente", checked: values.docLicencia },
    { label: "Cedula / doc. del vehiculo", checked: values.docCedula },
  ]);
  y += ROW_H + 6;

  drawSectionTitle(y, "FIRMAS Y CONFORMIDAD");
  y += 10;
  const sigWidth = (W - 10) / 2;
  drawSignatureField(L, y, sigWidth, "Firma del conductor", "");
  drawSignatureField(L + sigWidth + 10, y, sigWidth, "Firma del asesor", "");
  y += 14;
  drawSignatureField(L, y, sigWidth, "Aclaracion del conductor", values.aclaracionConductor || values.nombreConductor);
  drawSignatureField(L + sigWidth + 10, y, sigWidth, "Aclaracion del asesor", values.aclaracionAsesor || values.nombreAsesor);
  doc.text("Pagina 1", 105, 285, { align: "center" });

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const agreementTitle = "ACUERDO DE EXONERACION DE RESPONSABILIDAD - TEST DRIVE";
  const titleLines = doc.splitTextToSize(agreementTitle, W);
  titleLines.forEach((line, index) => {
    doc.text(line, 105, 26 + index * 6, { align: "center" });
  });

  let y2 = 26 + titleLines.length * 6 + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const vehicleDescription = [values.marca, values.modelo, values.version, values.dominio].filter(Boolean).join(" ");
  const paragraphs = [
    `Yo, ${values.nombreConductor || "________________"}, reconozco que acepto voluntariamente realizar la prueba de TEST DRIVE en el vehiculo ${vehicleDescription || "________________"} destinado por Jesus Diaz Automotores para tal fin, y declaro mediante el presente documento que la misma la estoy realizando bajo mi total y unica responsabilidad.`,
    "El TEST DRIVE implica que bajo mi responsabilidad conducire y manipulare el vehiculo destinado para este tipo de pruebas, por lo cual declaro que tengo vigente la licencia de conduccion que me acredita como apto(a) para conducir.",
    "Asimismo entiendo y soy consciente de que las actividades que voy a desarrollar son actividades que implican riesgos normales de circulacion y que existen riesgos conocidos o desconocidos, incluyendo la posibilidad de daños corporales, muerte o daños a bienes propios o ajenos; por lo cual estoy de acuerdo en asumir todos y cada uno de estos riesgos.",
    "Tambien declaro que me encuentro en condiciones fisicas y psiquicas aptas para conducir, que no me encuentro bajo efectos de alcohol, drogas o sustancias que alteren mi capacidad, que respetare las normas de transito vigentes y que circulare unicamente dentro del recorrido autorizado por la agencia.",
    "Acepto ademas que cualquier multa, infraccion, franquicia de seguro, daño no cubierto o perjuicio ocasionado durante el test drive que resulte imputable a mi conducta podra ser reclamado al conductor firmante.",
    "Declaro que he leido cuidadosamente este acuerdo y que entiendo plenamente su contenido.",
  ];

  paragraphs.forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph, W);
    doc.text(lines, L, y2);
    y2 += lines.length * 5 + 4;
  });

  const firstRowY = y2 + 4;
  drawSignatureField(L, firstRowY, 90, "Firma del declarante (conductor)", "");
  drawSignatureField(L + 95, firstRowY, 40, "Lugar", values.lugar);
  drawSignatureField(L + 140, firstRowY, 40, "Fecha", values.fecha);
  y2 = firstRowY + 14;
  drawSignatureField(L, y2, 90, "Aclaracion", values.aclaracionConductor || values.nombreConductor);
  drawSignatureField(L + 95, y2, 40, "DNI", values.dniConductor);
  y2 += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Documentacion a anexar:", L, y2);
  y2 += 6;
  doc.rect(L + 1, y2 - 3.5, 4, 4);
  if (values.docLicenciaCopia) {
    doc.line(L + 1.5, y2 - 3, L + 4.5, y2 + 0.5);
    doc.line(L + 4.5, y2 - 3, L + 1.5, y2 + 0.5);
  }
  doc.setFont("helvetica", "normal");
  doc.text("Copia de licencia de conducir", L + 7, y2);
  doc.setFontSize(8);
  doc.text("Pagina 2", 105, 285, { align: "center" });

  doc.save(`test_drive_${sanitizeFileName(values.nombreConductor || "document")}.pdf`);
}
