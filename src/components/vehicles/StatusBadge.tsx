import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VehicleStatus } from "@/types/vehicles";

const statusMap: Record<VehicleStatus, string> = {
  ingresado: "bg-slate-100 text-slate-700 border-slate-200",
  en_preparacion: "bg-amber-50 text-amber-700 border-amber-200",
  publicado: "bg-blue-50 text-blue-700 border-blue-200",
  reservado: "bg-violet-50 text-violet-700 border-violet-200",
  vendido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  egresado: "bg-cyan-50 text-cyan-700 border-cyan-200",
  archivado: "bg-slate-200 text-slate-600 border-slate-300",
};

export function StatusBadge({ status }: { status: VehicleStatus }) {
  return (
    <Badge className={cn("capitalize", statusMap[status])}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
