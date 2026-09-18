import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Circle, ClipboardList, FileText, Receipt, ShieldCheck, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Vehicle } from "@/types/vehicles";

type VehicleSalePanelProps = {
  vehicle: Vehicle;
  hasPostSaleAlert: boolean;
};

const saleDocuments = [
  { to: "/compra-venta", title: "Compra y Venta", icon: FileText },
  { to: "/recibo", title: "Recibo", icon: Receipt },
  { to: "/presupuesto-cliente", title: "Presupuesto para cliente", icon: WalletCards },
  { to: "/operacion-finalizada", title: "Operación finalizada", icon: CheckCircle2 },
  { to: "/datero", title: "Datero", icon: ClipboardList },
  { to: "/formulario-cliente", title: "Formulario Cliente", icon: ClipboardList },
  { to: "/autorizacion-conduccion", title: "Autorizacion", icon: ShieldCheck },
];

function buildDocumentUrl(path: string, vehicle: Vehicle) {
  const params = new URLSearchParams({ vehicleId: vehicle.id });
  return `${path}?${params.toString()}`;
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  const Icon = done ? CheckCircle2 : Circle;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm">
      <Icon className={done ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-slate-300"} />
      <span className={done ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
    </div>
  );
}

export function VehicleSalePanel({ vehicle, hasPostSaleAlert }: VehicleSalePanelProps) {
  const checklist = [
    { label: "Comprador cargado", done: Boolean(vehicle.buyerName) },
    { label: "Telefono cargado", done: Boolean(vehicle.buyerPhone) },
    { label: "Fecha de egreso cargada", done: Boolean(vehicle.exitDate) },
    { label: "Precio de venta cargado", done: Boolean(vehicle.salePrice) },
    { label: "Documentos adjuntos", done: vehicle.files.length > 0 },
    { label: "Alerta postventa creada", done: hasPostSaleAlert },
  ];

  const completedItems = checklist.filter((item) => item.done).length;

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Venta</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">Registrar venta desde este auto</h3>
            <p className="mt-1 text-sm text-slate-500">
              El auto se mantiene seleccionado mientras cargás al cliente y confirmás el cierre.
            </p>
          </div>
          <Badge className="w-fit border-slate-200 bg-slate-50 text-slate-700">
            {completedItems}/{checklist.length} listo
          </Badge>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-700">Atajo recomendado</p>
            <p className="mt-1 text-sm text-fuchsia-950">Cargá los datos del comprador y después confirmá la venta. No hace falta volver a buscar este auto.</p>
          </div>
          <Link to={buildDocumentUrl("/datero", vehicle)} className="shrink-0">
            <Button><span>Cargar cliente y avanzar</span><ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {checklist.map((item) => (
            <ChecklistItem key={item.label} done={item.done} label={item.label} />
          ))}
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Documentos opcionales</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {saleDocuments.map((document) => {
            const Icon = document.icon;
            return (
              <Link
                key={document.to}
                to={buildDocumentUrl(document.to, vehicle)}
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <Icon className="h-4 w-4 text-slate-700" />
                <p className="mt-3 text-sm font-semibold text-slate-950">{document.title}</p>
                <p className="mt-1 text-xs text-slate-500">Crear documento</p>
              </Link>
            );
          })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={buildDocumentUrl("/operacion-finalizada", vehicle)}>
            <Button>Finalizar con cliente existente</Button>
          </Link>
          <Link to={`/autos/${vehicle.id}/editar`}>
            <Button variant="outline">Completar datos</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
