import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import type { VehicleFileCategory } from "@/types/vehicles";

type PendingFile = {
  file: File;
  category: VehicleFileCategory;
  notes: string;
};

export function FileUploader({
  onAdd,
}: {
  onAdd: (file: PendingFile) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<VehicleFileCategory>("foto");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex items-center gap-3 text-slate-700">
        <div className="rounded-xl bg-white p-3">
          <Upload className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">Adjuntar documentacion</p>
          <p className="text-sm text-slate-500">
            Si no hay Supabase configurado, guardamos metadata localmente.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Archivo">
          <Input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
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
        <FormField label="Notas">
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Comentario interno" />
        </FormField>
      </div>

      <Button
        onClick={() => {
          if (!file) return;
          onAdd({ file, category, notes });
          setFile(null);
          setNotes("");
        }}
      >
        Agregar adjunto
      </Button>
    </div>
  );
}
