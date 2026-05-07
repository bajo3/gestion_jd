import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { FormField } from "@/components/shared/FormField";
import { useObjectState } from "@/hooks/useObjectState";
import { generatePresupuestoPdf } from "@/pdf/presupuestoPdf";
import type { PresupuestoFormValues } from "@/types/forms";
import { DocumentPage, FormGrid, FormSection } from "./documentUtils";

const initialState: PresupuestoFormValues = {
  fecha: new Date().toISOString().slice(0, 10),
  moneda: "ARS",
  nombre: "",
  telefono: "",
  dni: "",
  detalles: "",
  vehModelo: "",
  vehAnio: "",
  vehKm: "",
  precioVenta: "",
  entregaEfectivo: "",
  usadoModelo: "",
  usadoAnio: "",
  usadoKm: "",
  usadoToma: "",
  tomaCredito: "no",
  creditoTotal: "",
  cuotasCant: "",
  gastosAdm: "",
  transferencia: "",
};

export function PresupuestoPage() {
  const [values, form] = useObjectState(initialState);

  return (
    <DocumentPage title="Presupuesto" description="Presupuesto de operacion con credito, entrega y gastos.">
      <FormSection title="Datos generales">
        <FormGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Fecha">
            <Input type="date" value={values.fecha} onChange={(event) => form.set("fecha", event.target.value)} />
          </FormField>
          <FormField label="Moneda">
            <Select value={values.moneda} onChange={(event) => form.set("moneda", event.target.value as "ARS" | "USD")}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </Select>
          </FormField>
          <FormField label="Nombre">
            <Input value={values.nombre} onChange={(event) => form.set("nombre", event.target.value)} />
          </FormField>
          <FormField label="Telefono">
            <Input value={values.telefono} onChange={(event) => form.set("telefono", event.target.value)} />
          </FormField>
          <FormField label="DNI">
            <Input value={values.dni} onChange={(event) => form.set("dni", event.target.value)} />
          </FormField>
        </FormGrid>
        <FormField label="Detalles">
          <Textarea value={values.detalles} onChange={(event) => form.set("detalles", event.target.value)} />
        </FormField>
      </FormSection>

      <FormSection title="Vehiculo y entrega">
        <FormGrid>
          <FormField label="Modelo">
            <Input value={values.vehModelo} onChange={(event) => form.set("vehModelo", event.target.value)} />
          </FormField>
          <FormField label="Año">
            <Input value={values.vehAnio} onChange={(event) => form.set("vehAnio", event.target.value)} />
          </FormField>
          <FormField label="KM">
            <Input value={values.vehKm} onChange={(event) => form.set("vehKm", event.target.value)} />
          </FormField>
          <FormField label="Valor de venta">
            <CurrencyInput value={values.precioVenta} onChange={(value) => form.set("precioVenta", value)} />
          </FormField>
          <FormField label="Entrega en efectivo">
            <CurrencyInput value={values.entregaEfectivo} onChange={(value) => form.set("entregaEfectivo", value)} />
          </FormField>
          <FormField label="Usado modelo">
            <Input value={values.usadoModelo} onChange={(event) => form.set("usadoModelo", event.target.value)} />
          </FormField>
          <FormField label="Usado año">
            <Input value={values.usadoAnio} onChange={(event) => form.set("usadoAnio", event.target.value)} />
          </FormField>
          <FormField label="Usado km">
            <Input value={values.usadoKm} onChange={(event) => form.set("usadoKm", event.target.value)} />
          </FormField>
          <FormField label="Precio de toma">
            <CurrencyInput value={values.usadoToma} onChange={(value) => form.set("usadoToma", value)} />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Financiacion y gastos">
        <FormGrid>
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
              <FormField label="Cantidad de cuotas">
                <Input value={values.cuotasCant} onChange={(event) => form.set("cuotasCant", event.target.value)} />
              </FormField>
            </>
          ) : null}
          <FormField label="Gastos administrativos">
            <CurrencyInput value={values.gastosAdm} onChange={(value) => form.set("gastosAdm", value)} />
          </FormField>
          <FormField label="Transferencia">
            <CurrencyInput value={values.transferencia} onChange={(value) => form.set("transferencia", value)} />
          </FormField>
        </FormGrid>
      </FormSection>

      <div className="flex justify-end">
        <Button onClick={() => generatePresupuestoPdf(values)}>Generar Resumen</Button>
      </div>
    </DocumentPage>
  );
}
