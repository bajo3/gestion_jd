import { useEffect, useMemo, useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
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
};

export function VehicleFiles({ files, onDelete }: VehicleFilesProps) {
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

  useEffect(() => {
    if (!files.length) {
      setSelectedId(null);
      return;
    }

    if (selectedId && !files.some((file) => file.id === selectedId)) {
      setSelectedId(null);
    }
  }, [files, selectedId]);

  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedId) ?? null,
    [files, selectedId],
  );

  const selectedUrl = selectedFile ? resolvedUrls[selectedFile.id] || selectedFile.fileUrl || "" : "";

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Adjuntos</h3>
          <p className="text-sm text-slate-500">Documentacion asociada al vehiculo.</p>
        </div>

        {files.length ? (
          <>
            <div className="space-y-2">
              {files.map((file) => {
                const resolvedUrl = resolvedUrls[file.id] || file.fileUrl || "";
                const selected = file.id === selectedId;

                return (
                  <div
                    key={file.id}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-xl bg-slate-100 p-2.5">
                          {isImage(file) ? (
                            <ImageIcon className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {file.fileName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {file.category.replaceAll("_", " ")} • {file.fileType || "sin tipo"}
                          </p>
                          <p className="text-xs text-slate-400">{formatDateTime(file.createdAt)}</p>
                          {file.notes ? (
                            <p className="mt-1 text-xs text-slate-600">{file.notes}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {resolvedUrl ? (
                          <>
                            <Button
                              variant={selected ? "secondary" : "outline"}
                              onClick={() => setSelectedId(selected ? null : file.id)}
                            >
                              {selected ? "Ocultar" : "Ver"}
                            </Button>
                            <a
                              href={resolvedUrl}
                              download={file.fileName}
                              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                            >
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
                          <Button variant="destructive" onClick={() => onDelete(file)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Borrar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedFile && selectedUrl ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Vista previa</p>
                    <p className="text-xs text-slate-500">{selectedFile.fileName}</p>
                  </div>
                  <a
                    href={selectedUrl}
                    download={selectedFile.fileName}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Descargar
                  </a>
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
                    Este tipo de archivo no tiene preview embebida. Podes descargarlo desde el boton de arriba.
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Este auto todavia no tiene archivos adjuntos.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
