import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/FormField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { useObjectState } from "@/hooks/useObjectState";
import { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";
import { saveClientDocument, saveDateroWorkflow } from "@/services/clientsService";
import { generateDateroPdf } from "@/pdf/dateroPdf";
import type { DateroFormValues } from "@/types/forms";
import { DocumentContextBar, DocumentPage, DocumentPersistenceStatus, FormGrid, FormSection } from "./documentUtils";

const initialState: DateroFormValues = {
  nombre: "",
  dni: "",
  fechaNacimiento: "",
  lugar: "",
  direccionReal: "",
  direccionDni: "",
  localidad: "",
  codigoPostal: "",
  provincia: "",
  telefono: "",
  celular: "",
  email: "",
  cuil: "",
  condicionFiscal: "",
  estadoCivil: "",
  detalles: "",
  conyugeNombre: "",
  conyugeDni: "",
  fechaOperacion: "",
  dominio: "",
  tomaCredito: "no",
  creditoTotal: "",
  creditoCuotas: "",
  entregaPpa: "no",
  ppaDominio: "",
  ppaMarca: "",
  ppaModelo: "",
  ppaAnio: "",
};

export function DateroPage() {
  const [values, form] = useObjectState(initialState);
  const workflow = useDocumentWorkflow("datero");
  const [params] = useSearchParams();
  const [savedContext, setSavedContext] = useState<{ clientId: string; operationId: string; warning?: string } | null>(null);

  useEffect(() => {
    const source = workflow.operation?.data as Partial<DateroFormValues> | undefined;
    if (source && !values.nombre) form.replace({ ...initialState, ...source });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.operation]);
  useEffect(() => {
    if (workflow.saved?.data) form.replace({ ...initialState, ...(workflow.saved.data as Partial<DateroFormValues>) });
  }, [form, workflow.saved]);
  useEffect(() => {
    if (workflow.vehicle?.licensePlate && !values.dominio) form.set("dominio", workflow.vehicle.licensePlate);
  }, [form, values.dominio, workflow.vehicle]);

  const save = async (createNewOperation = false) => {
    try {
      const currentOperationId = createNewOperation ? undefined : params.get("operationId") || savedContext?.operationId;
      const result = await saveDateroWorkflow(values, { operationId: currentOperationId, vehicleId: params.get("vehicleId") || undefined, createNewOperation });
      const documentResult = await saveClientDocument({ id: createNewOperation ? undefined : workflow.saved?.id, clientId: result.client.id, operationId: result.operation.id, documentType: "datero", status: "generado", data: values as unknown as Record<string, unknown> });
      setSavedContext({ clientId: result.client.id, operationId: result.operation.id, warning: result.warning || documentResult.warning });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo guardar el datero");
    }
  };

  return (
    <DocumentPage title="Datero" description="Formulario para transferencia con datos del comprador, operación y auto entregado.">
      <DocumentContextBar client={workflow.client} operation={workflow.operation} />
      <DocumentPersistenceStatus loading={workflow.loading} mode={workflow.mode} error={workflow.error} />
      {workflow.vehicle ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><strong>Auto seleccionado:</strong> {workflow.vehicle.brand} {workflow.vehicle.model}{workflow.vehicle.licensePlate ? ` · ${workflow.vehicle.licensePlate}` : ""}. Se va a conservar al guardar la operación.</div> : null}
      <FormSection title="Datos del comprador">
        <FormGrid>
          {([
            ["nombre", "Apellido y nombre"],
            ["dni", "DNI"],
            ["fechaNacimiento", "Fecha de nacimiento"],
            ["lugar", "Lugar de nacimiento"],
            ["direccionReal", "Direccion real"],
            ["direccionDni", "Direccion segun DNI"],
            ["localidad", "Localidad"],
            ["codigoPostal", "Codigo postal"],
            ["provincia", "Provincia"],
            ["telefono", "Telefono"],
            ["celular", "Celular"],
            ["email", "Email"],
            ["cuil", "CUIL/CUIT"],
            ["condicionFiscal", "Condicion fiscal"],
            ["estadoCivil", "Estado civil"],
          ] as const).map(([key, label]) => (
            <FormField key={key} label={label}>
              <Input
                type={key === "fechaNacimiento" ? "date" : "text"}
                value={values[key]}
                onChange={(event) => form.set(key, event.target.value)}
              />
            </FormField>
          ))}
        </FormGrid>
        <FormField label="Detalles">
          <Textarea value={values.detalles} onChange={(event) => form.set("detalles", event.target.value)} />
        </FormField>
      </FormSection>

      <FormSection title="Conyuge y operacion">
        <FormGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Conyuge nombre">
            <Input value={values.conyugeNombre} onChange={(event) => form.set("conyugeNombre", event.target.value)} />
          </FormField>
          <FormField label="Conyuge DNI">
            <Input value={values.conyugeDni} onChange={(event) => form.set("conyugeDni", event.target.value)} />
          </FormField>
          <FormField label="Fecha de operacion">
            <Input type="date" value={values.fechaOperacion} onChange={(event) => form.set("fechaOperacion", event.target.value)} />
          </FormField>
          <FormField label="Dominio">
            <Input value={values.dominio} onChange={(event) => form.set("dominio", event.target.value.toUpperCase())} />
          </FormField>
          <FormField label="Toma credito">
            <Select value={values.tomaCredito} onChange={(event) => form.set("tomaCredito", event.target.value as "si" | "no")}>
              <option value="no">No</option>
              <option value="si">Si</option>
            </Select>
          </FormField>
          {values.tomaCredito === "si" ? (
            <>
              <FormField label="Total del credito">
                <CurrencyInput value={values.creditoTotal} onChange={(value) => form.set("creditoTotal", value)} />
              </FormField>
              <FormField label="Cantidad y valor de cuotas" className="xl:col-span-2">
                <Input value={values.creditoCuotas} onChange={(event) => form.set("creditoCuotas", event.target.value)} />
              </FormField>
            </>
          ) : null}
        </FormGrid>
      </FormSection>

      <FormSection title="Auto que entrega">
        <FormGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <FormField label="¿Entrega un auto?">
            <Select value={values.entregaPpa} onChange={(event) => form.set("entregaPpa", event.target.value as "si" | "no")}>
              <option value="no">No</option>
              <option value="si">Si</option>
            </Select>
          </FormField>
          {values.entregaPpa === "si" ? (
            <>
              <FormField label="Dominio">
                <Input value={values.ppaDominio} onChange={(event) => form.set("ppaDominio", event.target.value.toUpperCase())} />
              </FormField>
              <FormField label="Marca">
                <Input value={values.ppaMarca} onChange={(event) => form.set("ppaMarca", event.target.value)} />
              </FormField>
              <FormField label="Modelo">
                <Input value={values.ppaModelo} onChange={(event) => form.set("ppaModelo", event.target.value)} />
              </FormField>
              <FormField label="Año">
                <Input value={values.ppaAnio} onChange={(event) => form.set("ppaAnio", event.target.value)} />
              </FormField>
            </>
          ) : null}
        </FormGrid>
      </FormSection>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={() => save(false)}>{savedContext ? "Guardar cambios" : "Guardar cliente y operación"}</Button>
        {params.get("operationId") ? <Button variant="secondary" onClick={() => save(true)}>Guardar nueva operación</Button> : null}
        <Button onClick={() => generateDateroPdf(values)}>Generar Resumen</Button>
      </div>
      {savedContext ? <div className={`rounded-2xl border p-4 text-sm ${savedContext.warning ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><strong>{savedContext.warning ? "Borrador local." : "Cliente guardado."}</strong> Ya podés completar todos los documentos con los mismos datos.{savedContext.warning ? <p className="mt-1">{savedContext.warning} Reintentá guardar cuando Supabase esté disponible.</p> : null}<div className="mt-3 flex flex-wrap gap-2"><Link to={`/recibo?clientId=${savedContext.clientId}&operationId=${savedContext.operationId}`}><Button variant="secondary">Abrir recibo</Button></Link><Link to={`/presupuesto-cliente?clientId=${savedContext.clientId}&operationId=${savedContext.operationId}`}><Button variant="secondary">Preparar presupuesto</Button></Link><Link to={`/operacion-finalizada?clientId=${savedContext.clientId}&operationId=${savedContext.operationId}`}><Button variant="secondary">Ir a operación finalizada</Button></Link></div></div> : null}
    </DocumentPage>
  );
}
