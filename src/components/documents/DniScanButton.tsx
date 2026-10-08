import { useRef, useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readDniFromImage, type DniData } from "@/lib/dniBarcode";

type DniScanButtonProps = {
  /** Recibe los datos leidos del DNI para completar el formulario. */
  onRead: (data: DniData) => void;
  label?: string;
};

type Status = { kind: "ok" | "error"; message: string };

/**
 * Saca (o elige) una foto del frente del DNI y completa nombre, numero, fecha de nacimiento
 * y CUIL leyendo el codigo de barras. La foto no se sube a ningun lado.
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
      const data = await readDniFromImage(file);
      if (!data) {
        setStatus({
          kind: "error",
          message: "No pude leer el código de barras. Sacá la foto del frente del DNI, de cerca, con buena luz y sin reflejos.",
        });
        return;
      }
      onRead(data);
      setStatus({ kind: "ok", message: `DNI leído: ${data.nombreCompleto} · ${data.dni}` });
    } catch {
      setStatus({ kind: "error", message: "No se pudo abrir la imagen. Probá con otra foto." });
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
        capture="environment"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div>
        <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
          {busy ? "Leyendo el DNI…" : label}
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
