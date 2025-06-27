async function generarDateroPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const get = (id, length = 40) => {
    const valor = document.getElementById(id).value.trim();
    return valor || "_".repeat(length);
  };

  const getNombreArchivo = () => {
    let nombre = document.getElementById("nombre").value.trim().toLowerCase();
    if (!nombre) nombre = "sin_nombre";

    // Reemplaza espacios por guiones bajos y elimina caracteres especiales
    nombre = nombre
      .normalize("NFD")                    // elimina acentos
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/gi, "_")        // reemplaza caracteres no alfanuméricos
      .replace(/_+/g, "_")                // evita dobles guiones bajos
      .replace(/^_|_$/g, "");             // quita guiones bajos al inicio/fin

    return `datero_${nombre}.pdf`;
  };

  let y = 20;
  const x = 20;

  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.text("DATOS PARA LA TRANSFERENCIA DE UNA UNIDAD", 105, y, { align: "center" });

  y += 10;
  doc.setFont("courier", "normal");
  doc.setFontSize(12);

  // Datos personales
  doc.text(`Apellido y Nombre: ${get("nombre", 40)}`, x, y); y += 7;
  doc.text(`DNI: ${get("dni", 15)}`, x, y); y += 7;
  doc.text(`Fecha de Nacimiento: ${get("fecha_nacimiento", 20)}`, x, y); y += 7;
  doc.text(`Lugar: ${get("lugar", 30)}`, x, y); y += 7;
  doc.text(`Dirección Real: ${get("direccion_real", 40)}`, x, y); y += 7;
  doc.text(`Dirección en DNI: ${get("direccion_dni", 40)}`, x, y); y += 7;
  doc.text(`Localidad: ${get("localidad", 30)}`, x, y); y += 7;
  doc.text(`Código Postal: ${get("codigo_postal", 10)}`, x, y); y += 7;
  doc.text(`Provincia: ${get("provincia", 25)}`, x, y); y += 7;
  doc.text(`Teléfono: ${get("telefono", 20)}`, x, y); y += 7;
  doc.text(`Celular: ${get("celular", 20)}`, x, y); y += 7;
  doc.text(`Email: ${get("email", 35)}`, x, y); y += 7;
  doc.text(`CUIL/CUIT: ${get("cuil", 15)}`, x, y); y += 7;
  doc.text(`Condición Fiscal: ${get("condicion_fiscal", 25)}`, x, y); y += 7;
  doc.text(`Estado Civil: ${get("estado_civil", 15)}`, x, y); y += 10;

  // Cónyuge
  doc.setFont("courier", "bold");
  doc.text("Datos del Cónyuge", x, y); y += 7;
  doc.setFont("courier", "normal");
  doc.text(`Apellido y Nombre: ${get("conyuge_nombre", 40)}`, x, y); y += 7;
  doc.text(`DNI: ${get("conyuge_dni", 15)}`, x, y); y += 10;

  // Finales
  doc.setFont("courier", "bold");
  doc.text("Datos Finales", x, y); y += 7;
  doc.setFont("courier", "normal");
  doc.text(`Fecha de la operación: ${get("fecha_operacion", 20)}`, x, y); y += 10;

  // Dominio centrado y destacado
  doc.setFont("courier", "bold");
  doc.setFontSize(18);
  doc.text(`Dominio: ${get("dominio", 10)}`, 105, 270, { align: "center" });

  // Guardar con nombre personalizado
  const nombreArchivo = getNombreArchivo();
  doc.save(nombreArchivo);
}
