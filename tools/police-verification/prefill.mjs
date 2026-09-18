import fs from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";

const DEFAULT_PORTAL_URL = "https://vpa.mseg.gba.gov.ar/inicio_de_tramite.html";
const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Uso: npm run police:prefill -- ruta/al/archivo-verificacion-policial.json");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
} catch {
  console.error(`No pude leer el JSON de precarga: ${inputPath}`);
  process.exit(1);
}
const fields = payload.fields ?? {};
const cdpUrl = process.env.VPA_CDP_URL ?? "http://127.0.0.1:9222";
const provinceValues = new Map([
  ["BUENOS AIRES", "1"],
  ["CIUDAD AUTÓNOMA DE BUENOS AIRES", "2"],
  ["CATAMARCA", "3"],
  ["CÓRDOBA", "4"],
  ["CORRIENTES", "5"],
  ["CHACO", "6"],
  ["CHUBUT", "7"],
  ["ENTRE RÍOS", "8"],
  ["FORMOSA", "9"],
  ["JUJUY", "10"],
  ["LA PAMPA", "11"],
  ["LA RIOJA", "12"],
  ["MENDOZA", "13"],
  ["MISIONES", "14"],
  ["NEUQUÉN", "15"],
  ["RÍO NEGRO", "16"],
  ["SALTA", "17"],
  ["SAN JUAN", "18"],
  ["SAN LUIS", "19"],
  ["SANTA CRUZ", "20"],
  ["SANTA FE", "21"],
  ["SANTIAGO DEL ESTERO", "22"],
  ["TIERRA DEL FUEGO", "23"],
  ["TUCUMÁN", "24"],
]);

let browser;
try {
  browser = await chromium.connectOverCDP(cdpUrl);
} catch {
  console.error(`No pude conectar con Chrome en ${cdpUrl}. Abrilo con depuracion remota en el puerto 9222.`);
  process.exit(1);
}

const context = browser.contexts()[0] ?? (await browser.newContext());
const pages = context.pages();
const page = pages.find((item) => item.url().includes("vpa.mseg.gba.gov.ar")) ?? (await context.newPage());

await page.goto(payload.portalUrl ?? DEFAULT_PORTAL_URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);

const frame = page.frames().find((item) => item.url().includes("pagoverificacion.sivef.com.ar"));
if (!frame) {
  throw new Error("No encontré el formulario embebido de Verificación Policial.");
}

await frame.locator("#nuevotramite").click();
await frame.getByRole("button", { name: "Automóviles con dominio" }).click();
await frame.locator("#dominio").waitFor();

async function chooseSelect2(id, text) {
  if (!text) return;
  const select = frame.locator(`#${id}`);
  await select.waitFor();
  await frame.locator(`#select2-${id}-container`).click();
  const search = frame.locator(".select2-container--open .select2-search__field");
  await search.fill(text);
  await frame.waitForTimeout(900);
  const option = frame.locator(".select2-results__option").filter({ hasText: text }).first();
  if (!(await option.count())) {
    throw new Error(`No encontré ${text} en ${id}. Revisá la marca/modelo en el portal.`);
  }
  await option.click();
}

await chooseSelect2("cmb-marca", fields.marca);
await frame.waitForTimeout(700);
await chooseSelect2("cmb-modelo", fields.modelo);
await frame.locator(payload.presenterIsOwner === false ? "#check-no" : "#check-si").check({ force: true });

await frame.evaluate((values) => {
  for (const [name, value] of Object.entries(values)) {
    const element = document.querySelector(`[name="${CSS.escape(name)}"]`) ?? document.getElementById(name);
    if (!element || name === "cmb-marca" || name === "cmb-modelo") continue;
    const rawValue = String(value ?? "");
    const nextValue = name.endsWith("provincia")
      ? provinceValues.get(rawValue.trim().toUpperCase()) ?? rawValue
      : rawValue;
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      element.value = nextValue;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}, fields);

// El flujo deja el formulario listo para que el operador revise y avance.
// No se pulsa el botón que activa CAPTCHA, selección de turno o pago.
await page.bringToFront();
console.log("Datos cargados en el portal. Revisá la pantalla y continuá manualmente desde Siguiente.");
console.log("CAPTCHA, turno y pago no son automatizados por este puente.");
