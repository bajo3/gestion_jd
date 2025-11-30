async function generarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Datos fijos del vendedor
    const nombreVendedor = "Jesus Luciano Diaz";
    const domicilioVendedor = "Piedrabuena 1578";
    const cuitVendedor = "20-32498911-1";
    const telefonoVendedor = "2494587046";

    // Obtener valores del formulario
    const fecha = document.getElementById("fecha")?.value || "";
    const recibido = document.getElementById("recibido")?.value || "";
    const numeroDoc = document.getElementById("numero_doc")?.value || "";
    const telefono = document.getElementById("telefono")?.value || "";
    const domicilio = document.getElementById("domicilio")?.value || "";
    const cantidadNum = document.getElementById("cantidad_num")?.value || "";
    const dominio = document.getElementById("dominio")?.value || "";
    const marca = document.getElementById("marca")?.value || "";
    const modelo = document.getElementById("modelo")?.value || "";
    const tipo = document.getElementById("tipo")?.value || "";
    const nMotor = document.getElementById("n_motor")?.value || "";
    const nChasis = document.getElementById("n_chasis")?.value || "";
    const observaciones = document.getElementById("observaciones")?.value || "";

    // Limpieza y formato del monto
    const montoLimpio = cantidadNum.replace(/\./g, '').replace(',', '.');
    const montoFormateado = cantidadNum
        ? Number(montoLimpio).toLocaleString('es-AR')
        : "________________________";

    const nombreArchivo = `boleto_${recibido.replace(/\s+/g, "_") || "sin_nombre"}.pdf`;

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("BOLETO COMPRA VENTA", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Fecha: ${fecha || "________________________"}`, 20, 25);
    doc.line(20, 28, 190, 28);

    // Datos del Comprador
    doc.setTextColor(0, 102, 204);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Datos del Comprador", 20, 38);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${recibido || "________________________"}`, 20, 48);
    doc.text(`DNI: ${numeroDoc || "____________"}   Teléfono: ${telefono || "____________"}`, 20, 56);
    doc.text(`Domicilio: ${domicilio || "___________________________________________"}`, 20, 64);
    doc.text(`Monto recibido: $${montoFormateado}`, 20, 72);
    doc.line(20, 75, 190, 75);

    // Datos del Automotor
    doc.setTextColor(0, 102, 204);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Datos del Automotor", 20, 85);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Dominio: ${dominio || "_________________"}`, 20, 95);
    doc.text(`Marca: ${marca || "__________"}   Modelo: ${modelo || "__________"}`, 20, 103);
    doc.text(`Tipo: ${tipo || "__________"}   Nº Motor: ${nMotor || "__________"}   Nº Chasis: ${nChasis || "__________"}`, 20, 111);

    // Observaciones dinámicas
    const obsTexto = observaciones || "Sin observaciones.";
    const obsLineas = doc.splitTextToSize(`Observaciones: ${obsTexto}`, 170);
    doc.text(obsLineas, 20, 119);
    const alturaDespuesObs = 119 + obsLineas.length * 7;
    doc.line(20, alturaDespuesObs + 3, 190, alturaDespuesObs + 3);

    // Datos del Vendedor
    let y = alturaDespuesObs + 13;
    doc.setTextColor(0, 102, 204);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Datos del Vendedor", 20, y);

    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${nombreVendedor}`, 20, y); y += 8;
    doc.text(`Domicilio: ${domicilioVendedor}`, 20, y); y += 8;
    doc.text(`CUIT: ${cuitVendedor}`, 20, y); y += 8;
    doc.text(`Teléfono: ${telefonoVendedor}`, 20, y);
    doc.line(20, y + 3, 190, y + 3);

    // Firmas con aclaración más baja
    y += 18;
    doc.text("____________________________", 20, y);
    doc.text("Firma del Comprador", 20, y + 5);
    doc.text(`Aclaración: ${recibido || "________________________"}`, 20, y + 17);

    doc.text("____________________________", 120, y);
    doc.text("Firma del Vendedor", 120, y + 5);
    doc.text("Aclaración: ____________________________", 120, y + 17);

    // Logo (ajustado a la parte inferior)
    const logo = new Image();
    logo.src = "logo.png";

    let pdfGuardado = false;

    function guardarPDF() {
        if (!pdfGuardado) {
            doc.save(nombreArchivo);
            pdfGuardado = true;
        }
    }

    logo.onload = function () {
        doc.addImage(logo, "PNG", 70, y + 30, 70, 20);
        guardarPDF();
    };
    logo.onerror = guardarPDF;

    // Fallback por si el logo tarda
    setTimeout(() => guardarPDF(), 2000);
}
