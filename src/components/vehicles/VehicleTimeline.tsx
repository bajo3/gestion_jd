import { CalendarClock, FileStack, Flag, PencilLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Vehicle } from "@/types/vehicles";

export function VehicleTimeline({ vehicle }: { vehicle: Vehicle }) {
  const items = [
    {
      id: "created",
      title: "Registro creado",
      value: formatDateTime(vehicle.createdAt),
      icon: CalendarClock,
    },
    {
      id: "entry",
      title: "Fecha de ingreso",
      value: formatDate(vehicle.entryDate),
      icon: Flag,
    },
    {
      id: "updated",
      title: "Ultima actualizacion",
      value: formatDateTime(vehicle.updatedAt),
      icon: PencilLine,
    },
    {
      id: "files",
      title: "Adjuntos cargados",
      value: `${vehicle.files.length} archivo(s)`,
      icon: FileStack,
    },
  ];

  if (vehicle.exitDate) {
    items.splice(2, 0, {
      id: "exit",
      title: "Fecha de egreso",
      value: formatDate(vehicle.exitDate),
      icon: Flag,
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Timeline</h3>
          <p className="text-sm text-slate-500">Seguimiento rapido del historial interno.</p>
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <Icon className="h-4 w-4 text-slate-700" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
