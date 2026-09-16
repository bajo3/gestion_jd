import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { FormField } from "@/components/shared/FormField";
import { Card, CardContent } from "@/components/ui/card";
import { useObjectState } from "@/hooks/useObjectState";
import { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";
import { finalizeSaleAtomic, markLocalOperationFinalized } from "@/services/clientsService";
import { listVehicles } from "@/services/vehiclesService";
import { generateOperacionFinalizadaPdf } from "@/pdf/presupuestoPdf";
import { parseNumberish } from "@/lib/utils";
import type { Vehicle } from "@/types/vehicles";
import { emptySalesDocumentValues, type OperacionFinalizadaValues } from "@/types/salesDocuments";
import { DocumentContextBar, DocumentPage, FormGrid, FormSection } from "./documentUtils";

const initialState: OperacionFinalizadaValues = emptySalesDocumentValues;

type WorkflowExtras = { vehicleId?: string | null; documentId?: string | null; vehicle?: Vehicle | null; loading?: boolean; error?: string | null };

export function OperacionFinalizadaPage() {
  const [values, form] = useObjectState(initialState);
  const workflow = useDocumentWorkflow("operacion_finalizada");
  const workflowExtras = workflow as typeof workflow & WorkflowExtras;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hydrated = useRef(false);
  const selectedVehicleId = vehicleId || workflowExtras.vehicleId || workflowExtras.vehicle?.id || "";

  useEffect(() => {
    let active = true;
    listVehicles().then((next) => { if (active) setVehicles(next); }).catch(() => { if (active) setError("No se pudo cargar el inventario."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (hydrated.current) return;
    const source = (workflow.operation?.data ?? {}) as Partial<OperacionFinalizadaValues>;
    const saved = (workflow.saved?.data ?? {}) as Partial<OperacionFinalizadaValues>;
    if (!workflow.client && !workflow.operation && !workflow.saved) return;
    hydrated.current = true;
    form.replace({ ...initialState, ...source, nombre: saved.nombre || workflow.client?.nombre || source.nombre || "", telefono: saved.telefono || workflow.client?.telefono || workflow.client?.celular || source.telefono || "", dni: saved.dni || workflow.client?.dni || source.dni || "", ...saved });
  }, [form, workflow.client, workflow.operation, workflow.saved]);

  useEffect(() => {
    const selected = vehicles.find((item) => item.id === selectedVehicleId);
    if (!selected) return;
    form.set("vehModelo", `${selected.brand} ${selected.model}`.trim());
    form.set("vehAnio", String(selected.year ?? ""));
    form.set("vehKm", String(selected.kilometers ?? ""));
  }, [form, selectedVehicleId, vehicles]);

  const finalize = async () => {
    setError("");
    if (!workflow.client || !workflow.operation) {
      setError("Para finalizar la operación necesitás un cliente y una operación guardados desde el datero.");
      return;
    }
    if (!selectedVehicleId) {
      setError("Seleccioná el auto que se está vendiendo.");
      return;
    }
    const vehicle = vehicles.find((item) => item.id === selectedVehicleId);
    if (!vehicle) {
      setError("El auto seleccionado ya no está disponible en el inventario.");
      return;
    }
    const hasCredit = values.tomaCredito === "si";
    const creditInstallments = Number(values.creditoNumeroCuotas);
    const creditDueDay = Number(values.creditoDiaVencimiento);
    if (hasCredit && (!values.creditoFechaInicio || !Number.isInteger(creditInstallments) || creditInstallments < 1 || !Number.isInteger(creditDueDay) || creditDueDay < 1 || creditDueDay > 31)) {
      setError("Para finalizar con crédito completá fecha de inicio, número de cuotas y día de vencimiento válido (1 a 31).");
      return;
    }
    setLoading(true);
    try {
      const result = await finalizeSaleAtomic({
        operationId: workflow.operation.id,
        vehicleId: vehicle.id,
        salePrice: parseNumberish(values.precioVenta),
        buyerName: values.nombre,
        buyerPhone: values.telefono,
        hasCredit,
        saleDate: values.fecha,
        creditStartDate: hasCredit ? values.creditoFechaInicio : null,
        creditTotalInstallments: hasCredit ? creditInstallments : null,
        creditInstallmentsText: values.cuotasCant || values.creditoNumeroCuotas,
        creditDueDay: hasCredit ? creditDueDay : null,
      });
      if (result.mode !== "remote") throw new Error("Supabase no está disponible. La venta no se marcó como finalizada; reintentá cuando haya conexión.");
      markLocalOperationFinalized(workflow.operation.id, vehicle.id);
      const saved = await workflow.save(values as unknown as Record<string, unknown>, "generado", workflowExtras.documentId ?? undefined);
      if (saved?.warning) setError(saved.warning);
      setFinalized(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo finalizar la operación.");
    } finally {
      setLoading(false);
    }
  };

  const query = workflow.client && workflow.operation ? `?dni=${encodeURIComponent(workflow.client.dni)}&clientId=${encodeURIComponent(workflow.client.id)}&operationId=${encodeURIComponent(workflow.operation.id)}` : "";
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
    <DocumentPage title="Operación finalizada" description="Cierre explícito de una venta. Se completa sólo cuando el cliente, la operación, el auto y la confirmación remota están disponibles.">
      <DocumentContextBar client={workflow.client} operation={workflow.operation} />
      {workflowExtras.loading ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" role="status">Cargando datos guardados…</p> : null}
      {workflowExtras.error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{workflowExtras.error}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      {!workflow.loading && !workflow.hasContext && selectedVehicleId ? <Card><CardContent className="flex flex-col gap-3 border border-fuchsia-200 bg-fuchsia-50 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-700">Paso 1 de 2</p><p className="mt-1 font-semibold text-fuchsia-950">Primero cargá el cliente y la operación</p><p className="mt-1 text-sm text-fuchsia-900">El auto ya está seleccionado y se va a conservar al volver.</p></div><Link to={`/datero?vehicleId=${encodeURIComponent(selectedVehicleId)}`}><Button>Cargar cliente</Button></Link></CardContent></Card> : null}
      {workflow.hasContext && selectedVehicleId ? <Card><CardContent className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 text-sm text-emerald-900"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><span><strong>Paso 2:</strong> auto y cliente listos. Completá el precio y presioná “Finalizar venta”.</span></CardContent></Card> : null}
      <FormSection title="Cliente y auto vendido">
        <FormGrid>
          <FormField label="Cliente"><Input value={values.nombre} onChange={(event) => form.set("nombre", event.target.value)} /></FormField>
          <FormField label="DNI"><Input value={values.dni} onChange={(event) => form.set("dni", event.target.value)} /></FormField>
          <FormField label="Teléfono"><Input value={values.telefono} onChange={(event) => form.set("telefono", event.target.value)} /></FormField>
          <FormField label="Auto de inventario"><Select value={selectedVehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Seleccionar auto</option>{vehicles.filter((vehicle) => vehicle.status !== "vendido" || vehicle.id === selectedVehicleId).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.licensePlate || "sin patente"}</option>)}</Select></FormField>
          <FormField label="Fecha"><Input type="date" value={values.fecha} onChange={(event) => form.set("fecha", event.target.value)} /></FormField>
          <FormField label="Precio de venta"><CurrencyInput value={values.precioVenta} onChange={(value) => form.set("precioVenta", value)} /></FormField>
          <FormField label="Moneda"><Select value={values.moneda} onChange={(event) => form.set("moneda", event.target.value as "ARS" | "USD")}><option value="ARS">ARS</option><option value="USD">USD</option></Select></FormField>
          <FormField label="Modelo comercial"><Input value={values.vehModelo} onChange={(event) => form.set("vehModelo", event.target.value)} /></FormField>
          <FormField label="Año"><Input value={values.vehAnio} onChange={(event) => form.set("vehAnio", event.target.value)} /></FormField>
          <FormField label="KM"><Input value={values.vehKm} onChange={(event) => form.set("vehKm", event.target.value)} /></FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Entrega y usado"><FormGrid>
        <FormField label="Entrega en efectivo"><CurrencyInput value={values.entregaEfectivo} onChange={(value) => form.set("entregaEfectivo", value)} /></FormField>
        <FormField label="Usado modelo"><Input value={values.usadoModelo} onChange={(event) => form.set("usadoModelo", event.target.value)} /></FormField>
        <FormField label="Usado año"><Input value={values.usadoAnio} onChange={(event) => form.set("usadoAnio", event.target.value)} /></FormField>
        <FormField label="Usado KM"><Input value={values.usadoKm} onChange={(event) => form.set("usadoKm", event.target.value)} /></FormField>
        <FormField label="Precio de toma"><CurrencyInput value={values.usadoToma} onChange={(value) => form.set("usadoToma", value)} /></FormField>
      </FormGrid></FormSection>

      <FormSection title="Crédito y gastos"><FormGrid>
        <FormField label="¿Toma crédito?"><Select value={values.tomaCredito} onChange={(event) => setCreditEnabled(event.target.value as "si" | "no")}><option value="no">No</option><option value="si">Sí</option></Select></FormField>
        {values.tomaCredito === "si" ? <>
          <FormField label="Total crédito"><CurrencyInput value={values.creditoTotal} onChange={(value) => form.set("creditoTotal", value)} /></FormField>
          <FormField label="Moneda del crédito"><Select value={values.creditoMoneda} onChange={(event) => form.set("creditoMoneda", event.target.value as "ARS" | "USD")}><option value="ARS">ARS</option><option value="USD">USD</option></Select></FormField>
          <FormField label="Fecha de inicio"><Input type="date" value={values.creditoFechaInicio} onChange={(event) => form.set("creditoFechaInicio", event.target.value)} /></FormField>
          <FormField label="Número de cuotas"><Input type="number" min="1" step="1" value={values.creditoNumeroCuotas} onChange={(event) => form.set("creditoNumeroCuotas", event.target.value)} /></FormField>
          <FormField label="Día de vencimiento"><Input type="number" min="1" max="31" value={values.creditoDiaVencimiento} onChange={(event) => form.set("creditoDiaVencimiento", event.target.value)} /></FormField>
          <FormField label="Detalle de cuotas"><Input value={values.cuotasCant} onChange={(event) => form.set("cuotasCant", event.target.value)} placeholder="Ej: cuota fija mensual" /></FormField>
        </> : null}
        <FormField label="Gastos administrativos"><CurrencyInput value={values.gastosAdm} onChange={(value) => form.set("gastosAdm", value)} /></FormField>
        <FormField label="Transferencia"><CurrencyInput value={values.transferencia} onChange={(value) => form.set("transferencia", value)} /></FormField>
        <FormField label="Detalles"><Textarea value={values.detalles} onChange={(event) => form.set("detalles", event.target.value)} /></FormField>
      </FormGrid></FormSection>

      <Card><CardContent className="flex flex-wrap items-center justify-end gap-3"><Link to={`/presupuesto-cliente${query}`}><Button variant="outline">Generar presupuesto</Button></Link><Button variant="outline" disabled={loading} onClick={() => void workflow.save(values as unknown as Record<string, unknown>)}>Guardar borrador</Button><Button disabled={loading || finalized || !workflow.client || !workflow.operation} onClick={() => void finalize()}>{loading ? "Finalizando…" : finalized ? <><CheckCircle2 className="mr-2 h-4 w-4" />Venta finalizada</> : "Finalizar venta"}</Button></CardContent></Card>
      {finalized ? <p className="text-sm font-medium text-emerald-700" role="status">La venta quedó registrada remotamente y el vehículo fue marcado como vendido.</p> : null}
      <div className="flex justify-end"><Button variant="ghost" onClick={() => void generateOperacionFinalizadaPdf(values)}>Descargar operación finalizada</Button></div>
    </DocumentPage>
  );
}
