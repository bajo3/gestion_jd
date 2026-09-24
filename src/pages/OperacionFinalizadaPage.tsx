import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { FormField } from "@/components/shared/FormField";
import { Card, CardContent } from "@/components/ui/card";
import { useObjectState } from "@/hooks/useObjectState";
import { useDocumentWorkflow } from "@/hooks/useDocumentWorkflow";
import { finalizeSaleAtomic, markLocalOperationFinalized, saveClientDocument, saveDateroWorkflow } from "@/services/clientsService";
import { emptyDatero, emptyVehicleInput, parseInstallments } from "@/services/saleSyncService";
import { normalizePlate } from "@/services/documentsService";
import { createVehicle, listVehicles } from "@/services/vehiclesService";
import { generateOperacionFinalizadaPdf } from "@/pdf/presupuestoPdf";
import { parseNumberish } from "@/lib/utils";
import type { Vehicle } from "@/types/vehicles";
import type { DateroFormValues } from "@/types/forms";
import { emptySalesDocumentValues, type OperacionFinalizadaValues } from "@/types/salesDocuments";
import { DocumentContextBar, DocumentPage, FormGrid } from "./documentUtils";

const initialState: OperacionFinalizadaValues = emptySalesDocumentValues;

type Ids = { clientId: string; operationId: string };

/** Opcion del selector para vender un auto que todavia no esta en el historial. */
const NEW_VEHICLE = "__nuevo__";

/** Dia del mes de una fecha "YYYY-MM-DD": el credito vence todos los meses ese mismo dia. */
function dayOfMonth(date: string) {
  return Number(date.slice(8, 10));
}

