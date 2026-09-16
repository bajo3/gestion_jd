import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Search, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listClients } from "@/services/clientsService";

export function ClientesPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get("cliente") ?? "");
  const [clients, setClients] = useState<Awaited<ReturnType<typeof listClients>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listClients().then((nextClients) => {
      if (active) {
        setClients(nextClients);
        setLoading(false);
      }
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return clients;
    return clients.filter((client) => `${client.nombre} ${client.dni} ${client.telefono} ${client.celular} ${client.email} ${client.localidad} ${client.domicilio}`.toLowerCase().includes(normalizedQuery));
  }, [clients, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventas"
        title="Clientes"
        description="Entrá a la ficha de cada cliente para ver sus datos, documentos, movimientos y ventas históricas."
        actions={<Link to="/datero"><Button>Nuevo cliente</Button></Link>}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, DNI, teléfono o email" />
      </div>

      {loading ? <Card><CardContent><p className="text-sm text-slate-500">Cargando clientes…</p></CardContent></Card> : null}
      {!loading && filteredClients.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="transition hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-fuchsia-50 p-3 text-fuchsia-600"><UserRound className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-slate-950">{client.nombre || "Sin nombre"}</h2>
                    <p className="text-sm text-slate-500">DNI {client.dni || "sin dato"}</p>
                  </div>
                </div>
                <div className="grid gap-1 text-sm text-slate-600">
                  <p>{client.telefono || client.celular || "Sin teléfono"}</p>
                  <p className="truncate">{client.email || "Sin email"}</p>
                  <p>{client.localidad || client.domicilio || "Sin domicilio"}</p>
                </div>
                <Link to={`/ventas/clientes/${encodeURIComponent(client.id)}`} className="inline-flex items-center text-sm font-semibold text-fuchsia-700">
                  Abrir ficha completa <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {!loading && !filteredClients.length ? <Card><CardContent><div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">{query.trim() ? "No encontramos ese cliente." : "Todavía no hay clientes guardados. Completá un datero para crear el primero."}</div></CardContent></Card> : null}
    </div>
  );
}
