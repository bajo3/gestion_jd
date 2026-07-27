import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import type { VehicleFileCategory } from "@/types/vehicles";

export type PendingFiles = {
  files: File[];
  category: VehicleFileCategory;
  notes: string;
};

export function FileUploader({
  onAdd,
}: {
  onAdd: (pending: PendingFiles) => void | Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<VehicleFileCategory>("foto");
  const [notes, setNotes] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  function quitarArchivo(index: number) {
    setFiles((actuales) => actuales.filter((_, i) => i !== index));
  }

  async function confirmar() {
    if (!files.length || subiendo) return;

    setSubiendo(true);
    await onAdd({ files, category, notes });
    setFiles([]);
    setNotes("");
    setSubiendo(false);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex items-center gap-3 text-slate-700">
        <div className="rounded-xl bg-white p-3">
          <Upload className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">Adjuntar documentacion</p>
          <p className="text-sm text-slate-500">
            Podes elegir varios archivos a la vez: se suben todos juntos con la misma categoria.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Archivos">
          <Input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </FormField>
        <FormField label="Categoria">
          <Select value={category} onChange={(event) => setCategory(event.target.value as VehicleFileCategory)}>
            <option value="foto">Foto</option>
            <option value="cedula">Cedula</option>
            <option value="titulo">Titulo</option>
            <option value="dni">DNI</option>
            <option value="08">08</option>
            <option value="informe_de_dominio">Informe de dominio</option>
            <option value="verificacion_policial">Verificacion policial</option>
            <option value="boleto">Boleto</option>
            <option value="recibo">Recibo</option>
            <option value="pdf_generado">PDF generado</option>
            <option value="otro">Otro</option>
          </Select>
        </FormField>
        <FormField label="Notas" hint="Se aplica a todos los archivos de esta tanda.">
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Comentario interno" />
        </FormField>
      </div>

      {files.length ? (
        <ul className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-slate-700">{file.name}</span>
              <button
                type="button"
                onClick={() => quitarArchivo(index)}
                className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                aria-label={`Quitar ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button onClick={confirmar} disabled={!files.length || subiendo}>
        {subiendo
          ? "Subiendo..."
          : files.length > 1
            ? `Agregar ${files.length} adjuntos`
            : "Agregar adjunto"}
      </Button>
    </div>
  );
}
