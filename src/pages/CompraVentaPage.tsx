import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/FormField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { useObjectState } from "@/hooks/useObjectState";
import { generateCompraVentaPdf } from "@/pdf/compraVentaPdf";
import type { CompraVentaFormValues } from "@/types/forms";
import { DocumentPage, FormGrid, FormSection } from "./documentUtils";

const initialState: CompraVentaFormValues = {
  fecha: "",
  recibido: "",
  numeroDoc: "",
  telefono: "",
  domicilio: "",
  cantidadNum: "",
  dominio: "",
  marca: "",
  modelo: "",
  tipo: "",
  nMotor: "",
  nChasis: "",
  observaciones: "",
};

export function CompraVentaPage() {
  const [values, form] = useObjectState(initialState);

  return (
    <DocumentPage title="Compra y Venta" description="Boleto de compra venta migrado desde la version original.">
      <FormSection title="Datos del comprador">
        <FormGrid>
          <FormField label="Fecha">
            <Input type="date" value={values.fecha} onChange={(event) => form.set("fecha", event.target.value)} />
          </FormField>
          <FormField label="Nombre y apellido">
            <Input value={values.recibido} onChange={(event) => form.set("recibido", event.target.value)} />
          </FormField>
          <FormField label="DNI">
            <Input value={values.numeroDoc} onChange={(event) => form.set("numeroDoc", event.target.value)} />
          </FormField>
          <FormField label="Telefono">
            <Input value={values.telefono} onChange={(event) => form.set("telefono", event.target.value)} />
          </FormField>
          <FormField label="Domicilio" className="xl:col-span-2">
            <Input value={values.domicilio} onChange={(event) => form.set("domicilio", event.target.value)} />
          </FormField>
          <FormField label="Son $" className="xl:col-span-1">
            <CurrencyInput value={values.cantidadNum} onChange={(value) => form.set("cantidadNum", value)} />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Datos del automotor">
        <FormGrid>
          <FormField label="Dominio">
            <Input value={values.dominio} onChange={(event) => form.set("dominio", event.target.value.toUpperCase())} />
          </FormField>
          <FormField label="Marca">
            <Input value={values.marca} onChange={(event) => form.set("marca", event.target.value)} />
          </FormField>
          <FormField label="Modelo">
            <Input value={values.modelo} onChange={(event) => form.set("modelo", event.target.value)} />
          </FormField>
          <FormField label="Tipo">
            <Input value={values.tipo} onChange={(event) => form.set("tipo", event.target.value)} />
          </FormField>
          <FormField label="N° Motor">
            <Input value={values.nMotor} onChange={(event) => form.set("nMotor", event.target.value)} />
          </FormField>
          <FormField label="N° Chasis">
            <Input value={values.nChasis} onChange={(event) => form.set("nChasis", event.target.value)} />
          </FormField>
        </FormGrid>
        <FormField label="Observaciones">
          <Textarea value={values.observaciones} onChange={(event) => form.set("observaciones", event.target.value)} />
        </FormField>
      </FormSection>

      <div className="flex justify-end">
        <Button onClick={() => generateCompraVentaPdf(values)}>Generar Resumen</Button>
      </div>
    </DocumentPage>
  );
}
