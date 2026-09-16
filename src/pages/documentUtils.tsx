import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { UserRound, ArrowRight } from "lucide-react";
import { FormSection } from "@/components/shared/FormSection";
import type { Client, ClientOperation } from "@/types/clients";

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

export function DocumentContextBar({ client, operation }: { client: Client | null; operation: ClientOperation | null }) {
  if (!client || !operation) return null;
  const query = `?clientId=${encodeURIComponent(client.id)}&operationId=${encodeURIComponent(operation.id)}`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4 text-sm text-fuchsia-950 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3"><UserRound className="h-5 w-5" /><span><strong>{client.nombre || "Cliente sin nombre"}</strong> · DNI {client.dni}</span></div>
      <div className="flex flex-wrap gap-2">
        <Link className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 font-semibold hover:bg-fuchsia-100" to={`/recibo${query}`}>Recibo <ArrowRight className="h-4 w-4" /></Link>
        <Link className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 font-semibold hover:bg-fuchsia-100" to={`/autorizacion-conduccion${query}`}>Autorización <ArrowRight className="h-4 w-4" /></Link>
        <Link className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 font-semibold hover:bg-fuchsia-100" to={`/operacion-finalizada${query}`}>Cierre <ArrowRight className="h-4 w-4" /></Link>
        <Link className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 font-semibold hover:bg-fuchsia-100" to={`/compra-venta${query}`}>Compra venta <ArrowRight className="h-4 w-4" /></Link>
        <Link className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 font-semibold hover:bg-fuchsia-100" to={`/presupuesto-cliente${query}`}>Presupuesto <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}

export function DocumentPersistenceStatus({ loading, mode, error }: { loading: boolean; mode: "remote" | "offline" | null; error: string | null }) {
  if (loading) return <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">Cargando contexto…</p>;
  if (error) return <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>;
  if (mode === "offline") return <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Borrador local: se guardó en este dispositivo y todavía no está sincronizado.</p>;
  if (mode === "remote") return <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Guardado en la base de datos.</p>;
  return null;
}

export { FormSection };
