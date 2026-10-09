import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, ScanSearch, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_BOLETO_TYPES,
  boletoWarnings,
  buildBoletoForm,
  confirmBoleto,
  findExistingBoletos,
  isBoletoFile,
  scanBoletoFile,
  type BoletoConfirmResult,
  type BoletoExtraction,
  type BoletoForm,
} from "@/services/boletoScanService";

type Phase = "waiting" | "reading" | "review" | "saving" | "saved" | "error";

type Entry = {
  id: string;
  file: File;
  phase: Phase;
  extraction: BoletoExtraction | null;
  form: BoletoForm | null;
  error: string;
  result: BoletoConfirmResult | null;
  /** Aviso de que ya hay un boleto de esa patente; con el segundo click se carga igual. */
  duplicate: string;
};

let nextId = 1;

export function BoletosPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Se lee de a un archivo por vez para no pasarse del limite de la IA.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const patchEntry = useCallback((id: string, patch: Partial<Entry>) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const readEntry = useCallback(
    (id: string, file: File) => {
      queue.current = queue.current.then(async () => {
        patchEntry(id, { phase: "reading", error: "" });
        try {
          const extraction = await scanBoletoFile(file);
          patchEntry(id, { phase: "review", extraction, form: buildBoletoForm(extraction) });
        } catch (error) {
          patchEntry(id, { phase: "error", error: error instanceof Error ? error.message : "No se pudo leer el boleto." });
        }
      });
    },
    [patchEntry],
  );

  const addFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter(isBoletoFile);
    const fresh = valid.map<Entry>((file) => ({
      id: `boleto-${nextId++}`,
      file,
      phase: "waiting",
      extraction: null,
      form: null,
      error: "",
      result: null,
      duplicate: "",
    }));
    if (!fresh.length) return;
    setEntries((current) => [...fresh, ...current]);
    for (const entry of fresh) readEntry(entry.id, entry.file);
  };

  const confirm = async (entry: Entry) => {
    if (!entry.form) return;
    if (!entry.duplicate) {
      const existing = await findExistingBoletos(entry.form);
      if (existing.length) {
        const last = existing[0];
        patchEntry(entry.id, {
          duplicate: `Ya hay ${existing.length === 1 ? "un boleto cargado" : `${existing.length} boletos cargados`} de la patente ${entry.form.dominio} (${last.personName || "sin nombre"}, ${last.createdAt.slice(0, 10)}). Si es el mismo, no lo cargues de nuevo: se duplicaría la venta.`,
        });
        return;
      }
    }
    patchEntry(entry.id, { phase: "saving", error: "" });
    try {
      const result = await confirmBoleto(entry.form, entry.file);
      patchEntry(entry.id, { phase: "saved", result });
    } catch (error) {
      patchEntry(entry.id, { phase: "review", error: error instanceof Error ? error.message : "No se pudo cargar el boleto." });
    }
  };

  const setField = (id: string, field: keyof BoletoForm, value: string) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id && entry.form ? { ...entry, form: { ...entry.form, [field]: value } } : entry)),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventas"
        title="Cargar boletos"
        description="Subí el boleto de compra-venta en PDF o foto. La IA lee los datos, vos los revisás y recién ahí se cargan el cliente, el auto y la venta."
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
          dragging ? "border-slate-900 bg-slate-50" : "border-slate-300 bg-white",
        )}
      >
        <FileUp className="h-8 w-8 text-slate-500" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Arrastrá los boletos acá o elegilos</p>
          <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG o WebP. Podés subir varios juntos. Máximo ~3 MB cada PDF.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_BOLETO_TYPES}
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button onClick={() => inputRef.current?.click()}>Elegir archivos</Button>
      </div>

      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          onField={(field, value) => setField(entry.id, field, value)}
          onConfirm={() => void confirm(entry)}
          onRetry={() => readEntry(entry.id, entry.file)}
          onRemove={() => setEntries((current) => current.filter((item) => item.id !== entry.id))}
        />
      ))}
    </div>
  );
}

