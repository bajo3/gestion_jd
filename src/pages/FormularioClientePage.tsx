import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { useObjectState } from "@/hooks/useObjectState";
import { generateFormularioClientePdf } from "@/pdf/formularioClientePdf";
import { DocumentPage, FormGrid, FormSection } from "./documentUtils";

type ClientState = {
  dni: string;
  cuil: string;
  situacionLaboral: string;
  dniFrente: File | null;
  dniDorso: File | null;
};

const initialState: ClientState = {
  dni: "",
  cuil: "",
  situacionLaboral: "",
  dniFrente: null,
  dniDorso: null,
};

function ImagePreview({ file }: { file: File | null }) {
  const src = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  if (!file) {
    return <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">Todavia no se cargo una imagen.</div>;
  }

  return <img src={src} alt={file.name} className="h-56 w-full rounded-2xl border border-slate-200 object-contain bg-white" />;
}

export function FormularioClientePage() {
  const [values, form] = useObjectState(initialState);

  return (
    <DocumentPage title="Formulario Cliente" description="Datos basicos, situacion laboral y documentacion de DNI para resumen interno.">
      <FormSection title="Datos del cliente">
        <FormGrid columns="md:grid-cols-3">
          <FormField label="DNI">
            <Input value={values.dni} onChange={(event) => form.set("dni", event.target.value)} />
          </FormField>
          <FormField label="CUIL">
            <Input value={values.cuil} onChange={(event) => form.set("cuil", event.target.value)} />
          </FormField>
          <FormField label="Situacion laboral">
            <div className="grid gap-3 md:grid-cols-2">
              {["Relacion de dependencia", "Autonomo"].map((option) => (
                <label key={option} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="radio"
                    name="situacion_laboral"
                    checked={values.situacionLaboral === option}
                    onChange={() => form.set("situacionLaboral", option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Documentacion adjunta">
        <FormGrid columns="md:grid-cols-2">
          <FormField label="DNI frente">
            <Input type="file" accept="image/*" onChange={(event) => form.set("dniFrente", event.target.files?.[0] ?? null)} />
          </FormField>
          <FormField label="DNI dorso">
            <Input type="file" accept="image/*" onChange={(event) => form.set("dniDorso", event.target.files?.[0] ?? null)} />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Vista previa">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">DNI frente</p>
            <ImagePreview file={values.dniFrente} />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">DNI dorso</p>
            <ImagePreview file={values.dniDorso} />
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end">
        <Button
          onClick={() =>
            generateFormularioClientePdf({
              dni: values.dni,
              cuil: values.cuil,
              situacionLaboral: values.situacionLaboral,
              dniFrente: values.dniFrente,
              dniDorso: values.dniDorso,
            })
          }
        >
          Generar Resumen
        </Button>
      </div>
    </DocumentPage>
  );
}
