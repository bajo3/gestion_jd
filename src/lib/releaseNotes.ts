export type ReleaseNote = {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  items: string[];
};

/** Lo nuevo de cada version, de la mas reciente a la mas vieja. Sumar arriba cada cambio que se publique. */
export const releaseNotes: ReleaseNote[] = [
  {
    version: "2.6",
    date: "2026-11-18",
    title: "App instalable y DNI en el cliente",
    items: [
      "Gestión JD se puede instalar en el celular y en la PC como una app, con su ícono y a pantalla completa.",
      "Nueva sección Notas de versión con las mejoras de cada actualización.",
      "En Clientes, toda la tarjeta abre la ficha y se pinta de violeta al pasar el mouse.",
      "El PDF del Datero suma una hoja con la foto del frente y el dorso del DNI, lista para imprimir.",
      "La ficha del cliente muestra el DNI de los dos lados; se puede cargar o cambiar desde ahí.",
    ],
  },
  {
    version: "2.5",
    date: "2026-11-17",
    title: "Lectura del DNI con IA",
    items: [
      "Si el código de barras del DNI no se lee, la foto la lee la IA.",
      "En el Datero y en Formulario Cliente se adjuntan las fotos del frente y dorso del DNI; quedan guardadas.",
      "Con el dorso, se completan solos la dirección según DNI y el lugar de nacimiento.",
    ],
  },
  {
    version: "2.4",
    date: "2026-11-06",
    title: "Datero y Recibo",
    items: [
      "El campo Detalles del Datero se lee con IA y completa Compra y Venta, Recibo, Presupuesto y Operación finalizada.",
      "El Recibo permite elegir pesos o dólares y escribe el monto en letras según la moneda.",
      "El menú lateral se puede desplazar cuando no entra en la pantalla.",
    ],
  },
  {
    version: "2.3",
    date: "2026-10-13",
    title: "Historial de autos y postventa",
    items: [
      "Historial de autos en tarjetas con fotos.",
      "Seguimiento de postventa escalonado, aviso de cumpleaños de clientes y antigüedad del stock.",
    ],
  },
  {
    version: "2.2",
    date: "2026-10-10",
    title: "Carga de boletos",
    items: [
      "Nueva sección Cargar boletos: se sube el boleto de compra-venta en PDF o foto y la IA lee los datos.",
      "Se revisan los datos antes de confirmar; al confirmar se cargan el cliente, el auto y la venta.",
      "El archivo se guarda apenas se sube y se puede quitar con la X.",
    ],
  },
  {
    version: "2.1",
    date: "2026-10-08",
    title: "Asistente y Qué hacer hoy",
    items: [
      "Panel Qué hacer hoy en Inicio, con mensajes de WhatsApp ya armados para cada cliente.",
      "Rutina diaria con resumen por Telegram, sección Leads y lectura del DNI desde una foto.",
      "Calculadora de quebranto con cuotas, patentamiento y descarga en PDF.",
    ],
  },
  {
    version: "2.0",
    date: "2026-09-30",
    title: "Lista de precios y ventas",
    items: [
      "Lista de precios con estados, impresión en PDF y sincronización con la planilla de Google.",
      "Los documentos se completan entre sí con los mismos datos del cliente y del auto.",
      "Cierre de venta simplificado y ventas con datos faltantes marcadas en rojo.",
      "Consultas ordenadas por cliente, con los PDF en la ficha de cada uno.",
    ],
  },
];
