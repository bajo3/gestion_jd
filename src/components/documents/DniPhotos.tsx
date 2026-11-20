import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DniData } from "@/lib/dniBarcode";
import { readDniPhotos, shrinkPhoto, uploadDniPhoto, type DniPhoto, type DniSide } from "@/services/dniScanService";

type DniPhotosProps = {
  frenteUrl: string;
  dorsoUrl: string;
  /** Guarda el enlace de la foto subida ("" al quitarla). */
  onChange: (side: DniSide, url: string) => void;
  /** Recibe los datos leidos del DNI para completar el formulario. Sin esto, solo guarda las fotos. */
  onRead?: (data: DniData) => void;
};

type Status = { kind: "ok" | "error" | "info"; message: string };

const labels: Record<DniSide, string> = { frente: "DNI frente", dorso: "DNI dorso" };

/** Abre la camara o la galeria segun el boton (el atributo capture fuerza la camara en el celular). */
export function openPicker(input: HTMLInputElement | null, camera: boolean) {
  if (!input) return;
  if (camera) input.setAttribute("capture", "environment");
  else input.removeAttribute("capture");
  input.click();
}

async function photoFromUrl(side: DniSide, url: string): Promise<DniPhoto | null> {
  try {
    const response = await fetch(url);
    return response.ok ? { side, blob: await response.blob() } : null;
  } catch {
    return null;
  }
}

/**
 * Fotos del frente y dorso del DNI: se guardan en el archivo apenas se cargan y, con
 * cada foto nueva, se leen los datos (codigo de barras o IA) para completar el formulario.
 */
export function DniPhotos({ frenteUrl, dorsoUrl, onChange, onRead }: DniPhotosProps) {
  const inputs = { frente: useRef<HTMLInputElement>(null), dorso: useRef<HTMLInputElement>(null) };
  // Las fotos de esta sesion, para no volver a bajarlas al leer.
  const local = useRef<Partial<Record<DniSide, Blob>>>({});
  const [uploading, setUploading] = useState<DniSide | null>(null);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const urls: Record<DniSide, string> = { frente: frenteUrl, dorso: dorsoUrl };

  const read = async (fresh?: DniPhoto) => {
    if (!onRead) return;
    setReading(true);
    setStatus({ kind: "info", message: "Leyendo los datos del DNI…" });
    try {
      const photos: DniPhoto[] = [];
      for (const side of ["frente", "dorso"] as const) {
        if (fresh?.side === side) photos.push(fresh);
        else if (local.current[side]) photos.push({ side, blob: local.current[side]! });
        else if (urls[side]) {
          const remote = await photoFromUrl(side, urls[side]);
          if (remote) photos.push(remote);
        }
      }
      const { data, via } = await readDniPhotos(photos);
      onRead(data);
      setStatus({
        kind: "ok",
        message: `Datos cargados${via === "ia" ? " con IA (revisalos)" : ""}: ${data.nombreCompleto || "sin nombre"} · ${data.dni || "sin número"}${data.domicilio ? ` · ${data.domicilio}` : ""}`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: `${error instanceof Error ? error.message : "No se pudo leer el DNI."} Las fotos quedaron guardadas; podés completar los datos a mano.`,
      });
    } finally {
      setReading(false);
    }
  };

  const handleFile = async (side: DniSide, file: File | undefined) => {
    if (!file) return;
    setUploading(side);
    setStatus(null);
    try {
      const photo = await shrinkPhoto(file);
      const url = await uploadDniPhoto(photo, side);
      local.current[side] = photo;
      onChange(side, url);
      setUploading(null);
      if (onRead) await read({ side, blob: photo });
      else setStatus({ kind: "ok", message: `Foto del ${side} guardada.` });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "No se pudo guardar la foto." });
    } finally {
      setUploading(null);
      const input = inputs[side].current;
      if (input) input.value = "";
    }
  };

  const remove = (side: DniSide) => {
    if (!window.confirm(`¿Quitar la foto del ${side} del DNI?`)) return;
    delete local.current[side];
    onChange(side, "");
  };

  const busy = Boolean(uploading) || reading;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        {(["frente", "dorso"] as const).map((side) => (
          <div key={side} className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">{labels[side]}</p>
            <input
              ref={inputs[side]}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleFile(side, event.target.files?.[0])}
            />
            {urls[side] ? (
              <div className="relative">
                <a href={urls[side]} target="_blank" rel="noreferrer">
                  <img src={urls[side]} alt={labels[side]} className="h-48 w-full rounded-2xl border border-slate-200 bg-white object-contain" />
                </a>
                <button
                  type="button"
                  title="Quitar foto"
                  disabled={busy}
                  onClick={() => remove(side)}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-700 shadow hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                {uploading === side ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Guardando foto…
                  </>
                ) : (
                  <>
                    <span>Foto del {side}</span>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" disabled={busy} onClick={() => openPicker(inputs[side].current, true)}>
                        <Camera className="mr-2 h-4 w-4" />
                        Sacar foto
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={() => openPicker(inputs[side].current, false)}>
                        <ImageUp className="mr-2 h-4 w-4" />
                        Subir foto
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {onRead && (frenteUrl || dorsoUrl) ? (
          <Button variant="outline" disabled={busy} onClick={() => void read()}>
            {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
            {reading ? "Leyendo…" : "Volver a leer los datos"}
          </Button>
        ) : null}
        {status ? (
          <p
            role="status"
            className={
              status.kind === "ok"
                ? "text-xs font-medium text-emerald-700"
                : status.kind === "error"
                  ? "text-xs font-medium text-amber-700"
                  : "text-xs font-medium text-slate-500"
            }
          >
            {status.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
