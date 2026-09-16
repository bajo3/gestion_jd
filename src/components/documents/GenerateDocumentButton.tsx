import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveDocument } from "@/services/documentsService";
import type { DocumentType } from "@/services/documentDraftService";
import type { GeneratedPdf } from "@/pdf/common";

type Status =
  | { kind: "saved"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "error"; message: string };

type GenerateDocumentButtonProps = {
  documentType: DocumentType;
  values: Record<string, unknown>;
  onGenerate: () => Promise<GeneratedPdf>;
  label?: string;
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
}: GenerateDocumentButtonProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const handleClick = async () => {
    if (busy) return;

    setBusy(true);
    setStatus(null);

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
    </div>
  );
}
