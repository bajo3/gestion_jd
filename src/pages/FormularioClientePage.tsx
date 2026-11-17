import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { useObjectState } from "@/hooks/useObjectState";
import { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";
import { useSharedFlow } from "@/hooks/useSharedFlow";
import { generateFormularioClientePdf } from "@/pdf/formularioClientePdf";
import { DniPhotos } from "@/components/documents/DniPhotos";
import { GenerateDocumentButton } from "@/components/documents/GenerateDocumentButton";
import { consumeDocumentDraft } from "@/services/documentDraftService";
import { DocumentContextBar, DocumentPage, DocumentPersistenceStatus, FormGrid, FormSection } from "./documentUtils";

type ClientState = {
  dni: string;
  cuil: string;
  situacionLaboral: string;
  /** Enlaces a las fotos del DNI guardadas en el archivo. */
  dniFrenteUrl: string;
  dniDorsoUrl: string;
};

const initialState: ClientState = {
  dni: "",
  cuil: "",
  situacionLaboral: "",
  dniFrenteUrl: "",
  dniDorsoUrl: "",
};

export function FormularioClientePage() {
  const [values, form] = useObjectState(initialState);
  const workflow = useDocumentWorkflow("formulario_cliente");
  const flow = useSharedFlow("formulario_cliente", workflow, values, form.replace);
  useEffect(() => {
    if (workflow.saved?.data) form.replace({ ...initialState, ...(workflow.saved.data as Partial<ClientState>) });
  }, [form, workflow.saved]);

  useEffect(() => {
    const draft = consumeDocumentDraft<Pick<ClientState, "dni" | "cuil" | "situacionLaboral">>("formularioCliente");
    if (draft) {
      form.replace({ ...initialState, ...draft });
    }
  }, [form]);

  return (
    <DocumentPage title="Formulario Cliente" description="Datos basicos, situacion laboral y documentacion de DNI para resumen interno.">
      <DocumentContextBar client={flow.client} operation={flow.operation} />
      {flow.banner}
      <DocumentPersistenceStatus loading={workflow.loading} mode={workflow.mode} error={workflow.error} />
      <FormSection title="Fotos del DNI">
        <DniPhotos
          frenteUrl={values.dniFrenteUrl}
          dorsoUrl={values.dniDorsoUrl}
          onChange={(side, url) => form.set(side === "frente" ? "dniFrenteUrl" : "dniDorsoUrl", url)}
          onRead={(dni) => {
            if (dni.dni) form.set("dni", dni.dni);
            if (dni.cuil) form.set("cuil", dni.cuil);
          }}
        />
      </FormSection>

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

      <div className="flex justify-end">
        <GenerateDocumentButton
          documentType="formularioCliente"
          values={values}
          onGenerate={() =>
            workflow.save(values, "generado").then(() => generateFormularioClientePdf({
              dni: values.dni,
              cuil: values.cuil,
              situacionLaboral: values.situacionLaboral,
              dniFrente: values.dniFrenteUrl,
              dniDorso: values.dniDorsoUrl,
            }))
          }
        />
      </div>
    </DocumentPage>
  );
}
