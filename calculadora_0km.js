const IVA_RATE = 0.21;

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const form = document.querySelector("#calculator-form");
const fields = {
  unidad: document.querySelector("#unidad"),
  valorAuto: document.querySelector("#valorAuto"),
  montoFinanciado: document.querySelector("#montoFinanciado"),
  porcentajeQuebranto: document.querySelector("#porcentajeQuebranto"),
  aplicaIva: document.querySelector("#aplicaIva"),
  plazo: document.querySelector("#plazo"),
  tna: document.querySelector("#tna"),
  campana: document.querySelector("#campana"),
  observaciones: document.querySelector("#observaciones"),
};

const output = {
  totalInicial: document.querySelector("#totalInicial"),
  cuotaEstimada: document.querySelector("#resumenCuotaEstimada"),
  unidad: document.querySelector("#resumenUnidad"),
  valorAuto: document.querySelector("#resumenValorAuto"),
  montoFinanciado: document.querySelector("#resumenMontoFinanciado"),
  entrega: document.querySelector("#resumenEntrega"),
  porcentaje: document.querySelector("#resumenPorcentaje"),
  quebrantoNeto: document.querySelector("#resumenQuebrantoNeto"),
  ivaQuebranto: document.querySelector("#resumenIvaQuebranto"),
  quebrantoFinal: document.querySelector("#resumenQuebrantoFinal"),
  plazo: document.querySelector("#resumenPlazo"),
  tna: document.querySelector("#resumenTna"),
  campana: document.querySelector("#resumenCampana"),
  observaciones: document.querySelector("#resumenObservaciones"),
  copyPreview: document.querySelector("#copyPreview"),
  errorMessage: document.querySelector("#errorMessage"),
};

const clearButton = document.querySelector("#clearButton");
const copyButton = document.querySelector("#copyButton");

function toNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().replace(/\s+/g, "").replace(",", ".");
    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function extractNumericValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return toNumber(value);
  }

  const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? toNumber(match[0]) : 0;
}

function roundCurrency(value) {
  return Math.round(value);
}

function calculateOperation(values) {
  const valorAuto = toNumber(values.valorAuto);
  const montoFinanciado = toNumber(values.montoFinanciado);
  const porcentajeQuebranto = toNumber(values.porcentajeQuebranto);
  const plazoNumerico = extractNumericValue(values.plazo);
  const tnaNumerica = extractNumericValue(values.tna);

  const quebrantoNeto = roundCurrency(montoFinanciado * (porcentajeQuebranto / 100));
  const ivaQuebranto = values.aplicaIva ? roundCurrency(quebrantoNeto * IVA_RATE) : 0;
  const quebrantoFinal = quebrantoNeto + ivaQuebranto;
  const entrega = roundCurrency(valorAuto - montoFinanciado);
  const totalInicial = entrega + quebrantoFinal;
  const cuotaEstimada =
    montoFinanciado > 0 && plazoNumerico > 0
      ? roundCurrency(
          montoFinanciado / plazoNumerico +
            (montoFinanciado * (tnaNumerica / 100)) / plazoNumerico
        )
      : null;

  return {
    valorAuto,
    montoFinanciado,
    porcentajeQuebranto,
    aplicaIva: values.aplicaIva,
    plazoNumerico,
    tnaNumerica,
    entrega,
    quebrantoNeto,
    ivaQuebranto,
    quebrantoFinal,
    totalInicial,
    cuotaEstimada,
  };
}

function formatCurrency(value) {
  return currencyFormatter.format(toNumber(value)).replace(/\$\s+/u, "$");
}

