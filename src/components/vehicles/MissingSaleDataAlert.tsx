import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { getMissingSaleData, listVehiclesWithMissingSaleData, type MissingSaleField } from "@/lib/saleMissingData";
import { parseNumberish } from "@/lib/utils";
import { toVehicleInput } from "@/lib/vehicleInput";
import { updateVehicle } from "@/services/vehiclesService";
import type { Vehicle } from "@/types/vehicles";

function vehicleName(vehicle: Vehicle) {
  return [vehicle.brand, vehicle.model, vehicle.licensePlate && `· ${vehicle.licensePlate}`].filter(Boolean).join(" ") || "Auto";
}

type DraftValue = string;

function fieldToDraft(vehicle: Vehicle, field: MissingSaleField) {
  const value = vehicle[field.field];
  return value === null || value === undefined ? "" : String(value);
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: MissingSaleField;
  value: DraftValue;
  onChange: (value: string) => void;
}) {
  if (field.kind === "money") {
    return <CurrencyInput value={value} onChange={onChange} className="w-40" />;
  }
  if (field.kind === "date") {
    return <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-40" />;
  }
  if (field.kind === "number") {
    return (
      <Input
        type="number"
        min="1"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-28"
      />
    );
  }
  return <Input value={value} onChange={(event) => onChange(event.target.value)} className="w-48" />;
}

/**
 * Formulario compacto para completar, sin salir de la pantalla, los datos que
 * le faltan a una venta. Se usa tanto en la ficha del auto como en el
 * dashboard de Ventas.
 */
function InlineMissingSaleForm({
  vehicle,
  missing,
  onSaved,
}: {
  vehicle: Vehicle;
  missing: MissingSaleField[];
  onSaved: (vehicle: Vehicle) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>(() =>
    Object.fromEntries(missing.map((field) => [field.field, fieldToDraft(vehicle, field)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const input = toVehicleInput(vehicle);
      const target = input as unknown as Record<string, unknown>;
      for (const field of missing) {
        const raw = drafts[field.field]?.trim() ?? "";
        if (!raw) continue;
        if (field.kind === "number") target[field.field] = Number(raw);
        else if (field.kind === "money") target[field.field] = parseNumberish(raw);
        else target[field.field] = raw;
      }
      const updated = await updateVehicle(vehicle.id, input);
      onSaved(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-red-200 bg-white p-3">
      {missing.map((field) => (
        <label key={field.field} className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {field.label}
          <FieldInput
            field={field}
            value={drafts[field.field] ?? ""}
            onChange={(value) => setDrafts((current) => ({ ...current, [field.field]: value }))}
          />
        </label>
      ))}
      <Button onClick={() => void handleSave()} disabled={saving} className="h-9">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
        Guardar
      </Button>
      {error ? <p className="w-full text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

/** Aviso en rojo dentro de la ficha de un auto vendido con datos incompletos. */
export function VehicleMissingSaleData({ vehicle: initialVehicle }: { vehicle: Vehicle }) {
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [editing, setEditing] = useState(false);
  const missing = getMissingSaleData(vehicle);
  if (!missing.length) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Faltan datos de la venta</p>
            <ul className="mt-1 space-y-0.5">
              {missing.map((field) => (
                <li key={field.field}>
                  {field.label}
                  {field.impact ? <span className="text-red-700"> ({field.impact})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {!editing ? (
          <Button
            variant="outline"
            className="border-red-300 bg-white text-red-700 hover:bg-red-100"
            onClick={() => setEditing(true)}
          >
            Completar datos
          </Button>
        ) : null}
      </div>
      {editing ? (
        <InlineMissingSaleForm
          vehicle={vehicle}
          missing={missing}
          onSaved={(updated) => {
            setVehicle(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MissingSaleRow({
  vehicle: initialVehicle,
  onResolved,
}: {
  vehicle: Vehicle;
  onResolved: (vehicle: Vehicle) => void;
}) {
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [editing, setEditing] = useState(false);
  const missing = getMissingSaleData(vehicle);

  if (!missing.length) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">
          {vehicleName(vehicle)}
          {vehicle.buyerName ? <span className="font-normal text-slate-500"> · {vehicle.buyerName}</span> : null}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-red-700">Falta: {missing.map((field) => field.label.toLowerCase()).join(", ")}</span>
          {!editing ? (
            <>
              <Button variant="outline" className="h-8 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setEditing(true)}>
                Completar
              </Button>
              <Link to={`/autos/${vehicle.id}/editar`} className="text-xs font-medium text-slate-500 underline underline-offset-2">
                Ver auto
              </Link>
            </>
          ) : null}
        </div>
      </div>
      {editing ? (
        <InlineMissingSaleForm
          vehicle={vehicle}
          missing={missing}
          onSaved={(updated) => {
            setVehicle(updated);
            setEditing(false);
            onResolved(updated);
          }}
        />
      ) : null}
    </div>
  );
}

/** Lista en rojo de todas las ventas con datos faltantes (dashboard de Ventas). */
export function MissingSaleDataList({ vehicles }: { vehicles: Vehicle[] }) {
  const [overrides, setOverrides] = useState<Record<string, Vehicle>>({});
  const items = listVehiclesWithMissingSaleData(vehicles.map((vehicle) => overrides[vehicle.id] ?? vehicle));
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-red-800">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h2 className="text-lg font-semibold">
          {items.length === 1 ? "1 venta con datos faltantes" : `${items.length} ventas con datos faltantes`}
        </h2>
      </div>
      <p className="mt-1 text-sm text-red-700">Completalos para que la venta entre a postventa y a los seguimientos de credito.</p>
      <div className="mt-4 space-y-2">
        {items.map(({ vehicle }) => (
          <MissingSaleRow
            key={vehicle.id}
            vehicle={vehicle}
            onResolved={(updated) => setOverrides((current) => ({ ...current, [updated.id]: updated }))}
          />
        ))}
      </div>
    </div>
  );
}