function EntryCard({
  entry,
  onField,
  onConfirm,
  onRetry,
  onRemove,
}: {
  entry: Entry;
  onField: (field: keyof BoletoForm, value: string) => void;
  onConfirm: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { form, extraction, phase } = entry;
  const warnings = form ? boletoWarnings(form, extraction) : [];
  const locked = phase === "saving" || phase === "saved";

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{entry.file.name}</p>
            <p className="text-xs text-slate-500">{(entry.file.size / 1024).toFixed(0)} KB</p>
          </div>
          {phase !== "saving" ? (
            <button type="button" onClick={onRemove} className="text-slate-400 hover:text-slate-700" aria-label="Quitar">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {phase === "waiting" || phase === "reading" ? (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {phase === "waiting" ? "En la fila para leerse…" : "Leyendo el boleto con IA…"}
          </p>
        ) : null}

        {phase === "error" ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm font-medium text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {entry.error}
            </p>
            <Button variant="outline" onClick={onRetry}>
              <ScanSearch className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        ) : null}

        {form && extraction ? (
          <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
            {extraction.dudas.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold">La IA dudó de estos datos, mirá el original:</p>
                <ul className="mt-1 list-disc pl-4">
                  {extraction.dudas.map((doubt) => (
                    <li key={doubt}>{doubt}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="¿Qué operación es?" hint="Según el boleto: quién es la agencia en él.">
                <Select value={form.direction} onChange={(event) => onField("direction", event.target.value)}>
                  <option value="venta">Venta: le vendimos un auto</option>
                  <option value="compra">Compra: le compramos un auto</option>
                </Select>
              </FormField>
              <FormField label="Fecha">
                <Input type="date" value={form.fecha} onChange={(event) => onField("fecha", event.target.value)} />
              </FormField>
              <FormField label={`Precio (${form.moneda})`}>
                <Input inputMode="numeric" value={form.precio} onChange={(event) => onField("precio", event.target.value.replace(/\D/g, ""))} />
              </FormField>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {form.direction === "venta" ? "Comprador" : "Vendedor"}
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FormField label="Nombre">
                  <Input value={form.parteNombre} onChange={(event) => onField("parteNombre", event.target.value)} />
                </FormField>
                <FormField label="DNI">
                  <Input value={form.parteDni} onChange={(event) => onField("parteDni", event.target.value.replace(/\D/g, ""))} />
                </FormField>
                <FormField label="Teléfono">
                  <Input value={form.parteTelefono} onChange={(event) => onField("parteTelefono", event.target.value)} />
                </FormField>
                <FormField label="Domicilio">
                  <Input value={form.parteDomicilio} onChange={(event) => onField("parteDomicilio", event.target.value)} />
                </FormField>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Vehículo</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FormField label="Patente">
                  <Input value={form.dominio} onChange={(event) => onField("dominio", event.target.value.toUpperCase())} />
                </FormField>
                <FormField label="Marca">
                  <Input value={form.marca} onChange={(event) => onField("marca", event.target.value)} />
                </FormField>
                <FormField label="Modelo y versión">
                  <Input value={form.modelo} onChange={(event) => onField("modelo", event.target.value)} />
                </FormField>
                <FormField label="Tipo">
                  <Input value={form.tipo} onChange={(event) => onField("tipo", event.target.value)} />
                </FormField>
                <FormField label="Año">
                  <Input inputMode="numeric" value={form.anio} onChange={(event) => onField("anio", event.target.value.replace(/\D/g, ""))} />
                </FormField>
                <FormField label="Kilómetros">
                  <Input inputMode="numeric" value={form.km} onChange={(event) => onField("km", event.target.value.replace(/\D/g, ""))} />
                </FormField>
                <FormField label="Motor Nº">
                  <Input value={form.motor} onChange={(event) => onField("motor", event.target.value)} />
                </FormField>
                <FormField label="Chasis Nº">
                  <Input value={form.chasis} onChange={(event) => onField("chasis", event.target.value)} />
                </FormField>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Forma de pago" hint="Si es en cuotas, escribí cuántas: '24 cuotas'.">
                <Input value={form.formaPago} onChange={(event) => onField("formaPago", event.target.value)} />
              </FormField>
              <FormField label="Observaciones">
                <Input value={form.observaciones} onChange={(event) => onField("observaciones", event.target.value)} />
              </FormField>
            </div>

            {phase !== "saved" && warnings.length ? (
              <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}

            {phase !== "saved" && entry.duplicate ? (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{entry.duplicate}</p>
            ) : null}

            {phase !== "saved" ? (
              <div className="space-y-2">
                <Button disabled={phase === "saving"} onClick={onConfirm}>
                  {phase === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {entry.duplicate
                    ? "Cargar igual"
                    : form.direction === "venta"
                      ? "Confirmar y cargar la venta"
                      : "Confirmar y cargar el auto"}
                </Button>
                <p className="text-xs text-slate-500">
                  {form.direction === "venta"
                    ? "Se crea o actualiza el cliente, se carga la operación y, si están el DNI, la patente y el precio, se cierra la venta (el auto queda vendido y se programa la postventa)."
                    : "Se carga el auto en el Historial con el precio de compra. No se crea ninguna venta."}
                </p>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {entry.error && phase === "review" ? <p className="text-sm font-medium text-red-700">{entry.error}</p> : null}

        {phase === "saved" && entry.result ? (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Boleto cargado
            </p>
            <ul className="space-y-1 text-emerald-800">
              {entry.result.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            {entry.result.warnings.length ? (
              <ul className="space-y-1 text-amber-800">
                {entry.result.warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-1">
              {entry.result.links.map((link) => (
                <Link key={link.to} to={link.to} className="text-xs font-semibold text-slate-700 underline">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
