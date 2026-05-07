import type { ReactNode } from "react";
import { FormSection } from "@/components/shared/FormSection";

export function FormGrid({
  children,
  columns = "md:grid-cols-2 xl:grid-cols-3",
}: {
  children: ReactNode;
  columns?: string;
}) {
  return <div className={`grid gap-4 ${columns}`}>{children}</div>;
}

export function DocumentPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff0a8a]">Gestion JD</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}

export { FormSection };
