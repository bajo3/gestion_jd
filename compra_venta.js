async function generarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    

    // Obtener valores del formulario
    const fecha = document.getElementById("fecha").value;
    const recibido = document.getElementById("recibido").value;
    const numeroDoc = document.getElementById("numero_doc").value;
    const telefono = document.getElementById("telefono").value;
    const domicilio = document.getElementById("domicilio").value;
    const cantidadNum = document.getElementById("cantidad_num").value;
    const dominio = document.getElementById("dominio").value;
    const marca = document.getElementById("marca").value;
    const modelo = document.getElementById("modelo").value;
    const tipo = document.getElementById("tipo").value;
    const nMotor = document.getElementById("n_motor").value;
    const nChasis = document.getElementById("n_chasis").value;
    const observaciones = document.getElementById("observaciones").value;
    const nombreVendedor = document.getElementById("nombre_vendedor").value;
    const domicilioVendedor = document.getElementById("domicilio_vendedor").value;
    const numeroDocVendedor = document.getElementById("numero_doc_vendedor").value;
    const telefonoVendedor = document.getElementById("telefono_vendedor").value;

    const montoFormateado = Number(cantidadNum).toLocaleString('es-AR');

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("BOLETO COMPRA VENTA", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Fecha: ${fecha}`, 20, 25);
    doc.line(20, 28, 190, 28);

    // Datos del Comprador
    doc.setTextColor(0, 102, 204);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Datos del Comprador", 20, 38);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${recibido}`, 20, 48);
    doc.text(`DNI: ${numeroDoc}   Teléfono: ${telefono}`, 20, 56);
    doc.text(`Domicilio: ${domicilio}`, 20, 64);
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
    doc.text(`Dominio: ${dominio}`, 20, 95);
    doc.text(`Marca: ${marca}   Modelo: ${modelo}`, 20, 103);
    doc.text(`Tipo: ${tipo}   Nº Motor: ${nMotor}   Nº Chasis: ${nChasis}`, 20, 111);
    doc.text(`Observaciones: ${observaciones}`, 20, 119, { maxWidth: 170 });
    doc.line(20, 122, 190, 122);

    // Datos del Vendedor
    doc.setTextColor(0, 102, 204);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Datos del Vendedor", 20, 132);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre: ${nombreVendedor}`, 20, 142);
    doc.text(`Domicilio: ${domicilioVendedor}`, 20, 150);
    doc.text(`DNI: ${numeroDocVendedor}`, 20, 158);
    doc.text(`Teléfono: ${telefonoVendedor}`, 20, 166);
    doc.line(20, 169, 190, 169);

    // Firmas
    doc.text("____________________________", 20, 185);
    doc.text("Firma del Comprador", 20, 190);
    doc.text("____________________________", 120, 185);
    doc.text("Firma del Vendedor", 120, 190);

    // Logo y descarga segura
    const logo = new Image();
    logo.src = "logo.png";

    let pdfGuardado = false;

    function guardarPDF() {
        if (!pdfGuardado) {
            doc.save("boleto_compra_venta.pdf");
            pdfGuardado = true;
        }
    }

    logo.onload = function () {
        doc.addImage(logo, "PNG", 70, 200, 70, 20);
        guardarPDF();
    };

    logo.onerror = function () {
        guardarPDF();
    };

    // Backup por si ningún evento se dispara
    setTimeout(() => guardarPDF(), 2000);
}
