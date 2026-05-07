export type CompraVentaFormValues = {
  fecha: string;
  recibido: string;
  numeroDoc: string;
  telefono: string;
  domicilio: string;
  cantidadNum: string;
  dominio: string;
  marca: string;
  modelo: string;
  tipo: string;
  nMotor: string;
  nChasis: string;
  observaciones: string;
};

export type AutorizacionFormValues = {
  diasValidos: string;
  lugar: string;
  fecha: string;
  autorizado: string;
  titular: string;
  marca: string;
  modelo: string;
  tipo: string;
  anio: string;
  motor: string;
  chasis: string;
  dominio: string;
  domicilioAuto: string;
  otrasCaracteristicas: string;
  propietarioNombre: string;
  propietarioDni: string;
  propietarioDomicilio: string;
  propietarioLocalidad: string;
};

export type DateroFormValues = {
  nombre: string;
  dni: string;
  fechaNacimiento: string;
  lugar: string;
  direccionReal: string;
  direccionDni: string;
  localidad: string;
  codigoPostal: string;
  provincia: string;
  telefono: string;
  celular: string;
  email: string;
  cuil: string;
  condicionFiscal: string;
  estadoCivil: string;
  detalles: string;
  conyugeNombre: string;
  conyugeDni: string;
  fechaOperacion: string;
  dominio: string;
  tomaCredito: "si" | "no";
  creditoTotal: string;
  creditoCuotas: string;
  entregaPpa: "si" | "no";
  ppaDominio: string;
  ppaMarca: string;
  ppaModelo: string;
  ppaAnio: string;
};

export type ReciboFormValues = {
  reciboNro: string;
  fecha: string;
  tipo: string;
  duplicado: "si" | "no";
  cliente: string;
  doc: string;
  domicilio: string;
  localidad: string;
  concepto: string;
  monto: string;
  montoLetras: string;
  forma: string;
  detallePago: string;
  vehiculo: string;
  vehiculoDominio: string;
  obs: string;
};

export type PresupuestoFormValues = {
  fecha: string;
  moneda: "ARS" | "USD";
  nombre: string;
  telefono: string;
  dni: string;
  detalles: string;
  vehModelo: string;
  vehAnio: string;
  vehKm: string;
  precioVenta: string;
  entregaEfectivo: string;
  usadoModelo: string;
  usadoAnio: string;
  usadoKm: string;
  usadoToma: string;
  tomaCredito: "si" | "no";
  creditoTotal: string;
  cuotasCant: string;
  gastosAdm: string;
  transferencia: string;
};

export type TestDriveFormValues = {
  fecha: string;
  horaSalida: string;
  horaLlegada: string;
  concesionario: string;
  marca: string;
  modelo: string;
  version: string;
  dominio: string;
  color: string;
  recorrido: string;
  kmInicial: string;
  kmFinal: string;
  combustibleInicial: string;
  combustibleFinal: string;
  sinDanos: boolean;
  rayones: boolean;
  golpes: boolean;
  observaciones: string;
  docDni: boolean;
  docLicencia: boolean;
  docCedula: boolean;
  nombreConductor: string;
  dniConductor: string;
  lugar: string;
  aclaracionConductor: string;
  nombreAsesor: string;
  aclaracionAsesor: string;
  docLicenciaCopia: boolean;
};

export type Calculadora0kmValues = {
  valorAuto: string;
  montoFinanciado: string;
  porcentajeQuebranto: string;
  aplicaIva: boolean;
  plazo: string;
  tna: string;
  campana: string;
};

export type FormularioClienteValues = {
  dni: string;
  cuil: string;
  situacionLaboral: string;
};

export type FormularioClienteImages = {
  dniFrente?: File | null;
  dniDorso?: File | null;
};
