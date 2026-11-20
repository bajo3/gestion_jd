import { useRef, useState } from "react";
import { ImageUp, Loader2, ScanLine } from "lucide-react";
import { openPicker } from "@/components/documents/DniPhotos";
import { Button } from "@/components/ui/button";
import type { DniData } from "@/lib/dniBarcode";
import { readDniPhotos } from "@/services/dniScanService";

type DniScanButtonProps = {
  /** Recibe los datos leidos del DNI para completar el formulario. */
  onRead: (data: DniData) => void;
  label?: string;
};

type Status = { kind: "ok" | "error"; message: string };

/**
 * Saca o sube una foto del frente del DNI y completa nombre, numero, fecha de nacimiento
 * y CUIL. Primero lee el codigo de barras; si no se puede, la lee la IA.
 */
export function DniScanButton({ onRead, label = "Leer DNI desde una foto" }: DniScanButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const { data, via } = await readDniPhotos([{ side: "frente", blob: file }]);
      onRead(data);
      setStatus({ kind: "ok", message: `DNI leído${via === "ia" ? " con IA (revisalo)" : ""}: ${data.nombreCompleto} · ${data.dni}` });
    } catch (error) {
      setStatus({
        kind: "error",
        message: `${error instanceof Error ? error.message : "No se pudo leer el DNI."} Sacá la foto de cerca, con buena luz y sin reflejos.`,
      });
    } finally {
      setBusy(false);
      // Permite volver a elegir la misma foto.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => openPicker(inputRef.current, true)}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
          {busy ? "Leyendo el DNI…" : label}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => openPicker(inputRef.current, false)}>
          <ImageUp className="mr-2 h-4 w-4" />
          Subir foto
        </Button>
      </div>
      {status ? (
        <p className={status.kind === "ok" ? "text-xs font-medium text-emerald-700" : "text-xs font-medium text-amber-700"} role="status">
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
