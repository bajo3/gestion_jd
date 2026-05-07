import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { useObjectState } from "@/hooks/useObjectState";
import { formatCurrency, parseNumberish } from "@/lib/utils";
import type { Calculadora0kmValues } from "@/types/forms";

const initialState: Calculadora0kmValues = {
  valorAuto: "",
  montoFinanciado: "",
  porcentajeQuebranto: "",
  aplicaIva: false,
  plazo: "",
  tna: "",
  campana: "",
};

const IVA_RATE = 0.21;

function extractNumericValue(value: string) {
  const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export function Calculadora0kmPage() {
  const [values, form] = useObjectState(initialState);

  const result = useMemo(() => {
    const valorAuto = parseNumberish(values.valorAuto);
    const montoFinanciado = parseNumberish(values.montoFinanciado);
    const porcentajeQuebranto = parseNumberish(values.porcentajeQuebranto);
    const plazo = extractNumericValue(values.plazo);
    const tna = extractNumericValue(values.tna);

    const quebrantoNeto = Math.round(montoFinanciado * (porcentajeQuebranto / 100));
    const ivaQuebranto = values.aplicaIva ? Math.round(quebrantoNeto * IVA_RATE) : 0;
    const quebrantoFinal = quebrantoNeto + ivaQuebranto;
    const entrega = Math.round(valorAuto - montoFinanciado);
    const totalInicial = entrega + quebrantoFinal;
    const cuotaEstimada =
      montoFinanciado > 0 && plazo > 0
        ? Math.round(montoFinanciado / plazo + (montoFinanciado * (tna / 100)) / plazo)
        : null;

    const copyText = [
      "OPERACION ESTIMADA",
      "",
      `Valor del vehiculo: ${formatCurrency(valorAuto)}`,
      `Monto financiado: ${formatCurrency(montoFinanciado)}`,
      `Entrega estimada: ${formatCurrency(entrega)}`,
      "",
      `Quebranto: ${porcentajeQuebranto}%`,
      `Quebranto neto: ${formatCurrency(quebrantoNeto)}`,
      `IVA quebranto: ${formatCurrency(ivaQuebranto)}`,
      `Quebranto final: ${formatCurrency(quebrantoFinal)}`,
      "",
      `Total inicial estimado: ${formatCurrency(totalInicial)}`,
      cuotaEstimada ? `Cuota estimada: ${formatCurrency(cuotaEstimada)}` : "",
      values.plazo ? `Plazo: ${values.plazo}` : "",
      values.tna ? `TNA: ${values.tna}` : "",
      values.campana ? `Campana: ${values.campana}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      valorAuto,
      montoFinanciado,
      porcentajeQuebranto,
      quebrantoNeto,
      ivaQuebranto,
      quebrantoFinal,
      entrega,
      totalInicial,
      cuotaEstimada,
      copyText,
    };
  }, [values]);

  const accountRows = [
    ["Valor del auto", formatCurrency(result.valorAuto)],
    ["Monto financiado", `- ${formatCurrency(result.montoFinanciado)}`],
    ["Entrega", `= ${formatCurrency(result.entrega)}`],
    ["Quebranto neto", `+ ${formatCurrency(result.quebrantoNeto)}`],
    ["IVA quebranto", `+ ${formatCurrency(result.ivaQuebranto)}`],
    ["Quebranto final", `= ${formatCurrency(result.quebrantoFinal)}`],
    ["Total inicial", `= ${formatCurrency(result.totalInicial)}`],
  ];

  const summaryRows = [
    ["Cuota estimada", result.cuotaEstimada ? formatCurrency(result.cuotaEstimada) : "-"],
    ["Plazo", values.plazo || "-"],
    ["TNA", values.tna || "-"],
    ["Campana", values.campana || "-"],
    ["Quebranto %", `${result.porcentajeQuebranto}%`],
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff0a8a]">Credito 0 km</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Calculadora de quebranto</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Simplificada para cargar solo los datos necesarios y con una cuenta visible para entender el resultado.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="order-2 xl:order-1">
          <Card>
            <CardContent className="space-y-6">
              <Card className="border-blue-200 bg-blue-50 xl:hidden">
                <CardContent className="space-y-4 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Vista rapida</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Mientras cargas los importes, aca ves la cuenta armada paso a paso.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Total inicial</p>
                    <p className="mt-2 text-3xl font-black">{formatCurrency(result.totalInicial)}</p>
                  </div>
                  <div className="grid gap-2">
                    {accountRows.map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-sm"
                      >
                        <span className="text-slate-500">{label}</span>
                        <strong className="text-right text-slate-900">{value}</strong>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Valor del auto">
                  <CurrencyInput value={values.valorAuto} onChange={(value) => form.set("valorAuto", value)} />
                </FormField>
                <FormField label="Monto a financiar">
                  <CurrencyInput value={values.montoFinanciado} onChange={(value) => form.set("montoFinanciado", value)} />
                </FormField>
                <FormField label="% de quebranto">
                  <Input value={values.porcentajeQuebranto} onChange={(event) => form.set("porcentajeQuebranto", event.target.value)} />
                </FormField>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <Checkbox checked={values.aplicaIva} onChange={(event) => form.set("aplicaIva", event.target.checked)} />
                  Aplicar IVA al quebranto
                </label>
                <FormField label="Plazo">
                  <Input value={values.plazo} onChange={(event) => form.set("plazo", event.target.value)} />
                </FormField>
                <FormField label="TNA">
                  <Input value={values.tna} onChange={(event) => form.set("tna", event.target.value)} />
                </FormField>
                <FormField label="Campana" className="md:col-span-2">
                  <Input value={values.campana} onChange={(event) => form.set("campana", event.target.value)} />
                </FormField>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => form.replace(initialState)}>
                  Limpiar
                </Button>
                <Button onClick={() => navigator.clipboard.writeText(result.copyText)}>Copiar resumen</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="order-1 hidden space-y-4 xl:order-2 xl:block">
          <Card className="bg-slate-950 text-white">
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-300">Total inicial estimado</p>
              <p className="text-4xl font-black">{formatCurrency(result.totalInicial)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Cuenta</p>
                <p className="mt-1 text-sm text-slate-500">
                  Asi se arma el resultado para que siempre veas que estas cargando.
                </p>
              </div>
              <div className="grid gap-3">
                {accountRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                    <span className="text-slate-500">{label}</span>
                    <strong className="text-slate-900">{value}</strong>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="mb-3 text-sm font-semibold text-slate-900">Datos complementarios</p>
                <div className="grid gap-3">
                  {summaryRows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-slate-500">{label}</span>
                      <strong className="text-slate-900">{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
