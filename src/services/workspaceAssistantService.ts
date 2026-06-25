import { documentLabels, documentRoutes, type DocumentType } from "@/services/documentDraftService";
import { listAssistantLeads, summarizeLeads } from "@/services/leadsService";
import { listCommercialAlerts } from "@/services/commercialAlertsService";
import { listVehicles } from "@/services/vehiclesService";
import type { Vehicle } from "@/types/vehicles";

export type WorkspaceAssistantAction = {
  ok: boolean;
  model?: string;
  reply: string;
  actionType: "answer" | "navigate" | "documentDraft" | "vehicleDraft";
  routeKey?: string;
  path?: string;
  documentType?: DocumentType;
  title?: string;
  values?: Record<string, unknown>;
  missing?: string[];
  error?: string;
};

function currentMonth(value?: string | null) {
  return Boolean(value && value.slice(0, 7) === new Date().toISOString().slice(0, 7));
}

function vehicleLabel(vehicle: Vehicle) {
  return `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}${vehicle.licensePlate ? ` (${vehicle.licensePlate})` : ""}`;
}

function summarizeVehicles(vehicles: Vehicle[]) {
  const soldThisMonth = vehicles.filter(
    (vehicle) => vehicle.status === "vendido" && currentMonth(vehicle.exitDate || vehicle.updatedAt),
  );
  const revenue = soldThisMonth.reduce((total, vehicle) => total + (vehicle.salePrice ?? 0), 0);

  return {
    total: vehicles.length,
    published: vehicles.filter((vehicle) => vehicle.status === "publicado").length,
    reserved: vehicles.filter((vehicle) => vehicle.status === "reservado").length,
    soldThisMonth: soldThisMonth.length,
    revenueThisMonth: revenue,
    recent: vehicles.slice(0, 20).map((vehicle) => ({
      id: vehicle.id,
      label: vehicleLabel(vehicle),
      status: vehicle.status,
      salePrice: vehicle.salePrice,
      buyerName: vehicle.buyerName,
      updatedAt: vehicle.updatedAt,
    })),
  };
}

