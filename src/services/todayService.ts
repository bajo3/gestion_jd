import { formatPrice, priceListItemTitle } from "@/lib/priceList";
import { listVehiclesWithMissingSaleData } from "@/lib/saleMissingData";
import { listClients, listOpenQuotes } from "@/services/clientsService";
import { buildCommercialAlertMessage, listCommercialAlerts } from "@/services/commercialAlertsService";
import { listAssistantLeads, type AssistantLead } from "@/services/leadsService";
import { listPendingItems } from "@/services/pendingItemsService";
import { matchPriceListByText } from "@/services/priceListSaleLink";
import { listPriceListItems } from "@/services/priceListService";
import { listVehicles } from "@/services/vehiclesService";
import { commercialAlertTypeLabel, type CommercialAlert } from "@/types/commercialAlerts";
import type { Client } from "@/types/clients";
import type { PriceListItem } from "@/types/priceList";

/**
 * "Que hago hoy": junta en una sola lista, ya ordenada, lo que hoy esta repartido entre
 * Leads, Seguimientos, Clientes, Ventas, Presupuestos y Pendientes. Cada tarea trae listo el mensaje
 * de WhatsApp y a donde ir para resolverla.
 */
export type TodayTaskKind = "lead" | "request" | "birthday" | "followup" | "quote" | "missing_sale" | "pending";

export type TodayTask = {
  id: string;
  kind: TodayTaskKind;
  title: string;
  detail: string;
  /** Mas alto = mas urgente. */
  priority: number;
  phone?: string;
  message?: string;
  link: { to: string; label: string };
  /** Id del registro de origen (lead, alerta) para poder marcarlo como hecho. */
  sourceId?: string;
};

export const TODAY_KIND_LABELS: Record<TodayTaskKind, string> = {
  lead: "Leads sin contestar",
  request: "Encargos con stock",
  birthday: "Cumpleaños",
  followup: "Seguimientos vencidos",
  quote: "Presupuestos sin cerrar",
  missing_sale: "Ventas con datos faltantes",
  pending: "Pendientes",
};

const QUOTE_MIN_DAYS = 3;
const QUOTE_MAX_DAYS = 45;
/** Un cumpleaños se sigue mostrando un par de dias, por si cayo fin de semana. */
const BIRTHDAY_WINDOW_DAYS = 2;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

