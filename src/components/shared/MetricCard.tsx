import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  detail?: string;
};

export function MetricCard({ label, value, icon, detail }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{label}</p>
          {icon}
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
