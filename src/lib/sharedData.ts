import type { Client, ClientOperation } from "@/types/clients";
import type { Vehicle } from "@/types/vehicles";

/**
 * Datos de una operacion que se reciclan entre documentos (Datero, Boleto, Recibo,
 * Autorizacion, Presupuesto, Operacion finalizada). Cada documento tiene sus propios
 * nombres de campo; aca se traducen de ida y vuelta a un unico formato comun.
 */
export const SHARED_KEYS = [
  "nombre",
  "dni",
  "telefono",
  "email",
  "domicilio",
  "localidad",
  "provincia",
  "cuil",
  "estadoCivil",
  "fechaNacimiento",
  "fecha",
  "dominio",
  "marca",
  "modelo",
  "vehiculo",
  "anio",
  "km",
  "motor",
  "chasis",
  "tipo",
  "color",
  "precio",
  "tomaCredito",
  "creditoTotal",
  "creditoCuotas",
  "entregaEfectivo",
  "usadoModelo",
  "usadoAnio",
  "usadoKm",
  "usadoToma",
] as const;

export type SharedKey = (typeof SHARED_KEYS)[number];
export type SharedData = Partial<Record<SharedKey, string>>;

export type SharedDocType =
  | "datero"
  | "recibo"
  | "autorizacion"
  | "compra_venta"
  | "presupuesto_cliente"
  | "operacion_finalizada"
  | "formulario_cliente";

type Values = Record<string, unknown>;

/** Campos de identidad: solo se escriben en el cliente si el DNI es el mismo. */
export const IDENTITY_KEYS: SharedKey[] = [
  "nombre",
  "dni",
  "telefono",
  "email",
  "domicilio",
  "localidad",
  "provincia",
  "cuil",
  "estadoCivil",
  "fechaNacimiento",
];

