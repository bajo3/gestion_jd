async function generarTestDrivePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Funciones auxiliares para obtener valores del formulario
  const getValue = (id) => (document.getElementById(id)?.value || "").trim();
  const getCheckbox = (id) => document.getElementById(id)?.checked || false;

  // Recoger datos del formulario
  const fecha           = getValue("fecha");
  const horaSalida      = getValue("hora_salida");
  const horaLlegada     = getValue("hora_llegada");
  const concesionario   = getValue("concesionario");

  const marca           = getValue("marca");
  const modelo          = getValue("modelo");
  const version         = getValue("version");
  const dominio         = getValue("dominio");
  const color           = getValue("color");
  const recorrido       = getValue("recorrido");
  const kmInicial       = getValue("km_inicial");
  const kmFinal         = getValue("km_final");
  const combInicial     = getValue("combustible_inicial");
  const combFinal       = getValue("combustible_final");

  const sinDanos        = getCheckbox("sin_danos");
  const hayRayones      = getCheckbox("rayones");
  const hayGolpes       = getCheckbox("golpes");
  const observaciones   = getValue("observaciones");

  const docDNI          = getCheckbox("doc_dni");
  const docLicencia     = getCheckbox("doc_licencia");
  const docCedula       = getCheckbox("doc_cedula");

  const nombreConductor = getValue("nombre_conductor");
  const dniConductor    = getValue("dni_conductor");
  const lugar           = getValue("lugar");
  const aclarConductor  = getValue("aclaracion_conductor");
  const nombreAsesor    = getValue("nombre_asesor");
  const aclarAsesor     = getValue("aclaracion_asesor");

  const docLicenciaCopia = getCheckbox("doc_licencia_copia");

  // Componer descripción del vehículo para el acuerdo de exoneración
  const vehiculoDesc = [marca, modelo, version, dominio].filter(Boolean).join(" ");

  // Cargar el logo como DataURL para insertarlo en el PDF
  let logoDataURL = null;
  try {
    const res = await fetch("logo.png");
    if (res.ok) {
      const blob = await res.blob();
      logoDataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    // en caso de error, seguimos sin logo
  }

  // Constantes de layout
  const L = 15;            // margen izquierdo
  const R = 195;           // margen derecho útil
  const W = R - L;         // ancho útil
  const ROW_H = 8;         // alto de fila estándar

  // Función para dibujar títulos de sección con fondo suave
  function drawSectionTitle(y, title) {
    doc.setFillColor(240, 240, 240);
    doc.rect(L, y - 5, W, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, L + 2, y + 1);
  }

  // Dibuja una fila de uno a tres campos; se distribuyen equitativamente
  function drawFieldRow(y, fields) {
    const n = fields.length;
    const gap = 4;
    const totalGap = gap * (n - 1);
    const colW = (W - totalGap) / n;
    fields.forEach((fld, idx) => {
      const x = L + idx * (colW + gap);
      // etiqueta
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(fld.label + ":", x, y);
      // línea
      const labelWidth = doc.getTextWidth(fld.label + ": ");
      const lineX1 = x + labelWidth + 2;
      const lineX2 = x + colW - 2;
      const lineY = y + 1.5;
      doc.setLineWidth(0.3);
      doc.setDrawColor(160, 160, 160);
      doc.line(lineX1, lineY, lineX2, lineY);
      doc.setDrawColor(0);
      // valor si existe
      if (fld.value) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(String(fld.value), lineX1 + 1, y);
      }
    });
  }

  // Dibuja una fila de checkboxes con sus etiquetas
  function drawCheckRow(y, checks) {
    const n = checks.length;
    const gap = 4;
    const totalGap = gap * (n - 1);
    const colW = (W - totalGap) / n;
    checks.forEach((chk, idx) => {
      const x = L + idx * (colW + gap);
      // casilla
      doc.rect(x, y - 3, 4, 4);
      if (chk.checked) {
        // dibujar una X dentro de la casilla
        doc.setLineWidth(0.7);
        doc.line(x + 0.5, y - 2.5, x + 3.5, y + 0.5);
        doc.line(x + 3.5, y - 2.5, x + 0.5, y + 0.5);
        doc.setLineWidth(0.3);
      }
      // etiqueta
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(chk.label, x + 6, y);
    });
  }

  // Dibuja un campo de firma: valor opcional arriba de la línea y etiqueta debajo
  function drawSignatureField(x, y, width, label, value) {
    // valor sobre la línea
    if (value) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(String(value), x + 1, y - 1);
    }
    // línea de firma
    doc.setLineWidth(0.3);
    doc.line(x, y, x + width, y);
    // etiqueta bajo la línea
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label, x, y + 4);
  }

  // Posicionamiento inicial en la página 1
  // Separamos claramente el logo, el título y el subtítulo para que no se pisen
  const yStart = 20;
  if (logoDataURL) {
    // Logo en la esquina superior izquierda
    doc.addImage(logoDataURL, "PNG", L, yStart, 30, 12);
  }
  // Títulos centrados
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FORMULARIO TEST DRIVE", 105, yStart + 7, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Responsabilidad civil y constancia de uso", 105, yStart + 13, { align: "center" });
  // Situar el cursor después del encabezado para evitar solapamiento
  let y = yStart + 30;

  // Sección: Datos Generales
  drawSectionTitle(y, "DATOS GENERALES");
  y += 8;
  drawFieldRow(y, [
    { label: "Fecha", value: fecha || "" },
    { label: "Hora de salida", value: horaSalida || "" }
  ]);
  y += ROW_H;
  drawFieldRow(y, [
    { label: "Hora de llegada", value: horaLlegada || "" },
    { label: "Concesionario", value: concesionario || "" }
  ]);
  y += ROW_H + 4;

  // Sección: Datos del vehículo
  drawSectionTitle(y, "DATOS DEL VEHÍCULO");
  y += 8;
  drawFieldRow(y, [
    { label: "Marca", value: marca || "" },
    { label: "Modelo", value: modelo || "" },
    { label: "Versión", value: version || "" }
  ]);
  y += ROW_H;
  drawFieldRow(y, [
    { label: "Dominio / Patente", value: dominio || "" },
    { label: "Color", value: color || "" },
    { label: "Recorrido autorizado", value: recorrido || "" }
  ]);
  y += ROW_H;
  drawFieldRow(y, [
    { label: "Kilometraje inicial", value: kmInicial || "" },
    { label: "Kilometraje final", value: kmFinal || "" }
  ]);
  y += ROW_H;
  drawFieldRow(y, [
    { label: "Combustible inicial", value: combInicial || "" },
    { label: "Combustible final", value: combFinal || "" }
  ]);
  y += ROW_H + 4;

  // Sección: Estado del vehículo
  drawSectionTitle(y, "ESTADO DEL VEHÍCULO");
  y += 8;
  drawCheckRow(y, [
    { label: "Sin daños visibles", checked: sinDanos },
    { label: "Rayones", checked: hayRayones },
    { label: "Golpes", checked: hayGolpes }
  ]);
  y += ROW_H;
  // Observaciones
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Observaciones / detalles del estado del vehículo:", L, y);
  y += 4;
  const obsLines = doc.splitTextToSize(observaciones || "", W - 4);
  const obsHeight = Math.max(obsLines.length * 5 + 4, 24);
  // Contenedor de observaciones
  doc.setDrawColor(160, 160, 160);
  doc.rect(L, y, W, obsHeight);
  doc.setDrawColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(obsLines, L + 2, y + 5);
  y += obsHeight + 6;

  // Sección: Documentación verificada
  drawSectionTitle(y, "DOCUMENTACIÓN VERIFICADA");
  y += 8;
  drawCheckRow(y, [
    { label: "DNI", checked: docDNI },
    { label: "Licencia vigente", checked: docLicencia },
    { label: "Cédula / doc. del vehículo", checked: docCedula }
  ]);
  y += ROW_H + 6;

  // Sección: Firmas y conformidad
  drawSectionTitle(y, "FIRMAS Y CONFORMIDAD");
  y += 10;
  // Filas de firmas: Conductor y Asesor
  const sigWidth = (W - 10) / 2;
  drawSignatureField(L, y, sigWidth, "Firma del conductor", "");
  drawSignatureField(L + sigWidth + 10, y, sigWidth, "Firma del asesor", "");
  y += 14;
  // Filas de aclaración de firmas
  drawSignatureField(L, y, sigWidth, "Aclaración del conductor", aclarConductor || nombreConductor);
  drawSignatureField(L + sigWidth + 10, y, sigWidth, "Aclaración del asesor", aclarAsesor || nombreAsesor);
  y += 20;

  // Número de página
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Página 1", 105, 285, { align: "center" });

  // Página 2: Acuerdo de exoneración
  doc.addPage();
  // No colocamos el logo en la segunda página para evitar superposición con el título
  // Título del acuerdo: se divide en varias líneas si es necesario
  const y2Start = 20;
  const acuerdoTitulo = "ACUERDO DE EXONERACIÓN DE RESPONSABILIDAD - TEST DRIVE";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const tituloLines = doc.splitTextToSize(acuerdoTitulo, W);
  // Imprimir cada línea del título centrado
  tituloLines.forEach((line, idx) => {
    doc.text(line, 105, y2Start + 6 + idx * 6, { align: "center" });
  });
  // Situar el cursor debajo del título con un pequeño margen
  let y2 = y2Start + 6 + tituloLines.length * 6 + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  // Texto del acuerdo con campos completados
  const para1 = `Yo, ${nombreConductor || "________________"}, reconozco que acepto voluntariamente realizar la prueba de TEST DRIVE en el vehículo ${vehiculoDesc || "________________"} destinado por Jesús Diaz Automotores para tal fin, y declaro mediante el presente documento que la misma la estoy realizando bajo mi total y única responsabilidad.`;
  const para2 = "El TEST DRIVE implica que bajo mi responsabilidad conduciré y manipularé el vehículo destinado para este tipo de pruebas, por lo cual declaro que tengo vigente la licencia de conducción que me acredita como apto(a) para conducir.";
  const para3 = "Asimismo entiendo y soy consciente de que las actividades que voy a desarrollar son actividades que implican riesgos normales de circulación y que existen riesgos conocidos o desconocidos, incluyendo la posibilidad de daños corporales, muerte o daños a bienes propios o ajenos; por lo cual estoy de acuerdo en asumir todos y cada uno de estos riesgos.";
  const para4 = "También declaro que me encuentro en condiciones físicas y psíquicas aptas para conducir, que no me encuentro bajo efectos de alcohol, drogas o sustancias que alteren mi capacidad, que respetaré las normas de tránsito vigentes y que circularé únicamente dentro del recorrido autorizado por la agencia.";
  const para5 = "Acepto además que cualquier multa, infracción, franquicia de seguro, daño no cubierto o perjuicio ocasionado durante el test drive que resulte imputable a mi conducta podrá ser reclamado al conductor firmante.";
  const para6 = "DECLARO QUE HE LEÍDO CUIDADOSAMENTE ESTE ACUERDO Y QUE ENTIENDO PLENAMENTE SU CONTENIDO. ENTIENDO QUE ESTA CONSTANCIA FORMA PARTE DEL PROCEDIMIENTO INTERNO PARA LA REALIZACIÓN DEL TEST DRIVE.";
  const paragraphs = [para1, para2, para3, para4, para5, para6];
  paragraphs.forEach((p) => {
    const lines = doc.splitTextToSize(p, W);
    doc.text(lines, L, y2);
    y2 += lines.length * 5 + 4;
  });
  // Espacio antes de firmas
  y2 += 4;
  // Campos de firma, lugar y fecha (primera fila)
  const firstRowY = y2;
  drawSignatureField(L, firstRowY, 90, "Firma del declarante (conductor)", "");
  drawSignatureField(L + 95, firstRowY, 40, "Lugar", lugar || "");
  drawSignatureField(L + 140, firstRowY, 40, "Fecha", fecha || "");
  y2 += 14;
  // Segunda fila: aclaración y DNI
  drawSignatureField(L, y2, 90, "Aclaración", aclarConductor || nombreConductor);
  drawSignatureField(L + 95, y2, 40, "DNI", dniConductor || "");
  y2 += 16;
  // Documentación a anexar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Documentación a anexar:", L, y2);
  y2 += 6;
  // casilla para copia de licencia
  doc.rect(L + 1, y2 - 3.5, 4, 4);
  if (docLicenciaCopia) {
    doc.setLineWidth(0.7);
    doc.line(L + 1.5, y2 - 3, L + 4.5, y2 + 0.5);
    doc.line(L + 4.5, y2 - 3, L + 1.5, y2 + 0.5);
    doc.setLineWidth(0.3);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Copia de licencia de conducir", L + 7, y2);
  // Número de página de la segunda hoja
  doc.setFontSize(8);
  doc.text("Página 2", 105, 285, { align: "center" });

  // Guardar el PDF con un nombre identificativo
  let fileName = nombreConductor ? nombreConductor.trim().toLowerCase() : "test_drive";
  fileName = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  doc.save(`test_drive_${fileName || "document"}.pdf`);
}