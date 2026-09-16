import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CloudOff, ExternalLink, FileText, FolderArchive, Loader2, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate, formatDateTime } from "@/lib/utils";
import { consultaDocumentLabels, formatConsultaAmount, searchConsultas, type ConsultaDocument, type ConsultaFilter } from "@/services/consultasService";

const documentEditorPaths = {
  datero: "/datero",
  recibo: "/recibo",
  autorizacion: "/autorizacion-conduccion",
  operacion_finalizada: "/operacion-finalizada",
  compra_venta: "/compra-venta",
  presupuesto_cliente: "/presupuesto-cliente",
  formulario_cliente: "/formulario-cliente",
  test_drive: "/test-drive",
} as const;

function prettifyKey(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function formatValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function documentEditorUrl(document: ConsultaDocument) {
  if (!document.clientId || !document.operationId || !document.documentId) return documentEditorPaths[document.documentType];
  const params = new URLSearchParams({ clientId: document.clientId, operationId: document.operationId, documentId: document.documentId });
  return `${documentEditorPaths[document.documentType]}?${params.toString()}`;
}

function DocumentCard({ document }: { document: ConsultaDocument }) {
  const [expanded, setExpanded] = useState(false);
  const entries = useMemo(
    () => Object.entries(document.formData)
      .map(([key, value]) => [prettifyKey(key), formatValue(value)] as const)
      .filter(([, value]) => value),
    [document.formData],
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-slate-200 bg-slate-100 text-slate-700">{document.documentLabel}</Badge>
            <Badge className={document.source === "archivo" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
              {document.source === "archivo" ? "PDF archivado" : "Registro actual · sin PDF"}
            </Badge>
            {document.licensePlate ? <Badge className="border-[#ff0a8a]/20 bg-[#ff0a8a]/10 text-[#d90875]">{document.licensePlate}</Badge> : null}
          </div>
          <h2 className="mt-3 truncate text-lg font-semibold text-slate-950">{document.personName || document.title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(document.createdAt)}{document.documentDate ? ` · Fecha del documento: ${formatDate(document.documentDate)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {document.fileUrl ? (
            <a href={document.fileUrl} target="_blank" rel="noreferrer">
              <Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Abrir PDF</Button>
            </a>
          ) : (
            <Link to={documentEditorUrl(document)}><Button variant="outline"><FileText className="mr-2 h-4 w-4" />Abrir documento</Button></Link>
          )}
          <Button variant="ghost" onClick={() => setExpanded((current) => !current)}>{expanded ? "Ocultar datos" : "Ver datos"}</Button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {document.documentNumber ? <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">DNI / CUIT</dt><dd className="text-slate-800">{document.documentNumber}</dd></div> : null}
        {document.phone ? <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Teléfono</dt><dd className="text-slate-800">{document.phone}</dd></div> : null}
        {document.vehicleLabel ? <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vehículo</dt><dd className="text-slate-800">{document.vehicleLabel}</dd></div> : null}
        {document.amount !== null ? <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Importe</dt><dd className="text-slate-800">{formatConsultaAmount(document.amount)}</dd></div> : null}
      </dl>

      {expanded ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {entries.length ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {entries.map(([key, value]) => <div key={key}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{key}</dt><dd className="break-words text-slate-800">{value}</dd></div>)}
            </dl>
          ) : <p className="text-sm text-slate-500">No hay datos adicionales guardados.</p>}
          {document.fileName ? <p className="mt-4 text-xs text-slate-400">Archivo: {document.fileName}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

export function ConsultasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<ConsultaFilter>(() => (searchParams.get("tipo") as ConsultaFilter | null) ?? "todos");
  const [documents, setDocuments] = useState<ConsultaDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);

  const runSearch = useCallback(async (nextQuery: string, nextFilter: ConsultaFilter) => {
    setLoading(true);
    const result = await searchConsultas(nextQuery, nextFilter);
    setDocuments(result.documents);
    setConnected(result.connected);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void runSearch(query, filter); }, 250);
    return () => window.clearTimeout(timer);
  }, [filter, query, runSearch]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filter !== "todos") params.set("tipo", filter);
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [filter, query, searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos"
        title="Consultas"
        description="Buscá por nombre, DNI, teléfono, patente o vehículo. Recupera los PDF archivados y los registros del flujo comercial actual."
        actions={<Button variant="outline" onClick={() => void runSearch(query, filter)} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por patente, nombre, DNI, teléfono o vehículo" className="pl-9" /></div>
          <Select value={filter} onChange={(event) => setFilter(event.target.value as ConsultaFilter)}>
            <option value="todos">Todos los documentos</option>
            <option value="archivos">Solo PDF archivados</option>
            {Object.entries(consultaDocumentLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{loading ? "Buscando..." : `${documents.length} documento${documents.length === 1 ? "" : "s"}`}</span>
          <span className="flex items-center gap-1.5"><FolderArchive className="h-3.5 w-3.5" />Los registros que muestran “PDF archivado” se pueden descargar.</span>
          {!connected ? <span className="flex items-center gap-1.5 font-medium text-amber-700"><CloudOff className="h-3.5 w-3.5" />No se pudo conectar con la base.</span> : null}
        </div>
      </div>

      {loading && !documents.length ? <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Buscando documentos...</div> : null}
      {!loading && !documents.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><FileText className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-3 text-lg font-semibold text-slate-900">{query.trim() ? "No encontramos documentos" : "Todavía no hay documentos guardados"}</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{query.trim() ? "Probá con la patente sin espacios, solo el apellido o el DNI." : "Los documentos nuevos aparecerán aquí al guardarlos."}</p></div> : null}
      <div className="space-y-4">{documents.map((document) => <DocumentCard key={document.id} document={document} />)}</div>
    </div>
  );
}
