async function generarAutorizacionPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Obtener valores del formulario
  const diasValidos = document.getElementById("dias_validos").value;
  const lugarFecha = document.getElementById("lugar_fecha").value;
  const autorizado = document.getElementById("autorizado").value;
  const titular = document.getElementById("titular").value;

  const marca = document.getElementById("marca").value;
  const modelo = document.getElementById("modelo").value;
  const tipo = document.getElementById("tipo").value;
  const anio = document.getElementById("anio").value;
  const motor = document.getElementById("motor").value;
  const chasis = document.getElementById("chasis").value;
  const dominio = document.getElementById("dominio").value;
  const domicilioAuto = document.getElementById("domicilio_auto").value;
  const otrasCaracteristicas = document.getElementById("otras_caracteristicas").value;

  const propietarioNombre = document.getElementById("propietario_nombre").value;
  const propietarioDni = document.getElementById("propietario_dni").value;
  const propietarioDomicilio = document.getElementById("propietario_domicilio").value;
  const propietarioLocalidad = document.getElementById("propietario_localidad").value;

  // Datos del mandatario (fijos)
  const mandatarioNombre = "Valeria Luján Díaz";
  const mandatarioMatricula = "M201727276055394DN";
  const mandatarioDomicilio = "Piedrabuena 1578";
  const mandatarioLocalidad = "Tandil";

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PERMISO DE AUTORIZACIÓN PARA CIRCULAR", 105, 15, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Ley Nº 20.167`, 20, 25);
  doc.text(`Válido por: ${diasValidos} días`, 120, 25);
  doc.text(`Lugar y Fecha: ${lugarFecha}`, 20, 32);

  // Cuerpo del permiso
  doc.text(`Hacemos constar por la presente que autorizamos al/la Sr./Sra. ${autorizado}`, 20, 42);
  doc.text(`a conducir por todo el territorio de la República Argentina el automotor de titularidad del Sr./Sra. ${titular}`, 20, 49);

  doc.text(`Marca: ${marca}   Modelo: ${modelo}   Tipo: ${tipo}   Año: ${anio}`, 20, 59);
  doc.text(`Motor Nº: ${motor}   Chasis Nº: ${chasis}`, 20, 66);
  doc.text(`Dominio Nº: ${dominio}   Ubicación: ${domicilioAuto}`, 20, 73);

  doc.text("La presente autorización no exime al autorizado/a de su responsabilidad derivada de daños y perjuicios", 20, 83);
  doc.text("a Terceros, sean personas o cosas con el automotor de referencia.", 20, 88);
  doc.text("Se expide este documento conjuntamente con su actual propietario/a de quien se ha recibido, al solo", 20, 95);
  doc.text("efecto de realizar las gestiones de la respectiva documentación.", 20, 100);

  doc.text("CÉDULA DE IDENTIFICACIÓN del mencionado automotor, que lo autoriza a circular de acuerdo a lo establecido", 20, 110);
  doc.text("por la ley del Automotor en vigencia que se cita abajo, sirviendo por lo tanto, la presente autorización", 20, 115);
  doc.text("como prueba fehaciente de la imposibilidad de suministrarla.", 20, 120);

  if (otrasCaracteristicas) {
    doc.text(`* Otras características: ${otrasCaracteristicas}`, 20, 128);
  }

  // Firmas
  doc.line(20, 138, 90, 138); // Línea firma propietario
  doc.line(120, 138, 190, 138); // Línea firma mandataria

  doc.text("Propietario Actual", 35, 143);

  // Nombre del mandatario "escrito" sobre la línea y datos debajo
  doc.text(mandatarioNombre, 130, 136); // Justo sobre la línea
  doc.text("Mandataria Interviniente", 130, 143);
  doc.text(`Nº de Matrícula: ${mandatarioMatricula}`, 130, 148);
  doc.text(`Domicilio: ${mandatarioDomicilio}`, 130, 153);
  doc.text(`Localidad: ${mandatarioLocalidad}`, 130, 158);

  // Datos propietario
  doc.text(`D.N.I: ${propietarioDni}`, 20, 153);
  doc.text(`Domicilio: ${propietarioDomicilio}`, 20, 160);
  doc.text(`Localidad: ${propietarioLocalidad}`, 20, 167);

  // Pie de página
  doc.setFontSize(9);
  doc.text("DECRETO LEY 6582/58 RATIFICADO POR LEY 14467, MODIFICADO POR DECRETO LEY Nº 5120/63 Y LEY 20.167", 20, 180);
  doc.text("(*) En caso de no presentarse Cédula de Identificación se dejará constancia en el presente documento de que", 20, 185);
  doc.text("“NO JUSTIFICA” dicha carencia “FEHACIENTEMENTE LA IMPOSIBILIDAD MATERIAL DE SUMINISTRARLA”.", 20, 190);

  // Descargar PDF
  doc.save("autorizacion_para_circular.pdf");
}
