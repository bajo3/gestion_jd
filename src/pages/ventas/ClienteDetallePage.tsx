import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CarFront, ExternalLink, FileText, Loader2, ReceiptText, ShoppingCart, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { documentTypeLabel, getClientHistory, listClients, listFinalizedSales } from "@/services/clientsService";
import { searchConsultas, type ConsultaDocument } from "@/services/consultasService";
import { listVehicles } from "@/services/vehiclesService";
import type { Client, ClientDocument, ClientOperation, FinalizedSale } from "@/types/clients";
import type { Vehicle } from "@/types/vehicles";

const editorPaths: Record<string, string> = {
  datero: "/datero",
  recibo: "/recibo",
  autorizacion: "/autorizacion-conduccion",
  operacion_finalizada: "/operacion-finalizada",
  compra_venta: "/compra-venta",
  presupuesto_cliente: "/presupuesto-cliente",
  formulario_cliente: "/formulario-cliente",
};

type ClientProfileData = {
  client: Client;
  operations: ClientOperation[];
  documents: ClientDocument[];
  archiveDocuments: ConsultaDocument[];
  sales: FinalizedSale[];
  vehicles: Vehicle[];
};

function documentUrl(document: ClientDocument) {
  const path = editorPaths[document.documentType] ?? "/ventas/documentos";
  const params = new URLSearchParams({ clientId: document.clientId, operationId: document.operationId, documentId: document.id });
  return `${path}?${params.toString()}`;
}

function operationLabel(operation: ClientOperation) {
  if (operation.status === "finalizada") return "Operación finalizada";
  if (operation.status === "cancelada") return "Operación cancelada";
  return "Operación en borrador";
}

function operationVehicle(operation: ClientOperation, vehicles: Vehicle[]) {
  const vehicle = operation.vehicleId ? vehicles.find((item) => item.id === operation.vehicleId) : undefined;
  if (vehicle) return `${vehicle.brand} ${vehicle.model}${vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ""}`.trim();
  const data = operation.data;
  const vehicleName = [String(data.vehModelo ?? data.modelo ?? data.marca ?? ""), String(data.vehAnio ?? data.anio ?? "")].filter((value) => value && value !== "undefined").join(" · ");
  const domain = String(data.dominio ?? "").trim();
  return [vehicleName, domain ? `Dominio ${domain}` : ""].filter(Boolean).join(" · ") || "Vehículo sin vincular";
}

function saleForOperation(operation: ClientOperation) {
  const data = operation.data.ventaFinalizada as Record<string, unknown> | undefined;
  const raw = data?.precioVenta ?? operation.data.precioVenta;
  const amount = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function ArchiveDocumentCard({ document }: { document: ConsultaDocument }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-slate-200 bg-slate-100 text-slate-700">{document.documentLabel}</Badge>
          {document.licensePlate ? <Badge className="border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">{document.licensePlate}</Badge> : null}
        </div>
        <p className="mt-2 truncate font-semibold text-slate-900">{document.title}</p>
        <p className="text-xs text-slate-500">{formatDateTime(document.createdAt)}{document.vehicleLabel ? ` · ${document.vehicleLabel}` : ""}</p>
      </div>
      {document.fileUrl ? <a href={document.fileUrl} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Abrir PDF</Button></a> : <span className="text-xs text-amber-700">Sin archivo PDF</span>}
    </div>
  );
}

function CurrentDocumentCard({ document }: { document: ClientDocument }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2"><Badge className="border-blue-200 bg-blue-50 text-blue-700">{documentTypeLabel(document.documentType)}</Badge><Badge className="border-amber-200 bg-amber-50 text-amber-700">Registro actual</Badge></div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(document.updatedAt || document.createdAt)}</p>
        <p className="text-xs text-slate-500">Estado: {document.status === "generado" ? "Generado" : "Borrador"} · El PDF se descarga desde el documento.</p>
      </div>
      <Link to={documentUrl(document)}><Button variant="outline"><FileText className="mr-2 h-4 w-4" />Abrir documento</Button></Link>
    </div>
  );
}