function localWorkspaceAnswer(message: string, context: Awaited<ReturnType<typeof buildWorkspaceContext>>): WorkspaceAssistantAction | null {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("que podes hacer") ||
    normalized.includes("qué podés hacer") ||
    normalized.includes("que podés hacer") ||
    normalized.includes("ayuda") ||
    normalized.includes("como me ayudas") ||
    normalized.includes("cómo me ayudas")
  ) {
    return {
      ok: true,
      reply: [
        "Puedo ayudarte con toda la gestion:",
        "1. Cargar ventas o reservas desde texto.",
        "2. Decirte que leads faltan contestar y abrir Leads.",
        "3. Hacer resumen del mes con ventas, leads y seguimientos.",
        "4. Preparar documentos: compra-venta, autorizacion, datero, recibo, presupuesto, test drive y formulario cliente.",
        "5. Abrir secciones de la web y dejar formularios prellenados para revisar y generar PDF.",
      ].join("\n"),
      actionType: "answer",
    };
  }

  const documentKeywords: Array<[DocumentType, string[]]> = [
    ["compraVenta", ["boleto", "compra venta", "compra-venta"]],
    ["autorizacion", ["autorizacion", "autorización", "autorizar"]],
    ["datero", ["datero"]],
    ["recibo", ["recibo", "sena", "seña"]],
    ["presupuesto", ["presupuesto"]],
    ["testDrive", ["test drive", "prueba"]],
    ["formularioCliente", ["formulario cliente", "formulario"]],
  ];

  const requestedDocument = documentKeywords.find(([, keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  )?.[0];

  if (requestedDocument) {
    return {
      ok: true,
      reply: `Te preparo ${documentLabels[requestedDocument]}. Si me pasas cliente, DNI, telefono, dominio, auto e importe, lo puedo dejar mas completo.`,
      actionType: "documentDraft",
      documentType: requestedDocument,
      path: documentRoutes[requestedDocument],
      title: `Abrir ${documentLabels[requestedDocument]}`,
      values: {
        fecha: new Date().toISOString().slice(0, 10),
      },
      missing: ["datos de la operacion"],
    };
  }

  if (normalized.includes("lead") && (normalized.includes("falta") || normalized.includes("contestar") || normalized.includes("responder"))) {
    const urgent = context.leads.urgent;
    if (!urgent.length) {
      return {
        ok: true,
        reply: "No veo leads pendientes para contestar con los datos actuales.",
        actionType: "navigate",
        path: "/leads",
      };
    }

    return {
      ok: true,
      reply: [
        `Hay ${context.leads.needsReply} leads para revisar. Los mas urgentes:`,
        ...urgent.slice(0, 5).map((lead, index) => `${index + 1}. ${lead.nombre || "Sin nombre"} - ${lead.auto || "Sin auto"} - ${lead.telefono || "sin telefono"} - ${lead.daysSinceLead ?? "?"} dias`),
      ].join("\n"),
      actionType: "navigate",
      path: "/leads",
      title: "Abrir Leads",
    };
  }

  if (normalized.includes("resumen") && normalized.includes("mes")) {
    return {
      ok: true,
      reply: [
        `Resumen del mes: ${context.vehicles.soldThisMonth} ventas cargadas por ${context.vehicles.revenueThisMonth.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}.`,
        `Leads: ${context.leads.active} activos, ${context.leads.needsReply} pendientes de respuesta, ${context.leads.requests} encargos.`,
        `Seguimientos comerciales activos: ${context.alerts.active}.`,
      ].join("\n"),
      actionType: "answer",
    };
  }

  return null;
}

async function buildWorkspaceContext() {
  const [vehicles, leads, alerts] = await Promise.all([
    listVehicles(),
    listAssistantLeads(),
    listCommercialAlerts(),
  ]);
  const leadSummary = summarizeLeads(leads);

  return {
    currentDate: new Date().toISOString().slice(0, 10),
    vehicles: summarizeVehicles(vehicles),
    leads: {
      ...leadSummary,
      urgent: leadSummary.urgent.map((lead) => ({
        id: lead.id,
        nombre: lead.nombre,
        auto: lead.auto,
        telefono: lead.telefono,
        estado: lead.estado,
        notas: lead.notas,
        fechaLead: lead.fechaLead,
        fechaContacto: lead.fechaContacto,
        daysSinceLead: lead.daysSinceLead,
      })),
    },
    alerts: {
      active: alerts.filter((alert) => ["pending", "postponed"].includes(alert.status)).length,
      credit: alerts.filter((alert) => alert.alertType === "credit_installment_10" && ["pending", "postponed"].includes(alert.status)).length,
      postSale: alerts.filter((alert) => alert.alertType === "post_sale_12_months" && ["pending", "postponed"].includes(alert.status)).length,
    },
    documents: Object.entries(documentRoutes).map(([type, path]) => ({
      type,
      label: documentLabels[type as DocumentType],
      path,
    })),
  };
}

export async function askWorkspaceAssistant(message: string): Promise<WorkspaceAssistantAction> {
  const context = await buildWorkspaceContext();
  const local = localWorkspaceAnswer(message, context);

  try {
    const response = await fetch("/api/workspace-assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        context,
      }),
    });
    const data = (await response.json().catch(() => null)) as Partial<WorkspaceAssistantAction> | null;
    if (response.ok && data?.ok !== false && data?.reply) {
      return {
        ok: true,
        reply: data.reply,
        actionType: data.actionType ?? "answer",
        model: data.model,
        routeKey: data.routeKey,
        path: data.path,
        documentType: data.documentType,
        title: data.title,
        values: data.values ?? {},
        missing: data.missing ?? [],
      };
    }
  } catch {
    // local fallback below
  }

  if (local) return local;

  return {
    ok: true,
    reply: "Puedo ayudarte con leads, resumen del mes, ventas, seguimientos y documentos. Decime por ejemplo: que lead falta contestar, resumen del mes, o haceme un boleto compra venta.",
    actionType: "answer",
  };
}

export function isWorkspaceQuestion(message: string) {
  const normalized = message.toLowerCase();
  return [
    "lead",
    "resumen",
    "mes",
    "boleto",
    "compra venta",
    "compra-venta",
    "autorizacion",
    "autorización",
    "datero",
    "recibo",
    "presupuesto",
    "test drive",
    "formulario",
    "documento",
    "seguimiento",
    "postventa",
    "que podes hacer",
    "qué podés hacer",
    "que podés hacer",
    "ayuda",
    "como me ayudas",
    "cómo me ayudas",
    "abrir",
    "ir a",
  ].some((keyword) => normalized.includes(keyword));
}