function formatPercentage(value) {
  const numericValue = toNumber(value);
  const formatted = Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted}%`;
}

function getFormValues() {
  return {
    unidad: fields.unidad.value.trim(),
    valorAuto: fields.valorAuto.value,
    montoFinanciado: fields.montoFinanciado.value,
    porcentajeQuebranto: fields.porcentajeQuebranto.value,
    aplicaIva: fields.aplicaIva.checked,
    plazo: fields.plazo.value.trim(),
    tna: fields.tna.value.trim(),
    campana: fields.campana.value.trim(),
    observaciones: fields.observaciones.value.trim(),
  };
}

function getValidationMessage(values) {
  const valorAuto = toNumber(values.valorAuto);
  const montoFinanciado = toNumber(values.montoFinanciado);

  if (montoFinanciado > valorAuto) {
    return "El monto financiado no puede superar el valor del auto.";
  }

  return "";
}

function buildCopyText(values, results) {
  const lines = [
    "OPERACION ESTIMADA",
    "",
    `Unidad: ${values.unidad || "-"}`,
    `Valor del vehiculo: ${formatCurrency(results.valorAuto)}`,
    `Monto financiado: ${formatCurrency(results.montoFinanciado)}`,
    `Entrega estimada: ${formatCurrency(results.entrega)}`,
    "",
    `Quebranto: ${formatPercentage(results.porcentajeQuebranto)}`,
    `Quebranto neto: ${formatCurrency(results.quebrantoNeto)}`,
    `IVA quebranto: ${formatCurrency(results.ivaQuebranto)}`,
    `Quebranto final: ${formatCurrency(results.quebrantoFinal)}`,
    "",
    `Total inicial estimado: ${formatCurrency(results.totalInicial)}`,
  ];

  if (results.cuotaEstimada !== null) {
    lines.push(`Cuota estimada: ${formatCurrency(results.cuotaEstimada)}`);
  }

  if (values.plazo) {
    lines.push("", `Plazo: ${values.plazo}`);
  }

  if (values.tna) {
    lines.push(`TNA: ${values.tna}`);
  }

  if (values.campana) {
    lines.push(`Campana: ${values.campana}`);
  }

  if (values.observaciones) {
    lines.push(`Observaciones: ${values.observaciones}`);
  }

  return lines.join("\n");
}

function render() {
  const values = getFormValues();
  const validationMessage = getValidationMessage(values);
  const results = calculateOperation(values);

  output.errorMessage.textContent = validationMessage;
  copyButton.disabled = Boolean(validationMessage);

  output.totalInicial.textContent = formatCurrency(results.totalInicial);
  output.cuotaEstimada.textContent =
    results.cuotaEstimada === null ? "-" : formatCurrency(results.cuotaEstimada);
  output.unidad.textContent = values.unidad || "-";
  output.valorAuto.textContent = formatCurrency(results.valorAuto);
  output.montoFinanciado.textContent = formatCurrency(results.montoFinanciado);
  output.entrega.textContent = formatCurrency(results.entrega);
  output.porcentaje.textContent = formatPercentage(results.porcentajeQuebranto);
  output.quebrantoNeto.textContent = formatCurrency(results.quebrantoNeto);
  output.ivaQuebranto.textContent = formatCurrency(results.ivaQuebranto);
  output.quebrantoFinal.textContent = formatCurrency(results.quebrantoFinal);
  output.plazo.textContent = values.plazo || "-";
  output.tna.textContent = values.tna || "-";
  output.campana.textContent = values.campana || "-";
  output.observaciones.textContent = values.observaciones || "-";
  output.copyPreview.textContent = buildCopyText(values, results);
}

async function copySummary() {
  const values = getFormValues();
  const validationMessage = getValidationMessage(values);

  if (validationMessage) {
    output.errorMessage.textContent = validationMessage;
    return;
  }

  const results = calculateOperation(values);
  const text = buildCopyText(values, results);

  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = "Resumen copiado";
    window.setTimeout(() => {
      copyButton.textContent = "Copiar resumen";
    }, 1800);
  } catch (error) {
    output.errorMessage.textContent =
      "No se pudo copiar el resumen automaticamente. Revisalo en la vista previa.";
  }
}

function clearForm() {
  form.reset();
  render();
}

form.addEventListener("input", render);
clearButton.addEventListener("click", clearForm);
copyButton.addEventListener("click", copySummary);

render();

window.credito0kmCalculator = {
  calculateOperation,
  buildCopyText,
  extractNumericValue,
  formatCurrency,
  formatPercentage,
};
