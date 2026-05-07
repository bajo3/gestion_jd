import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/FormField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { useObjectState } from "@/hooks/useObjectState";
import { generateDateroPdf } from "@/pdf/dateroPdf";
import type { DateroFormValues } from "@/types/forms";
import { DocumentPage, FormGrid, FormSection } from "./documentUtils";

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

  return (
    <DocumentPage title="Datero" description="Formulario para transferencia con datos del comprador, operacion y auto entregado.">
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

      <div className="flex justify-end">
        <Button onClick={() => generateDateroPdf(values)}>Generar Resumen</Button>
      </div>
    </DocumentPage>
  );
}
