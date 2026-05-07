import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, MessageCircle, PauseCircle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { buildWhatsAppUrl, hasArgentinaPrefix } from "@/lib/whatsapp";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  buildCommercialAlertMessage,
  dismissCommercialAlert,
  listCommercialAlerts,
  markCommercialAlertContacted,
  postponeCommercialAlert,
} from "@/services/commercialAlertsService";
import { listVehicles } from "@/services/vehiclesService";
import type { CommercialAlert } from "@/types/commercialAlerts";
import type { Vehicle } from "@/types/vehicles";

type FilterValue = "all" | "pending" | "credit" | "post_sale" | "contacted" | "postponed";

const statusLabels: Record<CommercialAlert["status"], string> = {
  pending: "Pendiente",
  contacted: "Contactada",
  postponed: "Pospuesta",
  dismissed: "Descartada",
};

function alertTypeLabel(type: CommercialAlert["alertType"]) {
  return type === "credit_installment_10" ? "Credito cuota 10" : "Postventa 12 meses";
}

function statusClass(status: CommercialAlert["status"]) {
  if (status === "contacted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "postponed") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "dismissed") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function enrichAlerts(alerts: CommercialAlert[], vehicles: Vehicle[]) {
  return alerts.map((alert) => {
    const vehicle = vehicles.find((item) => item.id === alert.vehicleId);
    return {
      ...alert,
      vehicleBrand: vehicle?.brand ?? alert.vehicleBrand,
      vehicleModel: vehicle?.model ?? alert.vehicleModel,
      vehicleLicensePlate: vehicle?.licensePlate ?? alert.vehicleLicensePlate,
    };
  });
}

export function VentasSeguimientosPage() {
  const [alerts, setAlerts] = useState<CommercialAlert[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([listCommercialAlerts(), listVehicles()]).then(([nextAlerts, nextVehicles]) => {
      setAlerts(nextAlerts);
      setVehicles(nextVehicles);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredAlerts = useMemo(() => {
    const enriched = enrichAlerts(alerts, vehicles);
    return enriched
      .filter((alert) => {
        if (filter === "pending") return alert.status === "pending";
        if (filter === "credit") return alert.alertType === "credit_installment_10";
        if (filter === "post_sale") return alert.alertType === "post_sale_12_months";
        if (filter === "contacted") return alert.status === "contacted";
        if (filter === "postponed") return alert.status === "postponed";
        return alert.status !== "dismissed";
      })
      .sort((a, b) => a.alertDate.localeCompare(b.alertDate));
  }, [alerts, filter, vehicles]);

  const copyMessage = async (alert: CommercialAlert) => {
    await navigator.clipboard.writeText(buildCommercialAlertMessage(alert));
    setCopiedId(alert.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  const openWhatsApp = (alert: CommercialAlert) => {
    window.open(buildWhatsAppUrl(alert.clientPhone, buildCommercialAlertMessage(alert)), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventas"
        title="Seguimientos"
        description="Alertas comerciales para creditos y postventa."
        actions={
          <Select value={filter} onChange={(event) => setFilter(event.target.value as FilterValue)}>
            <option value="all">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="credit">Creditos</option>
            <option value="post_sale">Postventa</option>
            <option value="contacted">Contactadas</option>
            <option value="postponed">Pospuestas</option>
          </Select>
        }
      />

      {filteredAlerts.length ? (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{alert.clientName || "Sin cliente"}</h2>
                      <Badge className={statusClass(alert.status)}>{statusLabels[alert.status]}</Badge>
                      {!hasArgentinaPrefix(alert.clientPhone) ? (
                        <Badge className="border-slate-200 bg-slate-50 text-slate-500">Telefono sin prefijo 54</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {alert.clientPhone || "Sin telefono"} · {alertTypeLabel(alert.alertType)}
                    </p>
                  </div>

                  <div className="text-sm lg:text-right">
                    <p className="font-semibold text-slate-900">{formatDate(alert.alertDate)}</p>
                    <p className="text-slate-500">Fecha de alerta</p>
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Auto</p>
                    <p className="mt-1 font-semibold text-slate-900">{alert.vehicleBrand || "Sin dato"} {alert.vehicleModel || ""}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Patente</p>
                    <p className="mt-1 font-semibold text-slate-900">{alert.vehicleLicensePlate || "Sin dato"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Ultimo contacto</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatDateTime(alert.lastContactedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Notas</p>
                    <p className="mt-1 font-semibold text-slate-900">{alert.notes || "Sin dato"}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  {buildCommercialAlertMessage(alert)}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => openWhatsApp(alert)}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Abrir WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => copyMessage(alert)}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copiedId === alert.id ? "Copiado" : "Copiar mensaje"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await markCommercialAlertContacted(alert.id);
                      refresh();
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Contactado
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await postponeCommercialAlert(alert.id, 30);
                      refresh();
                    }}
                  >
                    <PauseCircle className="mr-2 h-4 w-4" />
                    Posponer 30 dias
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await dismissCommercialAlert(alert.id);
                      refresh();
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Descartar
                  </Button>
                  <a
                    href={buildWhatsAppUrl(alert.clientPhone, buildCommercialAlertMessage(alert))}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Link
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No hay seguimientos para este filtro.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