export function OperacionFinalizadaPage() {
  const [values, form] = useObjectState(initialState);
  const workflow = useDocumentWorkflow("operacion_finalizada");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [ids, setIds] = useState<Ids | null>(null);
  const [newVehicle, setNewVehicle] = useState({ brand: "", model: "", licensePlate: "" });
  const [createdVehicle, setCreatedVehicle] = useState<Vehicle | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const hydrated = useRef(false);
  const selectedVehicleId = vehicleId || workflow.vehicle?.id || "";
  const hasContext = workflow.hasContext;

  useEffect(() => {
    let active = true;
    listVehicles().then((next) => { if (active) setVehicles(next); }).catch(() => { if (active) setError("No se pudo cargar el inventario."); });
    return () => { active = false; };
  }, []);

  // Trae lo que ya se cargo en el Datero (credito, usado, fecha) para no volver a escribirlo.
  useEffect(() => {
    if (hydrated.current) return;
    if (!workflow.client && !workflow.operation && !workflow.saved) return;
    hydrated.current = true;
    const datero = (workflow.operation?.data ?? {}) as Partial<DateroFormValues>;
    const saved = (workflow.saved?.data ?? {}) as Partial<OperacionFinalizadaValues>;
    const withCredit = datero.tomaCredito === "si";
    const installments = withCredit ? parseInstallments(datero.creditoCuotas) : null;
    const tradeIn = datero.entregaPpa === "si";
    form.replace({
      ...initialState,
      fecha: datero.fechaOperacion || initialState.fecha,
      nombre: workflow.client?.nombre || datero.nombre || "",
      dni: workflow.client?.dni || datero.dni || "",
      telefono: workflow.client?.telefono || workflow.client?.celular || datero.celular || datero.telefono || "",
      tomaCredito: withCredit ? "si" : "no",
      creditoTotal: withCredit ? datero.creditoTotal ?? "" : "",
      creditoNumeroCuotas: installments ? String(installments) : "",
      cuotasCant: withCredit ? datero.creditoCuotas ?? "" : "",
      usadoModelo: tradeIn ? [datero.ppaMarca, datero.ppaModelo].filter(Boolean).join(" ") : "",
      usadoAnio: tradeIn ? datero.ppaAnio ?? "" : "",
      ...saved,
    });
  }, [form, workflow.client, workflow.operation, workflow.saved]);

  useEffect(() => {
    const selected = vehicles.find((item) => item.id === selectedVehicleId);
    if (!selected) return;
    form.set("vehModelo", `${selected.brand} ${selected.model}`.trim());
    form.set("vehAnio", String(selected.year ?? ""));
    form.set("vehKm", String(selected.kilometers ?? ""));
  }, [form, selectedVehicleId, vehicles]);

  const isNewVehicle = selectedVehicleId === NEW_VEHICLE;

  const setNewVehicleField = (field: keyof typeof newVehicle, value: string) => {
    const next = { ...newVehicle, [field]: value };
    setNewVehicle(next);
    form.set("vehModelo", `${next.brand} ${next.model}`.trim());
  };

  /**
   * El auto elegido, o uno nuevo dado de alta en el momento con lo minimo.
   * Lo que falte (patente, marca, modelo) queda marcado en rojo para completarlo despues.
   */
  const resolveVehicle = async (): Promise<Vehicle | null> => {
    if (!isNewVehicle) return vehicles.find((item) => item.id === selectedVehicleId) ?? null;
    if (createdVehicle) return createdVehicle;
    const plate = normalizePlate(newVehicle.licensePlate);
    const existing = plate ? vehicles.find((item) => normalizePlate(item.licensePlate) === plate) : undefined;
    if (existing) return existing;
    const vehicle = await createVehicle({
      ...emptyVehicleInput(newVehicle.licensePlate.trim().toUpperCase()),
      brand: newVehicle.brand.trim(),
      model: newVehicle.model.trim(),
      status: "reservado",
      buyerName: values.nombre.trim(),
      buyerPhone: values.telefono.trim(),
      observations: "Cargado al cerrar la venta: completar los datos del auto.",
    });
    setCreatedVehicle(vehicle);
    return vehicle;
  };

  /** Usa el cliente del Datero si vino; si no, lo crea en el momento con nombre, DNI y telefono. */
  const resolveOperation = async (vehicle: Vehicle): Promise<Ids> => {
    if (ids) return ids;
    if (workflow.client && workflow.operation) {
      // El cierre toma el telefono del cliente: si faltaba y se cargo aca, se guarda antes de cerrar.
      const phone = values.telefono.trim();
      if (phone && !workflow.client.telefono && !workflow.client.celular) {
        await saveDateroWorkflow(
          { ...emptyDatero, ...(workflow.operation.data as Partial<DateroFormValues>), nombre: workflow.client.nombre, dni: workflow.client.dni, celular: phone },
          { operationId: workflow.operation.id },
        );
      }
      return { clientId: workflow.client.id, operationId: workflow.operation.id };
    }
    const saved = await saveDateroWorkflow(
      {
        ...emptyDatero,
        nombre: values.nombre.trim(),
        dni: values.dni.trim(),
        celular: values.telefono.trim(),
        fechaOperacion: values.fecha,
        dominio: vehicle.licensePlate,
        tomaCredito: values.tomaCredito,
        creditoTotal: values.creditoTotal,
        creditoCuotas: values.cuotasCant || values.creditoNumeroCuotas,
      },
      { vehicleId: vehicle.id, createNewOperation: true },
    );
    if (saved.persistenceMode !== "remote") throw new Error(saved.warning || "Supabase no está disponible; reintentá cuando haya conexión.");
    const next = { clientId: saved.client.id, operationId: saved.operation.id };
    setIds(next);
    return next;
  };

  const finalize = async () => {
    setError("");
    setNotice("");
    if (!selectedVehicleId) {
      setError("Elegí el auto que se está vendiendo.");
      return;
    }
    if (isNewVehicle && !newVehicle.brand.trim() && !newVehicle.model.trim()) {
      setError("Escribí al menos la marca o el modelo del auto.");
      return;
    }
    if (!(parseNumberish(values.precioVenta) > 0)) {
      setError("Falta el precio de venta.");
      return;
    }
    if (!hasContext && (!values.nombre.trim() || !values.dni.trim())) {
      setError("Completá nombre y DNI del comprador.");
      return;
    }
    const hasCredit = values.tomaCredito === "si";
    const creditInstallments = Number(values.creditoNumeroCuotas);
    const creditStartDate = values.creditoFechaInicio || values.fecha;
    const creditDueDay = values.creditoDiaVencimiento ? Number(values.creditoDiaVencimiento) : dayOfMonth(creditStartDate);
    if (hasCredit && (!Number.isInteger(creditInstallments) || creditInstallments < 1)) {
      setError("Indicá la cantidad de cuotas del crédito.");
      return;
    }
    if (hasCredit && (!Number.isInteger(creditDueDay) || creditDueDay < 1 || creditDueDay > 31)) {
      setError("El día de vencimiento debe estar entre 1 y 31.");
      return;
    }
    setLoading(true);
    try {
      const vehicle = await resolveVehicle();
      if (!vehicle) throw new Error("El auto seleccionado ya no está disponible en el inventario.");
      const { clientId, operationId } = await resolveOperation(vehicle);
      const result = await finalizeSaleAtomic({
        operationId,
        vehicleId: vehicle.id,
        salePrice: parseNumberish(values.precioVenta),
        buyerName: values.nombre,
        buyerPhone: values.telefono,
        hasCredit,
        saleDate: values.fecha,
        creditStartDate: hasCredit ? creditStartDate : null,
        creditTotalInstallments: hasCredit ? creditInstallments : null,
        creditInstallmentsText: values.cuotasCant || values.creditoNumeroCuotas,
        creditDueDay: hasCredit ? creditDueDay : null,
      });
      if (result.mode !== "remote") throw new Error("Supabase no está disponible. La venta no se marcó como finalizada; reintentá cuando haya conexión.");
      markLocalOperationFinalized(operationId, vehicle.id);
      const saved = await saveClientDocument({
        id: workflow.saved?.id,
        clientId,
        operationId,
        documentType: "operacion_finalizada",
        status: "generado",
        data: values as unknown as Record<string, unknown>,
      });
      if (saved.warning) setNotice(saved.warning);
      setFinalized(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo finalizar la operación.");
    } finally {
      setLoading(false);
    }
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

  const withCredit = values.tomaCredito === "si";
  const presupuestoIds = ids ?? (workflow.client && workflow.operation ? { clientId: workflow.client.id, operationId: workflow.operation.id } : null);
  const presupuestoQuery = presupuestoIds ? `?clientId=${encodeURIComponent(presupuestoIds.clientId)}&operationId=${encodeURIComponent(presupuestoIds.operationId)}` : "";

  return (
    <DocumentPage title="Operación finalizada" description="Elegí el auto, confirmá el precio y finalizá. El auto queda como vendido y se arman los seguimientos de postventa.">
      <DocumentContextBar client={workflow.client} operation={workflow.operation} />
      {workflow.loading ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" role="status">Cargando datos guardados…</p> : null}
      {workflow.error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{workflow.error}</p> : null}

      <Card>
        <CardContent className="space-y-5">
          <FormGrid>
            <FormField label="Auto vendido"><Select value={selectedVehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Seleccionar auto</option><option value={NEW_VEHICLE}>+ Auto no cargado</option>{vehicles.filter((vehicle) => vehicle.status !== "vendido" || vehicle.id === selectedVehicleId).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.licensePlate || "sin patente"}</option>)}</Select></FormField>
            <FormField label="Precio de venta"><CurrencyInput value={values.precioVenta} onChange={(value) => form.set("precioVenta", value)} /></FormField>
            <FormField label="Fecha de venta"><Input type="date" value={values.fecha} onChange={(event) => form.set("fecha", event.target.value)} /></FormField>
            {!hasContext ? <>
              <FormField label="Comprador"><Input value={values.nombre} onChange={(event) => form.set("nombre", event.target.value)} placeholder="Nombre y apellido" /></FormField>
              <FormField label="DNI"><Input value={values.dni} onChange={(event) => form.set("dni", event.target.value)} /></FormField>
            </> : null}
            {!hasContext || !values.telefono ? <FormField label="Teléfono (para la postventa)"><Input value={values.telefono} onChange={(event) => form.set("telefono", event.target.value)} placeholder="549..." /></FormField> : null}
            <FormField label="¿Toma crédito?"><Select value={values.tomaCredito} onChange={(event) => setCreditEnabled(event.target.value as "si" | "no")}><option value="no">No</option><option value="si">Sí</option></Select></FormField>
            {withCredit ? <FormField label="Cantidad de cuotas"><Input type="number" min="1" step="1" value={values.creditoNumeroCuotas} onChange={(event) => form.set("creditoNumeroCuotas", event.target.value)} /></FormField> : null}
          </FormGrid>
          {isNewVehicle ? <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">Se agrega al Historial de Autos con estos datos. Lo que falte queda marcado en rojo en Ventas para completarlo después.</p>
            <FormGrid>
              <FormField label="Marca"><Input value={newVehicle.brand} onChange={(event) => setNewVehicleField("brand", event.target.value)} /></FormField>
              <FormField label="Modelo"><Input value={newVehicle.model} onChange={(event) => setNewVehicleField("model", event.target.value)} /></FormField>
              <FormField label="Patente (opcional)"><Input value={newVehicle.licensePlate} onChange={(event) => setNewVehicleField("licensePlate", event.target.value)} /></FormField>
            </FormGrid>
          </div> : null}
          {withCredit ? <p className="text-sm text-slate-500">El crédito arranca en la fecha de venta y vence el día {dayOfMonth(values.creditoFechaInicio || values.fecha) || "—"} de cada mes. Podés cambiarlo en “Más datos”.</p> : null}

          {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
          {finalized ? <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800" role="status"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />Venta registrada: el auto quedó como vendido y se crearon los seguimientos de postventa.</p> : null}
          {notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p> : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => void generateOperacionFinalizadaPdf(values)}>Descargar PDF</Button>
            <Button className="px-6 py-3 text-base" disabled={loading || finalized} onClick={() => void finalize()}>{loading ? "Finalizando…" : finalized ? <><CheckCircle2 className="mr-2 h-4 w-4" />Venta finalizada</> : "Finalizar venta"}</Button>
          </div>
        </CardContent>
      </Card>

      <details className="group rounded-2xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold text-slate-700">
          Más datos (opcionales, salen en el PDF)
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="space-y-6 border-t border-slate-200 p-4">
          <FormGrid>
            {hasContext ? <>
              <FormField label="Cliente"><Input value={values.nombre} onChange={(event) => form.set("nombre", event.target.value)} /></FormField>
              <FormField label="DNI"><Input value={values.dni} onChange={(event) => form.set("dni", event.target.value)} /></FormField>
              {values.telefono ? <FormField label="Teléfono"><Input value={values.telefono} onChange={(event) => form.set("telefono", event.target.value)} /></FormField> : null}
            </> : null}
            <FormField label="Moneda"><Select value={values.moneda} onChange={(event) => form.set("moneda", event.target.value as "ARS" | "USD")}><option value="ARS">ARS</option><option value="USD">USD</option></Select></FormField>
            <FormField label="Modelo comercial"><Input value={values.vehModelo} onChange={(event) => form.set("vehModelo", event.target.value)} /></FormField>
            <FormField label="Año"><Input value={values.vehAnio} onChange={(event) => form.set("vehAnio", event.target.value)} /></FormField>
            <FormField label="KM"><Input value={values.vehKm} onChange={(event) => form.set("vehKm", event.target.value)} /></FormField>
            <FormField label="Entrega en efectivo"><CurrencyInput value={values.entregaEfectivo} onChange={(value) => form.set("entregaEfectivo", value)} /></FormField>
            <FormField label="Usado modelo"><Input value={values.usadoModelo} onChange={(event) => form.set("usadoModelo", event.target.value)} /></FormField>
            <FormField label="Usado año"><Input value={values.usadoAnio} onChange={(event) => form.set("usadoAnio", event.target.value)} /></FormField>
            <FormField label="Usado KM"><Input value={values.usadoKm} onChange={(event) => form.set("usadoKm", event.target.value)} /></FormField>
            <FormField label="Precio de toma"><CurrencyInput value={values.usadoToma} onChange={(value) => form.set("usadoToma", value)} /></FormField>
            {withCredit ? <>
              <FormField label="Total crédito"><CurrencyInput value={values.creditoTotal} onChange={(value) => form.set("creditoTotal", value)} /></FormField>
              <FormField label="Moneda del crédito"><Select value={values.creditoMoneda} onChange={(event) => form.set("creditoMoneda", event.target.value as "ARS" | "USD")}><option value="ARS">ARS</option><option value="USD">USD</option></Select></FormField>
              <FormField label="Inicio del crédito"><Input type="date" value={values.creditoFechaInicio || values.fecha} onChange={(event) => form.set("creditoFechaInicio", event.target.value)} /></FormField>
              <FormField label="Día de vencimiento"><Input type="number" min="1" max="31" value={values.creditoDiaVencimiento} placeholder={String(dayOfMonth(values.creditoFechaInicio || values.fecha) || "")} onChange={(event) => form.set("creditoDiaVencimiento", event.target.value)} /></FormField>
              <FormField label="Detalle de cuotas"><Input value={values.cuotasCant} onChange={(event) => form.set("cuotasCant", event.target.value)} placeholder="Ej: 24 cuotas de $300.000" /></FormField>
            </> : null}
            <FormField label="Gastos administrativos"><CurrencyInput value={values.gastosAdm} onChange={(value) => form.set("gastosAdm", value)} /></FormField>
            <FormField label="Transferencia"><CurrencyInput value={values.transferencia} onChange={(value) => form.set("transferencia", value)} /></FormField>
            <FormField label="Detalles"><Textarea value={values.detalles} onChange={(event) => form.set("detalles", event.target.value)} /></FormField>
          </FormGrid>
          <div className="flex flex-wrap justify-end gap-3">
            {presupuestoQuery ? <Link to={`/presupuesto-cliente${presupuestoQuery}`}><Button variant="outline">Generar presupuesto</Button></Link> : null}
            {hasContext ? <Button variant="outline" disabled={loading} onClick={() => void workflow.save(values as unknown as Record<string, unknown>)}>Guardar borrador</Button> : null}
          </div>
        </div>
      </details>
    </DocumentPage>
  );
}
