import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clipboard, Download, ExternalLink, Save, ShieldCheck } from "lucide-react";
import { FormField } from "@/components/shared/FormField";
import { FormGrid, FormSection } from "@/pages/documentUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { useObjectState } from "@/hooks/useObjectState";
import { getVehicleById, listVehicles } from "@/services/vehiclesService";
import {
  getPoliceVerificationByVehicle,
  savePoliceVerification,
} from "@/services/policeVerificationService";
import {
  buildPoliceVerificationPortalPayload,
  createPoliceVerificationDraft,
  POLICE_VERIFICATION_PORTAL_URL,
  type PoliceVerification,
} from "@/types/policeVerification";
import type { Vehicle } from "@/types/vehicles";

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setValue<K extends keyof PoliceVerification>(
  values: PoliceVerification,
  key: K,
  value: PoliceVerification[K],
  form: ReturnType<typeof useObjectState<PoliceVerification>>[1],
) {
  form.set(key, value);
}

export function PoliceVerificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedVehicleId = searchParams.get("vehicleId") ?? "";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [values, form] = useObjectState<PoliceVerification>({} as PoliceVerification);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([listVehicles(), requestedVehicleId ? getVehicleById(requestedVehicleId) : Promise.resolve(null)])
      .then(([allVehicles, selected]) => {
        if (!active) return;
        setVehicles(allVehicles);
        const nextVehicle = selected ?? allVehicles[0] ?? null;
        setVehicle(nextVehicle);
        if (!nextVehicle) return;
        getPoliceVerificationByVehicle(nextVehicle.id).then((saved) => {
          if (!active) return;
          form.replace(createPoliceVerificationDraft(nextVehicle, saved ?? undefined));
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));

    return () => {
      active = false;
    };
  }, [form, requestedVehicleId]);

  const payload = useMemo(
    () => (vehicle && values.vehicleId ? buildPoliceVerificationPortalPayload(values) : null),
    [values, vehicle],
  );

  const chooseVehicle = async (vehicleId: string) => {
    const nextVehicle = await getVehicleById(vehicleId);
    if (!nextVehicle) return;
    setVehicle(nextVehicle);
    setSearchParams({ vehicleId: nextVehicle.id });
    const saved = await getPoliceVerificationByVehicle(nextVehicle.id);
    form.replace(createPoliceVerificationDraft(nextVehicle, saved ?? undefined));
    setMessage("");
  };

  const save = async (status: "borrador" | "preparada") => {
    if (!vehicle || !values.vehicleId) return;
    const result = await savePoliceVerification({ ...values, status, preparedAt: status === "preparada" ? new Date().toISOString() : values.preparedAt });
    form.replace(result.value);
    setMessage(result.persisted ? "Guardado en Gestion JD y Supabase." : "Guardado en este navegador. Aplicá la migración para sincronizarlo en Supabase.");
  };

  const prepare = async () => {
    await save("preparada");
    if (!payload) return;
    const nextPayload = buildPoliceVerificationPortalPayload({ ...values, status: "preparada" });
    await navigator.clipboard?.writeText(JSON.stringify(nextPayload, null, 2));
    downloadJson(`verificacion-policial-${values.domain || "sin-dominio"}.json`, nextPayload);
    setMessage("Precarga exportada y copiada. El puente local puede usar este JSON.");
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Cargando verificaciones...</div>;

  if (!vehicle || !values.vehicleId) {
    return (
      <Card><CardContent className="space-y-4"><h1 className="text-2xl font-bold text-slate-950">Verificacion policial</h1><p className="text-sm text-slate-600">Primero cargá un auto en Historial de Autos.</p><Link to="/autos"><Button>Ir a Historial de Autos</Button></Link></CardContent></Card>
    );
  }

  const field = <K extends keyof PoliceVerification>(key: K, label: string, hint?: string) => (
    <FormField label={label} hint={hint}>
      <Input value={String(values[key] ?? "")} onChange={(event) => setValue(values, key, event.target.value as PoliceVerification[K], form)} />
    </FormField>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion JD"
        title="Verificacion policial"
        description="Prepará los datos del auto para el portal de Verificación Policial. El CAPTCHA, el turno y el pago quedan bajo control del operador."
        actions={<a href={POLICE_VERIFICATION_PORTAL_URL} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Abrir portal</Button></a>}
      />

      <Card className="border-amber-200 bg-amber-50"><CardContent className="flex gap-3 text-sm text-amber-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>La automatizacion solo completa la carga de datos. No resuelve CAPTCHA, no elige turnos y no confirma pagos.</p></CardContent></Card>

      <FormSection title="Auto asociado" description="Los datos existentes se usan como punto de partida; revisalos antes de exportar.">
        <FormGrid>
          <FormField label="Auto">
            <Select value={vehicle.id} onChange={(event) => void chooseVehicle(event.target.value)}>
              {vehicles.map((item) => <option key={item.id} value={item.id}>{[item.licensePlate, item.brand, item.model].filter(Boolean).join(" · ") || item.id}</option>)}
            </Select>
          </FormField>
          {field("domain", "Dominio / patente", "Se carga también en la confirmacion final.")}
          <FormField label="Ejemplar de placa">
            <Select value={values.plateCopy} onChange={(event) => setValue(values, "plateCopy", event.target.value, form)}>
              <option value="1">Original</option><option value="2">Duplicado</option><option value="3">Triplicado</option><option value="4">Cuadruplicado</option><option value="5">Quintuplicado</option><option value="6">Sextuplicado</option><option value="7">Sin dominio</option>
            </Select>
          </FormField>
          {field("brand", "Marca")}
          {field("model", "Modelo")}
          {field("vehicleType", "Tipo de vehiculo", "Ejemplo: AUTOMOVIL")}
          {field("motorBrand", "Marca del motor")}
          {field("motorNumber", "Numero del motor")}
          {field("chassisBrand", "Marca del chasis")}
          {field("chassisNumber", "Numero de chasis")}
          <FormField label="Categoria">
            <Select value={values.category} onChange={(event) => setValue(values, "category", event.target.value, form)}><option value="1">Automovil</option><option value="3">Camion</option><option value="2">Motovehiculo</option></Select>
          </FormField>
        </FormGrid>
      </FormSection>

      <FormSection title="Titular actual" description="Estos datos no se inventan desde el comprador: completalos con la documentación del titular.">
        <FormGrid>
          {field("ownerName", "Apellido y nombre")}
          <FormField label="Tipo de persona"><Select value={values.ownerPersonType} onChange={(event) => setValue(values, "ownerPersonType", event.target.value as PoliceVerification["ownerPersonType"], form)}><option value="FISICA">Fisica</option><option value="JURIDICA">Juridica</option></Select></FormField>
          <FormField label="Tipo de documento"><Select value={values.ownerDocumentType} onChange={(event) => setValue(values, "ownerDocumentType", event.target.value as PoliceVerification["ownerDocumentType"], form)}><option value="DNI">DNI</option><option value="CUIT">CUIT</option><option value="PASAPORTE">Pasaporte</option></Select></FormField>
          {field("ownerDocument", "Numero de documento")}
          {field("ownerStreet", "Calle")}{field("ownerNumber", "Numero")}{field("ownerFloor", "Piso")}{field("ownerApartment", "Departamento")}{field("ownerPostalCode", "Codigo postal")}{field("ownerLocality", "Localidad")}{field("ownerProvince", "Provincia")}
        </FormGrid>
      </FormSection>

      <FormSection title="Persona que concurre" description="Si no concurre el titular, el puente completa el bloque de presentante con estos datos.">
        <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="radio" checked={values.presenterIsOwner} onChange={() => setValue(values, "presenterIsOwner", true, form)} />Concurre el titular</label>
          <label className="flex items-center gap-2"><input type="radio" checked={!values.presenterIsOwner} onChange={() => setValue(values, "presenterIsOwner", false, form)} />Concurre otra persona</label>
        </div>
        {!values.presenterIsOwner ? <FormGrid>{field("presenterName", "Apellido y nombre")}{<FormField label="Tipo de documento"><Select value={values.presenterDocumentType} onChange={(event) => setValue(values, "presenterDocumentType", event.target.value as PoliceVerification["presenterDocumentType"], form)}><option value="DNI">DNI</option><option value="CUIT">CUIT</option><option value="PASAPORTE">Pasaporte</option></Select></FormField>}{field("presenterDocument", "Numero de documento")}{field("presenterStreet", "Calle")}{field("presenterNumber", "Numero")}{field("presenterFloor", "Piso")}{field("presenterApartment", "Departamento")}{field("presenterPostalCode", "Codigo postal")}{field("presenterLocality", "Localidad")}{field("presenterProvince", "Provincia")}</FormGrid> : null}
      </FormSection>

      <FormSection title="Contacto">
        <FormGrid>{field("contactEmail", "E-mail")}{field("contactEmailRepeat", "Repetir e-mail")}{field("phoneArea", "Codigo de area")}{field("phoneNumber", "Telefono")}{field("notes", "Notas internas")}</FormGrid>
      </FormSection>

      <Card><CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-950">Acciones de precarga</p><p className="mt-1 text-sm text-slate-500">Guardá el borrador o exportá un JSON para el puente local de Chrome.</p>{message ? <p className="mt-2 text-sm font-medium text-emerald-700">{message}</p> : null}</div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void save("borrador")}><Save className="mr-2 h-4 w-4" />Guardar borrador</Button><Button variant="outline" onClick={() => payload && navigator.clipboard?.writeText(JSON.stringify(payload, null, 2))}><Clipboard className="mr-2 h-4 w-4" />Copiar JSON</Button><Button onClick={() => void prepare()}><Download className="mr-2 h-4 w-4" />Preparar precarga</Button></div></CardContent></Card>
    </div>
  );
}
