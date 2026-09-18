import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveDocument } from "@/services/documentsService";
import type { DocumentType } from "@/services/documentDraftService";
import type { GeneratedPdf } from "@/pdf/common";
import type { SaleSyncResult } from "@/services/saleSyncService";

type Status =
  | { kind: "saved"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "error"; message: string };

type GenerateDocumentButtonProps = {
  documentType: DocumentType;
  values: Record<string, unknown>;
  onGenerate: () => Promise<GeneratedPdf>;
  label?: string;
  /** Se ejecuta despues de generar el PDF (ej: cargar cliente y auto). */
  afterGenerate?: () => Promise<Pick<SaleSyncResult, "messages" | "warnings" | "links">>;
};

/**
 * Genera el PDF y lo archiva en Consultas para poder buscarlo despues por
 * patente o nombre.
 */
export function GenerateDocumentButton({
  documentType,
  values,
  onGenerate,
  label = "Generar Resumen",
  afterGenerate,
}: GenerateDocumentButtonProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [sync, setSync] = useState<Pick<SaleSyncResult, "messages" | "warnings" | "links"> | null>(null);

  const handleClick = async () => {
    if (busy) return;

    setBusy(true);
    setStatus(null);
    setSync(null);

    try {
      const pdf = await onGenerate();

      try {
        const result = await archiveDocument({
          documentType,
          values,
          fileName: pdf.fileName,
          blob: pdf.blob,
        });

        setStatus(
          result.persisted
            ? { kind: "saved", message: "Guardado en Consultas." }
            : {
                kind: "warning",
                message: "PDF generado. Quedo guardado en este dispositivo, no en la base.",
              },
        );
      } catch {
        setStatus({ kind: "warning", message: "PDF generado, pero no se pudo archivar." });
      }

      if (afterGenerate) {
        try {
          setSync(await afterGenerate());
        } catch (error) {
          setSync({
            messages: [],
            warnings: [error instanceof Error ? error.message : "No se pudo cargar el cliente ni el auto."],
            links: [],
          });
        }
      }
    } catch {
      setStatus({ kind: "error", message: "No se pudo generar el documento." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleClick} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {busy ? "Generando..." : label}
      </Button>
      {status ? (
        <p
          className={
            status.kind === "saved"
              ? "flex items-center gap-1.5 text-xs font-medium text-emerald-700"
              : status.kind === "warning"
                ? "flex items-center gap-1.5 text-xs font-medium text-amber-700"
                : "flex items-center gap-1.5 text-xs font-medium text-red-700"
          }
        >
          {status.kind === "saved" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <TriangleAlert className="h-3.5 w-3.5" />
          )}
          {status.message}
          {status.kind === "saved" ? (
            <Link to="/consultas" className="underline underline-offset-2">
              Ver
            </Link>
          ) : null}
        </p>
      ) : null}
      {sync?.warnings.length ? (
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-right text-xs font-medium text-red-700">
          {sync.warnings.map((warning) => (
            <p key={warning} className="flex items-start justify-end gap-1.5">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      ) : null}
      {sync && (sync.messages.length || sync.links.length) ? (
        <div className="max-w-md space-y-0.5 text-right text-xs text-slate-600">
          {sync.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
          <p className="mt-1 flex flex-wrap justify-end gap-3">
            {sync.links.map((link) => (
              <Link key={link.to} to={link.to} className="font-medium underline underline-offset-2">
                {link.label}
              </Link>
            ))}
            <Link to="/ventas/clientes" className="underline underline-offset-2">
              Ver clientes
            </Link>
            <Link to="/autos" className="underline underline-offset-2">
              Ver historial
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
