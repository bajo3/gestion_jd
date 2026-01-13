async function generarDateroPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // === Helpers ===
  const get = (id) => (document.getElementById(id)?.value || "").trim();
  const getNombreArchivo = () => {
    let nombre = (document.getElementById("nombre")?.value || "").trim().toLowerCase();
    if (!nombre) nombre = "sin_nombre";
    nombre = nombre
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    return `datero_${nombre}.pdf`;
  };
  const loadImageDataURL = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  // === Layout ===
  const L = 20;   // margen izq
  const R = 190;  // x derecha útil
  const W = R - L;
  let y = 18;

  // alto de línea y offsets para que el texto quede ARRIBA de la línea
  const ROW_H   = 8;     // separación vertical entre filas
  const LINE_DY = 3.6;   // cuánto más abajo va la línea
  const VALUE_DY= 1.4;   // cuánto más abajo del label va el valor (queda arriba de la línea)
  const LABEL_W = 58;    // ancho de columna etiqueta

  const PAGE_BOTTOM = 270;
  const newPageIfNeeded = (rows = 1) => {
    if (y + rows * ROW_H > PAGE_BOTTOM) { doc.addPage(); y = 20; }
  };

  // sección con banda suave
  const section = (title) => {
    newPageIfNeeded(3);
    doc.setFillColor(245,245,245);
    doc.roundedRect(L - 1.5, y - 5, W + 3, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text(title, L, y + 2);
    y += 10;
    doc.setDrawColor(200,200,200);
    doc.line(L - 1.5, y - 4, L - 1.5 + W + 3, y - 4);
    doc.setDrawColor(0);
    doc.setFont("helvetica","normal"); doc.setFontSize(12);
  };

  // campo alineado (texto visible arriba de la línea)
  const field = (label, value = "") => {
    newPageIfNeeded(1);
    const labelX = L, labelY = y;                  // etiqueta
    const lineX1 = L + LABEL_W + 2, lineX2 = R;    // línea
    const lineY  = y + LINE_DY;                    // posición de línea (más abajo)
    const valY   = y + VALUE_DY;                   // valor por arriba de la línea

    // etiqueta
    doc.setFont("helvetica","bold");
    doc.text(label + ":", labelX, labelY);

    // línea de escritura
    doc.setLineWidth(0.3);
    doc.setDrawColor(160,160,160);
    doc.line(lineX1, lineY, lineX2, lineY);
    doc.setDrawColor(0);

    // valor (si hay), encima de la línea
    if (value) {
      doc.setFont("helvetica","normal");
      doc.text(value, lineX1 + 1.2, valY);
    }

    y += ROW_H;
  };

  // campo multilinea (caja A4 para texto libre)
  const multilineField = (label, value = "", boxH = 24) => {
    // etiqueta
    newPageIfNeeded(4);
    doc.setFont("helvetica","bold");
    doc.text(label + ":", L, y);
    y += 4;

    // caja
    doc.setLineWidth(0.3);
    doc.setDrawColor(160,160,160);
    doc.roundedRect(L, y, W, boxH, 1.8, 1.8);
    doc.setDrawColor(0);

    // texto envuelto (si hay)
    if (value) {
      doc.setFont("helvetica","normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(value, W - 6);
      doc.text(lines.slice(0, 10), L + 3, y + 6); // límite por seguridad
      doc.setFontSize(12);
    }

    y += boxH + 8;
  };

  // === Header con logo y título
  try {
    const logo = await loadImageDataURL("logo.png");
    if (logo) doc.addImage(logo, "PNG", L, 10, 22, 10); // 22mm de ancho
  } catch {}
  doc.setFont("helvetica","bold"); doc.setFontSize(14);
  doc.text("DATOS PARA LA TRANSFERENCIA DE UNA UNIDAD", 105, 18, { align: "center" });
  y = 28;

  // === Datos del Comprador
  section("Datos del Comprador");
  field("Apellido y Nombre", get("nombre"));
  field("DNI", get("dni"));
  field("Fecha de Nacimiento", get("fecha_nacimiento"));
  field("Lugar", get("lugar"));
  field("Dirección Real", get("direccion_real"));
  field("Dirección en DNI", get("direccion_dni"));
  field("Localidad", get("localidad"));
  field("Código Postal", get("codigo_postal"));
  field("Provincia", get("provincia"));
  field("Teléfono", get("telefono"));
  field("Celular", get("celular"));
  field("Email", get("email"));
  field("CUIL/CUIT", get("cuil"));
  field("Condición Fiscal", get("condicion_fiscal"));
  field("Estado Civil", get("estado_civil"));

  // Detalles (texto libre)
  multilineField("Detalles", get("detalles"), 26);

  // === Datos del Cónyuge
  section("Datos del Cónyuge");
  field("Apellido y Nombre", get("conyuge_nombre"));
  field("DNI", get("conyuge_dni"));

  // === Datos Finales
  section("Datos Finales");
  field("Fecha de la operación", get("fecha_operacion"));

  // Crédito (opcional)
  const tomaCredito = (document.getElementById("toma_credito")?.value || "no").toLowerCase();
  field("Toma crédito", tomaCredito === "si" ? "Sí" : "No");
  if (tomaCredito === "si") {
    field("Total del crédito ($)", get("credito_total"));
    field("Cantidad y valor de cuotas", get("credito_cuotas"));
  }

  // === Auto que entrega (opcional)
  const entrega = (document.getElementById("entrega_ppa")?.value || "no").toLowerCase();
  if (entrega === "si") {
    section("Auto que entrega");
    field("Dominio", (get("ppa_dominio") || "").toUpperCase());
    field("Marca", get("ppa_marca"));
    field("Modelo", get("ppa_modelo"));
    field("Año", get("ppa_anio"));
  }

  // === Sello inferior
  doc.setFont("helvetica","bold"); doc.setFontSize(16);
  doc.text(`Dominio: ${(get("dominio") || "").toUpperCase()}`, 105, 270, { align: "center" });

  // Footer
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(120);
  doc.text("Generado por Jesús Díaz Automotores", 105, 285, { align: "center" });
  doc.setTextColor(0);

  doc.save(getNombreArchivo());
}
