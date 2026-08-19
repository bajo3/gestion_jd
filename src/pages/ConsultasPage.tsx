import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CloudOff, Download, FileText, Loader2, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { documentLabels, type DocumentType } from "@/services/documentDraftService";
import { searchDocuments } from "@/services/documentsService";
import type { StoredDocument } from "@/types/documents";

const documentTypes = Object.keys(documentLabels) as DocumentType[];

function prettifyKey(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function formatValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function DocumentCard({ document }: { document: StoredDocument }) {
  const [expanded, setExpanded] = useState(false);

  const entries = useMemo(
    () =>
      Object.entries(document.formData)
        .map(([key, value]) => [prettifyKey(key), formatValue(value)] as const)
        .filter(([, value]) => value !== ""),
    [document.formData],
  );

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-slate-200 bg-slate-100 text-slate-700">{document.documentLabel}</Badge>
            {document.licensePlate ? (
              <Badge className="border-[#ff0a8a]/20 bg-[#ff0a8a]/10 text-[#ff0a8a]">{document.licensePlate}</Badge>
            ) : null}
            {!document.fileUrl ? (
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">Sin archivo</Badge>
            ) : null}
          </div>
          <h2 className="mt-3 truncate text-lg font-semibold text-slate-950">
            {document.personName || document.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(document.createdAt)}
            {document.documentDate ? ` - Fecha del documento: ${formatDate(document.documentDate)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {document.fileUrl ? (
            <a href={document.fileUrl} target="_blank" rel="noreferrer" download={document.fileName || undefined}>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Abrir PDF
              </Button>
            </a>
          ) : null}
          <Button variant="ghost" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Ocultar datos" : "Ver datos"}
          </Button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {document.documentNumber ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">DNI / CUIT</dt>
            <dd className="text-slate-800">{document.documentNumber}</dd>
          </div>
        ) : null}
        {document.phone ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Telefono</dt>
            <dd className="text-slate-800">{document.phone}</dd>
          </div>
        ) : null}
        {document.vehicleLabel ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vehiculo</dt>
            <dd className="text-slate-800">{document.vehicleLabel}</dd>
          </div>
        ) : null}
        {document.amount ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Importe</dt>
            <dd className="text-slate-800">{formatCurrency(document.amount)}</dd>
          </div>
        ) : null}
      </dl>

      {expanded ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {entries.length ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {entries.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{key}</dt>
                  <dd className="break-words text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Este documento no guardo datos adicionales.</p>
          )}
          {document.fileName ? (
            <p className="mt-4 text-xs text-slate-400">Archivo: {document.fileName}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ConsultasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [documentType, setDocumentType] = useState<DocumentType | "todos">(
    () => (searchParams.get("tipo") as DocumentType | null) ?? "todos",
  );
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"supabase" | "local">("supabase");
  const urlQueryRef = useRef(searchParams.get("q") ?? "");

  const runSearch = useCallback(
    async (nextQuery: string, nextType: DocumentType | "todos") => {
      setLoading(true);
      try {
        const result = await searchDocuments({ query: nextQuery, documentType: nextType });
        setDocuments(result.documents);
        setSource(result.source);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => runSearch(query, documentType), 250);
    return () => window.clearTimeout(timer);
  }, [documentType, query, runSearch]);

  // Deja la busqueda en la URL para poder compartirla y para que el asistente
  // pueda abrir /consultas?q=PATENTE.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (documentType !== "todos") params.set("tipo", documentType);

    const next = params.toString();
    if (next === searchParams.toString()) return;

    const incomingQuery = searchParams.get("q") ?? "";
    if (incomingQuery !== urlQueryRef.current) {
      urlQueryRef.current = incomingQuery;
      setQuery(incomingQuery);
      return;
    }

    urlQueryRef.current = query.trim();
    setSearchParams(params, { replace: true });
  }, [documentType, query, searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Consultas"
        title="Consultas"
        description="Todos los documentos generados quedan guardados aca. Busca por patente, nombre, DNI, telefono o vehiculo."
        actions={
          <Button variant="outline" onClick={() => runSearch(query, documentType)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por patente o nombre (ej: AB123CD o Juan Perez)"
              className="pl-9"
            />
          </div>
          <Select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as DocumentType | "todos")}
          >
            <option value="todos">Todos los documentos</option>
            {documentTypes.map((type) => (
              <option key={type} value={type}>
                {documentLabels[type]}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>
            {loading ? "Buscando..." : `${documents.length} documento${documents.length === 1 ? "" : "s"}`}
          </span>
          {source === "local" ? (
            <span className="flex items-center gap-1.5 font-medium text-amber-700">
              <CloudOff className="h-3.5 w-3.5" />
              Mostrando la copia de este dispositivo (sin conexion con la base).
            </span>
          ) : null}
        </div>
      </div>

      {loading && !documents.length ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Buscando documentos...
        </div>
      ) : null}

      {!loading && !documents.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">
            {query.trim() ? "No encontramos documentos" : "Todavia no hay documentos guardados"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {query.trim()
              ? "Proba con la patente sin espacios, solo el apellido o el DNI."
              : "Cada documento que generes desde Ventas se guarda automaticamente en esta seccion."}
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {documents.map((document) => (
          <DocumentCard key={document.id} document={document} />
        ))}
      </div>
    </div>
  );
}