function str(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function first(...values: unknown[]) {
  for (const value of values) {
    const text = str(value);
    if (text) return text;
  }
  return "";
}

function join(...parts: unknown[]) {
  return parts.map(str).filter(Boolean).join(" ");
}

/** "Parana / Entre Rios" -> ["Parana", "Entre Rios"] */
function splitPlace(value: unknown): [string, string] {
  const [place = "", region = ""] = str(value).split(/\s*\/\s*/);
  return [place.trim(), region.trim()];
}

function joinPlace(shared: SharedData) {
  return [shared.localidad, shared.provincia].filter(Boolean).join(" / ");
}

function clean(shared: SharedData): SharedData {
  const out: SharedData = {};
  for (const key of SHARED_KEYS) {
    const value = shared[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

function firstInt(value: unknown) {
  const match = str(value).match(/\d+/);
  return match ? match[0] : "";
}

/** Lo que este documento aporta a la operacion: solo campos con valor. */
export function toShared(type: SharedDocType, v: Values): SharedData {
  switch (type) {
    case "datero": {
      const trade = v.entregaPpa === "si";
      return clean({
        nombre: str(v.nombre),
        dni: str(v.dni),
        telefono: first(v.celular, v.telefono),
        email: str(v.email),
        domicilio: first(v.direccionReal, v.direccionDni),
        localidad: str(v.localidad),
        provincia: str(v.provincia),
        cuil: str(v.cuil),
        estadoCivil: str(v.estadoCivil),
        fechaNacimiento: str(v.fechaNacimiento),
        fecha: str(v.fechaOperacion),
        dominio: str(v.dominio),
        tomaCredito: str(v.tomaCredito),
        creditoTotal: str(v.creditoTotal),
        creditoCuotas: str(v.creditoCuotas),
        usadoModelo: trade ? join(v.ppaMarca, v.ppaModelo) : "",
        usadoAnio: trade ? str(v.ppaAnio) : "",
      });
    }
    case "recibo": {
      const [localidad, provincia] = splitPlace(v.localidad);
      return clean({
        nombre: str(v.cliente),
        dni: str(v.doc),
        domicilio: str(v.domicilio),
        localidad,
        provincia,
        vehiculo: str(v.vehiculo),
        dominio: str(v.vehiculoDominio),
      });
    }
    case "autorizacion":
      // El titular de la autorizacion puede no ser el comprador: solo se recicla el auto.
      return clean({
        marca: str(v.marca),
        modelo: str(v.modelo),
        tipo: str(v.tipo),
        anio: str(v.anio),
        motor: str(v.motor),
        chasis: str(v.chasis),
        dominio: str(v.dominio),
      });
    case "compra_venta":
      return clean({
        nombre: str(v.recibido),
        dni: str(v.numeroDoc),
        telefono: str(v.telefono),
        domicilio: str(v.domicilio),
        fecha: str(v.fecha),
        dominio: str(v.dominio),
        marca: str(v.marca),
        modelo: str(v.modelo),
        tipo: str(v.tipo),
        motor: str(v.nMotor),
        chasis: str(v.nChasis),
        precio: str(v.cantidadNum),
      });
    case "presupuesto_cliente":
    case "operacion_finalizada":
      return clean({
        nombre: str(v.nombre),
        dni: str(v.dni),
        telefono: str(v.telefono),
        vehiculo: str(v.vehModelo),
        anio: str(v.vehAnio),
        km: str(v.vehKm),
        precio: str(v.precioVenta),
        tomaCredito: str(v.tomaCredito),
        creditoTotal: str(v.creditoTotal),
        creditoCuotas: first(v.cuotasCant, v.creditoNumeroCuotas),
        entregaEfectivo: str(v.entregaEfectivo),
        usadoModelo: str(v.usadoModelo),
        usadoAnio: str(v.usadoAnio),
        usadoKm: str(v.usadoKm),
        usadoToma: str(v.usadoToma),
      });
    case "formulario_cliente":
      return clean({ dni: str(v.dni), cuil: str(v.cuil) });
  }
}

const TWO_WORD_BRANDS = ["mercedes benz", "can am", "land rover", "alfa romeo", "great wall", "ds automobiles"];

/** "Volkswagen Amarok" -> marca y modelo, para los documentos que los piden por separado. */
function splitVehicle(text: string): { marca: string; modelo: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { marca: "", modelo: "" };
  const lower = clean.toLowerCase();
  const twoWords = TWO_WORD_BRANDS.find((brand) => lower.startsWith(`${brand} `) || lower === brand);
  const brandLength = twoWords ? twoWords.length : clean.indexOf(" ");
  if (brandLength <= 0) return { marca: "", modelo: clean };
  return { marca: clean.slice(0, brandLength).trim(), modelo: clean.slice(brandLength).trim() };
}

/** Como quedarian los campos de este documento con los datos de la operacion. */
export function fromShared(type: SharedDocType, s: SharedData): Values {
  const vehicleText = join(s.marca, s.modelo) || str(s.vehiculo);
  // Si el auto solo se cargo como un texto ("Marca Modelo"), se reparte para los documentos que piden dos campos.
  const split = s.marca || s.modelo ? { marca: s.marca ?? "", modelo: s.modelo ?? "" } : splitVehicle(str(s.vehiculo));
  switch (type) {
    case "datero": {
      const trade = Boolean(s.usadoModelo);
      return {
        nombre: s.nombre,
        dni: s.dni,
        celular: s.telefono,
        email: s.email,
        direccionReal: s.domicilio,
        localidad: s.localidad,
        provincia: s.provincia,
        cuil: s.cuil,
        estadoCivil: s.estadoCivil,
        fechaNacimiento: s.fechaNacimiento,
        fechaOperacion: s.fecha,
        dominio: s.dominio,
        tomaCredito: s.tomaCredito === "si" ? "si" : undefined,
        creditoTotal: s.creditoTotal,
        creditoCuotas: s.creditoCuotas,
        entregaPpa: trade ? "si" : undefined,
        ppaModelo: s.usadoModelo,
        ppaAnio: s.usadoAnio,
      };
    }
    case "recibo":
      return {
        cliente: s.nombre,
        doc: s.dni,
        domicilio: s.domicilio,
        localidad: joinPlace(s),
        concepto: s.nombre ? `Seña de operación de ${s.nombre}` : undefined,
        vehiculo: vehicleText,
        vehiculoDominio: s.dominio,
      };
    case "autorizacion":
      return {
        fecha: s.fecha,
        autorizado: s.nombre,
        titular: s.nombre,
        propietarioNombre: s.nombre,
        propietarioDni: s.dni,
        propietarioDomicilio: s.domicilio,
        propietarioLocalidad: joinPlace(s),
        domicilioAuto: s.domicilio,
        marca: split.marca,
        modelo: split.modelo,
        tipo: s.tipo,
        anio: s.anio,
        motor: s.motor,
        chasis: s.chasis,
        dominio: s.dominio,
      };
    case "compra_venta":
      return {
        recibido: s.nombre,
        numeroDoc: s.dni,
        telefono: s.telefono,
        domicilio: s.domicilio,
        fecha: s.fecha,
        dominio: s.dominio,
        marca: split.marca,
        modelo: split.modelo,
        tipo: s.tipo,
        nMotor: s.motor,
        nChasis: s.chasis,
        cantidadNum: s.precio,
      };
    case "presupuesto_cliente":
    case "operacion_finalizada":
      return {
        nombre: s.nombre,
        dni: s.dni,
        telefono: s.telefono,
        vehModelo: vehicleText,
        vehAnio: s.anio,
        vehKm: s.km,
        precioVenta: s.precio,
        tomaCredito: s.tomaCredito === "si" ? "si" : undefined,
        creditoTotal: s.creditoTotal,
        cuotasCant: s.creditoCuotas,
        creditoNumeroCuotas: type === "operacion_finalizada" ? firstInt(s.creditoCuotas) : undefined,
        entregaEfectivo: s.entregaEfectivo,
        usadoModelo: s.usadoModelo,
        usadoAnio: s.usadoAnio,
        usadoKm: s.usadoKm,
        usadoToma: s.usadoToma,
      };
    case "formulario_cliente":
      return { dni: s.dni, cuil: s.cuil };
  }
}

/** Estos valores por defecto cuentan como "vacio": "no" es lo que trae el formulario sin tocar. */
function isEmptyValue(key: string, value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") {
    if (!value.trim()) return true;
    if ((key === "tomaCredito" || key === "entregaPpa") && value === "no") return true;
  }
  return false;
}

/** Completa solo los campos vacios: lo que ya escribio la persona nunca se pisa. */
export function fillEmpty<T extends Values>(current: T, proposals: Values): T {
  const next: Values = { ...current };
  for (const [key, value] of Object.entries(proposals)) {
    if (!(key in current)) continue;
    if (isEmptyValue(key, value)) continue;
    if (isEmptyValue(key, current[key])) next[key] = value;
  }
  return next as T;
}

/** Reune lo que se sabe de la operacion: auto < cliente < datero < lo ultimo que cargo cada documento. */
export function resolveShared(context: {
  client?: Client | null;
  operation?: ClientOperation | null;
  vehicle?: Vehicle | null;
}): SharedData {
  const { client, operation, vehicle } = context;
  const data = (operation?.data ?? {}) as Values;
  const { shared: stored, ...flat } = data as Values & { shared?: SharedData };

  const fromVehicle: SharedData = vehicle
    ? clean({
        marca: vehicle.brand,
        modelo: vehicle.model,
        dominio: vehicle.licensePlate,
        anio: vehicle.year ? String(vehicle.year) : "",
        km: vehicle.kilometers ? String(vehicle.kilometers) : "",
        motor: vehicle.engine,
        chasis: vehicle.vin,
        color: vehicle.color,
      })
    : {};

  const fromClient: SharedData = client
    ? clean({
        nombre: client.nombre,
        dni: client.dni,
        telefono: first(client.celular, client.telefono),
        email: client.email,
        domicilio: client.domicilio,
        localidad: client.localidad,
        provincia: client.provincia,
        cuil: client.cuil,
        estadoCivil: client.estadoCivil,
        fechaNacimiento: client.fechaNacimiento,
      })
    : {};

  const fromDatero = toShared("datero", flat);
  const fromOperation = operation?.fecha && !fromDatero.fecha ? { fecha: operation.fecha } : {};

  return { ...fromVehicle, ...fromClient, ...fromOperation, ...fromDatero, ...clean((stored ?? {}) as SharedData) };
}

/**
 * Datos que solo sirven de memoria de trabajo cuando no hay cliente (no se guardan en el cliente):
 * en la Autorizacion la persona autorizada es, en general, quien compra.
 */
export function scratchExtras(type: SharedDocType, v: Values): SharedData {
  return type === "autorizacion" ? clean({ nombre: str(v.autorizado) }) : {};
}

/** Saca los campos sin valor de lo que devuelve `fromShared`. */
export function definedOnly(values: Values): Values {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

const NEXT_DOCUMENTS: Array<{ type: SharedDocType; path: string; label: string }> = [
  { type: "compra_venta", path: "/compra-venta", label: "Compra y Venta" },
  { type: "recibo", path: "/recibo", label: "Recibo" },
  { type: "autorizacion", path: "/autorizacion-conduccion", label: "Autorización" },
  { type: "presupuesto_cliente", path: "/presupuesto-cliente", label: "Presupuesto" },
  { type: "operacion_finalizada", path: "/operacion-finalizada", label: "Operación finalizada" },
];

/** Links para seguir con los otros documentos de la misma operacion, con los datos ya cargados. */
export function nextDocumentLinks(current: SharedDocType, ids: { clientId: string; operationId: string; vehicleId?: string | null }) {
  const query = new URLSearchParams({ clientId: ids.clientId, operationId: ids.operationId });
  if (ids.vehicleId) query.set("vehicleId", ids.vehicleId);
  return NEXT_DOCUMENTS.filter((next) => next.type !== current).map((next) => ({
    to: `${next.path}?${query.toString()}`,
    label: `Seguir con ${next.label}`,
  }));
}

/** Hay algo que valga la pena ofrecer para reciclar. */
export function hasUsefulData(shared: SharedData) {
  return Boolean(shared.nombre || shared.dominio || shared.marca || shared.modelo || shared.vehiculo);
}
