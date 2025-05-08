async function generarDateroPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
  
    // Obtener campos
    const get = id => document.getElementById(id).value;
  
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DATOS PARA LA TRANSFERENCIA DE UNA UNIDAD", 105, 15, { align: "center" });
  
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
  
    let y = 25;
  
    doc.text(`Apellido y Nombre: ${get("nombre")}`, 20, y); y += 7;
    doc.text(`DNI: ${get("dni")}`, 20, y); y += 7;
    doc.text(`Fecha de Nacimiento: ${get("fecha_nacimiento")}   Lugar: ${get("lugar")}`, 20, y); y += 7;
    doc.text(`Dirección Real: ${get("direccion_real")}`, 20, y); y += 7;
    doc.text(`Dirección en DNI: ${get("direccion_dni")}`, 20, y); y += 7;
    doc.text(`Localidad: ${get("localidad")}   Código Postal: ${get("codigo_postal")}`, 20, y); y += 7;
    doc.text(`Provincia: ${get("provincia")}   Teléfono: ${get("telefono")}`, 20, y); y += 7;
    doc.text(`Celular: ${get("celular")}   Email: ${get("email")}`, 20, y); y += 7;
    doc.text(`CUIL/CUIT: ${get("cuil")}   Condición Fiscal: ${get("condicion_fiscal")}`, 20, y); y += 7;
    doc.text(`Estado Civil: ${get("estado_civil")}`, 20, y); y += 10;
  
    doc.setFont("helvetica", "bold");
    doc.text("Datos del Cónyuge", 20, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Apellido y Nombre: ${get("conyuge_nombre")}`, 20, y); y += 7;
    doc.text(`DNI: ${get("conyuge_dni")}`, 20, y); y += 10;
  

  
    doc.setFont("helvetica", "bold");
    doc.text("Datos Finales", 20, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de la operación: ${get("fecha_operacion")}`, 20, y); y += 7;
    doc.text(`Dominio: ${get("dominio")}`, 20, y); y += 10;
  
    doc.save("datos_transferencia_unidad.pdf");
  }
  