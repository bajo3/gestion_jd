async function generarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Obtener valores del formulario
    const fecha = document.getElementById("fecha").value;
    const recibido = document.getElementById("recibido").value;
    const tipoDoc = document.getElementById("tipo_doc").value;
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
    const tipoDocVendedor = document.getElementById("tipo_doc_vendedor").value;
    const numeroDocVendedor = document.getElementById("numero_doc_vendedor").value;
    const telefonoVendedor = document.getElementById("telefono_vendedor").value;

    // Encabezado
    doc.setFontSize(14);
    doc.text("BOLETO COMPRA VENTA", 70, 15);
    doc.setFontSize(11);
    doc.text(`Fecha: ${fecha}`, 20, 25); // Se muestra la fecha ingresada
    doc.text(`Recibí del Sr/a: ${recibido}`, 20, 35);
    doc.text(`Doc. Id. Tipo: ${tipoDoc}  Nº: ${numeroDoc}  Teléfono: ${telefono}`, 20, 45);
    doc.text(`Domicilio: ${domicilio}`, 20, 55);
    doc.text(`La cantidad de pesos $: ${cantidadNum}`, 20, 65);

    // Datos del Automotor
    doc.text("Datos del Automotor", 20, 75);
    doc.text(`Dominio: ${dominio}`, 20, 85);
    doc.text(`Marca: ${marca}  Modelo: ${modelo}`, 20, 95);
    doc.text(`Tipo: ${tipo}  Nº Motor: ${nMotor}  Nº Chasis: ${nChasis}`, 20, 105);
    doc.text(`Observaciones: ${observaciones}`, 20, 115, { maxWidth: 170 });

    // Datos del vendedor
    doc.text("Datos del Vendedor", 20, 130);
    doc.text(`Nombre: ${nombreVendedor}`, 20, 140);
    doc.text(`Domicilio: ${domicilioVendedor}`, 20, 150);
    doc.text(`Doc. Id. Tipo: ${tipoDocVendedor}  Nº: ${numeroDocVendedor}`, 20, 160);
    doc.text(`Teléfono: ${telefonoVendedor}`, 20, 170);

    // Espacio para firmas
    doc.text("____________________________", 20, 190);
    doc.text("Firma del Comprador", 20, 195);
    doc.text("____________________________", 120, 190);
    doc.text("Firma del Vendedor", 120, 195);

    // Agregar logo
    const logo = new Image();
    logo.src = "logo.png";
    logo.onload = function () {
        doc.addImage(logo, "PNG", 70, 210, 70, 20);
        doc.save("boleto_compra_venta.pdf");
    };
}