function ago(days: number) {
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

/**
 * El campo "auto" de un lead a veces es el modelo ("Nissan Sentra") y a veces una nota
 * ("busca ecosport tiene una saveiro"). Solo se nombra en el mensaje si es un modelo.
 */
function leadCar(lead: AssistantLead) {
  const car = lead.auto.trim();
  const looksLikeNote = car.split(/\s+/).length > 4 || /\b(tiene|busca|quiere|entrega|permuta|consulta|pregunta)\b/i.test(car);
  return looksLikeNote ? "" : car;
}

/** "Amarok Highline 2023 a $ 52.000.000": como se nombra un auto de la lista en un mensaje. */
function stockLabel(item: PriceListItem) {
  const price = item.cashPrice ?? item.listPrice;
  const year = /^\d{4}$/.test(item.yearLabel.trim()) ? ` ${item.yearLabel.trim()}` : "";
  return `${priceListItemTitle(item)}${year}${price ? ` a ${formatPrice(price, item.currency)}` : ""}`;
}

function leadMessage(lead: AssistantLead, stock: PriceListItem[]) {
  const name = firstName(lead.nombre);
  const greeting = name ? `Hola ${name}!` : "Hola!";
  const car = leadCar(lead);
  // Con un solo auto que coincide se le pasa el dato concreto; con varios, se lo ofrece en general.
  if (stock.length === 1) {
    return `${greeting} Te escribo de Jesús Díaz Automotores${car ? ` por tu consulta del ${car}` : ""}. Tenemos disponible ${stockLabel(stock[0])}. ¿Querés que te pase fotos y formas de pago?`;
  }
  if (lead.status === "sin_contactar") {
    return `${greeting} Te escribo de Jesús Díaz Automotores${car ? ` por tu consulta del ${car}` : ""}. ¿Seguís buscando? Te paso fotos, precio y formas de pago.`;
  }
  return `${greeting} Te escribo de Jesús Díaz Automotores${car ? ` por el ${car}` : ""}. ¿Pudiste verlo? Si querés coordinamos para que lo veas o te paso opciones de financiación.`;
}

function leadTasks(leads: AssistantLead[], priceItems: PriceListItem[]): TodayTask[] {
  return leads
    .filter((lead) => lead.needsReply)
    .map((lead) => {
      const days = lead.daysSinceLead ?? 0;
      const fresh = lead.status === "sin_contactar";
      const stock = matchPriceListByText(priceItems, lead.auto);
      return {
        id: `lead-${lead.id}`,
        kind: "lead" as const,
        title: lead.nombre.trim() || "Lead sin nombre",
        detail: [lead.auto.trim(), lead.estado, ago(days), stock.length ? `en stock: ${stock.slice(0, 2).map(stockLabel).join(" / ")}` : ""]
          .filter(Boolean)
          .join(" · "),
        // Un lead sin contestar se enfria rapido: pesa mas que el resto.
        priority: (fresh ? 400 : 300) + Math.min(days, 60),
        phone: lead.telefono,
        message: leadMessage(lead, stock),
        link: { to: "/leads", label: "Abrir en Leads" },
        sourceId: lead.id,
      };
    });
}

/** Encargos que siguen buscando y para los que hoy hay un auto disponible en la lista. */
function requestTasks(leads: AssistantLead[], priceItems: PriceListItem[]): TodayTask[] {
  return leads
    .filter((lead) => lead.isRequest && !/encontrad|cancelad|pausa/i.test(lead.estado))
    .map((lead) => ({ lead, stock: matchPriceListByText(priceItems, lead.auto) }))
    .filter(({ stock }) => stock.length > 0)
    .map(({ lead, stock }) => {
      const name = firstName(lead.nombre);
      const offer = stock.slice(0, 2).map(stockLabel).join(" y ");
      return {
        id: `request-${lead.id}`,
        kind: "request" as const,
        title: lead.nombre.trim() || "Encargo sin nombre",
        detail: [`busca: ${lead.auto.trim()}`, `disponible: ${offer}`].join(" · "),
        priority: 350,
        phone: lead.telefono,
        message: `${name ? `Hola ${name}!` : "Hola!"} Te escribo de Jesús Díaz Automotores. Por lo que estabas buscando, hoy tenemos ${offer}. ¿Querés que te pase fotos o coordinamos para que lo veas?`,
        link: { to: "/leads", label: "Abrir en Leads" },
      };
    });
}

function followupTasks(alerts: CommercialAlert[]): TodayTask[] {
  const now = today();
  return alerts
    .filter((alert) => (alert.status === "pending" || alert.status === "postponed") && alert.alertDate <= now)
    .map((alert) => {
      const car = [alert.vehicleBrand, alert.vehicleModel].filter(Boolean).join(" ");
      const type = commercialAlertTypeLabel(alert.alertType);
      return {
        id: `followup-${alert.id}`,
        kind: "followup" as const,
        title: alert.clientName.trim() || "Cliente sin nombre",
        detail: [type, car, `venció ${ago(daysSince(alert.alertDate))}`].filter(Boolean).join(" · "),
        priority: 250 + Math.min(daysSince(alert.alertDate), 40),
        phone: alert.clientPhone,
        message: buildCommercialAlertMessage(alert),
        link: { to: "/ventas/seguimientos", label: "Abrir en Seguimientos" },
        sourceId: alert.id,
      };
    });
}

/** Fecha local de hoy ("2026-10-13"): a la noche la fecha UTC ya es la de mañana. */
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Clientes que cumplen años hoy o cumplieron en los ultimos dias. No se guarda nada en la
 * base: la tarea sale de la fecha de nacimiento cargada en el Datero y se descarta desde
 * la lista del dia (el id lleva el año, asi vuelve a aparecer el año siguiente).
 */
export function birthdayTasks(clients: Client[], today = localToday()): TodayTask[] {
  const year = Number(today.slice(0, 4));
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const tasks: TodayTask[] = [];

  for (const client of clients) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(client.fechaNacimiento.trim());
    if (!match) continue;
    // Los nacidos un 29 de febrero se saludan el 28 cuando el año no es bisiesto.
    const day = match[2] === "02" && match[3] === "29" && !isLeap ? "28" : match[3];
    const birthday = `${year}-${match[2]}-${day}`;
    if (birthday > today) continue;
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${birthday}T00:00:00Z`)) / 86400000);
    if (days > BIRTHDAY_WINDOW_DAYS) continue;

    const age = year - Number(match[1]);
    const when = days === 0 ? "cumple hoy" : days === 1 ? "cumplió ayer" : `cumplió hace ${days} días`;
    const greeting = days === 0 ? "¡Feliz cumpleaños" : "¡Feliz cumpleaños atrasado";
    tasks.push({
      id: `birthday-${client.id}-${year}`,
      kind: "birthday",
      title: client.nombre.trim() || "Cliente sin nombre",
      detail: [when, age > 0 && age < 120 ? `${age} años` : ""].filter(Boolean).join(" · "),
      // Es el unico aviso que pierde sentido si se deja pasar.
      priority: 360 - days,
      phone: client.celular || client.telefono,
      // Sin nombre de pila: los clientes estan cargados a veces como "APELLIDO NOMBRE" y a veces al reves.
      message: `${greeting}! Te mandamos un saludo grande de parte de todo el equipo de Jesús Díaz Automotores. Que tengas un gran día.`,
      link: { to: `/ventas/clientes/${encodeURIComponent(client.id)}`, label: "Ver cliente" },
    });
  }

  return tasks;
}

/** Arma la lista del dia. Si alguna fuente falla, el resto se muestra igual. */
export async function loadTodayTasks(): Promise<TodayTask[]> {
  const [leads, alerts, vehicles, quotes, pendings, priceItems, clients] = await Promise.all([
    listAssistantLeads().catch(() => []),
    listCommercialAlerts().catch(() => []),
    listVehicles().catch(() => []),
    listOpenQuotes().catch(() => []),
    listPendingItems().catch(() => []),
    listPriceListItems().catch(() => []),
    listClients().catch(() => []),
  ]);

  const quoteTasks: TodayTask[] = quotes
    .map((quote) => ({ quote, days: daysSince(quote.document.updatedAt) }))
    .filter(({ days }) => days >= QUOTE_MIN_DAYS && days <= QUOTE_MAX_DAYS)
    .map(({ quote, days }) => {
      const data = quote.document.data as Record<string, string | undefined>;
      const name = quote.client?.nombre || data.nombre || "";
      const car = (data.vehModelo ?? "").trim();
      const hello = firstName(name) ? `Hola ${firstName(name)}!` : "Hola!";
      return {
        id: `quote-${quote.document.id}`,
        kind: "quote" as const,
        title: name.trim() || "Presupuesto sin nombre",
        detail: [car, `presupuesto ${ago(days)}`].filter(Boolean).join(" · "),
        priority: 200 + Math.min(days, 45),
        phone: quote.client?.celular || quote.client?.telefono || data.telefono || "",
        message: `${hello} Te escribo de Jesús Díaz Automotores por el presupuesto${car ? ` del ${car}` : ""}. ¿Pudiste verlo? Si querés lo ajustamos o coordinamos para avanzar.`,
        link: {
          to: `/presupuesto-cliente?clientId=${quote.document.clientId}&operationId=${quote.document.operationId}&documentId=${quote.document.id}`,
          label: "Abrir presupuesto",
        },
      };
    });

  const missingTasks: TodayTask[] = listVehiclesWithMissingSaleData(vehicles).map(({ vehicle, missing }) => ({
    id: `missing-${vehicle.id}`,
    kind: "missing_sale" as const,
    title: [vehicle.brand, vehicle.model, vehicle.licensePlate].filter(Boolean).join(" ") || "Auto sin datos",
    detail: `Falta: ${missing.map((field) => field.label.toLowerCase()).join(", ")}`,
    // Sin telefono o comprador no se crea la postventa: eso pesa mas.
    priority: missing.some((field) => field.impact) ? 180 : 120,
    link: { to: `/autos/${vehicle.id}`, label: "Completar datos" },
  }));

  const pendingTasks: TodayTask[] = pendings
    .filter((item) => !item.completedAt)
    .map((item) => ({
      id: `pending-${item.id}`,
      kind: "pending" as const,
      title: item.title,
      detail: [item.details.trim().split("\n")[0], `anotado ${ago(daysSince(item.createdAt))}`].filter(Boolean).join(" · "),
      priority: 100 + Math.min(daysSince(item.createdAt), 30),
      link: { to: "/pendientes", label: "Abrir en Pendientes" },
    }));

  return [
    ...leadTasks(leads, priceItems),
    ...requestTasks(leads, priceItems),
    ...birthdayTasks(clients),
    ...followupTasks(alerts),
    ...quoteTasks,
    ...missingTasks,
    ...pendingTasks,
  ].sort(
    (a, b) => b.priority - a.priority,
  );
}
