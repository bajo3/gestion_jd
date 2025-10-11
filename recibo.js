async function generarReciboPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Helpers
  const get = (id) => (document.getElementById(id)?.value || "").trim();
  const upper = (s) => (s || "").toUpperCase();
  const currency = (n) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })
      .format(Number(n || 0));

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

  // Avanza correlativo
  const nroActual = get("recibo_nro");
  (function advanceCounter() {
    const y = new Date().getFullYear();
    let c = Number(localStorage.getItem("reciboCounter") || "0");
    localStorage.setItem("reciboCounter", String(c + 1));
    document.getElementById("recibo_nro").value = `REC-${y}-${String(c + 2).padStart(4, "0")}`;
  })();

  // ===== Layout (ajustable) =====
  const L = 15;       // margen izq
  const R = 195;      // margen der útil
  const W = R - L;    // ancho útil
  const LABEL_W = 62; // ancho columna etiqueta (↑ para etiquetas largas)
  const ROW_H = 8;    // alto de fila
  const LINE_DY = 4.0;    // línea debajo del texto
  const VALUE_DY = -0.2;  // texto un pelín arriba
  const HEADER_SPACING = 14; // espacio extra tras el encabezado

  // Etiqueta a la derecha dentro de la columna; valor siempre a la derecha de la columna
  const drawField = (y, label, value = "") => {
    const labelRight = L + LABEL_W;          // borde derecho de la columna de etiqueta
    const lineX1 = labelRight + 4;           // inicio de la línea
    const lineX2 = R;
    const lineY  = y + LINE_DY;
    const valY   = y + VALUE_DY;

    // etiqueta alineada a la derecha (no invade el valor)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(label + ":", labelRight, y, { align: "right" });

    // línea
    doc.setLineWidth(0.3);
    doc.setDrawColor(160,160,160);
    doc.line(lineX1, lineY, lineX2, lineY);
    doc.setDrawColor(0);

    // valor (si existe)
    if (value) {
      doc.setFont("helvetica", "normal");
      doc.text(value, lineX1 + 1.6, valY);
    }
  };

  const drawSection = (y, title) => {
    doc.setFillColor(245,245,245);
    doc.roundedRect(L - 1.5, y - 5, W + 3, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, L, y + 2);
    doc.setDrawColor(200,200,200);
    doc.line(L - 1.5, y + 5, L - 1.5 + W + 3, y + 5);
    doc.setDrawColor(0);
  };

  // Un bloque de recibo (Original/Duplicado)
  async function drawReceiptBlock(yStart, marcaOriginal = true) {
    let y = yStart;

    // Logo + título + marca
    try {
      const logo = await loadImageDataURL("logo.png");
      if (logo) doc.addImage(logo, "PNG", L, yStart - 4, 22, 10); // queda arriba a la izq
    } catch {}
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RECIBO", 105, yStart + 2, { align: "center" });
    doc.setFontSize(10);
    doc.text(marcaOriginal ? "ORIGINAL" : "DUPLICADO", R, yStart + 2, { align: "right" });

    // Comenzar los campos más abajo para no chocar con el logo
    y = yStart + HEADER_SPACING;

    // Cabecera
    doc.setFont("helvetica", "normal"); doc.setFontSize(12);
    drawField(y, "N°", nroActual); y += ROW_H;
    drawField(y, "Fecha", get("fecha")); y += ROW_H;
    drawField(y, "Tipo", get("tipo")); y += ROW_H;

    // Quién paga
    drawSection(y, "Quién paga"); y += 10;
    drawField(y, "Apellido y Nombre / Razón Social", get("cliente")); y += ROW_H;
    drawField(y, "DNI / CUIT", get("doc")); y += ROW_H;
    drawField(y, "Domicilio", get("domicilio")); y += ROW_H;
    drawField(y, "Localidad / Provincia", get("localidad")); y += ROW_H;

    // Concepto / Detalle (hasta 3 renglones)
    drawSection(y, "Concepto / Detalle"); y += 10;
    const concepto = get("concepto") || "—";
    const conceptLines = doc.splitTextToSize(concepto, W - (LABEL_W + 12));
    const conceptRows = Math.max(3, conceptLines.length);
    for (let i = 0; i < conceptRows; i++) {
      const lineY = y + i * ROW_H;
      drawField(lineY, i === 0 ? "Detalle" : "", conceptLines[i] || "");
    }
    y += ROW_H * conceptRows;

    // Importe
    drawSection(y, "Importe"); y += 10;
    const montoNum = Number(get("monto") || 0);
    const letras = get("monto_letras") || numALetras(montoNum);
    drawField(y, "Monto (ARS)", currency(montoNum)); y += ROW_H;
    drawField(y, "En letras", letras); y += ROW_H;
    drawField(y, "Forma de pago", get("forma")); y += ROW_H;
    drawField(y, "Detalle del pago", get("detalle_pago")); y += ROW_H;

    // Vehículo (opcional)
    drawSection(y, "Vehículo (opcional)"); y += 10;
    drawField(y, "Marca / Modelo", get("vehiculo")); y += ROW_H;
    drawField(y, "Dominio", upper(get("vehiculo_dominio"))); y += ROW_H;

    // Observaciones (2 renglones)
    drawSection(y, "Observaciones"); y += 10;
    const obs = get("obs") || "—";
    const obsLines = doc.splitTextToSize(obs, W - (LABEL_W + 12));
    const obsRows = Math.max(2, obsLines.length);
    for (let i = 0; i < obsRows; i++) {
      const lineY = y + i * ROW_H;
      drawField(lineY, i === 0 ? "Obs." : "", obsLines[i] || "");
    }
    y += ROW_H * obsRows + 2;

    // Firma
    const firmaY = y + 14;
    doc.setDrawColor(0);
    doc.line(L + 20, firmaY, L + 80, firmaY);
    doc.setFont("helvetica", "normal");
    doc.text("Firma / Aclaración", L + 25, firmaY + 5);

    // Pie
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Generado por Jesús Díaz Automotores", 105, y + 28, { align: "center" });
    doc.setTextColor(0);

    return y + 32; // altura usada
  }

  // Dibujo
  let y = 20;
  await drawReceiptBlock(y, true); // ORIGINAL

  const quiereDuplicado = (get("duplicado") || "no") === "si";
  if (quiereDuplicado) {
    doc.addPage();
    await drawReceiptBlock(20, false); // DUPLICADO en hoja nueva
  }

  // Guardar
  const nombre = (get("cliente") || "sin_nombre")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  doc.save(`recibo_${nroActual}_${nombre || "sinnombre"}.pdf`);
}