export function ClienteDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) { setError("Cliente no encontrado."); setLoading(false); return; }
      try {
        const clients = await listClients();
        const client = clients.find((item) => item.id === id);
        if (!client) { if (active) { setError("Cliente no encontrado."); setLoading(false); } return; }
        const historyPromise = getClientHistory(client.id);
        const salesPromise = listFinalizedSales();
        const vehiclesPromise = listVehicles();
        const archiveByNamePromise = searchConsultas(client.nombre, "archivos");
        const archiveByDniPromise = client.dni ? searchConsultas(client.dni, "archivos") : Promise.resolve({ documents: [] as ConsultaDocument[], connected: true });
        const [history, sales, vehicles, archiveByName, archiveByDni] = await Promise.all([historyPromise, salesPromise, vehiclesPromise, archiveByNamePromise, archiveByDniPromise]);
        if (!active) return;
        const archiveDocuments = [...archiveByName.documents, ...archiveByDni.documents].filter((document, index, all) => all.findIndex((candidate) => candidate.id === document.id) === index);
        const normalizedName = client.nombre.trim().toLowerCase();
        const clientSales = sales.filter((sale) => sale.clientId === client.id || (normalizedName && sale.clientName.trim().toLowerCase() === normalizedName));
        setProfile({ client, operations: history.operations, documents: history.documents, archiveDocuments, sales: clientSales, vehicles });
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la ficha del cliente.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  const operationRows = useMemo(() => profile?.operations ?? [], [profile]);
  const finishedSales = profile?.sales ?? [];

  if (loading) return <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando ficha del cliente…</div>;
  if (error || !profile) return <div className="space-y-4"><Button variant="ghost" onClick={() => navigate("/ventas/clientes")}><ArrowLeft className="mr-2 h-4 w-4" />Volver a clientes</Button><Card><CardContent><p className="text-sm text-slate-600">{error || "Cliente no encontrado."}</p></CardContent></Card></div>;

  const { client, documents, archiveDocuments, vehicles } = profile;
  const totalDocuments = documents.length + archiveDocuments.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventas · Clientes"
        title={client.nombre || "Cliente sin nombre"}
        description={`Ficha completa · DNI ${client.dni || "sin dato"}`}
        actions={<><Link to="/ventas/clientes"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Clientes</Button></Link><Link to={`/datero?clientId=${encodeURIComponent(client.id)}`}><Button>Editar datos</Button></Link></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Operaciones", value: String(operationRows.length), icon: <ShoppingCart className="h-5 w-5 text-blue-600" /> }, { label: "Ventas finalizadas", value: String(finishedSales.length), icon: <CarFront className="h-5 w-5 text-emerald-600" /> }, { label: "Documentos actuales", value: String(documents.length), icon: <FileText className="h-5 w-5 text-fuchsia-600" /> }, { label: "PDF históricos", value: String(archiveDocuments.length), icon: <ReceiptText className="h-5 w-5 text-amber-600" /> }].map((metric) => <Card key={metric.label}><CardContent className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{metric.label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{metric.value}</p></div>{metric.icon}</CardContent></Card>)}
      </div>

      <Card><CardContent className="space-y-4"><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-fuchsia-600" /><h2 className="text-lg font-semibold text-slate-950">Datos del cliente</h2></div><dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">{[["DNI", client.dni], ["CUIL / CUIT", client.cuil], ["Teléfono", client.telefono || client.celular], ["Email", client.email], ["Domicilio", client.domicilio], ["Localidad", client.localidad], ["Provincia", client.provincia], ["Estado civil", client.estadoCivil], ["Condición fiscal", client.condicionFiscal], ["Fecha de nacimiento", client.fechaNacimiento ? formatDate(client.fechaNacimiento) : ""]].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-words text-slate-800">{value || "Sin dato"}</dd></div>)}</dl></CardContent></Card>

      <Card><CardContent className="space-y-4"><div><h2 className="text-lg font-semibold text-slate-950">Ventas registradas</h2><p className="text-sm text-slate-500">Ventas vinculadas a operaciones finalizadas y ventas históricas asociadas por cliente.</p></div>{finishedSales.length ? <div className="space-y-3">{finishedSales.map((sale) => <div key={sale.operationId} className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{sale.vehicleLabel}</p><Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Vendida</Badge>{sale.source === "vehicle_history" ? <Badge className="border-slate-200 bg-slate-50 text-slate-600">Histórica</Badge> : <Badge className="border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">Operación finalizada</Badge>}{sale.hasCredit ? <Badge className="border-blue-200 bg-blue-50 text-blue-700">Con crédito</Badge> : null}</div><p className="text-sm text-slate-500">{sale.licensePlate || "Sin dominio"} · {formatDate(sale.saleDate)}</p></div><div className="flex items-center gap-3">{sale.salePrice ? <span className="font-semibold text-slate-900">{formatCurrency(sale.salePrice)}</span> : <span className="text-sm text-slate-500">Precio sin cargar</span>}<Link to={`/autos/${sale.vehicleId}`}><Button variant="outline">Ver auto</Button></Link></div></div>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No hay ventas finalizadas asociadas a este cliente.</p>}</CardContent></Card>

      <Card><CardContent className="space-y-4"><div><h2 className="text-lg font-semibold text-slate-950">Movimientos y operaciones</h2><p className="text-sm text-slate-500">La actividad comercial queda ordenada por fecha, sin mezclarla con los documentos.</p></div>{operationRows.length ? <div className="space-y-3">{operationRows.map((operation) => <div key={operation.id} className="rounded-xl border border-slate-200 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge className={operation.status === "finalizada" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-700"}>{operationLabel(operation)}</Badge><span className="text-sm font-semibold text-slate-900">{operationVehicle(operation, vehicles)}</span></div><span className="text-sm text-slate-500">{formatDate(operation.fecha || operation.updatedAt)}</span></div>{saleForOperation(operation) ? <p className="mt-2 text-sm text-slate-600">Precio de venta: <strong>{formatCurrency(saleForOperation(operation) ?? 0)}</strong></p> : null}<div className="mt-3 flex flex-wrap gap-2"><Link to={`/datero?clientId=${encodeURIComponent(client.id)}&operationId=${encodeURIComponent(operation.id)}`}><Button variant="ghost">Ver operación</Button></Link><Link to={`/operacion-finalizada?clientId=${encodeURIComponent(client.id)}&operationId=${encodeURIComponent(operation.id)}`}><Button variant="outline">Abrir cierre</Button></Link></div></div>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Todavía no hay movimientos registrados.</p>}</CardContent></Card>

      <div className="grid gap-6 xl:grid-cols-2"><Card><CardContent className="space-y-4"><div><h2 className="text-lg font-semibold text-slate-950">Documentos históricos</h2><p className="text-sm text-slate-500">PDF generados anteriormente y recuperados de Consultas.</p></div>{archiveDocuments.length ? <div className="space-y-3">{archiveDocuments.map((document) => <ArchiveDocumentCard key={document.id} document={document} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No hay PDFs históricos asociados.</p>}</CardContent></Card><Card><CardContent className="space-y-4"><div><h2 className="text-lg font-semibold text-slate-950">Documentos de la operación</h2><p className="text-sm text-slate-500">Registros actuales y acceso directo a cada documento.</p></div>{documents.length ? <div className="space-y-3">{documents.map((document) => <CurrentDocumentCard key={document.id} document={document} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No hay documentos actuales guardados.</p>}</CardContent></Card></div>
      <p className="text-xs text-slate-400">Total en esta ficha: {totalDocuments} documento{totalDocuments === 1 ? "" : "s"}.</p>
    </div>
  );
}
