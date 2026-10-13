import { Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StockAge, StockAgeLevel } from "@/lib/vehicleStock";

const levelStyles: Record<StockAgeLevel, string> = {
  ok: "border-slate-200 bg-white text-slate-500",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

/** Cuanto hace que el auto esta en stock. Cambia de color a los 45, 60 y 90 dias. */
export function StockAgeBadge({ age }: { age: StockAge }) {
  return (
    <Badge className={cn("shrink-0 gap-1.5 whitespace-nowrap", levelStyles[age.level])}>
      <Hourglass className="h-3 w-3" />
      {age.days === 1 ? "1 día en stock" : `${age.days} días en stock`}
    </Badge>
  );
}