/* ============
   Nº a letras
   ============ */
function numALetras(num) {
  num = Number(num || 0);
  const enteros = Math.floor(num);
  const cent = Math.round((num - enteros) * 100);
  if (enteros === 0) return `cero pesos con ${String(cent).padStart(2,"0")}/100`;
  return `${toSpanish(enteros)} ${enteros === 1 ? "peso" : "pesos"} con ${String(cent).padStart(2,"0")}/100`;
}
function toSpanish(n) {
  const u = ["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve"];
  const d = ["","","veinte","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
  const c = ["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"];
  if (n === 0) return "cero";
  if (n === 100) return "cien";
  if (n < 20) return u[n];
  if (n < 30) return n === 20 ? "veinte" : "veinti" + toSpanish(n - 20);
  if (n < 100) { const D = Math.floor(n/10), U = n%10; return d[D] + (U ? " y " + u[U] : ""); }
  if (n < 1000) { const C = Math.floor(n/100), R = n%100; return c[C] + (R ? " " + toSpanish(R) : ""); }
  if (n < 1_000_000) { const M = Math.floor(n/1000), R = n%1000; return (M===1?"mil":toSpanish(M)+" mil") + (R ? " " + toSpanish(R) : ""); }
  if (n < 1_000_000_000) { const MI = Math.floor(n/1_000_000), R = n%1_000_000; return (MI===1?"un millón":toSpanish(MI)+" millones") + (R ? " " + toSpanish(R) : ""); }
  return String(n);
}
