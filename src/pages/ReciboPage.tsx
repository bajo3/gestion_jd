import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { FormField } from "@/components/shared/FormField";
import { useObjectState } from "@/hooks/useObjectState";
import { parseNumberish } from "@/lib/utils";
import { amountToLetters, generateReciboPdf } from "@/pdf/reciboPdf";
import { commitReceiptNumber, getNextReceiptNumber } from "@/services/receiptCounterService";
import type { ReciboFormValues } from "@/types/forms";
import { DocumentPage, FormGrid, FormSection } from "./documentUtils";

const today = new Date();

const initialState: ReciboFormValues = {
  reciboNro: getNextReceiptNumber(),
  fecha: today.toISOString().slice(0, 10),
  tipo: "SEÑA",
  duplicado: "si",
  cliente: "",
  doc: "",
  domicilio: "",
  localidad: "",
  concepto: "",
  monto: "",
  montoLetras: "",
  forma: "Efectivo",
  detallePago: "",
  vehiculo: "",
  vehiculoDominio: "",
  obs: "",
};

export function ReciboPage() {
  const [values, form] = useObjectState(initialState);

  useEffect(() => {
    const amount = parseNumberish(values.monto);
    if (!Number.isNaN(amount)) {
      form.set("montoLetras", amountToLetters(amount));
    }
  }, [form, values.monto]);

  return (
    <DocumentPage title="Recibo" description="Recibo de seña o pago con correlativo local y opcion de duplicado.">
      <FormSection title="Datos del recibo">
        <FormGrid columns="md:grid-cols-2 xl:grid-cols-4">
          <FormField label="N° de recibo">
            <Input value={values.reciboNro} readOnly />
          </FormField>
          <FormField label="Fecha">
            <Input type="date" value={values.fecha} onChange={(event) => form.set("fecha", event.target.value)} />
          </FormField>
          <FormField label="Tipo">
            <Select value={values.tipo} onChange={(event) => form.set("tipo", event.target.value)}>
              <option value="SEÑA">Seña</option>
              <option value="PAGO TOTAL">Pago total</option>
              <option value="PAGO">Pago</option>
            </Select>
          </FormField>
          <FormField label="Duplicado">
            <Select value={values.duplicado} onChange={(event) => form.set("duplicado", event.target.value as "si" | "no")}>
              <option value="si">Si</option>
              <option value="no">No</option>
            </Select>
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Quien paga">
        <FormGrid>
          <FormField label="Apellido y nombre / Razon social">
            <Input value={values.cliente} onChange={(event) => form.set("cliente", event.target.value)} />
          </FormField>
          <FormField label="DNI / CUIT">
            <Input value={values.doc} onChange={(event) => form.set("doc", event.target.value)} />
          </FormField>
          <FormField label="Domicilio">
            <Input value={values.domicilio} onChange={(event) => form.set("domicilio", event.target.value)} />
          </FormField>
          <FormField label="Localidad / Provincia">
            <Input value={values.localidad} onChange={(event) => form.set("localidad", event.target.value)} />
          </FormField>
        </FormGrid>
        <FormField label="Concepto / detalle">
          <Textarea value={values.concepto} onChange={(event) => form.set("concepto", event.target.value)} />
        </FormField>
      </FormSection>

      <FormSection title="Importe y vehiculo">
        <FormGrid>
          <FormField label="Monto (ARS)">
            <CurrencyInput value={values.monto} onChange={(value) => form.set("monto", value)} />
          </FormField>
          <FormField label="En letras">
            <Input value={values.montoLetras} onChange={(event) => form.set("montoLetras", event.target.value)} />
          </FormField>
          <FormField label="Forma de pago">
            <Select value={values.forma} onChange={(event) => form.set("forma", event.target.value)}>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta</option>
              <option>Deposito</option>
              <option>Otro</option>
            </Select>
          </FormField>
          <FormField label="Detalle del pago">
            <Input value={values.detallePago} onChange={(event) => form.set("detallePago", event.target.value)} />
          </FormField>
          <FormField label="Marca y modelo">
            <Input value={values.vehiculo} onChange={(event) => form.set("vehiculo", event.target.value)} />
          </FormField>
          <FormField label="Dominio">
            <Input value={values.vehiculoDominio} onChange={(event) => form.set("vehiculoDominio", event.target.value.toUpperCase())} />
          </FormField>
        </FormGrid>
        <FormField label="Observaciones">
          <Textarea value={values.obs} onChange={(event) => form.set("obs", event.target.value)} />
        </FormField>
      </FormSection>

      <div className="flex flex-wrap justify-end gap-3">
        <Button
          onClick={async () => {
            await generateReciboPdf(values);
            form.set("reciboNro", commitReceiptNumber());
          }}
        >
          Generar Resumen
        </Button>
      </div>
    </DocumentPage>
  );
}
