import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Calculator, CheckCircle2, Clock, FileText, WalletCards } from "lucide-react";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { listCommercialAlerts } from "@/services/commercialAlertsService";
import { listVehicles } from "@/services/vehiclesService";
import type { CommercialAlert } from "@/types/commercialAlerts";
import type { Vehicle } from "@/types/vehicles";

const activeStatuses = ["pending", "postponed"];

function isActive(alert: CommercialAlert) {
  return activeStatuses.includes(alert.status);
}

function isDue(alert: CommercialAlert) {
  return alert.alertDate <= new Date().toISOString().slice(0, 10);
}

function isThisMonth(value?: string | null) {
  if (!value) return false;
  return value.slice(0, 7) === new Date().toISOString().slice(0, 7);
}

function alertTypeLabel(type: CommercialAlert["alertType"]) {
  return type === "credit_installment_10" ? "Credito cuota 10" : "Postventa 12 meses";
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

export function VentasDashboardPage() {
  const [alerts, setAlerts] = useState<CommercialAlert[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    Promise.all([listCommercialAlerts(), listVehicles()]).then(([nextAlerts, nextVehicles]) => {
      setAlerts(nextAlerts);
      setVehicles(nextVehicles);
    });
  }, []);

  const enrichedAlerts = useMemo(() => enrichAlerts(alerts, vehicles), [alerts, vehicles]);
  const activeAlerts = enrichedAlerts.filter(isActive);
  const sortedAlerts = [...activeAlerts].sort((a, b) => a.alertDate.localeCompare(b.alertDate));

  const metrics = [
    {
      label: "Alertas pendientes",
      value: String(activeAlerts.length),
      detail: `${activeAlerts.filter(isDue).length} vencidas o para hoy`,
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    },
    {
      label: "Creditos para contactar",
      value: String(activeAlerts.filter((alert) => alert.alertType === "credit_installment_10").length),
      detail: "Seguimiento cuota 10",
      icon: <WalletCards className="h-5 w-5 text-blue-600" />,
    },
    {
      label: "Postventa proxima",
      value: String(activeAlerts.filter((alert) => alert.alertType === "post_sale_12_months").length),
      detail: "12 meses desde egreso",
      icon: <Clock className="h-5 w-5 text-fuchsia-600" />,
    },
    {
      label: "Contactados este mes",
      value: String(enrichedAlerts.filter((alert) => alert.status === "contacted" && isThisMonth(alert.lastContactedAt)).length),
      detail: "Marcados como contactados",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventas"
        title="Dashboard comercial"
        description="Seguimientos simples para credito, postventa y documentos de venta."
        actions={
          <>
            <Link to="/ventas/seguimientos">
              <Button>Ver seguimientos</Button>
            </Link>
            <Link to="/ventas/documentos">
              <Button variant="outline">Documentos</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/ventas/seguimientos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <WalletCards className="h-5 w-5 text-slate-700" />
          <p className="mt-4 font-semibold text-slate-950">Seguimientos</p>
          <p className="mt-1 text-sm text-slate-500">Creditos, postventa y acciones de contacto.</p>
        </Link>
        <Link to="/ventas/documentos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <FileText className="h-5 w-5 text-slate-700" />
          <p className="mt-4 font-semibold text-slate-950">Documentos</p>
          <p className="mt-1 text-sm text-slate-500">Accesos a formularios comerciales actuales.</p>
        </Link>
        <Link to="/calculadora-0km" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <Calculator className="h-5 w-5 text-slate-700" />
          <p className="mt-4 font-semibold text-slate-950">Calculadora 0km</p>
          <p className="mt-1 text-sm text-slate-500">Quebranto y resumen de financiacion.</p>
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Proximos seguimientos</h2>
            <p className="text-sm text-slate-500">Ordenados por fecha, con vencidos o de hoy arriba.</p>
          </div>

          {sortedAlerts.length ? (
            <div className="space-y-3">
              {sortedAlerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{alert.clientName || "Sin cliente"}</p>
                      {isDue(alert) ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">Vencida / hoy</Badge> : null}
                    </div>
                    <p className="text-sm text-slate-500">
                      {alertTypeLabel(alert.alertType)} · {alert.vehicleBrand || "Auto"} {alert.vehicleModel || ""} {alert.vehicleLicensePlate ? `· ${alert.vehicleLicensePlate}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatDate(alert.alertDate)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No hay seguimientos pendientes.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
