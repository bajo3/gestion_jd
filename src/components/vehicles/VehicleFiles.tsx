import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { VEHICLE_FILE_CATEGORY_LABELS } from "@/lib/vehicleLabels";
import type { VehicleFile } from "@/types/vehicles";

function isImage(file: VehicleFile) {
  return file.fileType.startsWith("image/") || file.category === "foto";
}

function isPdf(file: VehicleFile) {
  return file.fileType.includes("pdf");
}

function isDataUrl(url?: string) {
  return Boolean(url?.startsWith("data:"));
}

type VehicleFilesProps = {
  files: VehicleFile[];
  onDelete?: (file: VehicleFile) => void | Promise<void>;
  /** Boton u otra accion a la derecha del titulo. */
  headerAction?: ReactNode;
  /** Contenido extra entre el titulo y la lista (por ejemplo, el formulario para adjuntar). */
  children?: ReactNode;
};

export function VehicleFiles({ files, onDelete, headerAction, children }: VehicleFilesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const createdUrls: string[] = [];

    async function resolveUrls() {
      const entries = await Promise.all(
        files.map(async (file) => {
          if (!file.fileUrl) {
            return [file.id, ""] as const;
          }

          if (!isDataUrl(file.fileUrl)) {
            return [file.id, file.fileUrl] as const;
          }

          try {
            const response = await fetch(file.fileUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            createdUrls.push(blobUrl);
            return [file.id, blobUrl] as const;
          } catch {
            return [file.id, file.fileUrl] as const;
          }
        }),
      );

      if (!active) return;
      setResolvedUrls(Object.fromEntries(entries));
    }

    resolveUrls();

    return () => {
      active = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const activeSelectedId = selectedId && files.some((file) => file.id === selectedId) ? selectedId : null;
  const selectedFile = useMemo(
    () => files.find((file) => file.id === activeSelectedId) ?? null,
    [files, activeSelectedId],
  );

  const selectedUrl = selectedFile ? resolvedUrls[selectedFile.id] || selectedFile.fileUrl || "" : "";

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              Adjuntos
              {files.length ? <span className="ml-2 text-sm font-medium text-slate-400">{files.length}</span> : null}
            </h3>
            <p className="text-sm text-slate-500">Documentación asociada al vehículo.</p>
          </div>
          {headerAction}
        </div>

        {children}

        {files.length ? (
          <>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {files.map((file) => {
                const resolvedUrl = resolvedUrls[file.id] || file.fileUrl || "";
                const selected = file.id === activeSelectedId;

                return (
                  <li
                    key={file.id}
                    className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                        {isImage(file) ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{file.fileName}</p>
                        <p className="text-xs text-slate-500">
                          {VEHICLE_FILE_CATEGORY_LABELS[file.category] ?? file.category} ·{" "}
                          {formatDateTime(file.createdAt)}
                        </p>
                        {file.notes ? <p className="mt-0.5 text-xs text-slate-600">{file.notes}</p> : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {resolvedUrl ? (
                        <>
                          <Button
                            variant={selected ? "secondary" : "outline"}
                            className="h-9 px-3 py-0"
                            onClick={() => setSelectedId(selected ? null : file.id)}
                          >
                            {selected ? "Ocultar" : "Ver"}
                          </Button>
                          <a
                            href={resolvedUrl}
                            download={file.fileName}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Download className="h-4 w-4" />
                            Descargar
                          </a>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
                          <Paperclip className="h-3.5 w-3.5" />
                          Archivo viejo sin contenido recuperable
                        </span>
                      )}

                      {onDelete ? (
                        <Button
                          variant="ghost"
                          className="h-9 px-2.5 py-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Borrar ${file.fileName}`}
                          title="Borrar"
                          onClick={() => onDelete(file)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {selectedFile && selectedUrl ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Vista previa</p>
                    <p className="truncate text-xs text-slate-500">{selectedFile.fileName}</p>
                  </div>
                  <Button variant="ghost" className="h-9 px-3 py-0" onClick={() => setSelectedId(null)}>
                    Cerrar
                  </Button>
                </div>

                {isImage(selectedFile) ? (
                  <img
                    src={selectedUrl}
                    alt={selectedFile.fileName}
                    className="max-h-[28rem] w-full rounded-xl border border-slate-200 bg-white object-contain"
                  />
                ) : null}

                {isPdf(selectedFile) ? (
                  <object
                    data={selectedUrl}
                    type="application/pdf"
                    className="h-[32rem] w-full rounded-xl border border-slate-200 bg-white"
                  >
                    <iframe
                      src={selectedUrl}
                      title={selectedFile.fileName}
                      className="h-[32rem] w-full rounded-xl border border-slate-200 bg-white"
                    />
                  </object>
                ) : null}

                {!isImage(selectedFile) && !isPdf(selectedFile) ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
                    Este tipo de archivo no tiene vista previa. Podés descargarlo desde el botón de la lista.
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Este auto todavía no tiene archivos adjuntos.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
