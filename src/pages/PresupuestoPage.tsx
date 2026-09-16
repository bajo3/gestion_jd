import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { FormField } from "@/components/shared/FormField";
import { useObjectState } from "@/hooks/useObjectState";
import { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";
import { generatePresupuestoPdf } from "@/pdf/presupuestoPdf";
import { emptyPresupuestoValues, type PresupuestoValues } from "@/types/salesDocuments";
import { DocumentContextBar, DocumentPage, FormGrid, FormSection } from "./documentUtils";

const initialState: PresupuestoValues = emptyPresupuestoValues;
type WorkflowExtras = { documentId?: string | null; vehicle?: { brand: string; model: string; year?: number | null; kilometers?: number | null } | null };

export function PresupuestoPage() {
  const [values, form] = useObjectState(initialState);
  const workflow = useDocumentWorkflow("presupuesto_cliente");
  const workflowExtras = workflow as typeof workflow & WorkflowExtras;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    const source = (workflow.operation?.data ?? {}) as Partial<PresupuestoValues> & { ppaModelo?: string; ppaAnio?: string };
    const saved = (workflow.saved?.data ?? {}) as Partial<PresupuestoValues>;
    if (!workflow.client && !workflow.operation && !workflow.saved) return;
    hydrated.current = true;
    form.replace({
      ...initialState,
      ...source,
      nombre: saved.nombre || workflow.client?.nombre || source.nombre || "",
      telefono: saved.telefono || workflow.client?.telefono || workflow.client?.celular || source.telefono || "",
      dni: saved.dni || workflow.client?.dni || source.dni || "",
      vehModelo: saved.vehModelo || source.vehModelo || source.ppaModelo || "",
      vehAnio: saved.vehAnio || source.vehAnio || source.ppaAnio || "",
      ...(workflowExtras.vehicle ? { vehModelo: saved.vehModelo || `${workflowExtras.vehicle.brand} ${workflowExtras.vehicle.model}`.trim(), vehAnio: saved.vehAnio || String(workflowExtras.vehicle.year ?? ""), vehKm: saved.vehKm || String(workflowExtras.vehicle.kilometers ?? "") } : {}),
      ...saved,
    });
  }, [form, workflow.client, workflow.operation, workflow.saved, workflowExtras.vehicle]);

  const save = async (status: "borrador" | "generado") => {
    setSaving(true);
    setMessage("");
    try {
      const result = await workflow.save(values as unknown as Record<string, unknown>, status, workflowExtras.documentId ?? undefined);
      if (workflow.hasContext && !result) throw new Error("No se pudo guardar el presupuesto.");
      if (result?.warning) setMessage(result.warning);
      else setMessage(status === "generado" ? "Presupuesto guardado." : "Borrador guardado.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el presupuesto.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    const saved = await save("generado");
    if (saved || !workflow.hasContext) await generatePresupuestoPdf(values);
  };

  const setCreditEnabled = (value: "si" | "no") => {
    form.set("tomaCredito", value);
    if (value === "no") {
      form.set("creditoTotal", "");
      form.set("creditoFechaInicio", "");
      form.set("creditoNumeroCuotas", "");
      form.set("creditoDiaVencimiento", "");
      form.set("cuotasCant", "");
    }
  };

  return (
    <DocumentPage title="Presupuesto para cliente" description="Una propuesta clara, editable y lista para entregar. Generarla no marca el auto como vendido.">
      <DocumentContextBar client={workflow.client} operation={workflow.operation} />
      <FormSection title="Datos generales" description="Estos datos se reutilizan en recibo, autorización, operación y compra venta.">
        <FormGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Fecha"><Input type="date" value={values.fecha} onChange={(event) => form.set("fecha", event.target.value)} /></FormField>
          <FormField label="Moneda"><Select value={values.moneda} onChange={(event) => form.set("moneda", event.target.value as PresupuestoValues["moneda"])}><option value="ARS">ARS</option><option value="USD">USD</option></Select></FormField>
          <FormField label="Nombre"><Input value={values.nombre} onChange={(event) => form.set("nombre", event.target.value)} /></FormField>
          <FormField label="Teléfono"><Input value={values.telefono} onChange={(event) => form.set("telefono", event.target.value)} /></FormField>
          <FormField label="DNI"><Input value={values.dni} onChange={(event) => form.set("dni", event.target.value)} /></FormField>
          <FormField label="Vigencia"><Input value={values.vigencia} onChange={(event) => form.set("vigencia", event.target.value)} placeholder="Ej: 7 días corridos" /></FormField>
        </FormGrid>
        <FormField label="Detalles"><Textarea value={values.detalles} onChange={(event) => form.set("detalles", event.target.value)} /></FormField>
      </FormSection>

      <FormSection title="Vehículo y entrega">
        <FormGrid>
          <FormField label="Modelo"><Input value={values.vehModelo} onChange={(event) => form.set("vehModelo", event.target.value)} /></FormField>
          <FormField label="Año"><Input value={values.vehAnio} onChange={(event) => form.set("vehAnio", event.target.value)} /></FormField>
          <FormField label="KM"><Input value={values.vehKm} onChange={(event) => form.set("vehKm", event.target.value)} /></FormField>
          <FormField label="Precio de venta"><CurrencyInput value={values.precioVenta} onChange={(value) => form.set("precioVenta", value)} /></FormField>
          <FormField label="Entrega en efectivo"><CurrencyInput value={values.entregaEfectivo} onChange={(value) => form.set("entregaEfectivo", value)} /></FormField>
          <FormField label="Usado modelo"><Input value={values.usadoModelo} onChange={(event) => form.set("usadoModelo", event.target.value)} /></FormField>
          <FormField label="Usado año"><Input value={values.usadoAnio} onChange={(event) => form.set("usadoAnio", event.target.value)} /></FormField>
          <FormField label="Usado KM"><Input value={values.usadoKm} onChange={(event) => form.set("usadoKm", event.target.value)} /></FormField>
          <FormField label="Precio de toma"><CurrencyInput value={values.usadoToma} onChange={(value) => form.set("usadoToma", value)} /></FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Financiación y gastos" description="No se calcula ni se inventa ninguna tasa. Cargá sólo los datos acordados.">
        <FormGrid>
          <FormField label="¿Toma crédito?"><Select value={values.tomaCredito} onChange={(event) => setCreditEnabled(event.target.value as "si" | "no")}><option value="no">No</option><option value="si">Sí</option></Select></FormField>
          {values.tomaCredito === "si" ? <>
            <FormField label="Total del crédito"><CurrencyInput value={values.creditoTotal} onChange={(value) => form.set("creditoTotal", value)} /></FormField>
            <FormField label="Moneda del crédito"><Select value={values.creditoMoneda} onChange={(event) => form.set("creditoMoneda", event.target.value as "ARS" | "USD")}><option value="ARS">ARS</option><option value="USD">USD</option></Select></FormField>
            <FormField label="Fecha de inicio"><Input type="date" value={values.creditoFechaInicio} onChange={(event) => form.set("creditoFechaInicio", event.target.value)} /></FormField>
            <FormField label="Número de cuotas"><Input value={values.creditoNumeroCuotas} onChange={(event) => form.set("creditoNumeroCuotas", event.target.value)} /></FormField>
            <FormField label="Día de vencimiento"><Input type="number" min="1" max="31" value={values.creditoDiaVencimiento} onChange={(event) => form.set("creditoDiaVencimiento", event.target.value)} /></FormField>
            <FormField label="Detalle de cuotas"><Input value={values.cuotasCant} onChange={(event) => form.set("cuotasCant", event.target.value)} placeholder="Ej: cuota fija mensual" /></FormField>
          </> : null}
          <FormField label="Gastos administrativos"><CurrencyInput value={values.gastosAdm} onChange={(value) => form.set("gastosAdm", value)} /></FormField>
          <FormField label="Transferencia"><CurrencyInput value={values.transferencia} onChange={(value) => form.set("transferencia", value)} /></FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Presentación al cliente">
        <FormField label="Condiciones"><Textarea value={values.condiciones} onChange={(event) => form.set("condiciones", event.target.value)} /></FormField>
        <FormField label="Notas"><Textarea value={values.notas} onChange={(event) => form.set("notas", event.target.value)} /></FormField>
      </FormSection>

      {message ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700" role="status">{message}</p> : null}
      <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={saving} onClick={() => void save("borrador")}>Guardar presupuesto</Button><Button disabled={saving} onClick={() => void generate()}>{saving ? "Guardando…" : "Generar PDF para cliente"}</Button></div>
    </DocumentPage>
  );
}
