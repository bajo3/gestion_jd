import type { AutorizacionFormValues } from "@/types/forms";
import { createPdf } from "./common";

export async function generateAutorizacionPdf(values: AutorizacionFormValues) {
  const doc = createPdf();
  const lugarFecha = [values.lugar, values.fecha].filter(Boolean).join(", ");

  const mandatarioNombre = "Valeria Lujan Diaz";
  const mandatarioMatricula = "M201727276055394DN";
  const mandatarioDomicilio = "Piedrabuena 1578";
  const mandatarioLocalidad = "Tandil";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PERMISO DE AUTORIZACION PARA CIRCULAR", 105, 15, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Ley N° 20.167", 20, 25);
  doc.text(`Valido por: ${values.diasValidos} dias`, 120, 25);
  doc.text(`Lugar y Fecha: ${lugarFecha}`, 20, 32);

  doc.text(`Hacemos constar por la presente que autorizamos al/la Sr./Sra. ${values.autorizado}`, 20, 42);
  doc.text(
    `a conducir por todo el territorio de la Republica Argentina el automotor de titularidad del Sr./Sra. ${values.titular}`,
    20,
    49,
  );

  doc.text(
    `Marca: ${values.marca}   Modelo: ${values.modelo}   Tipo: ${values.tipo}   Año: ${values.anio}`,
    20,
    59,
  );
  doc.text(`Motor N°: ${values.motor}   Chasis N°: ${values.chasis}`, 20, 66);
  doc.text(`Dominio N°: ${values.dominio}   Ubicacion: ${values.domicilioAuto}`, 20, 73);

  doc.text(
    "La presente autorizacion no exime al autorizado/a de su responsabilidad derivada de daños y perjuicios",
    20,
    83,
  );
  doc.text("a terceros, sean personas o cosas con el automotor de referencia.", 20, 88);
  doc.text(
    "Se expide este documento conjuntamente con su actual propietario/a de quien se ha recibido, al solo",
    20,
    95,
  );
  doc.text("efecto de realizar las gestiones de la respectiva documentacion.", 20, 100);
  doc.text(
    "Cedula de identificacion del mencionado automotor, que lo autoriza a circular de acuerdo a lo establecido",
    20,
    110,
  );
  doc.text(
    "por la ley del Automotor en vigencia que se cita abajo, sirviendo por lo tanto, la presente autorizacion",
    20,
    115,
  );
  doc.text("como prueba fehaciente de la imposibilidad de suministrarla.", 20, 120);

  if (values.otrasCaracteristicas) {
    doc.text(`* Otras caracteristicas: ${values.otrasCaracteristicas}`, 20, 128);
  }

  doc.line(20, 138, 90, 138);
  doc.line(120, 138, 190, 138);

  doc.text("Propietario Actual", 35, 143);
  doc.text(mandatarioNombre, 130, 136);
  doc.text("Mandataria Interviniente", 130, 143);
  doc.text(`N° de Matricula: ${mandatarioMatricula}`, 130, 148);
  doc.text(`Domicilio: ${mandatarioDomicilio}`, 130, 153);
  doc.text(`Localidad: ${mandatarioLocalidad}`, 130, 158);
  doc.text(`D.N.I: ${values.propietarioDni}`, 20, 153);
  doc.text(`Domicilio: ${values.propietarioDomicilio}`, 20, 160);
  doc.text(`Localidad: ${values.propietarioLocalidad}`, 20, 167);

  doc.setFontSize(9);
  doc.text(
    "DECRETO LEY 6582/58 RATIFICADO POR LEY 14467, MODIFICADO POR DECRETO LEY N° 5120/63 Y LEY 20.167",
    20,
    180,
  );
  doc.text(
    "(*) En caso de no presentarse Cedula de Identificacion se dejara constancia en el presente documento de que",
    20,
    185,
  );
  doc.text(
    '"NO JUSTIFICA" dicha carencia "FEHACIENTEMENTE LA IMPOSIBILIDAD MATERIAL DE SUMINISTRARLA".',
    20,
    190,
  );

  doc.save("autorizacion_para_circular.pdf");
}
